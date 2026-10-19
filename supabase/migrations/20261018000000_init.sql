-- Sobremesa schema: one cookbook per account, plus a read-only public sample cookbook.
-- Every table carries owner_id (auth.users) and is_demo. Demo rows have owner_id null
-- and are readable by everyone; all other rows are visible only to their owner.

create extension if not exists pgcrypto;

-- People in the family (not necessarily accounts). Each has an ink color used
-- for their handwritten notes.
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade default auth.uid(),
  is_demo boolean not null default false,
  name text not null check (char_length(name) between 1 and 60),
  relation text check (char_length(relation) <= 60),
  ink text not null default 'sepia'
    check (ink in ('sepia', 'burgundy', 'olive', 'terracotta', 'indigo', 'plum')),
  created_at timestamptz not null default now(),
  check ((is_demo and owner_id is null) or (not is_demo and owner_id is not null))
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade default auth.uid(),
  is_demo boolean not null default false,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 500),
  story text check (char_length(story) <= 4000),
  ingredients text[] not null default '{}',
  instructions text[] not null default '{}',
  servings int check (servings between 1 and 200),
  contributor_id uuid references public.family_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_demo and owner_id is null) or (not is_demo and owner_id is not null))
);

create table public.gatherings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade default auth.uid(),
  is_demo boolean not null default false,
  name text not null check (char_length(name) between 1 and 120),
  held_on date not null,
  location text check (char_length(location) <= 120),
  description text check (char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  check ((is_demo and owner_id is null) or (not is_demo and owner_id is not null))
);

-- A dish on a gathering's menu. One row per recipe per gathering, so a dish
-- can't be claimed twice; preparer is who is bringing or cooking it.
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade default auth.uid(),
  is_demo boolean not null default false,
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  preparer_id uuid references public.family_members (id) on delete set null,
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  unique (gathering_id, recipe_id),
  check ((is_demo and owner_id is null) or (not is_demo and owner_id is not null))
);

-- Handwritten margin notes. The recipe itself is never edited by a note.
create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade default auth.uid(),
  is_demo boolean not null default false,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  author_id uuid references public.family_members (id) on delete set null,
  body text not null check (char_length(body) between 1 and 600),
  created_at timestamptz not null default now(),
  check ((is_demo and owner_id is null) or (not is_demo and owner_id is not null))
);

create index on public.family_members (owner_id);
create index on public.recipes (owner_id);
create index on public.gatherings (owner_id, held_on);
create index on public.menu_items (gathering_id);
create index on public.menu_items (recipe_id);
create index on public.annotations (recipe_id);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

-- Helpers used by policies: does the referenced row belong to the caller?
-- security definer so the lookup itself isn't filtered by RLS recursion.
create function public.owns_member(member uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select member is null or exists (
    select 1 from family_members where id = member and owner_id = auth.uid()
  )
$$;

create function public.owns_recipe(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from recipes where id = rid and owner_id = auth.uid())
$$;

create function public.owns_gathering(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from gatherings where id = gid and owner_id = auth.uid())
$$;

-- Row-level security ---------------------------------------------------------

alter table public.family_members enable row level security;
alter table public.recipes enable row level security;
alter table public.gatherings enable row level security;
alter table public.menu_items enable row level security;
alter table public.annotations enable row level security;

-- Read: sample rows for everyone, your own rows for you.
create policy "read demo or own" on public.family_members for select
  using (is_demo or owner_id = (select auth.uid()));
create policy "read demo or own" on public.recipes for select
  using (is_demo or owner_id = (select auth.uid()));
create policy "read demo or own" on public.gatherings for select
  using (is_demo or owner_id = (select auth.uid()));
create policy "read demo or own" on public.menu_items for select
  using (is_demo or owner_id = (select auth.uid()));
create policy "read demo or own" on public.annotations for select
  using (is_demo or owner_id = (select auth.uid()));

-- Write: only your own rows, never demo rows, and only referencing your own rows.
create policy "write own" on public.family_members for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and not is_demo);

create policy "write own" on public.recipes for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and not is_demo
              and public.owns_member(contributor_id));

create policy "write own" on public.gatherings for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and not is_demo);

create policy "write own" on public.menu_items for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and not is_demo
              and public.owns_gathering(gathering_id)
              and public.owns_recipe(recipe_id)
              and public.owns_member(preparer_id));

create policy "write own" on public.annotations for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and not is_demo
              and public.owns_recipe(recipe_id)
              and public.owns_member(author_id));

-- New accounts start with themselves as the first family member.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into family_members (owner_id, name, relation, ink)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Me'),
    'Me',
    'sepia'
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Copy the sample cookbook into the caller's own cookbook, so a new account can
-- start from real-looking content and edit it. Runs as the caller (RLS applies).
create function public.copy_sample_cookbook() returns void
language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if exists (select 1 from recipes where owner_id = uid) then
    raise exception 'cookbook already has recipes';
  end if;

  create temp table member_map on commit drop as
    select id as old_id, gen_random_uuid() as new_id from family_members where is_demo;
  create temp table recipe_map on commit drop as
    select id as old_id, gen_random_uuid() as new_id from recipes where is_demo;
  create temp table gathering_map on commit drop as
    select id as old_id, gen_random_uuid() as new_id from gatherings where is_demo;

  insert into family_members (id, owner_id, name, relation, ink)
    select m.new_id, uid, f.name, f.relation, f.ink
    from family_members f join member_map m on m.old_id = f.id;

  insert into recipes (id, owner_id, title, description, story, ingredients, instructions, servings, contributor_id)
    select r.new_id, uid, x.title, x.description, x.story, x.ingredients, x.instructions, x.servings, m.new_id
    from recipes x join recipe_map r on r.old_id = x.id
    left join member_map m on m.old_id = x.contributor_id;

  insert into gatherings (id, owner_id, name, held_on, location, description)
    select g.new_id, uid, x.name, x.held_on, x.location, x.description
    from gatherings x join gathering_map g on g.old_id = x.id;

  insert into menu_items (owner_id, gathering_id, recipe_id, preparer_id, note)
    select uid, g.new_id, r.new_id, m.new_id, x.note
    from menu_items x
    join gathering_map g on g.old_id = x.gathering_id
    join recipe_map r on r.old_id = x.recipe_id
    left join member_map m on m.old_id = x.preparer_id
    where x.is_demo;

  insert into annotations (owner_id, recipe_id, author_id, body, created_at)
    select uid, r.new_id, m.new_id, x.body, x.created_at
    from annotations x
    join recipe_map r on r.old_id = x.recipe_id
    left join member_map m on m.old_id = x.author_id
    where x.is_demo;
end $$;

revoke execute on function public.copy_sample_cookbook() from anon, public;
grant execute on function public.copy_sample_cookbook() to authenticated;
