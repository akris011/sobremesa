import type { Annotation } from "@/lib/types";

// La Libreta: notes written onto a recipe's lines. The recipe text never changes;
// a note remembers the line as it read, which characters it crossed out, and
// what was written instead.

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}½¼¾⅓⅔/]/u.test(c);

/**
 * What changed between a line and its rewrite: the crossed-out range of the
 * original and the words written in its place. Widened to whole words, so
 * "taza" → "tazas" crosses out "taza" instead of squeezing in an "s".
 * Returns null when nothing changed.
 */
export function diffLine(before: string, after: string): { start: number; end: number; replacement: string } | null {
  if (before === after) return null;
  let pre = 0;
  while (pre < before.length && pre < after.length && before[pre] === after[pre]) pre++;
  let suf = 0;
  while (
    suf < before.length - pre &&
    suf < after.length - pre &&
    before[before.length - 1 - suf] === after[after.length - 1 - suf]
  )
    suf++;

  // Back up to word boundaries on both sides (the shared prefix/suffix is the same text in both).
  while (pre > 0 && isWordChar(before[pre - 1]) && (isWordChar(before[pre]) || isWordChar(after[pre]))) pre--;
  while (
    suf > 0 &&
    isWordChar(before[before.length - suf]) &&
    (isWordChar(before[before.length - suf - 1]) || isWordChar(after[after.length - suf - 1]))
  )
    suf--;

  let start = pre;
  let end = before.length - suf;
  let replacement = after.slice(pre, after.length - suf);
  // Don't cross out or write leading/trailing spaces; keep them as plain text.
  while (start < end && before[start] === " " && replacement.startsWith(" ")) {
    start++;
    replacement = replacement.slice(1);
  }
  while (end > start && before[end - 1] === " " && replacement.endsWith(" ")) {
    end--;
    replacement = replacement.slice(0, -1);
  }
  // A plain deletion takes one of the spaces around it, so no double space is left.
  if (!replacement.trim() && before[end - 1] === " " && (start === 0 || before[start - 1] === " ")) end--;
  return { start, end, replacement: replacement.trim() };
}

export type LineNotes = Annotation[];

/**
 * Sort notes onto the lines they were written on. Notes whose line has since
 * been rewritten in the recipe itself (or that never had one) go to the margin.
 */
export function placeNotes(annotations: Annotation[], ingredients: string[], instructions: string[]) {
  const ingredientNotes = ingredients.map(() => [] as LineNotes);
  const stepNotes = instructions.map(() => [] as LineNotes);
  const margin: Annotation[] = [];
  for (const a of annotations) {
    const lines = a.line_kind === "ingredient" ? ingredients : a.line_kind === "step" ? instructions : null;
    const at = lines && a.line_text !== null ? lines.indexOf(a.line_text) : -1;
    if (at === -1) margin.push(a);
    else (a.line_kind === "ingredient" ? ingredientNotes : stepNotes)[at].push(a);
  }
  return { ingredientNotes, stepNotes, margin };
}

/** A note that crosses something out or writes something in. */
export const isCorrection = (a: Annotation) => a.strike_start !== null && a.strike_end !== null;
