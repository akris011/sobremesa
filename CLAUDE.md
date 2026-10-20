# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Sobremesa: a mobile-first family cookbook PWA built around gatherings. Recipes, the dinners they were served at, who made them, and handwritten-style margin notes in each family member's ink. Scope and acceptance criteria live in `SPEC.md`; read it before adding features. Briefs for in-flight feature work live in `docs/tasks/`.

@AGENTS.md

## Commands

- Dev: `npm run dev` (http://localhost:3000)
- Type-check: `npx tsc --noEmit` (run `npx next typegen` first if `PageProps`/`LayoutProps` are missing)
- Lint: `npm run lint`
- Build: `npm run build`
- Tests: `npm run test:import` (import parsers and link guard, offline), `npm run test:db` (every migration applied to in-process PGlite with a stub auth schema, then RLS checked as different roles; offline, never touches Supabase), `npm run test:rls` (RLS against the live Supabase API) and `npm run test:e2e` (browser flows; needs `npx next start -p 3001` running, or `BASE_URL=…`). Run all four before merging; run `test:db` before every `supabase db push`.
- Apply DB migrations to the linked Supabase project: `supabase db push`
- Env: copy `.env.example` to `.env.local`. Only the Supabase URL and publishable key are needed; there is no server secret.

## Architecture

- Next.js 16 App Router, React 19, Tailwind v4 (tokens in `src/app/globals.css` `@theme`), Supabase via `@supabase/ssr`.
- Next 16 renames middleware to `src/proxy.ts`; it only refreshes the Supabase session cookie.
- Reads: Server Components call `src/lib/data.ts`. Each query is filtered to the signed-in user's cookbook (`cookbook_id`, from `cookbook_members`), or to `is_demo = true` for visitors. That filter picks what to show; RLS is what enforces access.
- Writes: Server Actions in `src/app/actions.ts`, called from client forms via `useActionState`. They return `{ error }` / `{ ok }` or redirect, and `revalidatePath("/", "layout")` after changes.
- Recipe import: pure parsers in `src/lib/import/` (`jsonld.ts`, `text.ts`, no `@/` imports so Node runs them in tests), the guarded link fetcher in `fetch-page.ts` (server-only), the one server action in `src/app/import-actions.ts`. Photos and PDFs are read in the browser (`read-file.ts`); Tesseract and the pdf.js worker load from jsDelivr at pinned versions. No paid API: don't add a model call without asking.
- Anything a family member wrote is drawn with `pen(member)` from `src/lib/pen.ts` (their hand class + ink color inline). Inks are 12 named pens or a custom `#rrggbb`, darkened to stay readable; never use per-ink CSS classes.
- La Libreta: a note can sit on one ingredient/step line (`line_text`) and cross out a range of it (`strike_start/end`) with a `replacement`. The recipe row never changes. Notes whose line has since changed fall back to the margin (`placeNotes` in `src/lib/libreta.ts`).
- Cookbooks are shared. `cookbooks`, `cookbook_members (role owner|member, one cookbook per account for now)`, `cookbook_invites` (one reusable link, 14 days, owner can revoke). Every row has `cookbook_id` (defaults to the caller's cookbook) and `owner_id`, which now means "who wrote it". Joining goes through the `invite_preview` / `accept_invite` RPCs at `/join/[token]`; the owner uses `create_invite` / `revoke_invite`.
- "Family members" are people, not accounts. `family_members.user_id` links one to an account once they join ("Which one are you?"); that's their own profile. Forms choose a person, or pick "Someone new…" (`__new`) and type a name + ink; `resolvePerson` creates the member inline. Pickers use `signable()`: unclaimed people and yourself.
- Schema: `supabase/migrations/*_init.sql`; inks/hands/line notes: `*_libreta.sql`; cookbooks, invites, current RLS, signup trigger and `copy_sample_cookbook()`: `*_shared_cookbooks.sql`. Sample (Moreno family) data: `*_sample_cookbook.sql`. Schema changes go in a new migration file, never by editing applied ones.

## Rules

- Every table has RLS. Reads and writes go through `is_cookbook_member(cookbook_id)`. Write policies must also check that referenced rows (recipe, gathering, family member) are in the same cookbook; use `recipe_in` / `gathering_in` / `member_in` (the old `owns_*` helpers are unused and kept only so nothing breaks).
- A claimed profile belongs to its account: only that account changes it, signs as it (contributor, preparer, note author) or removes its notes. Inserts check `claimed_by_other()` in RLS; changing a signer is checked by the `guard_shared_row` trigger (RLS can't see the old row). Unclaimed people are editable by any member. Profiles are linked only by `accept_invite` or the signup trigger.
- Policies are OR'ed: never add a permissive policy beside these without checking it doesn't reopen a hole. Security definer functions use `set search_path = ''` and qualified names, and revoke execute from `public, anon` (Supabase grants anon directly).
- Demo rows (`is_demo`, `owner_id null`) are never writable through the API. Don't add a service-role key to get around this.
- Design: aged paper, warm brown ink, burgundy accent. Fonts: Cormorant Garamond (display), Newsreader (body), and for handwriting only Caveat (default) plus the five other hands in `src/lib/pen.ts`. No emoji icons (inline SVGs live in `src/components/icons.tsx`), no gradients, no heavy rounded cards. Use the `.index-card`, `.field`, `.btn`, `.eyebrow`, `.hand`, `.ink-*` classes rather than one-off styles.
- Phone first (375–430px). Inputs at 16px+ so iOS doesn't zoom. Respect safe-area insets; the bottom nav height is `--nav-h`.
- UI copy is plain and specific ("Add to the menu", not "Submit"). No marketing tone.
- Forms that call a `useActionState` action use `<ActionForm>` from `form-bits.tsx`, not `<form action>`; React's auto-reset would wipe the fields on a validation error.

## Workflow

- Start every session by reading `NOTES.md`. Before ending, update it: what changed, what was verified, open questions, next step.
- One session per task. Keep state in files (`NOTES.md`, `SPEC.md`), not in the chat.
- Work on a feature branch. Commit each verified change on its own, when it's done, with a message that says why. Ask before pushing, merging or changing repo visibility.
- Verify flows in a browser against a production build (`npm run build && npx next start -p 3001`); the dev server has stalled requests.
- After two failed fixes for the same problem, stop, revert, and write what you learned in `NOTES.md`.
