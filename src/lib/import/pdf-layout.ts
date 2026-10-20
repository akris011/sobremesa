import type { PDFDocumentProxy } from "pdfjs-dist";
import { parseServings, type RecipeDraft } from "./draft.ts";
import { clean, looksLikeIngredient, PAGE_FURNITURE, parseRecipeText, sectionOf } from "./text.ts";

/** One run of text on a PDF page. y is PDF space (grows upward); height is about the font size. */
export type PdfTextItem = { page: number; str: string; x: number; y: number; width: number; height: number; bold: boolean };

const MAX_PAGES = 8;

/**
 * Pull positioned text out of an open pdf.js document (browser, or Node with the
 * legacy build), plus the links it contains, the page's own URL first.
 *
 * Bold comes from the font's name ("…-Bold", "…-Med" vs "…-Book"), compared with
 * the body font. pdf.js only reports font names when the document was opened
 * with `getDocument({ …, fontExtraProperties: true })`; without it nothing is bold
 * and the parser leans on capitals, labels and spacing instead.
 */
export async function extractPdfItems(doc: PDFDocumentProxy): Promise<{ items: PdfTextItem[]; links: string[] }> {
  type Raw = Omit<PdfTextItem, "bold"> & { weight: number };
  const raw: Raw[] = [];
  const annotationLinks: string[] = [];
  const charsByWeight = new Map<number, number>();

  for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
    const page = await doc.getPage(n);
    // The operator list loads the page's fonts into commonObjs, where their names live.
    const [content] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
    for (const a of await page.getAnnotations()) {
      if (typeof a.url === "string" && /^https?:\/\//i.test(a.url)) annotationLinks.push(a.url);
    }
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      let name: string | undefined;
      try {
        if (page.commonObjs.has(item.fontName)) name = (page.commonObjs.get(item.fontName) as { name?: string } | null)?.name;
      } catch {
        name = undefined;
      }
      const w = fontWeight(name);
      charsByWeight.set(w, (charsByWeight.get(w) ?? 0) + item.str.length);
      const [a, b, , , x, y] = item.transform as number[];
      raw.push({ page: n, str: item.str, x, y, width: item.width, height: item.height || Math.hypot(a, b), weight: w });
    }
  }

  const body = [...charsByWeight].sort((p, q) => q[1] - p[1])[0]?.[0] ?? 4;
  const items = raw.map(({ weight, ...it }) => ({ ...it, bold: weight > body }));

  // A "Save as PDF" header or footer prints the page's address; it's the best link to the recipe.
  const bodySize = typicalSize(items);
  const printed = items
    .filter((it) => it.height < bodySize * 0.95)
    .flatMap((it) => it.str.match(/https?:\/\/[^\s"<>]+/g) ?? []);
  return { items, links: [...new Set([...printed, ...annotationLinks])] };
}

/** 1 thin … 4 regular … 7 bold … 8 black, from a PDF font name like "ABCDEF+Helvetica-BoldOblique". */
function fontWeight(name: string | undefined): number {
  if (!name) return 4;
  const base = name.replace(/^[A-Z]{6}\+/, "");
  const style = /[-,]/.test(base) ? base.split(/[-,]/).slice(1).join("-") : base;
  if (/black|heavy|ultra(?!light)|extrabold/i.test(style)) return 8;
  if (/semibold|demibold|semi|demi/i.test(style)) return 6;
  if (/bold|bd\b/i.test(style)) return 7;
  if (/^med|medium/i.test(style)) return 5;
  if (/light|thin|hairline/i.test(style)) return 3;
  return 4;
}

/** The font size most of the text is set in. */
function typicalSize(items: PdfTextItem[]): number {
  const bySize = new Map<number, number>();
  for (const it of items) {
    const s = Math.round(it.height * 2) / 2;
    bySize.set(s, (bySize.get(s) ?? 0) + it.str.length);
  }
  return [...bySize].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
}

type Line = { page: number; y: number; x: number; height: number; text: string; bold: boolean; lead: string };
type Para = { kind: "heading" | "list" | "prose"; lines: Line[]; text: string; label: string | null };

// Site chrome that survives printing: share buttons, affiliate notices, copyright lines.
const BOILERPLATE =
  /^(print|email|save|share|pin|jump to|rate|review)( (this|the))? recipe\b|save to pinterest|amazon associate|privacy policy|first published|©|\(c\) ?\d{4}|copyright|all rights reserved|designed with|hosted by|powered by|^advertisement$|^skip to content/i;
// Recipe-card metadata lines: "SERVINGS: 12 TIME: 2.5 HOURS SOURCE: …", "Prep Time: 10 mins".
const METADATA = /^(?:servings?|serves|yield|makes|(?:prep|cook|total|active|inactive)?\s*time|source|course|cuisine|author|calories|keyword)\s*:/i;
const SERVINGS_FIELD = /\b(?:servings?|serves|yield|makes)\s*:?\s*([^:]*?)(?=\s+[A-Z][A-Z ]+:|$)/i;
// A label that opens a paragraph: "Make dough:", "Method 1:", "Do ahead:".
const LABEL = /^([A-Z][^:.!?]{0,30}):\s/;
const NOTES_LABEL = /^(a few notes|notes?|cook(?:'|’)?s notes?|tips?|do ahead|make ahead|storage|to store|nota|notas|consejos)\b/i;
const ENDS_SENTENCE = /[.!?:)”"]$/;

/**
 * Turn positioned PDF text into a draft using the page's layout: reading order
 * by position, headings by size, capitals or weight, ingredient lists by their
 * short lines, and one step per paragraph or bold label. Falls back to the
 * plain-text splitter when the layout gives too little to go on. Null when the
 * PDF has no text layer (a scan), so the caller can OCR it instead.
 */
export function recipeFromPdfItems(items: PdfTextItem[]): RecipeDraft | null {
  if (items.reduce((n, it) => n + it.str.replace(/\s/g, "").length, 0) < 40) return null;
  const size = typicalSize(items);
  let lines = toLines(items, size);
  lines = dropFurniture(lines, size);

  // Title: the first line set noticeably larger than the body text.
  const titleLine = lines.find((l) => l.height >= size * 1.25 && l.text.length <= 120);
  let servings: number | null = null;
  lines = lines.filter((l) => {
    if (l === titleLine) return false;
    // Above the title is site chrome: logo, breadcrumbs, the address a print adds.
    if (titleLine && l.page === titleLine.page && l.y > titleLine.y) return false;
    if (PAGE_FURNITURE.test(l.text) && l.text.split(" ").length <= 12) return false;
    if (BOILERPLATE.test(l.text)) return false;
    if (METADATA.test(l.text) && l.text.length < 160) {
      const m = l.text.match(SERVINGS_FIELD);
      if (servings == null && m) servings = parseServings(m[1]);
      return false;
    }
    return true;
  });

  const paras = toParagraphs(lines, size);
  const ingredients: string[] = [];
  const steps: string[] = [];
  const story: string[] = [];
  let description = "";
  let mode: "intro" | "ingredients" | "method" | "notes" = "intro";

  paras.forEach((p, i) => {
    if (p.kind === "heading") {
      const section = sectionOf(p.text);
      if (section) {
        mode = section;
        return;
      }
      // A group heading ("DOUGH", "For the sauce") names the list or steps that follow it.
      const next = paras.slice(i + 1).find((q) => q.kind !== "heading");
      const name = `${groupName(p.text)}:`;
      if (next?.kind === "list" && mode !== "method") ingredients.push(name);
      else if (next?.kind === "prose" && (mode === "method" || ingredients.length > 0)) steps.push(name);
      return;
    }
    if ((p.label && NOTES_LABEL.test(p.label)) || mode === "notes") {
      story.push(p.text);
      return;
    }
    if (p.kind === "list" && mode !== "method") {
      ingredients.push(...p.lines.map((l) => clean(l.text)).filter(Boolean));
      mode = "ingredients";
      return;
    }
    if (mode === "intro" && ingredients.length === 0) {
      if (!description && !p.label && p.text.length <= 300) description = p.text;
      else story.push(p.text);
      return;
    }
    if (p.kind === "list") steps.push(...p.lines.map((l) => clean(l.text)).filter(Boolean));
    else steps.push(clean(p.text));
    mode = "method";
  });

  const title = titleLine?.text ?? "";
  if (ingredients.filter((l) => !l.endsWith(":")).length === 0 || steps.length === 0) {
    // Too little structure to trust; let the text splitter try, keeping what layout found for sure.
    const text = paras.map((p) => p.lines.map((l) => l.text).join("\n")).join("\n\n");
    const fallback = parseRecipeText(title ? `${title}\n${text}` : text);
    return { ...fallback, servings: fallback.servings ?? servings };
  }
  return { title, description, servings, ingredients, instructions: steps, story: story.join("\n\n") };
}

/** "DOUGH" → "Dough", "FOR THE SAUCE:" → "For the sauce". Mixed case is kept. */
function groupName(text: string): string {
  const t = text.replace(/:$/, "").trim();
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}

/** Group items into lines in reading order: page by page, top to bottom, left to right. */
function toLines(items: PdfTextItem[], size: number): Line[] {
  const sorted = [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const rows: PdfTextItem[][] = [];
  for (const it of sorted) {
    const row = rows[rows.length - 1];
    if (row && row[0].page === it.page && Math.abs(row[0].y - it.y) <= Math.max(2, size * 0.4)) row.push(it);
    else rows.push([it]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let text = "";
    let lead = "";
    let leading = true;
    row.forEach((it, i) => {
      const prev = row[i - 1];
      const gap = prev ? it.x - (prev.x + prev.width) : 0;
      const space = prev && gap > it.height * 0.15 && !/\s$/.test(text) && !/^\s/.test(it.str) ? " " : "";
      text += space + it.str;
      if (leading && it.bold) lead += space + it.str;
      else leading = false;
    });
    return {
      page: row[0].page,
      y: Math.max(...row.map((it) => it.y)),
      x: row[0].x,
      height: Math.max(...row.map((it) => it.height)),
      text: text.replace(/\s+/g, " ").trim(),
      bold: row.every((it) => it.bold),
      lead: lead.trim(),
    };
  });
}

/**
 * Drop what a browser prints around each page (date, title, URL, "1/3") and
 * anything repeated in the same place on every page.
 */
function dropFurniture(lines: Line[], size: number): Line[] {
  const extremes = new Map<number, { top: number; bottom: number }>();
  for (const l of lines) {
    const e = extremes.get(l.page) ?? { top: -Infinity, bottom: Infinity };
    extremes.set(l.page, { top: Math.max(e.top, l.y), bottom: Math.min(e.bottom, l.y) });
  }
  const key = (l: Line) => `${Math.round(l.y)}|${l.text.replace(/\d+/g, "#")}`;
  const pagesByKey = new Map<string, Set<number>>();
  for (const l of lines) pagesByKey.set(key(l), (pagesByKey.get(key(l)) ?? new Set()).add(l.page));
  const pages = new Set(lines.map((l) => l.page)).size;

  return lines.filter((l) => {
    const small = l.height < size * 0.95;
    const e = extremes.get(l.page)!;
    const atEdge = l.y === e.top || l.y === e.bottom;
    if (small && atEdge) return false;
    if (small && PAGE_FURNITURE.test(l.text) && l.text.split(" ").length <= 12) return false;
    if (pages > 1 && pagesByKey.get(key(l))!.size >= Math.min(pages, 2) && (small || atEdge)) return false;
    return true;
  });
}

const isHeadingLine = (l: Line, size: number) => {
  const words = l.text.split(/\s+/).length;
  if (words > 6 || /[.!?]$/.test(l.text) || /^[\d½⅓⅔¼¾⅛]/.test(l.text) || l.text.length < 2) return false;
  if (sectionOf(l.text)) return true;
  const letters = l.text.replace(/[^\p{L}]/gu, "");
  const caps = letters.length >= 3 && letters === letters.toUpperCase();
  return caps || l.bold || l.height >= size * 1.15;
};

const labelOf = (l: Line) => {
  if (l.lead && /:$/.test(l.lead) && l.lead.length < l.text.length) return l.lead.replace(/:$/, "");
  const m = l.text.match(LABEL);
  return m && m[1].split(/\s+/).length <= 4 ? m[1] : null;
};

/**
 * Split lines into paragraphs at big vertical gaps, indent changes, headings
 * and labels. A paragraph of short, ragged, ingredient-like lines is a list;
 * one whose lines run the full width is prose.
 */
function toParagraphs(lines: Line[], size: number): Para[] {
  const groups: Line[][] = [];
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    const group = groups[groups.length - 1];
    // A wrapped line that carries on mid-sentence stays put even if it's indented
    // differently (the text after "1." or a bullet sits right of the marker).
    const continues = prev && prev.page === l.page && prev.y - l.y <= size * 2.1 && !ENDS_SENTENCE.test(prev.text) && /^[a-z]/.test(l.text);
    const startsNew =
      !continues && (!prev ||
      isHeadingLine(l, size) ||
      isHeadingLine(prev, size) ||
      labelOf(l) != null ||
      /^(?:\d+[.)]|[-•*·])\s/.test(l.text) ||
      Math.abs(l.x - group[0].x) > size * 0.8 ||
      (prev.page === l.page ? prev.y - l.y > size * 2.1 : ENDS_SENTENCE.test(prev.text)));
    if (startsNew) groups.push([l]);
    else group.push(l);
  });

  const widest = Math.max(...lines.map((l) => l.text.length), 1);
  return groups.map((g) => {
    const text = joinLines(g.map((l) => l.text));
    if (g.length === 1 && isHeadingLine(g[0], size)) return { kind: "heading", lines: g, text, label: null };
    const label = labelOf(g[0]);
    const ingredientLike = g.filter((l) => looksLikeIngredient(l.text)).length;
    const fullWidth = g.slice(0, -1).filter((l) => l.text.length >= widest * 0.7).length;
    const list = !label && ingredientLike * 2 >= g.length && (g.length === 1 || fullWidth * 2 < g.length - 1 || g.length - 1 === 0);
    return { kind: list ? "list" : "prose", lines: g, text, label };
  });
}

/** Join wrapped lines into one paragraph, mending words hyphenated across the break. */
function joinLines(lines: string[]): string {
  return lines.reduce((acc, l) => (!acc ? l : /\w-$/.test(acc) && /^[a-z]/.test(l) ? acc.slice(0, -1) + l : `${acc} ${l}`), "");
}
