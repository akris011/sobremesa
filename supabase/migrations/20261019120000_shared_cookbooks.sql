-- Shared cookbooks and a family join link.
--
-- Until now every row belonged to one account (owner_id). Now rows belong to a
-- cookbook, and a cookbook has members. Each existing account gets its own
-- cookbook, with all of its rows moved into it, so nothing changes for anyone
-- until they share a link.
--
-- Additive, so the code deployed on main (which reads and writes by owner_id)
-- keeps working while this is live and before the new code ships:
--   * owner_id stays, and keeps meaning "who wrote this row". Nothing is
--     dropped or renamed except the old RLS policies, which are replaced by
--     cookbook ones that give an account exactly the same rows while it is the
--     only member of its cookbook.
--   * cookbook_id defaults to the caller's cookbook, so inserts that don't
--     mention it (all of main's) land in the right place.
--   * the old owns_* helpers stay (unused) so nothing that names them breaks.
--
-- A family member can be linked to an account (user_id): that's their own
-- profile. Only that account can change it or sign notes, recipes and dishes
-- as that person. Unlinked people (Abuela, who won't sign up) stay editable by
-- any member until someone claims them through the invite link.

-- Tables ----------------------------------------------------------------------

create table public.cookbooks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- One cookbook per account for now (unique user_id). A cookbook switcher would
-- drop that constraint; see NOTES.md.
create table public.cookbook_members (
  cookbook_id uuid not null references public.cookbooks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (cookbook_id, user_id),
  unique (user_id)
);

-- One reusable link per cookbook, meant for the family group chat. Anyone who
-- has the link can join until it expires or the owner turns it off. The token
-- is two v4 UUIDs (pg_strong_random, 244 random bits), so it doesn't depend on
-- which schema pgcrypto lives in.
create table public.cookbook_invites (
  token text primary key
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
    check (char_length(token) >= 32),
  cookbook_id uuid not null references public.cookbooks (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked_at timestamptz
);
create index on public.cookbook_invites (cookbook_id);

alter table public.family_members
  add column cookbook_id uuid references public.cookbooks (id) on delete cascade,
  add column user_id uuid references auth.users (id) on delete set null;
alter table public.recipes add column cookbook_id uuid references public.cookbooks (id) on delete cascade;
alter table public.gatherings add column cookbook_id uuid references public.cookbooks (id) on delete cascade;
alter table public.menu_items add column cookbook_id uuid references public.cookbooks (id) on delete cascade;
alter table public.annotations add column cookbook_id uuid references public.cookbooks (id) on delete cascade;

-- Backfill: one cookbook per account, owned by it --------------------------------

-- Named after the account's own person (the first family member the signup
-- trigger made), e.g. "Mari's family cookbook". The owner can rename it.
insert into public.cookbooks (name, created_by, created_at)
select
  coalesce(
    (select case when f.name = 'Me' then null else left(f.name, 60) || '''s family cookbook' end
     from public.family_members f
     where f.owner_id = u.id and not f.is_demo
     order by f.created_at, f.id limit 1),
    'Our family cookbook'),
  u.id,
  u.created_at
from auth.users u;

insert into public.cookbook_members (cookbook_id, user_id, role, joined_at)
select c.id, c.created_by, 'owner', c.created_at from public.cookbooks c;

-- Don't let the backfill bump every recipe's updated_at.
alter table public.recipes disable trigger recipes_touch;
update public.family_members t set cookbook_id = m.cookbook_id from public.cookbook_members m where m.user_id = t.owner_id and not t.is_demo;
update public.recipes t set cookbook_id = m.cookbook_id from public.cookbook_members m where m.user_id = t.owner_id and not t.is_demo;
update public.gatherings t set cookbook_id = m.cookbook_id from public.cookbook_members m where m.user_id = t.owner_id and not t.is_demo;
update public.menu_items t set cookbook_id = m.cookbook_id from public.cookbook_members m where m.user_id = t.owner_id and not t.is_demo;
update public.annotations t set cookbook_id = m.cookbook_id from public.cookbook_members m where m.user_id = t.owner_id and not t.is_demo;
alter table public.recipes enable trigger recipes_touch;

-- Each account's first family member is the one the signup trigger made for
-- them (nothing can be written before it), so it's their own profile.
update public.family_members f set user_id = f.owner_id
where f.id in (
  select distinct on (owner_id) id from public.family_members
  where not is_demo order by owner_id, created_at, id
);

-- Sample rows have no cookbook; every other row has one.
alter table public.family_members add constraint family_members_cookbook_check
  check ((is_demo and cookbook_id is null and user_id is null) or (not is_demo and cookbook_id is not null));
alter table public.recipes add constraint recipes_cookbook_check
  check ((is_demo and cookbook_id is null) or (not is_demo and cookbook_id is not null));
alter table public.gatherings add constraint gatherings_cookbook_check
  check ((is_demo and cookbook_id is null) or (not is_demo and cookbook_id is not null));
alter table public.menu_items add constraint menu_items_cookbook_check
  check ((is_demo and cookbook_id is null) or (not is_demo and cookbook_id is not null));
alter table public.annotations add constraint annotations_cookbook_check
  check ((is_demo and cookbook_id is null) or (not is_demo and cookbook_id is not null));

-- One profile per account per cookbook.
alter table public.family_members add constraint family_members_one_profile unique (cookbook_id, user_id);

create index on public.family_members (cookbook_id);
create index on public.recipes (cookbook_id);
create index on public.gatherings (cookbook_id, held_on);
create index on public.menu_items (cookbook_id);
create index on public.annotations (cookbook_id);

-- Helpers for policies ----------------------------------------------------------
-- security definer so the lookups aren't themselves filtered by RLS (which
-- would recurse); search_path is empty and every name is qualified.

create function public.my_cookbook_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.cookbook_id from public.cookbook_members m where m.user_id = auth.uid() limit 1
$$;

create function public.is_cookbook_member(cb uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cookbook_members m where m.cookbook_id = cb and m.user_id = auth.uid())
$$;

create function public.is_cookbook_owner(cb uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cookbook_members m
    where m.cookbook_id = cb and m.user_id = auth.uid() and m.role = 'owner'
  )
$$;

-- Does the referenced row sit in this cookbook? (Foreign keys stay inside one book.)
create function public.member_in(member uuid, cb uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select member is null or exists (select 1 from public.family_members f where f.id = member and f.cookbook_id = cb)
$$;

create function public.recipe_in(rid uuid, cb uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.recipes r where r.id = rid and r.cookbook_id = cb)
$$;

create function public.gathering_in(gid uuid, cb uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.gatherings g where g.id = gid and g.cookbook_id = cb)
$$;

-- Is this person someone else's own profile? Then the caller can't sign as them.
create function public.claimed_by_other(member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members f
    where f.id = member and f.user_id is not null and f.user_id is distinct from auth.uid()
  )
$$;

-- New rows land in the caller's cookbook unless they say otherwise (main's code
-- never says). RLS still checks the cookbook is theirs.
alter table public.family_members alter column cookbook_id set default public.my_cookbook_id();
alter table public.recipes alter column cookbook_id set default public.my_cookbook_id();
alter table public.gatherings alter column cookbook_id set default public.my_cookbook_id();
alter table public.menu_items alter column cookbook_id set default public.my_cookbook_id();
alter table public.annotations alter column cookbook_id set default public.my_cookbook_id();

-- Guards that RLS can't express (they compare the old row with the new) ----------
-- They apply only to requests through the API (roles authenticated / anon).
-- Security definer RPCs below run as the function owner and are trusted. These
-- trigger functions are deliberately security invoker, so current_user is the
-- caller's role.

-- Rows stay in the cookbook (and with the writer) they were created with; a
-- signer (contributor, note author) can only be set to someone the caller may
-- sign as. A dish's preparer isn't a signature: anyone planning the dinner can
-- say "Carmen's bringing the flan", so menu_items has no signer column here. Leaving a signer unchanged is fine, so anyone can still
-- edit a recipe Tía Carmen contributed.
create function public.guard_shared_row() returns trigger
language plpgsql set search_path = '' as $$
declare
  signer_col text := tg_argv[0];
  signer uuid;
  before_signer uuid;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.cookbook_id is distinct from old.cookbook_id or new.owner_id is distinct from old.owner_id then
      raise exception 'Rows stay in the cookbook they were written in.' using errcode = '42501';
    end if;
  end if;
  if signer_col is null then
    return new;
  end if;
  signer := (to_jsonb(new) ->> signer_col)::uuid;
  if tg_op = 'UPDATE' then
    before_signer := (to_jsonb(old) ->> signer_col)::uuid;
    if signer is not distinct from before_signer then
      return new;
    end if;
  end if;
  if public.claimed_by_other(signer) then
    raise exception 'Only that person can sign as themselves.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger recipes_guard before insert or update on public.recipes
  for each row execute function public.guard_shared_row('contributor_id');
create trigger gatherings_guard before insert or update on public.gatherings
  for each row execute function public.guard_shared_row();
create trigger menu_items_guard before insert or update on public.menu_items
  for each row execute function public.guard_shared_row();
create trigger annotations_guard before insert or update on public.annotations
  for each row execute function public.guard_shared_row('author_id');

-- A profile is linked to an account only by accept_invite (or the signup
-- trigger), never by a direct insert or update.
create function public.guard_family_member() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.user_id is not null then
      raise exception 'People link their own profile through the invite link.' using errcode = '42501';
    end if;
  elsif new.user_id is distinct from old.user_id
     or new.cookbook_id is distinct from old.cookbook_id
     or new.owner_id is distinct from old.owner_id then
    raise exception 'People link their own profile through the invite link.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger family_members_guard before insert or update on public.family_members
  for each row execute function public.guard_family_member();

-- Row-level security ---------------------------------------------------------------
-- Policies are OR'ed, so the old owner_id ones must go: left in place, "write
-- own" would let a member edit a person they once added after someone else
-- claimed them, or write rows with their own owner_id into a cookbook they
-- aren't in. The new ones give a sole member the same rows the old ones did.

drop policy "read demo or own" on public.family_members;
drop policy "read demo or own" on public.recipes;
drop policy "read demo or own" on public.gatherings;
drop policy "read demo or own" on public.menu_items;
drop policy "read demo or own" on public.annotations;
drop policy "write own" on public.family_members;
drop policy "write own" on public.recipes;
drop policy "write own" on public.gatherings;
drop policy "write own" on public.menu_items;
drop policy "write own" on public.annotations;

alter table public.cookbooks enable row level security;
alter table public.cookbook_members enable row level security;
alter table public.cookbook_invites enable row level security;

-- Cookbooks: members read; the owner renames. Created and deleted only by the
-- functions below. Only the name column is writable at all.
create policy "members read" on public.cookbooks for select
  using (public.is_cookbook_member(id));
create policy "owner renames" on public.cookbooks for update to authenticated
  using (public.is_cookbook_owner(id))
  with check (public.is_cookbook_owner(id));
revoke insert, update, delete on public.cookbooks from anon, authenticated;
grant update (name) on public.cookbooks to authenticated;

-- Memberships and invites: members read; written only by the functions below.
create policy "members read" on public.cookbook_members for select
  using (public.is_cookbook_member(cookbook_id));
create policy "members read" on public.cookbook_invites for select
  using (public.is_cookbook_member(cookbook_id));
revoke insert, update, delete on public.cookbook_members from anon, authenticated;
revoke insert, update, delete on public.cookbook_invites from anon, authenticated;

-- Read: the sample for everyone; a cookbook's rows for its members.
create policy "read demo or member" on public.family_members for select
  using (is_demo or public.is_cookbook_member(cookbook_id));
create policy "read demo or member" on public.recipes for select
  using (is_demo or public.is_cookbook_member(cookbook_id));
create policy "read demo or member" on public.gatherings for select
  using (is_demo or public.is_cookbook_member(cookbook_id));
create policy "read demo or member" on public.menu_items for select
  using (is_demo or public.is_cookbook_member(cookbook_id));
create policy "read demo or member" on public.annotations for select
  using (is_demo or public.is_cookbook_member(cookbook_id));

-- Family: any member adds people and changes unclaimed ones; a claimed profile
-- only by its own account. Claimed profiles can't be deleted through the API.
create policy "members add people" on public.family_members for insert to authenticated
  with check (not is_demo and user_id is null and owner_id = (select auth.uid())
              and public.is_cookbook_member(cookbook_id));
create policy "members change unclaimed people, or themselves" on public.family_members for update to authenticated
  using (public.is_cookbook_member(cookbook_id) and (user_id is null or user_id = (select auth.uid())))
  with check (not is_demo and public.is_cookbook_member(cookbook_id)
              and (user_id is null or user_id = (select auth.uid())));
create policy "members remove unclaimed people" on public.family_members for delete to authenticated
  using (public.is_cookbook_member(cookbook_id) and user_id is null);

-- Recipes: any member writes; the contributor is in the same cookbook, and on a
-- new recipe isn't someone else's profile (changes to it: guard_shared_row).
create policy "members add" on public.recipes for insert to authenticated
  with check (not is_demo and owner_id = (select auth.uid()) and public.is_cookbook_member(cookbook_id)
              and public.member_in(contributor_id, cookbook_id)
              and not public.claimed_by_other(contributor_id));
create policy "members change" on public.recipes for update to authenticated
  using (public.is_cookbook_member(cookbook_id))
  with check (not is_demo and public.is_cookbook_member(cookbook_id)
              and public.member_in(contributor_id, cookbook_id));
create policy "members remove" on public.recipes for delete to authenticated
  using (public.is_cookbook_member(cookbook_id));

create policy "members add" on public.gatherings for insert to authenticated
  with check (not is_demo and owner_id = (select auth.uid()) and public.is_cookbook_member(cookbook_id));
create policy "members change" on public.gatherings for update to authenticated
  using (public.is_cookbook_member(cookbook_id))
  with check (not is_demo and public.is_cookbook_member(cookbook_id));
create policy "members remove" on public.gatherings for delete to authenticated
  using (public.is_cookbook_member(cookbook_id));

create policy "members add" on public.menu_items for insert to authenticated
  with check (not is_demo and owner_id = (select auth.uid()) and public.is_cookbook_member(cookbook_id)
              and public.gathering_in(gathering_id, cookbook_id)
              and public.recipe_in(recipe_id, cookbook_id)
              and public.member_in(preparer_id, cookbook_id));
create policy "members change" on public.menu_items for update to authenticated
  using (public.is_cookbook_member(cookbook_id))
  with check (not is_demo and public.is_cookbook_member(cookbook_id)
              and public.gathering_in(gathering_id, cookbook_id)
              and public.recipe_in(recipe_id, cookbook_id)
              and public.member_in(preparer_id, cookbook_id));
create policy "members remove" on public.menu_items for delete to authenticated
  using (public.is_cookbook_member(cookbook_id));

-- Notes: written as someone you may sign as; a note signed by a claimed
-- profile is changed or removed only by that account.
create policy "members add" on public.annotations for insert to authenticated
  with check (not is_demo and owner_id = (select auth.uid()) and public.is_cookbook_member(cookbook_id)
              and public.recipe_in(recipe_id, cookbook_id)
              and public.member_in(author_id, cookbook_id)
              and not public.claimed_by_other(author_id));
create policy "members change unclaimed notes, or their own" on public.annotations for update to authenticated
  using (public.is_cookbook_member(cookbook_id) and not public.claimed_by_other(author_id))
  with check (not is_demo and public.is_cookbook_member(cookbook_id)
              and public.recipe_in(recipe_id, cookbook_id)
              and public.member_in(author_id, cookbook_id)
              and not public.claimed_by_other(author_id));
create policy "members remove unclaimed notes, or their own" on public.annotations for delete to authenticated
  using (public.is_cookbook_member(cookbook_id) and not public.claimed_by_other(author_id));

-- Signup: a new account gets its own cookbook and its own profile in it -----------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  display text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  cb uuid;
begin
  insert into public.cookbooks (name, created_by)
  values (coalesce(left(display, 60) || '''s family cookbook', 'Our family cookbook'), new.id)
  returning id into cb;
  insert into public.cookbook_members (cookbook_id, user_id, role) values (cb, new.id, 'owner');
  insert into public.family_members (cookbook_id, owner_id, user_id, name, relation, ink)
  values (cb, new.id, new.id, coalesce(left(display, 60), 'Me'), 'Me', 'sepia');
  return new;
end $$;

-- Copying the sample, now into the caller's cookbook ------------------------------
-- Runs as the caller, so RLS applies. The copied Morenos are unclaimed people.

create or replace function public.copy_sample_cookbook() returns void
language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
  cb uuid := public.my_cookbook_id();
begin
  if uid is null or cb is null then
    raise exception 'not signed in';
  end if;
  if exists (select 1 from recipes where cookbook_id = cb) then
    raise exception 'cookbook already has recipes';
  end if;

  create temp table member_map on commit drop as
    select id as old_id, gen_random_uuid() as new_id from family_members where is_demo;
  create temp table recipe_map on commit drop as
    select id as old_id, gen_random_uuid() as new_id from recipes where is_demo;
  create temp table gathering_map on commit drop as
    select id as old_id, gen_random_uuid() as new_id from gatherings where is_demo;

  insert into family_members (id, cookbook_id, owner_id, name, relation, ink, hand)
    select m.new_id, cb, uid, f.name, f.relation, f.ink, f.hand
    from family_members f join member_map m on m.old_id = f.id;

  insert into recipes (id, cookbook_id, owner_id, title, description, story, ingredients, instructions, servings, contributor_id)
    select r.new_id, cb, uid, x.title, x.description, x.story, x.ingredients, x.instructions, x.servings, m.new_id
    from recipes x join recipe_map r on r.old_id = x.id
    left join member_map m on m.old_id = x.contributor_id;

  insert into gatherings (id, cookbook_id, owner_id, name, held_on, location, description)
    select g.new_id, cb, uid, x.name, x.held_on, x.location, x.description
    from gatherings x join gathering_map g on g.old_id = x.id;

  insert into menu_items (cookbook_id, owner_id, gathering_id, recipe_id, preparer_id, note)
    select cb, uid, g.new_id, r.new_id, m.new_id, x.note
    from menu_items x
    join gathering_map g on g.old_id = x.gathering_id
    join recipe_map r on r.old_id = x.recipe_id
    left join member_map m on m.old_id = x.preparer_id
    where x.is_demo;

  insert into annotations (cookbook_id, owner_id, recipe_id, author_id, body, created_at,
                           line_kind, line_text, strike_start, strike_end, replacement)
    select cb, uid, r.new_id, m.new_id, x.body, x.created_at,
           x.line_kind, x.line_text, x.strike_start, x.strike_end, x.replacement
    from annotations x
    join recipe_map r on r.old_id = x.recipe_id
    left join member_map m on m.old_id = x.author_id
    where x.is_demo;
end $$;

-- Invites ------------------------------------------------------------------------

-- Can this account leave its cookbook for another without losing anything? Only
-- if it's alone in it and has written nothing but its own profile. Internal.
create function public.cookbook_is_disposable(cb uuid, uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.cookbook_members m where m.cookbook_id = cb and m.user_id <> uid)
     and not exists (select 1 from public.recipes r where r.cookbook_id = cb)
     and not exists (select 1 from public.gatherings g where g.cookbook_id = cb)
     and not exists (select 1 from public.family_members f where f.cookbook_id = cb and f.user_id is distinct from uid)
$$;

-- What /join/[token] needs to greet someone. Callable signed out, so it says
-- only the cookbook and inviter names; the unclaimed people are listed only to a
-- signed-in caller holding a working link.
create function public.invite_preview(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  inv public.cookbook_invites;
  uid uuid := auth.uid();
  mine uuid;
  result jsonb;
begin
  select * into inv from public.cookbook_invites i where i.token = p_token;
  if not found then
    return jsonb_build_object('status', 'unknown');
  end if;

  result := jsonb_build_object(
    'status', case when inv.revoked_at is not null then 'revoked'
                   when inv.expires_at <= now() then 'expired'
                   else 'open' end,
    'cookbook', (select c.name from public.cookbooks c where c.id = inv.cookbook_id),
    'inviter', (select f.name from public.family_members f
                where f.cookbook_id = inv.cookbook_id and f.user_id = inv.created_by),
    'expires_at', inv.expires_at
  );
  if result ->> 'status' <> 'open' or uid is null then
    return result;
  end if;

  select m.cookbook_id into mine from public.cookbook_members m where m.user_id = uid;
  return result || jsonb_build_object(
    'member', mine is not distinct from inv.cookbook_id,
    'has_profile', exists (select 1 from public.family_members f
                           where f.cookbook_id = inv.cookbook_id and f.user_id = uid),
    'blocked', mine is not null and mine <> inv.cookbook_id
               and not public.cookbook_is_disposable(mine, uid),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'relation', f.relation,
                                          'ink', f.ink, 'hand', f.hand) order by f.created_at)
      from public.family_members f where f.cookbook_id = inv.cookbook_id and f.user_id is null), '[]'::jsonb),
    'inks', coalesce((select jsonb_agg(distinct f.ink) from public.family_members f
                      where f.cookbook_id = inv.cookbook_id), '[]'::jsonb)
  );
end $$;

-- Join through a link: become a member, then either claim an unlinked person
-- (p_member) or add yourself. Name, relation, ink and hand are the joiner's
-- choice either way. An empty personal cookbook is given up; a non-empty one
-- stops the join (one cookbook per account, for now).
create function public.accept_invite(
  p_token text,
  p_member uuid default null,
  p_name text default null,
  p_relation text default null,
  p_ink text default null,
  p_hand text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  inv public.cookbook_invites;
  mine uuid;
  claimed int;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select * into inv from public.cookbook_invites i where i.token = p_token;
  if not found then
    raise exception 'This invite link doesn''t work. Ask for a new one.';
  end if;
  if inv.revoked_at is not null then
    raise exception 'This invite link has been turned off. Ask for a new one.';
  end if;
  if inv.expires_at <= now() then
    raise exception 'This invite link has expired. Ask for a new one.';
  end if;

  select m.cookbook_id into mine from public.cookbook_members m where m.user_id = uid;
  if mine is distinct from inv.cookbook_id then
    if mine is not null then
      if not public.cookbook_is_disposable(mine, uid) then
        raise exception 'You already have a cookbook with recipes or people in it. For now an account can be in only one cookbook.';
      end if;
      delete from public.cookbooks c where c.id = mine;
    end if;
    insert into public.cookbook_members (cookbook_id, user_id, role) values (inv.cookbook_id, uid, 'member');
  end if;

  -- Already has a profile here (opened the link twice): nothing more to do.
  if exists (select 1 from public.family_members f where f.cookbook_id = inv.cookbook_id and f.user_id = uid) then
    return inv.cookbook_id;
  end if;

  if p_member is not null then
    update public.family_members f set
      user_id = uid,
      name = coalesce(nullif(trim(p_name), ''), f.name),
      relation = case when p_relation is null then f.relation else nullif(trim(p_relation), '') end,
      ink = coalesce(p_ink, f.ink),
      hand = coalesce(p_hand, f.hand)
    where f.id = p_member and f.cookbook_id = inv.cookbook_id and f.user_id is null and not f.is_demo;
    get diagnostics claimed = row_count;
    if claimed = 0 then
      raise exception 'Someone has already said they''re that person. Choose another, or add yourself.';
    end if;
  else
    if nullif(trim(p_name), '') is null then
      raise exception 'Write your name.';
    end if;
    insert into public.family_members (cookbook_id, owner_id, user_id, name, relation, ink, hand)
    values (inv.cookbook_id, uid, uid, trim(p_name), nullif(trim(p_relation), ''),
            coalesce(p_ink, 'sepia'), coalesce(p_hand, 'caveat'));
  end if;
  return inv.cookbook_id;
end $$;

-- The owner makes the link (or gets the one that's still open).
create function public.create_invite() returns text
language plpgsql security definer set search_path = '' as $$
declare
  cb uuid := public.my_cookbook_id();
  tok text;
begin
  if cb is null or not public.is_cookbook_owner(cb) then
    raise exception 'Only the person who started this cookbook can make an invite link.' using errcode = '42501';
  end if;
  select i.token into tok from public.cookbook_invites i
  where i.cookbook_id = cb and i.revoked_at is null and i.expires_at > now()
  order by i.created_at desc limit 1;
  if tok is null then
    insert into public.cookbook_invites (cookbook_id, created_by) values (cb, auth.uid()) returning token into tok;
  end if;
  return tok;
end $$;

-- The owner turns the link off. People who already joined stay.
create function public.revoke_invite() returns void
language plpgsql security definer set search_path = '' as $$
declare
  cb uuid := public.my_cookbook_id();
begin
  if cb is null or not public.is_cookbook_owner(cb) then
    raise exception 'Only the person who started this cookbook can turn the link off.' using errcode = '42501';
  end if;
  update public.cookbook_invites i set revoked_at = now()
  where i.cookbook_id = cb and i.revoked_at is null;
end $$;

-- Function privileges. Supabase grants execute on new functions to anon and
-- authenticated directly, so revoke from those roles, not only from public.
revoke execute on function public.cookbook_is_disposable(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.accept_invite(text, uuid, text, text, text, text) from public, anon;
revoke execute on function public.create_invite() from public, anon;
revoke execute on function public.revoke_invite() from public, anon;
grant execute on function public.accept_invite(text, uuid, text, text, text, text) to authenticated;
grant execute on function public.create_invite() to authenticated;
grant execute on function public.revoke_invite() to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;
