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
const want = { family_members: 6, recipes: 6, gatherings: 4, menu_items: 12, annotations: 11 };
for (const [table, n] of Object.entries(want)) {
  const { count } = await c.from(table).select("*", { count: "exact", head: true }).eq("owner_id", user.id);
  expect(`copy made ${n} ${table}`, count === n, `got ${count}`);
}
const { count: lineEdits } = await c
  .from("annotations").select("*", { count: "exact", head: true })
  .eq("owner_id", user.id).not("strike_start", "is", null);
expect("copy keeps the crossed-out line edits", lineEdits === 5, `got ${lineEdits}`);
const { data: hands } = await c.from("family_members").select("hand").eq("owner_id", user.id).neq("hand", "caveat");
expect("copy keeps each member's handwriting", hands?.length === 4, `got ${hands?.length}`);

// Shared cookbooks and the join link (migration 20261019120000_shared_cookbooks).
// An expired link can't be made through the API (nobody can backdate one), so
// expiry is checked offline in `npm run test:db`, along with everything below.
const owner = await signUp("rls-owner", "Rosa");
const ownerCb = (await owner.from("cookbook_members").select("cookbook_id, role").single()).data;
expect("a new account owns its own cookbook", ownerCb?.role === "owner");
const abuela = (await owner.from("family_members").insert({ name: "Abuela", ink: "olive" }).select("id").single()).data.id;
const flan = (await owner.from("recipes").insert({ title: "Flan", ingredients: ["eggs"], instructions: ["bake"] }).select("id").single()).data.id;
const party = (await owner.from("gatherings").insert({ name: "Nochebuena", held_on: "2026-12-24" }).select("id").single()).data.id;
const { data: token } = await owner.rpc("create_invite");
expect("the owner makes a link with at least 128 bits", /^[0-9a-f]{32,}$/.test(token ?? ""), token);
const again = await owner.rpc("create_invite");
expect("asking again gives the same open link", again.data === token);

const anonPreview = (await anon.rpc("invite_preview", { p_token: token })).data;
expect("a visitor's preview names the cookbook and inviter, not the people", anonPreview?.status === "open" && anonPreview.inviter === "Rosa" && !anonPreview.people, JSON.stringify(anonPreview));
const anonJoin = await anon.rpc("accept_invite", { p_token: token });
expect("a visitor can't accept", !!anonJoin.error);
expect("a made-up token is unknown", (await anon.rpc("invite_preview", { p_token: "0".repeat(64) })).data?.status === "unknown");

const guest = await signUp("rls-guest", "Carmen");
const guestPreview = (await guest.rpc("invite_preview", { p_token: token })).data;
expect("a signed-in preview lists who can be claimed", guestPreview?.people?.some((p) => p.id === abuela) && guestPreview.blocked === false, JSON.stringify(guestPreview));
const joined = await guest.rpc("accept_invite", { p_token: token, p_member: abuela, p_name: "Abuela Rosa", p_ink: "plum", p_hand: "reenie" });
expect("joining as Abuela works", joined.data === ownerCb.cookbook_id, joined.error?.message);
const guestRead = await guest.from("recipes").select("id").eq("id", flan);
expect("a member reads the shared cookbook", guestRead.data?.length === 1);
const guestRecipe = await guest.from("recipes").insert({ title: "Carmen's cake", ingredients: ["flour"], instructions: ["bake"], contributor_id: abuela }).select("id, cookbook_id").single();
expect("a member writes into the shared cookbook", guestRecipe.data?.cookbook_id === ownerCb.cookbook_id, guestRecipe.error?.message);
const ownerSees = await owner.from("recipes").select("id").eq("id", guestRecipe.data?.id);
expect("the owner sees the member's recipe", ownerSees.data?.length === 1);
const guestNote = await guest.from("annotations").insert({ recipe_id: flan, author_id: abuela, body: "Less sugar." }).select("id").single();
expect("a member signs a note as their own profile", !guestNote.error, guestNote.error?.message);
const g1 = await guest.from("menu_items").insert({ gathering_id: party, recipe_id: flan, preparer_id: abuela });
expect("a member puts a dish on the shared menu", !g1.error, g1.error?.message);

const o1 = await owner.from("family_members").update({ name: "hacked" }).eq("id", abuela).select();
expect("the owner can't change a claimed profile", !o1.data?.length, JSON.stringify(o1.error ?? o1.data));
const o2 = await owner.from("annotations").insert({ recipe_id: flan, author_id: abuela, body: "forged" });
expect("the owner can't sign a note as a claimed profile", !!o2.error, o2.error?.code);
const oDish = await owner.from("menu_items").update({ preparer_id: abuela }).eq("gathering_id", party).eq("recipe_id", flan).select();
expect("the owner can say a joined person is bringing a dish", oDish.data?.length === 1, JSON.stringify(oDish.error ?? oDish.data));
const o3 = await owner.from("recipes").insert({ title: "forged", contributor_id: abuela });
expect("the owner can't sign a recipe as a claimed profile", !!o3.error, o3.error?.code);
const o4 = await owner.from("annotations").delete().eq("id", guestNote.data?.id).select();
expect("the owner can't remove a claimed profile's note", !o4.data?.length);
const o5 = await owner.from("recipes").update({ title: "Carmen's cake (lemon)" }).eq("id", guestRecipe.data?.id).select();
expect("the owner can still edit a recipe the member contributed", o5.data?.length === 1, o5.error?.message);
const o6 = await owner.from("family_members").insert({ name: "Me again", user_id: (await owner.auth.getUser()).data.user.id });
expect("nobody links a profile to an account directly", !!o6.error, o6.error?.code);

const n1 = await b.from("recipes").select("id").eq("id", flan);
expect("a non-member still can't read the shared cookbook", n1.data?.length === 0);
const n2 = await b.from("recipes").insert({ title: "inject", cookbook_id: ownerCb.cookbook_id });
expect("a non-member can't write into it by naming it", !!n2.error, n2.error?.code);
const n3 = await b.rpc("accept_invite", { p_token: token, p_name: "Intruder" });
expect("an account with its own recipes can't join (one cookbook each)", /already have a cookbook/.test(n3.error?.message ?? ""), n3.error?.message);
const m1 = await guest.from("menu_items").insert({ gathering_id: party, recipe_id: rec.data.id });
expect("a member can't attach a recipe from another cookbook", !!m1.error, m1.error?.code);
const m2 = await guest.rpc("create_invite");
expect("a member who isn't the owner can't make links", !!m2.error);
const m3 = await guest.rpc("revoke_invite");
expect("…or turn the link off", !!m3.error);

await owner.rpc("revoke_invite");
const late = await signUp("rls-late", "Late");
const lateJoin = await late.rpc("accept_invite", { p_token: token, p_name: "Late" });
expect("a turned-off link is refused", /turned off/.test(lateJoin.error?.message ?? ""), lateJoin.error?.message);
expect("its preview says so", (await anon.rpc("invite_preview", { p_token: token })).data?.status === "revoked");
const stillIn = await guest.from("recipes").select("id").eq("id", flan);
expect("people who joined stay after the link is turned off", stillIn.data?.length === 1);

done();
