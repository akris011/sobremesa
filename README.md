# Sobremesa

A family cookbook organized around the dinners where the recipes get made. Each recipe keeps who it came from, the gatherings it was served at (and who brought it), and handwritten-style margin notes from family members, each in their own ink.

**Live:** https://sobremesa-taupe.vercel.app (built for phones; on an iPhone, open it in Safari and use Share → Add to Home Screen).

## Try it

1. Open the link signed out. You're reading the sample cookbook of the Moreno family (fictional). Swipe the deck, open a recipe, read the margin notes and "At the table", open a gathering.
2. Tap **Start your own** and sign up (name, email, password; no confirmation email).
3. Your cookbook starts empty. Write a recipe, or copy the Moreno recipes in with **Start from the sample recipes**.
4. Add a recipe, or use **Bring in a recipe** to start from a link, a photo, a PDF or pasted text. Nothing saves until you press "Add to the cookbook".
5. On a recipe, write in the margin as yourself or as a new family member with their own ink.
6. Plan a gathering, add dishes from the cookbook and choose who's bringing each one. The recipe's "At the table" history then lists that dinner.

## How it fits together

```
phone (PWA) ──► Next.js on Vercel ──► Supabase (Postgres + Auth)
                 │                     │
                 ├ Server Components   ├ row-level security on every table
                 │  read via data.ts   ├ trigger: new account → first family member
                 └ Server Actions      └ RPC: copy_sample_cookbook()
                    write via actions.ts
```

- **Frontend:** Next.js 16 App Router, React 19, Tailwind v4. Pages are Server Components. The bottom nav prefetches each tab, so tab switches show cached pages right away.
- **Reads:** `src/lib/data.ts`. Each query asks for the signed-in user's rows, or the sample rows (`is_demo = true`) for visitors.
- **Writes:** Server Actions in `src/app/actions.ts`, called from forms with `useActionState`. They validate input, write through Supabase with the user's session, and revalidate the pages.
- **Auth:** Supabase email + password. `src/proxy.ts` (Next 16's middleware) only refreshes the session cookie.
- **Database:** `supabase/migrations/`. Tables: `family_members`, `recipes`, `gatherings`, `menu_items` (a dish on a gathering's menu, with who's making it), `annotations` (margin notes). A dish can't be on the same menu twice (unique constraint).
- **Recipe import** (`src/lib/import/`, no paid API): links are fetched on the server and read from the page's schema.org recipe data. The fetcher allows https only and refuses private and loopback addresses, also after redirects. PDFs (pdf.js, read by layout) and photos (Tesseract OCR, English + Spanish) are read on the phone and never uploaded. Every source ends up as a draft in the normal recipe form.

## Security

- The app only has the public Supabase URL and publishable key. There is no service-role key anywhere, so the server can do nothing a signed-in user couldn't do from the API.
- Permissions are enforced in Postgres with row-level security. You can read the sample rows and your own rows. You can write only your own rows, and only when every linked row (recipe, gathering, family member) is also yours. The sample cookbook can't be written through the API by anyone.
- `npm run test:rls` checks this against the live API with fresh accounts: a second account can't read, change or link to the first one's rows, and nobody can write sample rows.

## Running it locally

```bash
cp .env.example .env.local   # Supabase URL + publishable key
npm install
npm run dev                  # http://localhost:3000
```

Tests: `npm run test:import` (parsers, offline), `npm run test:rls` (permissions against Supabase), `npm run test:e2e` (browser flows at phone width; needs `npm run build && npx next start -p 3001`).

## How it was built

Built with Claude Code, following `CLAUDE.md`, from the spec in `SPEC.md`. Each feature was built on its own branch and merged through a pull request. `NOTES.md` is the handoff file between sessions: what changed, how it was verified, what's open.
