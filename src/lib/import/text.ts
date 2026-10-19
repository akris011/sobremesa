import { emptyDraft, parseServings, type RecipeDraft } from "./draft.ts";

// Section headings as they appear on cards, cookbook pages and PDFs, in English and Spanish.
const INGREDIENTS = /^(ingredients?|ingredientes|you(?:'|’)?ll need|what you(?:'|’)?ll need|you will need|necesitas)\s*:?$/i;
const METHOD =
  /^(method|directions?|instructions?|preparation|steps|procedure|to make|how to make it|preparaci[oó]n|modo de preparaci[oó]n|instrucciones|procedimiento|elaboraci[oó]n|pasos)\s*:?$/i;
const NOTES = /^(notes?|tips?|cook(?:'|’)?s notes?|story|notas?|consejos)\s*:?$/i;
const SERVINGS = /^(?:serves|servings?|makes|yield|yields|porciones|raciones|rinde|para)\b[\s:]*(.*)$/i;
const SERVINGS_TRAILING = /^\d+\s*(?:servings|porciones|raciones)$/i;

// "2 cups", "½ lb", "1/2 tsp", "a pinch of", "salt to taste": lines that read like an ingredient.
const QUANTITY = /^(?:[\d½⅓⅔¼¾⅛⅜⅝⅞]|a\s+(?:pinch|dash|handful|few|cup|can)\b|pinch\b|dash\b|una?\s|un\s|pizca\b)/i;
const STEP_START = /^\s*(?:\d+[.)]\s+|step\s+\d+[:.]?\s*|paso\s+\d+[:.]?\s*)/i;
const BULLET = /^\s*[-•*·]\s*/;
const ENDS_SENTENCE = /[.!?:)]$/;
// Headers and footers that browsers print on "Save as PDF" pages: URLs, dates, page numbers.
const PAGE_FURNITURE = /https?:\/\/|\bwww\.|^\d{1,2}\/\d{1,2}\/\d{2,4}\b|\bpage \d+ of \d+\b|^\d+\s*\/\s*\d+$/i;

const isHeading = (l: string) => INGREDIENTS.test(l) || METHOD.test(l) || NOTES.test(l);
const looksLikeIngredient = (l: string) =>
  BULLET.test(l) || QUANTITY.test(l) || /\bto taste\b|\bal gusto\b/i.test(l) || (l.split(/\s+/).length <= 5 && !ENDS_SENTENCE.test(l));

/**
 * Split loose recipe text (pasted, from a PDF, or from OCR) into a draft.
 * Uses headings when it finds them, otherwise guesses: quantity-like lines are
 * ingredients, sentences are steps. The user corrects the rest on the form.
 */
export function parseRecipeText(input: string): RecipeDraft {
  const draft = emptyDraft();
  const raw = input
    .replace(/\r\n?/g, "\n")
    .replace(/(\w)-\n(\w)/g, "$1$2") // words hyphenated across a line break
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim());

  type Section = "intro" | "ingredients" | "method" | "notes";
  const sections: Record<Section, (string | null)[]> = { intro: [], ingredients: [], method: [], notes: [] };
  let current: Section = "intro";
  let sawHeading = false;

  for (const line of raw) {
    if (line && PAGE_FURNITURE.test(line) && line.split(" ").length <= 12) continue;
    if (!line) {
      sections[current].push(null); // keep paragraph breaks for joining wrapped steps
      continue;
    }
    const heading = INGREDIENTS.test(line) ? "ingredients" : METHOD.test(line) ? "method" : NOTES.test(line) ? "notes" : null;
    if (heading) {
      current = heading;
      sawHeading = true;
    } else {
      const serves = line.match(SERVINGS);
      if (draft.servings == null && ((serves && parseServings(serves[1]) != null) || SERVINGS_TRAILING.test(line))) {
        draft.servings = parseServings(line);
        continue;
      }
      sections[current].push(line);
    }
  }

  const intro = sections.intro.filter((l): l is string => l != null);
  if (!sawHeading) {
    // No headings: after the title, ingredient-like lines up to the first sentence are
    // ingredients, everything after is the method.
    const lines = sections.intro;
    const titleAt = lines.findIndex((l) => l != null);
    draft.title = titleAt === -1 ? "" : lines[titleAt]!;
    const rest = lines.slice(titleAt + 1);
    const firstStep = rest.findIndex((l) => l != null && !looksLikeIngredient(l));
    const split = firstStep === -1 ? rest.length : firstStep;
    draft.ingredients = rest.slice(0, split).filter((l): l is string => l != null).map(clean).filter(Boolean);
    draft.instructions = joinSteps(rest.slice(split));
    return draft;
  }

  // The title is the first short line before the sections; anything else there is the description.
  const titleIndex = intro.findIndex((l) => l.length <= 80 && !isHeading(l));
  draft.title = titleIndex === -1 ? "" : intro[titleIndex];
  draft.description = intro.filter((_, i) => i !== titleIndex).join(" ");
  draft.ingredients = sections.ingredients.filter((l): l is string => l != null).map(clean).filter(Boolean);
  draft.instructions = joinSteps(sections.method);
  draft.story = sections.notes.filter((l): l is string => l != null).join("\n");
  return draft;
}

const clean = (l: string) => l.replace(BULLET, "").replace(STEP_START, "").trim();

/**
 * Turn method lines into steps. Numbered or bulleted lines start a step, as do
 * blank lines; otherwise a line that doesn't end a sentence was wrapped (by the
 * PDF or the page) and continues onto the next one.
 */
function joinSteps(lines: (string | null)[]): string[] {
  const steps: string[] = [];
  let open = false;
  const numbered = lines.some((l) => l != null && (STEP_START.test(l) || BULLET.test(l)));
  for (const line of lines) {
    if (line == null) {
      open = false;
      continue;
    }
    const startsStep = STEP_START.test(line) || BULLET.test(line);
    const text = clean(line);
    if (!text) continue;
    if (open && steps.length > 0 && !startsStep && (numbered || !ENDS_SENTENCE.test(steps[steps.length - 1]))) {
      steps[steps.length - 1] += " " + text;
    } else {
      steps.push(text);
    }
    open = true;
  }
  return steps;
}
