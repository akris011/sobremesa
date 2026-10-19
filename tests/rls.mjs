// Row-level security, checked straight against the Supabase API with the
// public key (no UI involved). Usage: npm run test:rls
import { checker, supabase, testEmail } from "./helpers.mjs";

const DEMO_RECIPE = "d0000000-0000-4000-8000-000000000201";
const { expect, done } = checker();

async function signUp(kind, name) {
  const client = supabase();
  const { error } = await client.auth.signUp({ email: testEmail(kind), password: "rls-test-pass-9", options: { data: { display_name: name } } });
  if (error) throw error;
  return client;
}

// Account A owns a recipe and a gathering; everyone else tries to reach them.
const a = await signUp("rls-a", "Owner");
const victimRecipe = (await a.from("recipes").insert({ title: "A's soup", ingredients: ["water"], instructions: ["boil"] }).select("id").single()).data.id;
const victimGathering = (await a.from("gatherings").insert({ name: "A's party", held_on: "2026-12-01" }).select("id").single()).data.id;

const anon = supabase();
const r1 = await anon.from("recipes").select("id").eq("id", victimRecipe);
expect("visitor cannot read a private recipe", r1.data?.length === 0, JSON.stringify(r1.error ?? r1.data));
const r1b = await anon.from("recipes").select("id").eq("is_demo", true);
expect("visitor can read sample recipes", r1b.data?.length === 6, JSON.stringify(r1b.data?.length));
const r2 = await anon.from("recipes").insert({ title: "spam" });
expect("visitor cannot insert", !!r2.error, r2.error?.code);
const r3 = await anon.from("recipes").update({ title: "hacked" }).eq("id", DEMO_RECIPE).select();
expect("visitor cannot update sample", !r3.data?.length, JSON.stringify(r3.error?.code ?? r3.data));

const b = await signUp("rls-b", "Intruder");
const all = await b.from("recipes").select("id, is_demo");
expect("user B sees only sample rows (none of A's)", all.data.every((r) => r.is_demo) && !all.data.some((r) => r.id === victimRecipe));
const b1 = await b.from("recipes").update({ title: "hacked" }).eq("id", victimRecipe).select();
expect("user B cannot update A's recipe", !b1.data?.length, JSON.stringify(b1.error?.code ?? b1.data));
const b2 = await b.from("recipes").delete().eq("id", victimRecipe).select();
expect("user B cannot delete A's recipe", !b2.data?.length);
const b3 = await b.from("recipes").update({ title: "hacked" }).eq("id", DEMO_RECIPE).select();
expect("user B cannot update sample recipe", !b3.data?.length);
const b4 = await b.from("recipes").insert({ title: "fake demo", is_demo: true });
expect("user B cannot create demo rows", !!b4.error, b4.error?.code);
const b5 = await b.from("annotations").insert({ recipe_id: victimRecipe, body: "graffiti" });
expect("user B cannot annotate A's recipe", !!b5.error, b5.error?.code);
const b6 = await b.from("annotations").insert({ recipe_id: DEMO_RECIPE, body: "graffiti" });
expect("user B cannot annotate sample recipe", !!b6.error, b6.error?.code);
const own = await b.from("gatherings").insert({ name: "B's party", held_on: "2026-12-01" }).select("id").single();
const b7 = await b.from("menu_items").insert({ gathering_id: own.data.id, recipe_id: victimRecipe });
expect("user B cannot put A's recipe on their menu", !!b7.error, b7.error?.code);
const b8 = await b.from("menu_items").insert({ gathering_id: victimGathering, recipe_id: DEMO_RECIPE });
expect("user B cannot add to A's gathering", !!b8.error, b8.error?.code);
const b9 = await b.from("recipes").insert({ title: "x", owner_id: "00000000-0000-0000-0000-000000000000" });
expect("user B cannot insert as someone else", !!b9.error, b9.error?.code);

// Duplicate dish guard at the database level.
const rec = await b.from("recipes").insert({ title: "B soup", ingredients: ["water"], instructions: ["boil"] }).select("id").single();
await b.from("menu_items").insert({ gathering_id: own.data.id, recipe_id: rec.data.id });
const dup = await b.from("menu_items").insert({ gathering_id: own.data.id, recipe_id: rec.data.id });
expect("same dish can't be added twice to one menu", dup.error?.code === "23505", dup.error?.code);

const refused = await b.rpc("copy_sample_cookbook");
expect("copying the sample is refused when the cookbook isn't empty", !!refused.error, refused.error?.message);

// A fresh account copies the sample into its own rows.
const c = await signUp("rls-c", "Copier");
const copied = await c.rpc("copy_sample_cookbook");
expect("copying the sample into an empty cookbook works", !copied.error, copied.error?.message);
const { data: { user } } = await c.auth.getUser();
const want = { family_members: 6, recipes: 6, gatherings: 4, menu_items: 12, annotations: 9 };
for (const [table, n] of Object.entries(want)) {
  const { count } = await c.from(table).select("*", { count: "exact", head: true }).eq("owner_id", user.id);
  expect(`copy made ${n} ${table}`, count === n, `got ${count}`);
}

done();
