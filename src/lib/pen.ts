import type { CSSProperties } from "react";
import { HANDS, INKS, type FamilyMember, type Hand, type Ink, type NamedInk } from "./types.ts"; // relative, so Node runs it in tests

// Everyone writes with a pen: an ink and a hand. This file is the one place that
// turns a member into the color and font their writing appears in.

export const INK_COLORS: Record<NamedInk, string> = {
  sepia: "#6e4b2f",
  burgundy: "#7a2431",
  indigo: "#2f3e64",
  olive: "#56622f",
  terracotta: "#a24f2e",
  plum: "#5e3552",
  ballpoint: "#2b4a9b",
  teal: "#1f5c5a",
  forest: "#2c5a35",
  violet: "#5b3f9a",
  red: "#a3201c",
  pencil: "#55555a",
};

export const INK_LABELS: Record<NamedInk, string> = {
  sepia: "Sepia",
  burgundy: "Burgundy",
  indigo: "Indigo",
  olive: "Olive",
  terracotta: "Terracotta",
  plum: "Plum",
  ballpoint: "Ballpoint blue",
  teal: "Teal",
  forest: "Forest green",
  violet: "Violet",
  red: "Red pen",
  pencil: "Pencil",
};

export const HAND_LABELS: Record<Hand, string> = {
  caveat: "Quick note",
  kalam: "Neat print",
  cedarville: "Schoolbook cursive",
  homemade: "Old-world script",
  reenie: "Felt-tip scrawl",
  gochi: "Rounded marker",
};

const isNamedInk = (v: string): v is NamedInk => (INKS as readonly string[]).includes(v);
export const isHand = (v: string): v is Hand => (HANDS as readonly string[]).includes(v);

// The card stock everything is written on (--color-card).
const CARD = [0xfb, 0xf7, 0xee] as const;

function luminance([r, g, b]: readonly number[]) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrast = (a: readonly number[], b: readonly number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const hex = (rgb: number[]) => "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

/**
 * A custom color made dark enough to read on the card (4.5:1), keeping its hue.
 * Returns null for anything that isn't a "#rrggbb" color.
 */
export function readableInk(value: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  let rgb = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  for (let i = 0; i < 40 && contrast(rgb, CARD) < 4.5; i++) rgb = rgb.map((c) => c * 0.93);
  return hex(rgb);
}

/** The color a stored ink writes in. Unknown values fall back to sepia. */
export function inkColor(ink: string | null | undefined): string {
  if (!ink) return INK_COLORS.sepia;
  if (isNamedInk(ink)) return INK_COLORS[ink];
  return readableInk(ink) ?? INK_COLORS.sepia;
}

/** Validate an ink from a form: a named pen, or a custom color (darkened to read). */
export function parseInk(value: string): Ink | null {
  if (isNamedInk(value)) return value;
  return readableInk(value) as Ink | null;
}

type PenStyle = CSSProperties & { "--pen": string };

/**
 * Props for text written by someone: their hand and ink. Spread onto any element:
 * `<span {...pen(member, "text-[1.3rem]")}>`. `--pen` is there for strike-throughs.
 */
export function pen(member: Pick<FamilyMember, "ink" | "hand"> | null | undefined, className = "") {
  const color = inkColor(member?.ink);
  const hand = member?.hand && isHand(member.hand) ? member.hand : "caveat";
  return { className: `hand hand-${hand} ${className}`.trim(), style: { color, "--pen": color } as PenStyle };
}

/** The first named ink nobody in the family uses yet, so new people stand apart. */
export function freshInk(family: Pick<FamilyMember, "ink">[]): NamedInk {
  const used = new Set(family.map((m) => m.ink));
  return INKS.find((i) => !used.has(i)) ?? INKS[family.length % INKS.length];
}
