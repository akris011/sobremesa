import "server-only";
import { cache } from "react";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Annotation, Cookbook, FamilyMember, Gathering, InvitePreview, MenuItem, Recipe, ServedAt } from "@/lib/types";

// No account is in a cookbook with this id; used if a signed-in user somehow has none.
const NO_COOKBOOK = "00000000-0000-0000-0000-000000000000";

/** The signed-in user's cookbook (one per account for now), once per request. */
const myCookbook = cache(async (): Promise<{ userId: string | null; cookbook: Cookbook | null }> => {
  const [supabase, userId] = await Promise.all([createClient(), getUserId()]);
  if (!userId) return { userId, cookbook: null };
  const { data } = await supabase
    .from("cookbook_members")
    .select("role, cookbook:cookbooks(id, name)")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as unknown as { role: string; cookbook: { id: string; name: string } | null } | null;
  return {
    userId,
    cookbook: row?.cookbook ? { ...row.cookbook, isOwner: row.role === "owner" } : null,
  };
});

export async function getCookbook() {
  return (await myCookbook()).cookbook;
}

// Visitors see the sample cookbook; signed-in users see the cookbook they're a
// member of. RLS enforces the same boundary in the database; this filter just
// picks which of the readable rows a page should show.
async function scoped() {
  const [supabase, { userId, cookbook }] = await Promise.all([createClient(), myCookbook()]);
  const [col, val]: [string, string | boolean] = userId ? ["cookbook_id", cookbook?.id ?? NO_COOKBOOK] : ["is_demo", true];
  return { supabase, userId, col, val };
}

const MEMBER = "id, name, relation, ink, hand";

type WithUser = FamilyMember & { user_id: string | null };
/** Turn a member's account id into claimed/mine flags, so it never reaches the browser. */
function flags({ user_id, ...m }: WithUser, userId: string | null): FamilyMember {
  return { ...m, claimed: !!user_id, mine: !!userId && user_id === userId };
}
const RECIPE = `id, is_demo, title, description, story, ingredients, instructions, servings, photo_url,
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
      .select(`id, body, created_at, line_kind, line_text, strike_start, strike_end, replacement, author:family_members(${MEMBER}, user_id)`)
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
  // A note signed by someone's own profile can be removed only by them (RLS agrees).
  const notes = (check(annotations) as unknown as (Omit<Annotation, "author"> & { author: WithUser | null })[]).map(
    ({ author, ...a }) => ({
      ...a,
      author: author && flags(author, userId),
      removable: !author?.user_id || author.user_id === userId,
    }),
  );
  return {
    recipe,
    annotations: notes as Annotation[],
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

/** Everyone in the cookbook, with whether they've joined (claimed) and which one is you. */
export async function listFamily(): Promise<FamilyMember[]> {
  const { supabase, col, val, userId } = await scoped();
  const rows = check(
    await supabase.from("family_members").select(`${MEMBER}, user_id`).eq(col, val).order("created_at"),
  ) as WithUser[];
  return rows.map((m) => flags(m, userId));
}

/** The cookbook's open invite link (token and expiry), if there is one. Members only. */
export async function getInvite(): Promise<{ token: string; expires_at: string } | null> {
  const { cookbook } = await myCookbook();
  if (!cookbook) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("cookbook_invites")
    .select("token, expires_at")
    .eq("cookbook_id", cookbook.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Who has joined (has an account linked to a person), the owner first. */
export async function listJoined(): Promise<(FamilyMember & { owner: boolean })[]> {
  const { cookbook, userId } = await myCookbook();
  if (!cookbook) return [];
  const supabase = await createClient();
  const [members, people] = await Promise.all([
    supabase.from("cookbook_members").select("user_id, role, joined_at").eq("cookbook_id", cookbook.id).order("joined_at"),
    supabase.from("family_members").select(`${MEMBER}, user_id`).eq("cookbook_id", cookbook.id).not("user_id", "is", null),
  ]);
  const byUser = new Map((check(people) as WithUser[]).map((p) => [p.user_id, p]));
  return (check(members) as { user_id: string; role: string }[])
    .filter((m) => byUser.has(m.user_id))
    .sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"))
    .map((m) => ({ ...flags(byUser.get(m.user_id)!, userId), owner: m.role === "owner" }));
}

/** What an invite link points at. Works signed out (names only). */
export async function invitePreview(token: string): Promise<InvitePreview> {
  if (!/^[0-9a-f]{32,128}$/.test(token)) return { status: "unknown" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_preview", { p_token: token });
  if (error) throw new Error(error.message);
  return data as InvitePreview;
}

// The server runs in UTC, which is already "tomorrow" on US evenings. Gatherings
// are calendar days in the family's time zone; one fixed zone is an MVP shortcut
// until accounts store their own.
const FAMILY_TIME_ZONE = "America/New_York";

/** Today's date (YYYY-MM-DD) in the family's time zone, for upcoming/past splits. */
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FAMILY_TIME_ZONE }).format(new Date());
}
