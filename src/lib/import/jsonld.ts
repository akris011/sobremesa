import { parseServings, type RecipeDraft } from "./draft.ts";

/**
 * Read the schema.org Recipe that most recipe sites embed as JSON-LD
 * (<script type="application/ld+json">). Returns null when the page has none.
 */
export function recipeFromHtml(html: string): RecipeDraft | null {
  const scripts = html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue; // some sites ship broken JSON-LD next to a good block
    }
    const recipe = findRecipe(data);
    if (recipe) return toDraft(recipe);
  }
  return null;
}

type Node = Record<string, unknown>;

const isObject = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);
const types = (n: Node) => [n["@type"]].flat().map(String);

/** Depth-first search through arrays, @graph and nested objects for a node typed Recipe. */
function findRecipe(data: unknown, depth = 0): Node | null {
  if (depth > 6) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipe(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(data)) return null;
  if (types(data).some((t) => t === "Recipe" || t.endsWith("/Recipe"))) return data;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement"]) {
    const found = findRecipe(data[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function toDraft(r: Node): RecipeDraft {
  const ingredients = [r.recipeIngredient ?? r.ingredients].flat().filter((i) => i != null).map((i) => text(i)).filter(Boolean);
  return {
    title: text(r.name ?? r.headline),
    description: text(r.description),
    servings: parseServings(r.recipeYield ?? r.yield),
    ingredients,
    instructions: steps(r.recipeInstructions),
    story: "",
  };
}

/**
 * recipeInstructions comes as one string, a list of strings, HowToStep objects,
 * or HowToSections that group steps under a name ("For the sauce").
 */
function steps(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") {
    // One blob, sometimes HTML: split on paragraph breaks and newlines.
    return text(value.replace(/<\/(p|li|div)>|<br\s*\/?>/gi, "\n"), true)
      .split("\n")
      .map((s) => s.replace(/^\s*\d+[.)]\s+/, "").trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap(steps);
  if (!isObject(value)) return [];
  if (types(value).includes("HowToSection")) {
    const name = text(value.name);
    const inner = steps(value.itemListElement);
    return name ? [`${name.replace(/:$/, "")}:`, ...inner] : inner;
  }
  if (value.itemListElement) return steps(value.itemListElement);
  return [text(value.text ?? value.name)].filter(Boolean);
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", deg: "°", frac12: "½", frac14: "¼", frac34: "¾",
  frac13: "⅓", frac23: "⅔", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…",
  eacute: "é", aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü", ccedil: "ç", egrave: "è",
};

/** Plain text from a JSON-LD string: tags stripped, entities decoded, whitespace collapsed. */
function text(value: unknown, keepNewlines = false): string {
  if (value == null || typeof value === "object") return "";
  let s = String(value).replace(/<[^>]+>/g, " ");
  // Decode twice: some sites double-encode ("&amp;frac12;").
  for (let i = 0; i < 2; i++) {
    s = s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
  }
  return keepNewlines
    ? s.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).join("\n").trim()
    : s.replace(/\s+/g, " ").trim();
}
