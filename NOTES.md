# NOTES

Session handoff. Read this first; update it before ending a session.
Last updated: 2026-10-18, end of session 1. Deadline: Mon 2026-10-19, 11:59 pm (submission form in `technify-training-swe.pdf` §10.4).

## Where things stand

- Branch `feature/mvp`, draft PR #1 → `main`. Repo `akris011/sobremesa` is **private** (must be public before submitting).
- Supabase project `sobremesa`, ref `nzvpdlddjywgsbnlkfkj` (US East). Migrations applied with `supabase db push`. Email confirmation is off. The auth `site_url` is still `http://127.0.0.1:3000`.
- Local secrets: `.env.local` (URL + publishable key), `.env.supabase.local` (DB password). Both gitignored.
- **Not deployed yet.** Vercel CLI login is needed: run `npx vercel login` in a normal Terminal (the `!` prefix in Claude Code can't do browser logins).

## Verified (session 1)

Headless Chromium against a production build (`npm run build && npx next start -p 3001`):
- Visitor: sample cookbook, recipe, gatherings, family pages render. No console errors.
- Sign up, sign in (wrong password shows an error), `?next=` return, sign out.
- Recipe create, edit, delete. Persists after reload. "1.5 cups" kept intact. Validation errors keep the typed fields.
- Margin note in the author's ink. Gathering create/delete. Dish assigned, can't be added twice. Gathering shows in the recipe's history with its preparer. A gathering dated today counts as upcoming.
- No horizontal overflow at 375px or 390px.
- RLS, tested directly against the Supabase API with the public key: 16/16 pass. Visitors and a second account can't read or write another account's rows or the sample rows; duplicate dish rejected by the database.
- `copy_sample_cookbook()` copies 6 people, 6 recipes, 4 gatherings, 12 dishes, 9 notes; refuses if the cookbook isn't empty.

The test scripts live outside the repo (Claude's scratchpad), so they can't be rerun from here yet. See open question 1.

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
- The dev server once stalled a request for 3.5 minutes; it never happened on the production build. If it recurs, test with `next start`.

## Open questions / next steps

1. Move the e2e and RLS scripts into the repo (`tests/`, `npm run test:e2e`) so the security claim is reproducible? (Recommended.)
2. Test accounts in Supabase use plus-addressed `@gmail.com` emails (`sobremesa.e2e+…`, `sobremesa.rls+…`, `sobremesa.copy+…`). Delete them before recording, and use an address Anya controls next time.
3. Deploy to Vercel, add env vars there, then set the Supabase auth `site_url` to the Vercel URL.
4. On-device iPhone check: safe areas, Add to Home Screen, standalone mode.
5. Fresh-session code review of the branch against SPEC.md before merging. Session 1's review was self-review by the agent that wrote the code.
6. README: setup and architecture. Make the repo public. Merge the PR. Record the video (under 3 min).
