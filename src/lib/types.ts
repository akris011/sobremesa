/** Named pens, in the order new people are offered them. */
export const INKS = [
  "sepia", "burgundy", "indigo", "olive", "terracotta", "plum",
  "ballpoint", "teal", "forest", "violet", "red", "pencil",
] as const;
export type NamedInk = (typeof INKS)[number];
/** A named pen, or a custom color as lowercase "#rrggbb". */
export type Ink = NamedInk | `#${string}`;

/** Handwriting styles. Caveat is everyone's default. */
export const HANDS = ["caveat", "kalam", "cedarville", "homemade", "reenie", "gochi"] as const;
export type Hand = (typeof HANDS)[number];

export type FamilyMember = {
  id: string;
  name: string;
  relation: string | null;
  ink: Ink;
  hand: Hand;
};

export type Recipe = {
  id: string;
  is_demo: boolean;
  title: string;
  description: string | null;
  story: string | null;
  ingredients: string[];
  instructions: string[];
  servings: number | null;
  contributor_id: string | null;
  created_at: string;
  updated_at: string;
  contributor: FamilyMember | null;
};

export type Annotation = {
  id: string;
  body: string;
  created_at: string;
  author: FamilyMember | null;
  /** Set when the note sits on one ingredient or step, as that line read then. */
  line_kind: "ingredient" | "step" | null;
  line_text: string | null;
  /** Crossed-out characters of line_text; equal for an insertion. */
  strike_start: number | null;
  strike_end: number | null;
  replacement: string | null;
};

export type Gathering = {
  id: string;
  is_demo: boolean;
  name: string;
  held_on: string;
  location: string | null;
  description: string | null;
};

export type MenuItem = {
  id: string;
  note: string | null;
  recipe: Pick<Recipe, "id" | "title" | "description"> | null;
  preparer: FamilyMember | null;
};

/** A recipe's appearance at a gathering, for the recipe's history. */
export type ServedAt = {
  id: string;
  note: string | null;
  gathering: Gathering;
  preparer: FamilyMember | null;
};
