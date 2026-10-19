/**
 * A recipe read from a link, file or pasted text. It only prefills the recipe
 * form; nothing is saved until the user reviews it and presses save.
 */
export type RecipeDraft = {
  title: string;
  description: string;
  servings: number | null;
  ingredients: string[];
  instructions: string[];
  story: string;
  /** Words the OCR wasn't sure of, for "We couldn't read these words: …". */
  unread?: string[];
};

export const emptyDraft = (): RecipeDraft => ({
  title: "",
  description: "",
  servings: null,
  ingredients: [],
  instructions: [],
  story: "",
});

/** First whole number in "Serves 4–6", "12 cookies", ["8", "8 servings"]. Null if none or out of range. */
export function parseServings(value: unknown): number | null {
  const raw = Array.isArray(value) ? value.map(String).join(" ") : value == null ? "" : String(value);
  const m = raw.match(/\d+/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 200 ? n : null;
}
