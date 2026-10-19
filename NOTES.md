# NOTES

Session handoff. Read this first; update it before ending a session.
Last updated: 2026-10-19, end of session 2. Deadline: Mon 2026-10-19, 11:59 pm (submission form in `technify-training-swe.pdf` §10.4).

## Where things stand

- PR #1 (`feature/mvp`) merged into `main` as a merge commit (`28e5b0a`), keeping the small commits. New work branches off `main`. Repo `akris011/sobremesa` is **private** (must be public before submitting).
- Supabase project `sobremesa`, ref `nzvpdlddjywgsbnlkfkj` (US East). Migrations applied with `supabase db push`. Email confirmation is off. Auth `site_url` is the Vercel URL; redirect URLs allow it plus localhost:3000/3001 (pushed with `supabase config push`).
- Vercel: logged in as `akris011`. The project `sobremesa` is linked (`.vercel/`, gitignored). `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set for production and preview.
- **Live at https://sobremesa-taupe.vercel.app** (deployed by Anya with `npx vercel deploy --prod --yes`; the agent isn't allowed to run production deploys).
- Local secrets: `.env.local` (Supabase URL, publishable key, and a `VERCEL_OIDC_TOKEN` added by `vercel link`), `.env.supabase.local` (DB password). Both gitignored.

## Verified

Session 2, against a production build (`npm run build && npx next start -p 3001`):
- `npm run test:rls`: 22/22 pass. It hits the Supabase API directly with the public key, creates its own accounts, and covers visitors, a second account, demo rows, the duplicate-dish constraint and `copy_sample_cookbook()`.
- `npm run test:e2e`: 20/20 steps pass at 375px with no console errors. Covers signup, recipe, note, gathering, preparer, history and sign-out; then sign-in via `?next`, decimals, validation keeping the fields, edit, delete, a gathering dated today counting as upcoming, gathering delete, and no horizontal overflow.
- Lint, `tsc` and build pass.
- `BASE_URL=https://sobremesa-taupe.vercel.app npm run test:e2e`: 20/20 pass on the live site, no console errors. Live pages, manifest and icons return 200.

Each test run creates new Supabase accounts. Set `TEST_EMAIL="you+{tag}@gmail.com"` to make them yours and easy to delete.

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
- `docs/tasks/recipe-import.md`: photo, PDF, link or text into a prefilled recipe draft. Phase 1 adds no migrations, so it can run in parallel.

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
- Snapshot shows the person's initial in their ink. A real photo needs Storage, a `photo_url` column and a migration; do that after invites merges. `Snapshot` already takes `src`.
- Verified: tsc, lint and build pass; `test:e2e` 20/20 against a production build on port 3002; screenshots at 375px.
- Next ideas: restyle gatherings and the margin notes to match; check the deck on a real iPhone (swipe vs. the edge-swipe-back gesture).
- Merge risk: `ui.tsx` and `recipes/[id]/page.tsx` may conflict with recipe-import. Merge this after the feature branches and resolve the conflicts here.

## Open questions

1. Deadline risk: both features land the day of submission. Recommended order:
   1. Deploy, go public, merge the MVP and record a baseline video first.
   2. Then build invites, and re-record if it merges by Monday evening.
   3. Import is a bonus.
2. Invites: reusable group-chat link (recommended) or single-use links? Can any member edit everything, or only the owner deletes?
3. Import: OK to add the first server secret (`ANTHROPIC_API_KEY`) and pay per image? Tesseract (free) can't read handwriting usefully.
4. Delete the old test accounts (`sobremesa.e2e+…`, `sobremesa.rls+…`, `sobremesa.copy+…` @gmail.com) in the Supabase dashboard before recording.
5. Fresh-session code review of the branch against SPEC.md before merging (session 1 was self-review).
6. README: setup and architecture.
