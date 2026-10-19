# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Sobremesa: a mobile-first family cookbook PWA built around gatherings. Recipes, the dinners they were served at, who made them, and handwritten-style margin notes in each family member's ink. Scope and acceptance criteria live in `SPEC.md`; read it before adding features. Briefs for in-flight feature work live in `docs/tasks/`.

@AGENTS.md

## Commands

- Dev: `npm run dev` (http://localhost:3000)
- Type-check: `npx tsc --noEmit` (run `npx next typegen` first if `PageProps`/`LayoutProps` are missing)
- Lint: `npm run lint`
- Build: `npm run build`
- Tests: `npm run test:rls` (RLS against the live Supabase API) and `npm run test:e2e` (browser flows; needs `npx next start -p 3001` running, or `BASE_URL=…`). Run both before merging.
- Apply DB migrations to the linked Supabase project: `supabase db push`
- Env: copy `.env.example` to `.env.local`. Only the Supabase URL and publishable key are needed; there is no server secret.

## Architecture

- Next.js 16 App Router, React 19, Tailwind v4 (tokens in `src/app/globals.css` `@theme`), Supabase via `@supabase/ssr`.
- Next 16 renames middleware to `src/proxy.ts`; it only refreshes the Supabase session cookie.
- Reads: Server Components call `src/lib/data.ts`. Each query is filtered to the signed-in user's rows, or to `is_demo = true` for visitors. That filter picks what to show; RLS is what enforces access.
- Writes: Server Actions in `src/app/actions.ts`, called from client forms via `useActionState`. They return `{ error }` / `{ ok }` or redirect, and `revalidatePath("/", "layout")` after changes.
- "Family members" are people, not accounts. Forms choose one, or pick "Someone new…" (`__new`) and type a name + ink; `resolvePerson` creates the member inline.
- Schema, RLS, signup trigger and `copy_sample_cookbook()` RPC: `supabase/migrations/*_init.sql`. Sample (Moreno family) data: `*_sample_cookbook.sql`. Schema changes go in a new migration file, never by editing applied ones.

## Rules

- Every table has RLS. Write policies must also check that referenced rows (recipe, gathering, family member) belong to the caller; use the `owns_*` helpers.
- Demo rows (`is_demo`, `owner_id null`) are never writable through the API. Don't add a service-role key to get around this.
- Design: aged paper, warm brown ink, burgundy accent. Fonts: Cormorant Garamond (display), Newsreader (body), Caveat (handwriting only). No emoji icons (inline SVGs live in `src/components/icons.tsx`), no gradients, no heavy rounded cards. Use the `.index-card`, `.field`, `.btn`, `.eyebrow`, `.hand`, `.ink-*` classes rather than one-off styles.
- Phone first (375–430px). Inputs at 16px+ so iOS doesn't zoom. Respect safe-area insets; the bottom nav height is `--nav-h`.
- UI copy is plain and specific ("Add to the menu", not "Submit"). No marketing tone.
- Forms that call a `useActionState` action use `<ActionForm>` from `form-bits.tsx`, not `<form action>`; React's auto-reset would wipe the fields on a validation error.

## Workflow

- Start every session by reading `NOTES.md`. Before ending, update it: what changed, what was verified, open questions, next step.
- One session per task. Keep state in files (`NOTES.md`, `SPEC.md`), not in the chat.
- Work on a feature branch. Commit each verified change on its own, when it's done, with a message that says why. Ask before pushing, merging or changing repo visibility.
- Verify flows in a browser against a production build (`npm run build && npx next start -p 3001`); the dev server has stalled requests.
- After two failed fixes for the same problem, stop, revert, and write what you learned in `NOTES.md`.
