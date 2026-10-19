# Task: recipe import (photo, PDF, link, pasted text)

Goal: getting a recipe in should not mean retyping Abuela's card. The user photographs a handwritten card, uploads a PDF, pastes a link or pastes text, and gets the normal recipe form **prefilled as a draft** to correct and save. Nothing saves without review.

Branch: `feature/recipe-import`, PR to `main`.

## Phase 1 (parallel with invites): no schema changes

Avoid conflicts with the invites task:
- Add no migrations.
- Put new server code in `src/lib/import/*` and `src/app/import-actions.ts`, not `actions.ts`.
- `RecipeForm` takes `recipe?: Recipe`. Add a separate `draft` prop (or similar) that prefills the fields while still creating a new recipe.

Sources:
- **Link:** fetch on the server and read the schema.org `Recipe` JSON-LD (`recipeIngredient`, `recipeInstructions` including HowToSection, `recipeYield`, `name`, `description`). Most recipe sites have it, and no AI is needed. Fall back to the model on the page text only when there's no JSON-LD.
  - SSRF guard: https only, resolve DNS and reject private or loopback ranges (check again after redirects), 8 s timeout, 2 MB cap.
- **Photo or PDF:** Claude vision with structured output (title, description, servings, ingredients[], instructions[], story, plus a list of words it couldn't read). Handwritten cards are the main case, and Tesseract.js reads them poorly and returns no structure. Use the `claude-api` skill for current model IDs and SDK usage.
- **Pasted text:** the existing line parser, with the model as an optional "tidy this up".

Constraints:
- This adds the first **server secret**: `ANTHROPIC_API_KEY`. Keep it in a `server-only` module, add it to Vercel env (production and preview) and `.env.example` with no value, and update the CLAUDE.md line that says there is no server secret.
- Signed-in users only, plus a per-user daily limit, so the public URL can't run up the bill.
- Server Actions cap request bodies at **1 MB** by default (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`). Downscale photos in the browser (canvas, about 1600 px long edge, JPEG). For PDFs, either raise `serverActions.bodySizeLimit` modestly or upload to Storage first.
- iPhone: `<input type="file" accept="image/*,application/pdf">` gives the camera and the photo library. Check what format iOS Safari actually sends (HEIC or JPEG) on a real device.
- Keep the UI copy plain: "Take a photo of the card", "We couldn't read these words: …".

## Phase 2 (after invites merges)

Keep the original card image. Add a private Supabase Storage bucket with policies scoped to the cookbook, and show "The original card" on the recipe page. This needs the invites `cookbook_id` model, so it waits.

## Done when

- A JSON-LD parser test runs against 2–3 saved HTML fixtures (no network).
- The e2e test uploads a fixture image with a fake extractor enabled by an env flag, so CI doesn't call the API, and lands on a prefilled form.
- A real handwritten card from Anya was tried on a phone, and the result is noted in NOTES.md.
- SPEC.md, CLAUDE.md and NOTES.md are updated.
