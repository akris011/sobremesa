// Browser-only: reads a photo or PDF on the phone, so the file never has to be
// uploaded. PDFs with real text use that text; photos and scanned PDFs go
// through Tesseract OCR (free, runs in a web worker). Both libraries load only
// when someone imports a file.

export type Progress = (message: string) => void;
export type FileText = { text: string; unread: string[] };

const OCR_LONG_EDGE = 2000; // px; enough for cookbook type, small enough for a phone
const MAX_PDF_PAGES = 8;
const MAX_SCANNED_PAGES = 4;
const LOW_CONFIDENCE = 55;

export async function readRecipeFile(file: File, progress: Progress): Promise<FileText> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return readPdf(file, progress);
  if (file.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp)$/i.test(file.name)) {
    progress("Opening the photo…");
    const canvas = await imageToCanvas(file);
    return ocr([canvas], progress);
  }
  throw new Error("Choose a photo or a PDF.");
}

async function readPdf(file: File, progress: Progress): Promise<FileText> {
  progress("Opening the PDF…");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // The legacy build supports older iOS Safari. Its worker comes from the same
  // pinned version on the CDN that serves Tesseract's files.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise.catch(() => {
      throw new Error("That PDF wouldn't open. If it has a password, remove it first.");
    });
    const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
    let text = "";
    for (let n = 1; n <= pages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str + (item.hasEOL ? "\n" : "");
      }
      text += "\n\n";
    }
    if (text.replace(/\s/g, "").length > 40) return { text, unread: [] };

    // No text layer: a scan or a photo saved as PDF. Render the pages and read them.
    const canvases: HTMLCanvasElement[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_SCANNED_PAGES); n++) {
      progress(`Preparing page ${n}…`);
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: OCR_LONG_EDGE / Math.max(base.width, base.height) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      canvases.push(canvas);
    }
    return ocr(canvases, progress);
  } finally {
    void task.destroy();
  }
}

/** Draw the photo on a canvas, scaled down so OCR is quick on a phone. Honors EXIF rotation. */
async function imageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error("This phone can't open that photo. Try a JPEG or PNG.");
    });
    const scale = Math.min(1, OCR_LONG_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function ocr(canvases: HTMLCanvasElement[], progress: Progress): Promise<FileText> {
  progress("Getting the reader ready (the first time takes a moment)…");
  const { createWorker } = await import("tesseract.js");
  let page = 0;
  const worker = await createWorker(["eng", "spa"], 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        const pct = Math.round(m.progress * 100);
        progress(canvases.length > 1 ? `Reading page ${page} of ${canvases.length}… ${pct}%` : `Reading the page… ${pct}%`);
      }
    },
  });
  try {
    let text = "";
    const unread = new Set<string>();
    for (const canvas of canvases) {
      page++;
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      text += data.text + "\n\n";
      for (const block of data.blocks ?? [])
        for (const para of block.paragraphs)
          for (const line of para.lines)
            for (const word of line.words) {
              const w = word.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
              if (w.length > 1 && word.confidence < LOW_CONFIDENCE) unread.add(w);
            }
    }
    return { text, unread: [...unread].slice(0, 30) };
  } finally {
    void worker.terminate();
  }
}
