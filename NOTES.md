# NOTES

Session handoff. Read this first; update it before ending a session.
Last updated: 2026-10-19, session 3 (recipe import). Deadline: Mon 2026-10-19, 11:59 pm (submission form in `technify-training-swe.pdf` §10.4).

## Where things stand

- PR #1 (`feature/mvp`) merged into `main` as a merge commit (`28e5b0a`), keeping the small commits. New work branches off `main`. Repo `akris011/sobremesa` is **private** (must be public before submitting).
- Supabase project `sobremesa`, ref `nzvpdlddjywgsbnlkfkj` (US East). Migrations applied with `supabase db push`. Email confirmation is off. Auth `site_url` is the Vercel URL; redirect URLs allow it plus localhost:3000/3001 (pushed with `supabase config push`).
- Vercel: logged in as `akris011`. The project `sobremesa` is linked (`.vercel/`, gitignored). `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set for production and preview.
- **Live at https://sobremesa-taupe.vercel.app.** Production deploys are Anya's call (`npx vercel deploy --prod --yes`); the agent runs one only when she asks in that session.
- **2026-10-19:** production runs the import + graphics code (deployed from `feature/recipe-import` at `515189a`, before the merge). PR #3 (graphics) and PR #2 (import) are now merged to `main` (`075ea01`), and `main`'s `src`/`tests` match what's live. `BASE_URL=https://sobremesa-taupe.vercel.app npm run test:e2e`: 24/24, no console errors. Roll back with `npx vercel rollback` if needed.
- Local secrets: `.env.local` (Supabase URL, publishable key, and a `VERCEL_OIDC_TOKEN` added by `vercel link`), `.env.supabase.local` (DB password). Both gitignored.

## Verified

Session 2, against a production build (`npm run build && npx next start -p 3001`):
- `npm run test:rls`: 22/22 pass. It hits the Supabase API directly with the public key, creates its own accounts, and covers visitors, a second account, demo rows, the duplicate-dish constraint and `copy_sample_cookbook()`.
- `npm run test:e2e`: 20/20 steps pass at 375px with no console errors. Covers signup, recipe, note, gathering, preparer, history and sign-out; then sign-in via `?next`, decimals, validation keeping the fields, edit, delete, a gathering dated today counting as upcoming, gathering delete, and no horizontal overflow.
- Lint, `tsc` and build pass.
- `BASE_URL=https://sobremesa-taupe.vercel.app npm run test:e2e`: 20/20 pass on the live site, no console errors. Live pages, manifest and icons return 200.

Each test run creates new Supabase accounts. Set `TEST_EMAIL="you+{tag}@gmail.com"` to make them yours and easy to delete.

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
- `docs/tasks/family-invites.md`: shared cookbooks plus a join link. Rewrites RLS; owns all migrations while it runs.
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
