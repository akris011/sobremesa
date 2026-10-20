// Every migration, applied in order to an in-process Postgres (PGlite) with a
// stub of Supabase's auth schema and roles, then RLS exercised as different
// users the way PostgREST runs requests (set role + JWT sub). Offline: it never
// touches the Supabase project. Usage: npm run test:db
//
// It also builds "production" rows with main's owner_id-style writes before the
// newest migration and checks main's queries still work after it.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

const migDir = new URL("../supabase/migrations", import.meta.url).pathname;
const files = readdirSync(migDir).sort();
const NEW = "20261019120000_shared_cookbooks.sql";
const db = new PGlite({ extensions: { pgcrypto } });

let pass = 0, fail = 0;
const expect = (name, ok, detail = "") => {
  if (ok) pass++;
  else fail++;
  console.log(ok ? "PASS" : "FAIL", name, process.env.V || !ok ? detail : "");
};

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, created_at timestamptz default now(), raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`);

const run = async (f) => {
  await db.exec(readFileSync(`${migDir}/${f}`, "utf8"));
  console.log("applied", f);
};

// Act as a user, the way PostgREST does: set role + JWT sub inside a transaction.
async function as(uid, sql, params = []) {
  try {
    return await db.transaction(async (tx) => {
      await tx.exec(`set local role ${uid ? "authenticated" : "anon"}`);
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ""]);
      const r = await tx.query(sql, params);
      return { rows: r.rows, count: r.affectedRows };
    });
  } catch (e) {
    return { error: e.message };
  }
}
const one = async (uid, sql, params) => {
  const r = await as(uid, sql, params);
  if (r.error) throw new Error(`${sql} -> ${r.error}`);
  return r.rows[0];
};
async function signUp(name) {
  const id = randomUUID();
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${name}@x`, { display_name: name }]);
  return id;
}

// --- Production state before the new migration -------------------------------
for (const f of files.filter((f) => f < NEW)) await run(f);

const A = await signUp("Rosa");
const B = await signUp("Intruder");
const C = await signUp("Copier");
const aMe = (await one(A, `select id from family_members where owner_id = auth.uid()`)).id;
const aAbuela = (await one(A, `insert into family_members (name, ink) values ('Abuela', 'olive') returning id`)).id;
const aRecipe = (await one(A, `insert into recipes (title, contributor_id) values ('Flan', $1) returning id, updated_at`, [aMe]));
const aGath = (await one(A, `insert into gatherings (name, held_on) values ('Party', '2026-12-01') returning id`)).id;
await one(A, `insert into menu_items (gathering_id, recipe_id, preparer_id) values ($1, $2, $3) returning id`, [aGath, aRecipe.id, aAbuela]);
await one(A, `insert into annotations (recipe_id, author_id, body) values ($1, $2, 'old note') returning id`, [aRecipe.id, aMe]);
await one(C, `select public.copy_sample_cookbook()`);
const before = {};
for (const u of [A, B, C]) {
  before[u] = {};
  for (const t of ["family_members", "recipes", "gatherings", "menu_items", "annotations"])
    before[u][t] = (await one(u, `select count(*)::int n from ${t} where owner_id = auth.uid()`)).n;
}

// --- Apply ------------------------------------------------------------------------
await run(NEW);

// Backfill
for (const u of [A, B, C]) {
  const m = await db.query(`select role from cookbook_members where user_id = $1`, [u]);
  expect("backfill: one owner membership per account", m.rows.length === 1 && m.rows[0].role === "owner");
  for (const t of Object.keys(before[u])) {
    const n = (await one(u, `select count(*)::int n from ${t} where owner_id = auth.uid()`)).n;
    expect(`backfill: ${t} still readable by owner_id (main's query)`, n === before[u][t], `${n} vs ${before[u][t]}`);
  }
}
const nulls = await db.query(`select (select count(*) from recipes where not is_demo and cookbook_id is null)::int r`);
expect("backfill: no non-demo row without a cookbook", nulls.rows[0].r === 0);
const claimedA = await db.query(`select id from family_members where user_id = $1`, [A]);
expect("backfill: each account's own person is linked to it", claimedA.rows.length === 1 && claimedA.rows[0].id === aMe);
const touched = await db.query(`select updated_at from recipes where id = $1`, [aRecipe.id]);
expect("backfill didn't bump updated_at", +touched.rows[0].updated_at === +aRecipe.updated_at);
const cbName = await db.query(`select name from cookbooks where created_by = $1`, [A]);
expect("backfill names the cookbook after its owner", cbName.rows[0].name === "Rosa's family cookbook", cbName.rows[0].name);

// --- main's code keeps working ---------------------------------------------------
let r = await as(A, `insert into recipes (title, contributor_id) values ('Main-style', $1) returning id, cookbook_id`, [aAbuela]);
expect("main: insert without cookbook_id lands in own cookbook", !r.error && r.rows[0].cookbook_id, r.error);
r = await as(A, `insert into family_members (name, ink, hand) values ('Tío', 'teal', 'kalam') returning id`);
expect("main: add a family member", !r.error, r.error);
r = await as(A, `update family_members set name = 'Rosa M.' where id = $1 returning id`, [aMe]);
expect("main: change own person", r.rows?.length === 1, r.error);
r = await as(A, `insert into annotations (recipe_id, author_id, body) values ($1, $2, 'n') returning id`, [aRecipe.id, aMe]);
expect("main: note as yourself", !r.error, r.error);
r = await as(A, `update menu_items set preparer_id = $1 where gathering_id = $2 returning id`, [aMe, aGath]);
expect("main: set preparer", r.rows?.length === 1, r.error);
r = await as(A, `delete from annotations where body = 'n' returning id`);
expect("main: delete a note", r.rows?.length === 1, r.error);
const D = await signUp("Newbie");
r = await as(D, `select count(*)::int n from family_members where owner_id = auth.uid() and user_id = auth.uid()`);
expect("signup: new account gets its own linked person", r.rows[0].n === 1);
r = await as(D, `select public.copy_sample_cookbook()`);
expect("copy_sample_cookbook works for a new account", !r.error, r.error);
const want = { family_members: 6, recipes: 6, gatherings: 4, menu_items: 12, annotations: 11 };
for (const [t, n] of Object.entries(want)) {
  const got = (await one(D, `select count(*)::int n from ${t} where cookbook_id = public.my_cookbook_id()`)).n;
  expect(`copy made ${n} ${t}`, got === n, `got ${got}`);
}
r = await as(D, `select public.copy_sample_cookbook()`);
expect("copy refused when the cookbook has recipes", !!r.error, r.error);

// --- Isolation -------------------------------------------------------------------
const aCb = (await db.query(`select cookbook_id from cookbook_members where user_id = $1`, [A])).rows[0].cookbook_id;
r = await as(B, `select id from recipes where not is_demo`);
expect("B sees none of A's rows", r.rows.length === 0);
r = await as(B, `insert into recipes (title, cookbook_id) values ('inject', $1)`, [aCb]);
expect("B can't write into A's cookbook by naming it", !!r.error, JSON.stringify(r));
r = await as(B, `insert into annotations (recipe_id, body) values ($1, 'x')`, [aRecipe.id]);
expect("B can't annotate A's recipe", !!r.error, r.error);
const bRecipe = (await one(B, `insert into recipes (title) values ('B soup') returning id`)).id;
r = await as(B, `update recipes set cookbook_id = $1 where id = $2 returning id`, [aCb, bRecipe]);
expect("B can't move a row into A's cookbook", !!r.error || !r.rows.length);
r = await as(null, `select id from recipes where not is_demo`);
expect("visitor sees no private rows", r.rows.length === 0);
r = await as(null, `select id from recipes where is_demo`);
expect("visitor sees the sample", r.rows.length === 6);
r = await as(B, `update recipes set title = 'x' where is_demo returning id`);
expect("nobody writes the sample", !r.error && r.rows.length === 0);
r = await as(B, `select * from cookbook_invites`);
expect("B reads no invites", r.rows.length === 0);
r = await as(B, `select * from cookbooks`);
expect("B reads only its own cookbook", r.rows.length === 1);

// --- Invites ---------------------------------------------------------------------
const token = (await one(A, `select public.create_invite() t`)).t;
expect("owner makes an invite of >=128 bits", /^[0-9a-f]{64}$/.test(token), token);
expect("asking again returns the same open link", (await one(A, `select public.create_invite() t`)).t === token);
r = await as(null, `select public.invite_preview($1) p`, [token]);
const anonPrev = r.rows[0].p;
expect("signed-out preview: names, no people", anonPrev.status === "open" && anonPrev.cookbook === "Rosa's family cookbook" && anonPrev.inviter === "Rosa M." && !anonPrev.people, JSON.stringify(anonPrev));
r = await as(null, `select public.invite_preview('nope') p`);
expect("unknown token preview", r.rows[0].p.status === "unknown");
r = await as(null, `select public.accept_invite($1)`, [token]);
expect("visitor can't accept", !!r.error, r.error);

const E = await signUp("Carmen");
const ePrev = (await one(E, `select public.invite_preview($1) p`, [token])).p;
expect("signed-in preview lists unclaimed people", ePrev.people.some((p) => p.id === aAbuela) && !ePrev.people.some((p) => p.id === aMe) && ePrev.blocked === false && ePrev.member === false, JSON.stringify(ePrev));
r = await as(E, `select public.cookbook_is_disposable($1, $2)`, [aCb, E]);
expect("internal helper isn't callable", !!r.error, r.error);
r = await as(E, `select public.accept_invite($1, $2, 'Abuelita', null, 'plum', 'reenie') cb`, [token, aAbuela]);
expect("join claiming Abuela", !r.error && r.rows[0].cb === aCb, r.error);
r = await db.query(`select count(*)::int n from cookbook_members where user_id = $1`, [E]);
expect("joiner's empty personal cookbook is gone", r.rows[0].n === 1);
r = await db.query(`select name, ink, hand, user_id from family_members where id = $1`, [aAbuela]);
expect("claimed with the joiner's own pen", r.rows[0].user_id === E && r.rows[0].ink === "plum" && r.rows[0].name === "Abuelita");
r = await as(E, `select public.accept_invite($1, null, 'Again') cb`, [token]);
expect("opening the link again is harmless", !r.error && r.rows[0].cb === aCb, r.error);
r = await db.query(`select count(*)::int n from family_members where user_id = $1`, [E]);
expect("still one profile", r.rows[0].n === 1);

r = await as(E, `select id from recipes where id = $1`, [aRecipe.id]);
expect("member reads the shared cookbook", r.rows.length === 1);
r = await as(E, `insert into recipes (title, contributor_id) values ('Carmen cake', $1) returning id, cookbook_id`, [aAbuela]);
expect("member writes into the shared cookbook", !r.error && r.rows[0].cookbook_id === aCb, r.error);
const eRecipe = r.rows[0].id;
r = await as(A, `select id from recipes where id = $1`, [eRecipe]);
expect("owner sees the member's recipe", r.rows.length === 1);
const eNote = (await one(E, `insert into annotations (recipe_id, author_id, body) values ($1, $2, 'mine') returning id`, [aRecipe.id, aAbuela])).id;
expect("member signs a note as their own profile", !!eNote);
r = await as(A, `update family_members set name = 'hacked' where id = $1 returning id`, [aAbuela]);
expect("owner can't change a profile someone claimed (old write-own hole closed)", !r.error && r.rows.length === 0, JSON.stringify(r));
r = await as(A, `insert into annotations (recipe_id, author_id, body) values ($1, $2, 'forged')`, [aRecipe.id, aAbuela]);
expect("owner can't sign a note as a claimed profile", !!r.error, r.error);
r = await as(A, `insert into recipes (title, contributor_id) values ('forged', $1)`, [aAbuela]);
expect("owner can't contribute a recipe as a claimed profile", !!r.error, r.error);
r = await as(A, `update menu_items set preparer_id = $1 where gathering_id = $2 returning id`, [aAbuela, aGath]);
expect("owner can't assign a dish to a claimed profile", !!r.error, JSON.stringify(r));
r = await as(A, `update recipes set title = 'Carmen cake (edited)' where id = $1 returning id`, [eRecipe]);
expect("owner can still edit a recipe a claimed profile contributed", r.rows?.length === 1, r.error);
r = await as(A, `delete from annotations where id = $1 returning id`, [eNote]);
expect("owner can't remove a claimed profile's note", !r.error && r.rows.length === 0);
r = await as(A, `update family_members set user_id = auth.uid() where name = 'Tío' returning id`);
expect("nobody links a profile by direct update", !!r.error, r.error);
r = await as(E, `insert into family_members (name, user_id) values ('Me twice', auth.uid())`);
expect("nobody links a profile by direct insert", !!r.error, r.error);
r = await as(E, `insert into family_members (name, ink) values ('Primo', 'red') returning id`);
expect("member adds an unclaimed person", !r.error, r.error);
r = await as(A, `update family_members set ink = 'forest' where name = 'Primo' returning id`);
expect("any member changes an unclaimed person", r.rows?.length === 1, r.error);
r = await as(E, `insert into menu_items (gathering_id, recipe_id) values ($1, $2)`, [aGath, bRecipe]);
expect("member can't attach a recipe from another cookbook", !!r.error, r.error);
const bMe = (await db.query(`select id from family_members where user_id = $1`, [B])).rows[0].id;
r = await as(E, `insert into annotations (recipe_id, author_id, body) values ($1, $2, 'x')`, [aRecipe.id, bMe]);
expect("member can't sign as a person from another cookbook", !!r.error, r.error);
r = await as(E, `select public.create_invite()`);
expect("a member who isn't the owner can't make links", !!r.error, r.error);
r = await as(E, `select public.revoke_invite()`);
expect("a member who isn't the owner can't turn the link off", !!r.error, r.error);
r = await as(E, `update cookbooks set name = 'Mine now' returning id`);
expect("a member can't rename the cookbook", !r.error ? r.rows.length === 0 : true);
r = await as(A, `update cookbooks set name = 'The Moreno family cookbook' returning id`);
expect("the owner renames it", r.rows?.length === 1, r.error);
r = await as(A, `update cookbooks set created_by = null returning id`);
expect("only the name column is writable", !!r.error, r.error);
r = await as(E, `select token from cookbook_invites`);
expect("members can read the link to share it", r.rows?.length === 1);
r = await as(E, `insert into cookbook_members (cookbook_id, user_id, role) values ($1, auth.uid(), 'owner')`, [aCb]);
expect("nobody writes memberships directly", !!r.error, r.error);

// B has recipes, so joining would lose them.
r = await as(B, `select public.invite_preview($1) p`, [token]);
expect("preview says B is blocked", r.rows[0].p.blocked === true);
r = await as(B, `select public.accept_invite($1, null, 'B')`, [token]);
expect("join refused while you have a non-empty cookbook", /already have a cookbook/.test(r.error ?? ""), r.error);
r = await as(B, `select id from recipes where id = $1`, [aRecipe.id]);
expect("…and B still can't read A's cookbook", r.rows.length === 0);

// Claim race: someone else tries to claim Abuela.
const F = await signUp("Late");
r = await as(F, `select public.accept_invite($1, $2, 'Abuela')`, [token, aAbuela]);
expect("can't claim someone already claimed", /already said/.test(r.error ?? ""), r.error);
r = await db.query(`select count(*)::int n from cookbook_members where user_id = $1`, [F]);
expect("…and the failed join changed nothing", r.rows[0].n === 1);

// Turned off and expired links.
await one(A, `select public.revoke_invite()`);
r = await as(F, `select public.accept_invite($1, null, 'Late')`, [token]);
expect("turned-off link is refused", /turned off/.test(r.error ?? ""), r.error);
r = await as(null, `select public.invite_preview($1) p`, [token]);
expect("turned-off preview", r.rows[0].p.status === "revoked");
const t2 = (await one(A, `select public.create_invite() t`)).t;
expect("a new link after turning off", t2 !== token);
await db.query(`update cookbook_invites set expires_at = now() - interval '1 minute' where token = $1`, [t2]);
r = await as(F, `select public.accept_invite($1, null, 'Late')`, [t2]);
expect("expired link is refused", /expired/.test(r.error ?? ""), r.error);
r = await as(F, `select public.invite_preview($1) p`, [t2]);
expect("expired preview", r.rows[0].p.status === "expired" && !r.rows[0].p.people);

// Deleting a person someone signed with (FK set null) still works for members.
r = await as(A, `delete from family_members where name = 'Primo' returning id`);
expect("members remove unclaimed people", r.rows?.length === 1, r.error);
r = await as(A, `delete from family_members where id = $1 returning id`, [aAbuela]);
expect("claimed profiles can't be removed", !r.error && r.rows.length === 0);
r = await as(A, `delete from recipes where id = $1 returning id`, [eRecipe]);
expect("any member removes a recipe", r.rows?.length === 1, r.error);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
