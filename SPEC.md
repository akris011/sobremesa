# Sobremesa MVP spec

A family cookbook organized around the gatherings where recipes are served. Source of truth for vision: `Sobremesa Project Proposal.pdf`. This spec is the MVP cut, due Oct 19, 2026.

## Scope

In:
- Cookbook: browse, view, add, edit, delete recipes (title, description, servings, ingredients, method, story, contributor).
- Gatherings: create, browse upcoming/past, view, delete. Menu built from cookbook recipes, each dish with an optional preparer and note.
- Margin notes: handwritten-style annotations on a recipe, each by a family member in that member's ink and hand. The recipe text is never changed by a note.
- La Libreta (line edits): tap an ingredient or step, choose who's writing, rewrite it. The changed words are crossed out in their ink and their version is written beside it; a note can go beside the line too. "Show it as first written" hides every edit. If the recipe itself is later edited and the line changes, its notes move to the margin.
- Recipe history: every gathering a recipe was served at, and who made it.
- Family: named people (not accounts) with an ink (12 named pens or a custom color, darkened if too pale to read) and a handwriting (Caveat by default, 6 to choose from), shown as a live signature while choosing. Name, relation, ink and hand can be changed later. Used as recipe contributor, note author and dish preparer.
- Auth: email + password (Supabase). One cookbook per account (yours, or the one you joined).
- Shared cookbooks: the owner makes one reusable invite link for the family group chat ("Invite family" opens the phone's share sheet; "Copy link" otherwise). It lasts 14 days and the owner can turn it off. Opening it → sign up or sign in → "Which one are you?" (claim a person already in the book) or "I'm not listed" → choose your name, ink and hand. Then you read and write the same cookbook. The Family page shows who has joined; the owner can rename the cookbook. An account whose own cookbook already has recipes or people can't join another (yet).
- Claimed profiles: once someone has joined as a person, only their account can change that person's pen, sign notes, recipes or dishes as them, or remove their notes. People without accounts (Abuela) stay editable by any member until claimed.
- Public sample cookbook (the fictional Moreno family), read-only, shown to signed-out visitors. Signed-in users can copy it into their own cookbook.
- Installable PWA (manifest, icons, standalone, safe areas).
- Recipe import ("Bring in a recipe"): a photo, PDF, link or pasted text becomes a prefilled draft of the normal recipe form. Nothing saves until the user presses "Add to the cookbook". Free: links use the page's schema.org JSON-LD; PDFs and photos are read on the phone (pdf.js, Tesseract OCR in English + Spanish). Printed recipes read well; handwriting is best effort.

Next (briefs in `docs/tasks/`): keeping the original card image with an imported recipe; a cookbook switcher (more than one cookbook per account); the owner removing a member.

Out (deferred): photos, recipe scaling, print/PDF, AI menu planner, notifications, offline.

## Data

All tables: `cookbook_id` (null for sample rows), `owner_id` (who wrote it; null for sample rows), `is_demo`.

| Table | Key fields | Notes |
|---|---|---|
| cookbooks | name, created_by | One per account at signup ("Mari's family cookbook"); the owner renames it. |
| cookbook_members | cookbook_id, user_id, role (owner, member) | unique user_id: one cookbook per account for now. Written only by RPCs. |
| cookbook_invites | token (≥128 random bits), cookbook_id, expires_at (+14 days), revoked_at | Written only by `create_invite` / `revoke_invite`. |
| family_members | name, relation, ink, hand, user_id | ink ∈ 12 named pens or `#rrggbb`; hand ∈ caveat, kalam, cedarville, homemade, reenie, gochi. A trigger creates one for each new account, linked to it (user_id). |
| recipes | title, description, story, ingredients[], instructions[], servings, contributor_id → family_members | |
| gatherings | name, held_on (date), location, description | Upcoming = held_on ≥ today. |
| menu_items | gathering_id, recipe_id, preparer_id → family_members, note | unique (gathering_id, recipe_id): a dish can't be on a menu twice. |
| annotations | recipe_id, author_id → family_members, body, line_kind, line_text, strike_start, strike_end, replacement | Line fields are null for a general margin note. |

RLS on every table:
- Select: `is_demo or is_cookbook_member(cookbook_id)`.
- Insert/update/delete: members of the row's cookbook, never `is_demo`, and every foreign key must point into the same cookbook.
- A claimed profile (`user_id` set) is changed, signed as, or has its notes removed only by its own account. Only the owner makes or turns off the link and renames the cookbook.

## Flows

1. Visitor opens the URL → sample cookbook → recipe with notes and history → gathering menu. No edit controls shown; writes are rejected by RLS anyway.
2. Sign up (name, email, password) → empty cookbook with "Write the first recipe" or "Start from the sample recipes".
3. Add recipe → lands on the recipe page with "Saved".
4. Write in the margin → choose who's writing (or add someone with an ink) → note appears in their ink.
5. Plan a gathering → menu page → add a dish, choose who's bringing it → dish disappears from the "add" list.
6. Open the recipe → "At the table" lists that gathering and the preparer.
7. Family → Make an invite link → Invite family (share sheet) → a relative opens it → signs up → "Which one are you?" → picks Tía Carmen, her ink and hand → lands in the shared cookbook; her notes default to her.

## Acceptance criteria

Checked = verified in a browser or against the API; see NOTES.md for how.

- [ ] Public URL loads on an iPhone, no horizontal scroll at 375px, bottom nav clears the home indicator. (Public URL and 375px verified with the e2e test on https://sobremesa-taupe.vercel.app; on-device iPhone check pending.)
- [x] Signed-out visitor can browse sample recipes, notes and gatherings.
- [x] Sign up and sign in work; sign out returns to the sample cookbook.
- [x] Created recipe persists after reload.
- [x] Margin note shows in the author's ink with name and date.
- [x] Line edit: rewriting "1 cup sugar" as "3/4 cup sugar" crosses out "1" and writes "3/4" in the writer's hand and ink; "Show it as first written" hides it. (`test:e2e`, `test:import` for the diff.)
- [x] New family member with a pale custom color gets it darkened; hand and ink can be changed later. (`test:e2e`)
- [x] Gathering created; recipe added with a preparer; adding the same recipe again is impossible.
- [x] That gathering appears in the recipe's history with the preparer.
- [x] A second account cannot read or change the first account's rows (checked via the API, not just the UI).
- [ ] Invites: the owner shares a link; a guest signs up from it, claims a person, and writes a note that the owner sees in the guest's ink. A non-member can't read or write the shared cookbook; a turned-off or expired link is refused; nobody signs as or edits someone else's claimed profile. (`test:db` passes offline against the migration; `test:rls` and `test:e2e` are written and wait for the migration to be pushed.)
- [x] `npm run build`, `npx tsc --noEmit`, `npm run lint` pass. No console errors on the main flows.
- [ ] "Add to Home Screen" opens standalone with the Sobremesa icon.
- [x] Import: pasted text, a text PDF and a photo of a printed card each land on a prefilled form; the draft saves only on "Add to the cookbook". Link import reads JSON-LD and refuses non-https and private addresses. (`test:import` offline, `test:e2e` in the browser, live fetch of five recipe sites.)
- [ ] Import on an iPhone: a saved recipe PDF works (Anya, Oct 19). Still to try: a photographed printed page and a handwritten card. Results in NOTES.md.
