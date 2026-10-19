import "server-only";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Annotation, FamilyMember, Gathering, MenuItem, Recipe, ServedAt } from "@/lib/types";

// Visitors see the sample cookbook; signed-in users see only their own.
// RLS enforces the same boundary in the database; this filter just picks which
// of the readable rows a page should show.
async function scoped() {
  const [supabase, userId] = await Promise.all([createClient(), getUserId()]);
  const [col, val]: [string, string | boolean] = userId ? ["owner_id", userId] : ["is_demo", true];
  return { supabase, userId, col, val };
}

const MEMBER = "id, name, relation, ink";
const RECIPE = `id, is_demo, title, description, story, ingredients, instructions, servings,
  contributor_id, created_at, updated_at, contributor:family_members(${MEMBER})`;

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function listRecipes(): Promise<Recipe[]> {
  const { supabase, col, val } = await scoped();
  return check(
    await supabase.from("recipes").select(RECIPE).eq(col, val).order("created_at", { ascending: false }),
  ) as unknown as Recipe[];
}

export async function getRecipe(id: string) {
  const { supabase, col, val, userId } = await scoped();
  const recipe = check(
    await supabase.from("recipes").select(RECIPE).eq(col, val).eq("id", id).maybeSingle(),
  ) as unknown as Recipe | null;
  if (!recipe) return null;

  const [annotations, served] = await Promise.all([
    supabase
      .from("annotations")
      .select(`id, body, created_at, author:family_members(${MEMBER})`)
      .eq("recipe_id", id)
      .order("created_at"),
    supabase
      .from("menu_items")
      .select(
        `id, note, preparer:family_members(${MEMBER}),
         gathering:gatherings!inner(id, is_demo, name, held_on, location, description)`,
      )
      .eq("recipe_id", id),
  ]);

  const history = (check(served) as unknown as ServedAt[]).sort((a, b) =>
    b.gathering.held_on.localeCompare(a.gathering.held_on),
  );
  return {
    recipe,
    annotations: check(annotations) as unknown as Annotation[],
    history,
    canEdit: !!userId && !recipe.is_demo,
  };
}

export async function listGatherings(): Promise<(Gathering & { dishes: number })[]> {
  const { supabase, col, val } = await scoped();
  const rows = check(
    await supabase
      .from("gatherings")
      .select("id, is_demo, name, held_on, location, description, menu_items(count)")
      .eq(col, val)
      .order("held_on"),
  ) as unknown as (Gathering & { menu_items: { count: number }[] })[];
  return rows.map(({ menu_items, ...g }) => ({ ...g, dishes: menu_items[0]?.count ?? 0 }));
}

export async function getGathering(id: string) {
  const { supabase, col, val, userId } = await scoped();
  const gathering = check(
    await supabase
      .from("gatherings")
      .select("id, is_demo, name, held_on, location, description")
      .eq(col, val)
      .eq("id", id)
      .maybeSingle(),
  ) as Gathering | null;
  if (!gathering) return null;

  const menu = check(
    await supabase
      .from("menu_items")
      .select(`id, note, recipe:recipes(id, title, description), preparer:family_members(${MEMBER})`)
      .eq("gathering_id", id)
      .order("created_at"),
  ) as unknown as MenuItem[];

  return { gathering, menu, canEdit: !!userId && !gathering.is_demo };
}

export async function listFamily(): Promise<FamilyMember[]> {
  const { supabase, col, val } = await scoped();
  return check(
    await supabase.from("family_members").select(MEMBER).eq(col, val).order("created_at"),
  ) as FamilyMember[];
}

/** Today's date in the format Postgres `date` columns use, for upcoming/past splits. */
export function today() {
  return new Date().toISOString().slice(0, 10);
}
