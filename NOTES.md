# NOTES

Session handoff. Read this first; update it before ending a session.
Last updated: 2026-10-18, end of session 2. Deadline: Mon 2026-10-19, 11:59 pm (submission form in `technify-training-swe.pdf` §10.4).

## Where things stand

- Branch `feature/mvp`, draft PR #1 → `main`. 7 local commits not pushed yet. Repo `akris011/sobremesa` is **private** (must be public before submitting).
- Supabase project `sobremesa`, ref `nzvpdlddjywgsbnlkfkj` (US East). Migrations applied with `supabase db push`. Email confirmation is off. The auth `site_url` is still `http://127.0.0.1:3000`.
- Vercel: logged in as `akris011`. The project `sobremesa` is linked (`.vercel/`, gitignored). `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set for production and preview.
- **Not deployed yet.** The agent isn't allowed to run production deploys. Anya runs `npx vercel deploy --prod --yes`.
- Local secrets: `.env.local` (Supabase URL, publishable key, and a `VERCEL_OIDC_TOKEN` added by `vercel link`), `.env.supabase.local` (DB password). Both gitignored.
- `SKILL.md` (frontend-design) is untracked in the repo root. It's Anya's file. If agents should use it, move it to `.claude/skills/frontend-design/SKILL.md`.

## Verified

Session 2, against a production build (`npm run build && npx next start -p 3001`):
- `npm run test:rls`: 22/22 pass. It hits the Supabase API directly with the public key, creates its own accounts, and covers visitors, a second account, demo rows, the duplicate-dish constraint and `copy_sample_cookbook()`.
- `npm run test:e2e`: 20/20 steps pass at 375px with no console errors. Covers signup, recipe, note, gathering, preparer, history and sign-out; then sign-in via `?next`, decimals, validation keeping the fields, edit, delete, a gathering dated today counting as upcoming, gathering delete, and no horizontal overflow.
- Lint, `tsc` and build pass.

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

1. Deploy: `npx vercel deploy --prod --yes`. Note the `https://….vercel.app` URL.
2. Supabase auth: set `site_url` and the redirect URLs to that URL. Next session can do it via `supabase/config.toml` and `supabase config push`. Sign-in works without this because email confirmation is off, but invites and any email links need it.
3. iPhone: open the URL in **Safari** (not Chrome; only Safari can add to the Home Screen on older iOS), then Share → Add to Home Screen. Check that it opens standalone with the icon and the bottom nav clears the home indicator. Tick the two open SPEC criteria.
4. Push the 7 commits, make the repo public, merge PR #1.

## Next tasks (parallel sessions)

Briefs live in `docs/tasks/`. Each session reads this file, then its brief.
- `docs/tasks/family-invites.md`: shared cookbooks plus a join link. Rewrites RLS; owns all migrations while it runs.
- `docs/tasks/recipe-import.md`: photo, PDF, link or text into a prefilled recipe draft. Phase 1 adds no migrations, so it can run in parallel.

Rules for running them side by side:
- Merge PR #1 first, and branch both off `main`.
- One git worktree per agent.
- Only the invites branch adds migrations.
- Each opens its own PR.
- Run `test:rls` and `test:e2e` before every merge.

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
