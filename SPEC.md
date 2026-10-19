# Sobremesa MVP spec

A family cookbook organized around the gatherings where recipes are served. Source of truth for vision: `Sobremesa Project Proposal.pdf`. This spec is the MVP cut, due Oct 19, 2026.

## Scope

In:
- Cookbook: browse, view, add, edit, delete recipes (title, description, servings, ingredients, method, story, contributor).
- Gatherings: create, browse upcoming/past, view, delete. Menu built from cookbook recipes, each dish with an optional preparer and note.
- Margin notes: handwritten-style annotations on a recipe, each by a family member in that member's ink. The recipe text is never changed by a note.
- Recipe history: every gathering a recipe was served at, and who made it.
- Family: named people (not accounts) with an ink color. Used as recipe contributor, note author and dish preparer.
- Auth: email + password (Supabase). One cookbook per account.
- Public sample cookbook (the fictional Moreno family), read-only, shown to signed-out visitors. Signed-in users can copy it into their own cookbook.
- Installable PWA (manifest, icons, standalone, safe areas).

Out (deferred): family invitations/shared membership, photos, recipe scaling, print/PDF, AI menu planner, notifications, offline.

## Data

All tables: `owner_id` (auth user, null for sample rows), `is_demo`.

| Table | Key fields | Notes |
|---|---|---|
| family_members | name, relation, ink | ink ∈ sepia, burgundy, olive, terracotta, indigo, plum. A trigger creates one for each new account. |
| recipes | title, description, story, ingredients[], instructions[], servings, contributor_id → family_members | |
| gatherings | name, held_on (date), location, description | Upcoming = held_on ≥ today. |
| menu_items | gathering_id, recipe_id, preparer_id → family_members, note | unique (gathering_id, recipe_id): a dish can't be on a menu twice. |
| annotations | recipe_id, author_id → family_members, body | |

RLS on every table:
- Select: `is_demo or owner_id = auth.uid()`.
- Insert/update/delete: own rows only, never `is_demo`, and every foreign key must point at the caller's own rows.

## Flows

1. Visitor opens the URL → sample cookbook → recipe with notes and history → gathering menu. No edit controls shown; writes are rejected by RLS anyway.
2. Sign up (name, email, password) → empty cookbook with "Write the first recipe" or "Start from the sample recipes".
3. Add recipe → lands on the recipe page with "Saved".
4. Write in the margin → choose who's writing (or add someone with an ink) → note appears in their ink.
5. Plan a gathering → menu page → add a dish, choose who's bringing it → dish disappears from the "add" list.
6. Open the recipe → "At the table" lists that gathering and the preparer.

## Acceptance criteria

- [ ] Public URL loads on an iPhone, no horizontal scroll at 375px, bottom nav clears the home indicator.
- [ ] Signed-out visitor can browse sample recipes, notes and gatherings.
- [ ] Sign up and sign in work; sign out returns to the sample cookbook.
- [ ] Created recipe persists after reload.
- [ ] Margin note shows in the author's ink with name and date.
- [ ] Gathering created; recipe added with a preparer; adding the same recipe again is impossible.
- [ ] That gathering appears in the recipe's history with the preparer.
- [ ] A second account cannot read or change the first account's rows (checked via the API, not just the UI).
- [ ] `npm run build`, `npx tsc --noEmit`, `npm run lint` pass. No console errors on the main flows.
- [ ] "Add to Home Screen" opens standalone with the Sobremesa icon.
