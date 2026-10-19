// Renders the app icons into public/icons. Run: node scripts/make-icons.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

const font = await readFile(new URL("../src/app/_fonts/cormorant-600-italic.woff", import.meta.url));
await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });

function icon(size, { maskable = false } = {}) {
  const inset = Math.round(size * (maskable ? 0.14 : 0.07));
  return h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#7a2431",
      },
    },
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: inset,
          left: inset,
          right: inset,
          bottom: inset,
          border: `${Math.max(1, Math.round(size / 96))}px solid rgba(245,238,223,0.55)`,
        },
      },
    ),
    h(
      "div",
      {
        style: {
          fontFamily: "Cormorant",
          fontStyle: "italic",
          fontSize: size * (maskable ? 0.58 : 0.72),
          color: "#f5eedf",
          lineHeight: 1,
          marginTop: -size * 0.06,
        },
      },
      "S",
    ),
  );
}

const targets = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, {}],
  ["favicon-32.png", 32, {}],
];

for (const [name, size, opts] of targets) {
  const res = new ImageResponse(icon(size, opts), {
    width: size,
    height: size,
    fonts: [{ name: "Cormorant", data: font, style: "italic", weight: 600 }],
  });
  await writeFile(new URL(`../public/icons/${name}`, import.meta.url), Buffer.from(await res.arrayBuffer()));
  console.log("wrote", name);
}
