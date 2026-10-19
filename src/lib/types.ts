export const INKS = ["sepia", "burgundy", "olive", "terracotta", "indigo", "plum"] as const;
export type Ink = (typeof INKS)[number];

export type FamilyMember = {
  id: string;
  name: string;
  relation: string | null;
  ink: Ink;
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
