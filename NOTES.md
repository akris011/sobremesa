# NOTES

Session handoff. Read this first; update it before ending a session.
Last updated: 2026-10-19, session 5 (family invites; migration NOT pushed). Deadline: Mon 2026-10-19, 11:59 pm (submission form in `technify-training-swe.pdf` §10.4).

## Where things stand

- PR #1 (`feature/mvp`) merged into `main` as a merge commit (`28e5b0a`), keeping the small commits. New work branches off `main`. Repo `akris011/sobremesa` is **private** (must be public before submitting).
- Supabase project `sobremesa`, ref `nzvpdlddjywgsbnlkfkj` (US East). Migrations applied with `supabase db push`. Email confirmation is off. Auth `site_url` is the Vercel URL; redirect URLs allow it plus localhost:3000/3001 (pushed with `supabase config push`).
- Vercel: logged in as `akris011`. The project `sobremesa` is linked (`.vercel/`, gitignored). `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set for production and preview.
- **Live at https://sobremesa-taupe.vercel.app.** Production deploys are Anya's call (`npx vercel deploy --prod --yes`); the agent runs one only when she asks in that session.
- **2026-10-19:** production runs the import + graphics code (deployed from `feature/recipe-import` at `515189a`, before the merge). PR #3 (graphics) and PR #2 (import) are now merged to `main` (`075ea01`), and `main`'s `src`/`tests` match what's live. `BASE_URL=https://sobremesa-taupe.vercel.app npm run test:e2e`: 24/24, no console errors. Roll back with `npx vercel rollback` if needed.
- Local secrets: `.env.local` (Supabase URL, publishable key, and a `VERCEL_OIDC_TOKEN` added by `vercel link`), `.env.supabase.local` (DB password). Both gitignored.

## Session 5: family invites (branch `feature/invites`, worktree `../sobremesa-invites`)

**Status 2026-10-19 (late):** migration applied to the live project (Anya ran `supabase db push`); then `test:rls` 53/53 and `test:e2e` 31/31 (two-phone join included) against it, no console errors. Anya decided: anyone can set who's bringing a dish, even a joined person; account deletion stays as is. Branch pushed, PR #6 open (not merged), and **deployed to production** from `feature/invites` (`sobremesa-taupe.vercel.app` now runs it, ahead of `main`). Next: merge PR #6 so `main` matches production; try the invite on real phones (share sheet, join, claim).

Built from `docs/tasks/family-invites.md` and its "Decided with Anya" section, on top of `main` after libreta and tab-latency merged (`e4dcb20`). **The migration is not pushed, nothing is deployed, nothing is pushed to GitHub.**

What changed:
- Migration `20261019120000_shared_cookbooks.sql` (additive): `cookbooks`, `cookbook_members` (owner/member, unique user_id = one cookbook per account), `cookbook_invites` (token = two v4 UUIDs, 244 random bits from `gen_random_uuid`, so it doesn't depend on where pgcrypto lives; 14 days; `revoked_at`). `cookbook_id` on all five tables, default `my_cookbook_id()`; `family_members.user_id`. Backfill: one cookbook per auth user named "<first person>'s family cookbook", owner membership, every row moved in, and each account's first family member (the one the signup trigger made) linked to it. `updated_at` is not bumped.
- RLS: the old `read demo or own` / `write own` policies are **dropped and replaced** (policies are OR'ed; keeping `write own` would let a member edit a person after someone else claimed them, or write rows into a cookbook they aren't in). New ones: read `is_demo or is_cookbook_member`; writes need membership and same-cookbook foreign keys (`member_in`, `recipe_in`, `gathering_in`). Claimed profiles: inserts check `claimed_by_other()` in RLS; changing a signer is checked by trigger `guard_shared_row` (which also freezes `cookbook_id`/`owner_id` on update); `guard_family_member` stops anyone linking a profile except `accept_invite` and the signup trigger. Both triggers act only for API roles (`authenticated`/`anon`). Cookbooks: only `name` is updatable, owner only. Memberships/invites: read by members, written only by RPCs.
- RPCs (security definer, `search_path = ''`): `invite_preview(token)` (anon ok; people listed only to a signed-in caller), `accept_invite(token, member, name, relation, ink, hand)`, `create_invite()` and `revoke_invite()` (owner only). `handle_new_user` now makes a cookbook + owner membership + linked profile. `copy_sample_cookbook()` copies into `my_cookbook_id()`.
- App: `data.ts` scopes by `cookbook_id` (cached `myCookbook()` per request) and turns `user_id` into `claimed`/`mine` flags so account ids don't reach the browser. Family page: cookbook name (owner renames), Invite family (`navigator.share`, Copy link fallback, `data-invite-url`), who has joined, Turn off this link. Invite URL is built from the request host. `/join/[token]`: unknown / turned off / expired notices; greeting + `AuthForm joining`; "Which one are you?" with `PenFields`; "already has a cookbook" notice with sign-out. Pickers offer only unclaimed people and you (`signable()`), defaulting to you. Claimed pens show "joined" and no Change for others; their notes have no remove button for others. Home header shows the cookbook name.
- Tests: new `npm run test:db` (PGlite, offline). `test:rls` + 28 checks for sharing. `test:e2e` Part 3: two phones, owner invites, guest joins as Tía Carmen, note in her ink, owner can't remove or sign it, turned-off link.

Verified (no database involved):
- `npm run test:db`: 93/93. Applies all four migrations to PGlite with a stub `auth` schema and Supabase-like roles/default grants, builds data with main's owner_id-style writes *before* the new migration, then checks main's queries/inserts/updates/copy still work *after* it, plus every sharing rule above (expired links included, which the API can't set up).
- `tsc`, lint, `npm run build` clean; `test:import` 16/16. Signed-out pages (/, /account, /gatherings, /login, /join/<bad token>) return 200 on a production build against the live DB (read-only, same queries visitors make today).
- `supabase db push --dry-run`: only `20261019120000_shared_cookbooks.sql` pending.

NOT verified (needs the migration on a database with the real Supabase stack):
- `test:rls` (old 24 + new sharing checks) and `test:e2e` (old 26 + join flow). Nothing signed in has run against the new code.
- PGlite is not Supabase: the real `auth.uid()`, PostgREST's role switching, `postgres` not being superuser, and Supabase's default grants are stubbed. Riskiest spots if it differs: the signup trigger (`handle_new_user`; a failure there blocks every signup), the `current_user` check in the guard triggers, and `revoke … from anon` on the RPCs.
- The share sheet on a real iPhone (iOS Safari needs the tap to call `navigator.share` directly; the link is made by a separate earlier tap for that reason).

Open question: staging or live push. The migration runs in one transaction (a failure leaves the DB unchanged) and main keeps working after it per `test:db`. But if a Supabase-specific difference slips through, it shows up in production right away, and undoing it means writing a new migration. Recommended: create a free second Supabase project as staging (~20 min: create, `supabase link --project-ref <staging>`, `supabase db push`, point a local `.env.local` copy at it, run `test:rls` and `test:e2e` against a production build), then push to live and deploy. If there's no time: push to live, then immediately run main's `BASE_URL=https://sobremesa-taupe.vercel.app npm run test:e2e` and `test:rls` from `main` (signup, notes, copy) before deploying this branch.

Decisions to confirm with Anya:
1. Only the owner makes or turns off the link and renames the cookbook; any member can share the open link.
2. A note signed by someone who joined can be removed only by them (the brief only said "sign as").
3. Following the binding rule literally, nobody else can set a joined person as a dish's preparer ("Carmen is bringing the flan" has to be set by Carmen). Loosen to preparer-excepted if planning feels awkward.
4. Signed-out visitors with the link see the cookbook and inviter names only; the list of people appears after sign-in.
5. An account whose cookbook has any recipe, gathering or extra person can't join (the brief's MVP rule). Alternative later: a cookbook switcher (drop `unique(user_id)` on `cookbook_members`, pick a current cookbook per session).
6. Not built: the owner removing a member; leaving a cookbook.
7. Existing: `owner_id … on delete cascade` means deleting an account deletes everything it wrote, now including rows in a shared cookbook. Fix after deploy (make it `set null` and relax the demo check).

Next steps:
1. Decide staging vs. live; push the migration; run `test:db`, `test:rls`, `test:e2e` (production build, own port, e.g. `npx next start -p 3004` + `BASE_URL=http://localhost:3004`).
2. Open the PR from `feature/invites` to `main` (ask first), merge, deploy when Anya asks.
3. Try the share sheet and the join flow on an iPhone.

## Session 4: tab latency (branch `fix/tab-latency`, not merged or deployed)

Anya: tapping a bottom-nav tab took a second or two to show the page. Cause: every page is dynamic, so a tap showed the `loading.tsx` skeleton and waited on a fresh server render (~320 ms from a laptop on the live site; more on a phone network or a cold function). Server and auth weren't the problem: TTFB ~150 ms, `getClaims` verifies locally (ES256 keys, JWKS cached), Vercel iad1 sits next to Supabase us-east-1.
- Fix: bottom-nav `<Link prefetch>` (full prefetch) + `experimental.staleTimes { dynamic: 30, static: 60 }` in `next.config.ts`. Every server action already calls `revalidatePath`, which clears the client cache.
- Verified on a production build (port 3001): tab taps went from ~320 ms to ~20 ms with no skeleton. Freshness check (a throwaway script, not committed): a new gathering and a new recipe show up right away when you open their tab; after sign-out, the tabs show none of the account's data. `test:e2e` 24/24 with no console errors, `test:rls` 22/22, `test:import` 13/13, lint and tsc clean.
- Trade-off: a change made on another device shows on the tabs within 60 s, not at once (iOS standalone mode has no pull-to-refresh).
- Anya, on her phone (signed out on the preview, since sign-in doesn't carry over between domains): tapping Add recipe lit Family. The live site does the same: signed out, /recipes/new redirects to /login, and the nav lit Family for any /login. Fix: on /login the nav lights the tab named by `?next` (`useSearchParams` inside Suspense, for the prerendered 404). Verified locally; e2e, lint and tsc pass.
- Preview: https://sobremesa-8d9vvup03-akris011s-projects.vercel.app (behind Vercel login). Anya checked it on her phone (2026-10-19): works. PR to `main` opened. Next: merge, then a production deploy when Anya asks.

## Session 6: recipe photos + more sample data (branch `feature/recipe-photos`, not pushed to GitHub)

Built after invites merged (`main` merged in at `fdf71af`).
- **Portraits.** Stock portraits removed (Anya: "kinda creepy"). Members show their initial in their ink.
- **Migration `20261020000000_recipe_photos.sql`:**
  - adds `recipes.photo_url`, checked to be `/food/<name>.jpg` or `https://`;
  - adds a public `recipe-photos` bucket at `<cookbook_id>/<file>`. Insert, select and delete are allowed only for `is_cookbook_member`. JPEG only, 5 MB;
  - re-creates the shared-cookbooks `copy_sample_cookbook()` with `photo_url` added;
  - sample photos (`public/food`, Wikimedia Commons, see `CREDITS.md`), 4 more recipes, 2 gatherings, notes and 3 line notes.
  - The "like Mamá said" note and the shortened Mari note are Libreta's line notes, not dashboard edits. They are left as they are.
- **UI:**
  - the dish photo is taped at the top of the recipe, and replaces the member snapshot on deck cards;
  - the recipe form has "A photo of the dish": shrunk to a 1600 px JPEG in the browser, uploaded by `saveRecipe`, with "Take the photo off" to remove it. `serverActions.bodySizeLimit` is 5 MB.
- **Verified:** `test:db` 104/104 offline (storage stubbed: member uploads, outsider/visitor refused, member deletes, copy keeps photos and line notes, bad `photo_url` refused). tsc and lint are clean.
- **Pushed** to the live DB by Anya (2026-10-20). Against it, on a production build (port 3001):
  - `test:e2e` passes, no console errors;
  - `test:rls` 54/54 (sample counts updated, and copies keep photos);
  - `test:import` 16/16;
  - a scripted upload: a PNG chosen on an iPhone-sized page became a 94 KB JPEG, saved into `recipe-photos/<cookbook>/…` and served with status 200. "Take the photo off" removed it.
- **Not yet:** push the branch to GitHub, PR, deploy. Production still runs the old code, which ignores `photo_url`, so visitors see the 10 sample recipes without photos until the deploy.
- **Known gap:** replacing or removing a photo leaves the old file in storage (no cleanup).

## Verified

Session 2, against a production build (`npm run build && npx next start -p 3001`):
- `npm run test:rls`: 22/22 pass. It hits the Supabase API directly with the public key, creates its own accounts, and covers visitors, a second account, demo rows, the duplicate-dish constraint and `copy_sample_cookbook()`.
- `npm run test:e2e`: 20/20 steps pass at 375px with no console errors. Covers signup, recipe, note, gathering, preparer, history and sign-out; then sign-in via `?next`, decimals, validation keeping the fields, edit, delete, a gathering dated today counting as upcoming, gathering delete, and no horizontal overflow.
- Lint, `tsc` and build pass.
- `BASE_URL=https://sobremesa-taupe.vercel.app npm run test:e2e`: 20/20 pass on the live site, no console errors. Live pages, manifest and icons return 200.

Each test run creates new Supabase accounts. Set `TEST_EMAIL="you+{tag}@gmail.com"` to make them yours and easy to delete.

## Session 4: La Libreta (branch `feature/libreta`, worktree `../sobremesa-libreta`)

From direction 02 in Anya's `sobremesa-directions.html`. Her choices: keep the serif recipe text (no typewriter), Caveat by default with a choice of hand on the profile, 12 curated inks plus "add your own color", and permission to push the migration.
- **Migration `20261019000000_libreta.sql` is already pushed to the live Supabase project.** Additive only; production (main) keeps working. Adds `family_members.hand`, widens `ink` to 12 names or `#rrggbb`, and adds line fields to `annotations` (`line_kind`, `line_text`, `strike_start/end`, `replacement`). Sample Morenos got hands and some of their notes were moved onto lines, plus two new corrections. `copy_sample_cookbook()` copies both.
- Tap a line → who's writing → rewrite it and/or add a note. `diffLine` crosses out whole words. The newest correction is drawn into the line; older corrections and notes go underneath. "Show it as first written" is a CSS `:has()` toggle. Notes on lines that later changed fall back to the margin with "On '…', as it read then".
- Pens: `src/lib/pen.ts` (`pen(member)`, `inkColor`, `readableInk` darkens custom colors to 4.5:1 against the card). Six hands: Caveat, Kalam, Cedarville Cursive, Homemade Apple, Reenie Beanie, Gochi Hand, all via next/font without preload. `font-size-adjust` per hand is tuned by eye. Older Safari (<17) ignores it, so the hands will look less even there.
- Family page: rows open into an edit form (name, relation, ink, hand); "Add someone" has a live signature preview; new people default to an unused ink. Same `PenFields` is used inline in "Someone new…" pickers.

Verified (production build, port 3003): `test:import` 16/16 (3 new: diff, placement, readable ink); `test:rls` 24/24 (copy counts updated to 11 notes, plus line edits and hands survive the copy); `test:e2e` 26/26, no console errors (new: line edit + toggle, custom pale color darkened, hand changed). tsc, lint, build clean. Screenshots of the sample flan and picadillo at 390px.

Open / next:
- Not merged, not deployed. Needs a PR (ask Anya before pushing).
- Check on an iPhone: tapping a line vs. scrolling, the native color picker, and how the hands look in iOS Safari.
- Homemade Apple ("old-world script") is the least readable hand; drop it if notes in it are hard to read on a phone.
- The deck cards still show the plain ingredients (no edits). Could show the newest correction there too.

## Session 3: recipe import (merged to `main` via PR #2)

`feature/graphics` (card deck, member photos) was merged into this branch on 2026-10-19 with no conflicts (only NOTES.md overlapped). On the combined build, `test:import` passes 13/13, `test:e2e` 24/24 with no console errors, `test:rls` 22/22, and lint, tsc and build are clean. The home deck renders with photos. One PR from this branch to `main` now carries both.

Built per `docs/tasks/recipe-import.md` phase 1, but **with no paid API** (Anya's call). /recipes/import ("Bring in a recipe", linked from /recipes/new) has three tabs; each lands on the normal form as a draft, saved only on "Add to the cookbook".
- Link: server fetch (`src/lib/import/fetch-page.ts`) reading schema.org JSON-LD. https only, port 443, no credentials in the URL; private/loopback/link-local ranges are rejected inside the request's own DNS lookup (no rebinding gap); 8 s, 2 MB, every redirect rechecked. Signed-in only. No JSON-LD → message suggesting Save as PDF or paste.
- Photo or PDF: read on the phone, not uploaded. pdf.js (legacy build, for older iOS Safari) uses the text layer; scans and photos go through Tesseract.js (eng + spa), downscaled to 2000 px. Low-confidence words are listed ("We couldn't read these words clearly: …"). Tesseract's core and language data (several MB, cached by the browser after the first run) and the pdf.js worker come from jsDelivr at pinned versions, so import needs a connection.
- Paste text: `src/lib/import/text.ts` splits by English/Spanish headings ("Ingredients", "Preparación"…), or guesses from quantities; rejoins wrapped lines into steps; drops printed-PDF headers (URLs, dates, page numbers).

Verified (production build, port 3001):
- `npm run test:import`: 9/9 offline (13/13 after the PDF work) (3 saved JSON-LD pages + a no-recipe page, 4 text cases, address guard).
- Live fetch with the real fetcher: simplyrecipes, allrecipes, bbcgoodfood, seriouseats, budgetbytes (with a redirect) all parsed, ~0.3 s each.
- `npm run test:e2e`: 24/24, no console errors. New: paste → save; text PDF → draft; photo of a printed card → OCR draft (one slip: "1large onion"); localhost link refused.
- `npm run test:rls` 22/22, lint, tsc, build pass.

PDF intelligence (after Anya's Smitten Kitchen "twisty cinnamon buns" PDF came out badly: notes as ingredients, columns merged, footer junk as steps):
- `src/lib/import/pdf-layout.ts` (built by a subagent) reads PDFs by position and font, not draw order: ALL-CAPS group headings become "Dough:"/"Filling:" lines, bold labels ("Make dough:") start steps, notes/"Do ahead" go to the story, browser header/footer and site boilerplate are dropped, ingredient lists that spill onto the next page are kept. Falls back to the text splitter when layout signals are weak.
- A PDF saved from a website records its URL; import first tries that page's JSON-LD (exact), then the layout read. Smitten Kitchen has no JSON-LD, so that recipe uses the layout path. The source URL is added to the story.
- Verified: `test:import` 13/13 (synthetic "Save as PDF" fixture with groups, page spill, bold labels, boilerplate); Anya's real PDF in the browser → 18 ingredients in 3 groups, 9 labelled steps, servings 12, in 0.8 s; `test:e2e` passes. Her PDF is not committed (copyrighted).
- Not handled yet: side-by-side ingredient columns, and servings only mentioned mid-sentence ("Makes 10 slices.").
- The recipe she already saved under "Anya" was made with the old parser; re-import it or fix it by hand.
- **On-device, 2026-10-19 (Anya, iPhone, preview `sobremesa-c3kvzhx78…`):** the cinnamon buns PDF imported correctly. Photo of a printed page and a handwritten card not yet tried.

Found and fixed: a file chosen before hydration was silently dropped (picker now disabled until hydrated); pdf.js 6's modern build calls `Math.sumPrecise` (missing in older Safari) → legacy build.

Not done / open:
- **On-device check (Anya):** a real handwritten card and a cookbook page photographed on an iPhone. Needs a deploy of this branch (preview or prod; the agent doesn't deploy to prod). Check: camera opens from the picker, HEIC photos decode (iOS normally hands over JPEG), how long the first OCR takes on cellular, and how readable handwriting comes out. Note the result here.
- Handwriting is expected to read poorly with Tesseract. If it's unusable, the options are a free-tier vision API (data may be used for training) or a paid one; decide with Anya.
- No per-user rate limit on link import (no cost now; signed-in only). Add one if abuse appears.
- Phase 2 (keep the original card image) still waits for invites.

## Fixed in session 1 (from the SPEC review)

1. Pasted lists turned "1.5 cups" into "5 cups". `17b95d2`
2. Upcoming/past used the UTC date, so tonight's dinner showed as past on US evenings. `b2a98be`
3. `?next=` after sign-in was ignored. `c4ced79`
4. A server-side validation error wiped every form field (React 19 auto-reset). `6928b1a`

## Known limitations (accepted for the MVP)

- One fixed time zone (America/New_York) for upcoming vs. past.
- Opening someone else's private page shows "not in the book" with status 200, not 404 (streaming through `loading.tsx`). No data leaks.
- Right after deleting a gathering, the list can show it for under a second before refreshing.
- Delete actions don't show an error if the delete fails.
- The dev server once stalled a request for 3.5 minutes; it never happened on the production build.

## To get it on a phone (Anya)

1. ~~Deploy~~ done. ~~Supabase auth URLs~~ done.
2. iPhone: open the URL in **Safari** (not Chrome; only Safari can add to the Home Screen on older iOS), then Share → Add to Home Screen. Check that it opens standalone with the icon and the bottom nav clears the home indicator. Tick the two open SPEC criteria.
3. Make the repo public (ask first).

## Next tasks (parallel sessions)

Briefs live in `docs/tasks/`. Each session reads this file, then its brief.
- `docs/tasks/family-invites.md`: built on `feature/invites` (session 5); migration not pushed yet. Owns all migrations while it runs.
- `docs/tasks/recipe-import.md`: phase 1 built and merged (PR #2, free, no API key). Still to try on a phone: a photographed printed page and a handwritten card.

Rules for running them side by side:
- Branch both off `main`.
- One git worktree per agent.
- Only the invites branch adds migrations.
- Each opens its own PR.
- Run `test:rls` and `test:e2e` before every merge.
- Worktrees don't get gitignored files: copy `.env.local` into each one. The invites worktree also needs `supabase link --project-ref nzvpdlddjywgsbnlkfkj` and `.env.supabase.local`.
- Each worktree runs its production server on its own port (e.g. 3001 and 3002) and sets `BASE_URL` for `test:e2e`.
- **There is only one Supabase project, and the live app uses it.** `supabase db push` from the invites branch changes production right away, while the deployed code still expects the old schema. Either make the migration additive (add `cookbook_id` and the new tables without breaking `owner_id` queries, and drop old columns only after the new code is deployed), or create a second free Supabase project as staging first. Decide this before the first push.
- Vercel isn't connected to the GitHub repo, so merging to `main` does **not** deploy. Connect it (Vercel dashboard → Project → Settings → Git) to get a production deploy on merge and a preview URL per PR. Previews also use the one Supabase project.

## Graphics branch (`feature/graphics`, worktree `../sobremesa-graphics`)

Goal: a homier, less generic look, merged in with the feature branches later. No migrations.
- Done (`da2d80a`):
  - Home opens on a swipeable deck of lined index cards (`RecipeDeck`, CSS scroll-snap, arrows and "Card 2 of 6").
  - Each card shows the ingredients in the contributor's hand and ink, plus a taped `Snapshot` of them.
  - "The whole box" (`/?view=box`) lists every recipe A–Z behind divider tabs.
  - The recipe header has the snapshot, and its text sits on the printed lines.
- Photos: `photoFor(member)` in `src/lib/photos.ts` is the only place that picks a member's picture.
  - The 5 sample Morenos have placeholder portraits from randomuser.me in `public/people/`, keyed by their fixed ids.
  - Everyone else, including members copied from the sample (they get new ids), shows their initial in their ink.
  - Real uploads (after invites merges): Storage bucket, policies on the cookbook (not `owner_id`, which invites replaces), then have `photoFor` return the stored URL first. Cards don't change.
  - Before the repo goes public, decide whether the randomuser portraits can stay. Their license is informal; Unsplash or illustrations would be cleaner. There's no old-looking face, so Abuela's photo is younger than she should be.
- Verified: tsc, lint and build pass; `test:e2e` 20/20 against a production build on port 3002; screenshots at 375px.
- Next ideas: restyle gatherings and the margin notes to match; check the deck on a real iPhone (swipe vs. the edge-swipe-back gesture).
- Merge risk: `ui.tsx` and `recipes/[id]/page.tsx` may conflict with recipe-import. Merge this after the feature branches and resolve the conflicts here.

## Open questions

1. Deadline risk: both features land the day of submission. Recommended order:
   1. Deploy, go public, merge the MVP and record a baseline video first.
   2. Then build invites, and re-record if it merges by Monday evening.
   3. Import is a bonus.
2. Invites: reusable group-chat link (recommended) or single-use links? Can any member edit everything, or only the owner deletes?
3. Import: answered: no paid API. Revisit only if the on-device handwriting test is unusable.
4. Delete the old test accounts (`sobremesa.e2e+…`, `sobremesa.rls+…`, `sobremesa.copy+…` @gmail.com) in the Supabase dashboard before recording.
5. Fresh-session code review of the branch against SPEC.md before merging (session 1 was self-review).
6. README: setup and architecture.
