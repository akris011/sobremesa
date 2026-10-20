"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";
import { diffLine } from "@/lib/libreta";
import { isHand, parseInk } from "@/lib/pen";

export type FormState = { error?: string; ok?: string } | undefined;

type Supabase = Awaited<ReturnType<typeof createClient>>;

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const lines = (fd: FormData, key: string) =>
  text(fd, key)
    .split("\n")
    // Strip pasted bullets and step numbers ("- ", "2) ", "3. "), but only when a
    // space follows the number, so quantities like "1.5 cups" stay intact.
    .map((l) => l.replace(/^\s*(?:[-•*]\s*|\d+[.)]\s+)/, "").trim())
    .filter(Boolean);

async function requireUser(supabase: Supabase) {
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) redirect("/login");
  return id;
}

function friendly(error: { message: string; code?: string }) {
  if (error.code === "23505") return "That dish is already on the menu.";
  if (error.code === "42501") return "You can only change your own cookbook.";
  if (error.code === "23514") return "One of the fields is too long or empty.";
  return error.message;
}

/**
 * A pen from a form: `<prefix>ink` is a named ink or "custom", in which case the
 * color is `<prefix>ink_custom` (darkened if too pale to read); `<prefix>hand`
 * is the handwriting. Missing or unknown values fall back to the defaults.
 */
function penFrom(fd: FormData, prefix: string) {
  const choice = text(fd, `${prefix}ink`);
  const ink = parseInk(choice === "custom" ? text(fd, `${prefix}ink_custom`) : choice);
  const hand = text(fd, `${prefix}hand`);
  return { ink, hand: isHand(hand) ? hand : "caveat" };
}

/**
 * Forms pick a family member from a list, or choose "new" and type a name.
 * Returns the member id (creating them if needed), null for "nobody", or an error.
 */
async function resolvePerson(supabase: Supabase, fd: FormData, field: string): Promise<{ id: string | null } | { error: string }> {
  const choice = text(fd, field);
  if (choice !== "__new") return { id: choice || null };
  const name = text(fd, `${field}_name`);
  if (!name) return { error: "Write the new person's name." };
  const { ink, hand } = penFrom(fd, `${field}_`);
  const { data, error } = await supabase
    .from("family_members")
    .insert({ name, ink: ink ?? "sepia", hand })
    .select("id")
    .single();
  if (error) return { error: friendly(error) };
  return { id: data.id };
}

// Auth -----------------------------------------------------------------------

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: text(fd, "email"), password: String(fd.get("password") ?? "") });
  if (error) return { error: error.message === "Invalid login credentials" ? "That email and password don't match." : error.message };
  revalidatePath("/", "layout");
  redirect(safeNextPath(text(fd, "next")));
}

export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  const name = text(fd, "name");
  const email = text(fd, "email");
  const password = String(fd.get("password") ?? "");
  if (!name) return { error: "Tell us what your family calls you." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
  if (error) return { error: error.message };
  if (!data.session) return { ok: "Check your email to confirm your account, then sign in." };
  revalidatePath("/", "layout");
  redirect(safeNextPath(text(fd, "next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function copySampleCookbook(): Promise<FormState> {
  const supabase = await createClient();
  await requireUser(supabase);
  const { error } = await supabase.rpc("copy_sample_cookbook");
  if (error) return { error: friendly(error) };
  revalidatePath("/", "layout");
  return { ok: "Copied." };
}

// Recipes --------------------------------------------------------------------

export async function saveRecipe(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  await requireUser(supabase);
  const id = text(fd, "id");
  const title = text(fd, "title");
  const ingredients = lines(fd, "ingredients");
  const instructions = lines(fd, "instructions");
  const servingsRaw = text(fd, "servings");
  const servings = servingsRaw ? Number(servingsRaw) : null;

  if (!title) return { error: "Give the recipe a name." };
  if (ingredients.length === 0) return { error: "List at least one ingredient." };
  if (instructions.length === 0) return { error: "Add at least one step." };
  if (servings !== null && (!Number.isInteger(servings) || servings < 1 || servings > 200))
    return { error: "Servings should be a whole number between 1 and 200." };

  const person = await resolvePerson(supabase, fd, "contributor");
  if ("error" in person) return person;

  const row = {
    title,
    description: text(fd, "description") || null,
    story: text(fd, "story") || null,
    ingredients,
    instructions,
    servings,
    contributor_id: person.id,
  };

  const { data, error } = id
    ? await supabase.from("recipes").update(row).eq("id", id).select("id").single()
    : await supabase.from("recipes").insert(row).select("id").single();
  if (error) return { error: friendly(error) };

  revalidatePath("/", "layout");
  redirect(`/recipes/${data.id}?saved=1`);
}

export async function deleteRecipe(fd: FormData) {
  const supabase = await createClient();
  await requireUser(supabase);
  await supabase.from("recipes").delete().eq("id", text(fd, "id"));
  revalidatePath("/", "layout");
  redirect("/");
}

// Annotations ----------------------------------------------------------------

export async function addAnnotation(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  await requireUser(supabase);
  const recipeId = text(fd, "recipe_id");
  const body = text(fd, "body");
  if (!body) return { error: "Write a note first." };
  if (body.length > 600) return { error: "Keep notes under 600 characters." };

  const person = await resolvePerson(supabase, fd, "author");
  if ("error" in person) return person;
  if (!person.id) return { error: "Choose who is writing this note." };

  const { error } = await supabase.from("annotations").insert({ recipe_id: recipeId, author_id: person.id, body });
  if (error) return { error: friendly(error) };
  revalidatePath(`/recipes/${recipeId}`);
  return { ok: "Note added." };
}

/**
 * Write on one line of a recipe: rewrite it (the changed words are crossed out
 * and the new ones written beside them), add a note next to it, or both.
 * The recipe itself is never changed.
 */
export async function addLineNote(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  await requireUser(supabase);
  const recipeId = text(fd, "recipe_id");
  const kind = text(fd, "line_kind");
  const line = String(fd.get("line_text") ?? "");
  const rewrite = text(fd, "rewrite").replace(/\s+/g, " ");
  const body = text(fd, "body");
  if (kind !== "ingredient" && kind !== "step") return { error: "That line isn't in the recipe." };

  const { data: recipe } = await supabase.from("recipes").select("ingredients, instructions").eq("id", recipeId).maybeSingle();
  const lines: string[] = kind === "ingredient" ? (recipe?.ingredients ?? []) : (recipe?.instructions ?? []);
  if (!lines.includes(line)) return { error: "That line has changed since the page loaded. Reload and try again." };

  const change = rewrite ? diffLine(line, rewrite) : null;
  if (!change && !body) return { error: "Change a word, or write a note beside it." };
  if (body.length > 600) return { error: "Keep notes under 600 characters." };
  if (change && change.replacement.length > 300) return { error: "That's a lot to squeeze in. Put the longer part in the note." };

  const person = await resolvePerson(supabase, fd, "author");
  if ("error" in person) return person;
  if (!person.id) return { error: "Choose who is writing this." };

  const { error } = await supabase.from("annotations").insert({
    recipe_id: recipeId,
    author_id: person.id,
    body,
    line_kind: kind,
    line_text: line,
    strike_start: change?.start ?? null,
    strike_end: change?.end ?? null,
    replacement: change ? change.replacement : null,
  });
  if (error) return { error: friendly(error) };
  revalidatePath(`/recipes/${recipeId}`);
  return { ok: "Written in." };
}

export async function deleteAnnotation(fd: FormData) {
  const supabase = await createClient();
  await requireUser(supabase);
  await supabase.from("annotations").delete().eq("id", text(fd, "id"));
  revalidatePath(`/recipes/${text(fd, "recipe_id")}`);
}

// Gatherings -----------------------------------------------------------------

export async function createGathering(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  await requireUser(supabase);
  const name = text(fd, "name");
  const heldOn = text(fd, "held_on");
  if (!name) return { error: "Name the gathering." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(heldOn)) return { error: "Choose a date." };

  const { data, error } = await supabase
    .from("gatherings")
    .insert({ name, held_on: heldOn, location: text(fd, "location") || null, description: text(fd, "description") || null })
    .select("id")
    .single();
  if (error) return { error: friendly(error) };
  revalidatePath("/", "layout");
  redirect(`/gatherings/${data.id}`);
}

export async function deleteGathering(fd: FormData) {
  const supabase = await createClient();
  await requireUser(supabase);
  await supabase.from("gatherings").delete().eq("id", text(fd, "id"));
  revalidatePath("/", "layout");
  redirect("/gatherings");
}

export async function addMenuItem(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  await requireUser(supabase);
  const gatheringId = text(fd, "gathering_id");
  const recipeId = text(fd, "recipe_id");
  if (!recipeId) return { error: "Choose a recipe from the cookbook." };

  const person = await resolvePerson(supabase, fd, "preparer");
  if ("error" in person) return person;

  const { error } = await supabase.from("menu_items").insert({
    gathering_id: gatheringId,
    recipe_id: recipeId,
    preparer_id: person.id,
    note: text(fd, "note") || null,
  });
  if (error) return { error: friendly(error) };
  revalidatePath("/", "layout");
  return { ok: "Added to the menu." };
}

export async function setPreparer(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  await requireUser(supabase);
  const person = await resolvePerson(supabase, fd, "preparer");
  if ("error" in person) return person;
  const { error } = await supabase.from("menu_items").update({ preparer_id: person.id }).eq("id", text(fd, "id"));
  if (error) return { error: friendly(error) };
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export async function removeMenuItem(fd: FormData) {
  const supabase = await createClient();
  await requireUser(supabase);
  await supabase.from("menu_items").delete().eq("id", text(fd, "id"));
  revalidatePath("/", "layout");
}

// Family ---------------------------------------------------------------------

export async function addFamilyMember(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  await requireUser(supabase);
  const name = text(fd, "name");
  const { ink, hand } = penFrom(fd, "");
  if (!name) return { error: "Write their name." };
  if (!ink) return { error: "Choose an ink color." };
  const { error } = await supabase.from("family_members").insert({ name, ink, hand, relation: text(fd, "relation") || null });
  if (error) return { error: friendly(error) };
  revalidatePath("/", "layout");
  return { ok: `${name} added.` };
}

export async function updateFamilyMember(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  await requireUser(supabase);
  const name = text(fd, "name");
  const { ink, hand } = penFrom(fd, "");
  if (!name) return { error: "Write their name." };
  if (!ink) return { error: "Choose an ink color." };
  const { error } = await supabase
    .from("family_members")
    .update({ name, ink, hand, relation: text(fd, "relation") || null })
    .eq("id", text(fd, "id"));
  if (error) return { error: friendly(error) };
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}
