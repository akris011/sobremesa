# Task: family invites

Goal: a cook shares one link ("Join the Moreno family cookbook on Sobremesa") in the family group chat. Whoever opens it signs up or signs in, says which family member they are, and then reads and writes the same cookbook. This is the centerpiece of the demo video.

Branch: `feature/invites`, PR to `main`. This task **owns all migrations** while it runs; the import task adds none in phase 1.

## Why this is the risky one

Today every row belongs to one account (`owner_id = auth.uid()`), and every RLS policy, `data.ts` query, `owns_*` helper and `copy_sample_cookbook()` assumes that. Sharing replaces the ownership model. Do it in a **new migration**; never edit the applied ones.

## Recommended design (challenge it before building)

- `cookbooks (id, name, created_by, created_at)`. `cookbook_members (cookbook_id, user_id, role 'owner'|'member', unique(cookbook_id, user_id))`.
- Add `cookbook_id` to family_members, recipes, gatherings, menu_items and annotations. Backfill one cookbook per existing `owner_id`. Keep `owner_id` as "created by" or drop it, but decide on purpose.
- RLS: select `is_demo or is_cookbook_member(cookbook_id)`. Writes go to your own cookbook only, never to demo rows. Foreign keys must stay inside the same cookbook (rewrite the `owns_*` helpers as `in_my_cookbook(...)`, security definer).
- `family_members.user_id` (nullable, unique per cookbook) links a person to an account. When joining, the user picks "I'm Tía Carmen" from the unlinked people or adds themselves with an ink. Their margin notes then default to their own person.
- `cookbook_invites (token, cookbook_id, created_by, created_at, expires_at default now() + 14 days, revoked_at)`. Use one **reusable** link per cookbook, made for a group chat. Trade-off: anyone holding the link can join until it expires or the owner revokes it. Generate the token in the database with at least 128 bits of randomness, e.g. `encode(gen_random_bytes(16), 'hex')`.
- RPCs (security definer, `set search_path = ''`):
  - `invite_preview(token)` returns the cookbook name, the inviter's name and the unlinked people. A signed-out visitor can call it, so `/join/[token]` can greet them.
  - `accept_invite(token, member_id uuid default null)` validates the token, adds the membership and links or creates the person.
- One cookbook per account still holds. The signup trigger creates a personal cookbook. `accept_invite` deletes the caller's personal cookbook if it's empty and they're its only member; otherwise it refuses with "You already have a cookbook" (MVP). Write down the alternative (a cookbook switcher) instead of building it.
- Roles: any member can add and edit recipes, notes and gatherings. Only the owner can revoke the link or remove people. Ask Anya if unsure.

## UI

- Family page: "Invite family" calls `navigator.share({ title, text, url })` on phones, with "Copy link" as the fallback. Show who has joined. The owner sees "Turn off this link".
- `/join/[token]`: "Rosa invited you to the Moreno family cookbook", then sign up or sign in (reuse `AuthForm` with `next=/join/[token]`), then "Which one are you?", then the cookbook. Expired or revoked links get a plain explanation.
- Build invite URLs from the request host (`headers()`), not a hard-coded domain.

## Done when

- `npm run test:rls` is extended and passes:
  - a member can read and write the shared cookbook
  - a non-member still can't
  - an expired or revoked token is refused
  - a member can't attach rows from another cookbook
- `npm run test:e2e` still passes, plus a two-browser-context join flow (owner invites, guest joins, guest's note shows in their ink, owner sees it).
- `copy_sample_cookbook()` works with `cookbook_id`.
- Supabase auth `site_url` and redirect URLs point at the Vercel URL.
- SPEC.md (move invitations from "Out" to "In"), CLAUDE.md (data model and rules) and NOTES.md are updated.
