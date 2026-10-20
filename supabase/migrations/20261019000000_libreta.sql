-- La Libreta: everyone writes in the book in their own hand.
-- Additive only, so the deployed code keeps working while this is live:
--   * family members get a handwriting style, and inks widen to 12 named pens
--     or a custom '#rrggbb' color;
--   * a margin note can sit on one ingredient or step line, and can cross out
--     part of it and write a replacement. The recipe row is never changed.

-- Inks and hands ---------------------------------------------------------------

-- Drop the old checks by what they test, not by a guessed generated name.
do $$
declare c record;
begin
  for c in select conrelid::regclass as tbl, conname from pg_constraint
           where contype = 'c' and (
             (conrelid = 'public.family_members'::regclass and pg_get_constraintdef(oid) like '%ink%')
             or (conrelid = 'public.annotations'::regclass and pg_get_constraintdef(oid) like '%body%'))
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table public.family_members add constraint family_members_ink_check check (
  ink in ('sepia', 'burgundy', 'red', 'terracotta', 'olive', 'forest',
          'teal', 'indigo', 'ballpoint', 'violet', 'plum', 'pencil')
  or ink ~ '^#[0-9a-f]{6}$'
);

alter table public.family_members
  add column hand text not null default 'caveat'
  check (hand in ('caveat', 'kalam', 'cedarville', 'homemade', 'reenie', 'gochi'));

-- Notes on a line ----------------------------------------------------------------

-- line_text is the line as it read when the note was written. If the recipe is
-- later edited and the line changes, the note falls back to the general margin.
-- strike_start/strike_end are the crossed-out characters of line_text (equal for
-- an insertion); replacement is what was written in their place.
alter table public.annotations
  add column line_kind text check (line_kind in ('ingredient', 'step')),
  add column line_text text check (char_length(line_text) <= 1000),
  add column strike_start int,
  add column strike_end int,
  add column replacement text check (char_length(replacement) <= 300),
  add constraint annotations_line_check check ((line_kind is null) = (line_text is null)),
  add constraint annotations_strike_check check (
    (strike_start is null and strike_end is null)
    or (line_text is not null and strike_start >= 0 and strike_end >= strike_start)
  ),
  add constraint annotations_correction_check check (replacement is null or strike_start is not null);

-- A correction can be just the replacement, with no words beside it.
alter table public.annotations add constraint annotations_body_check check (
  char_length(body) <= 600 and (char_length(body) >= 1 or replacement is not null)
);

-- Copying the sample now carries hands and line notes too -------------------------

create or replace function public.copy_sample_cookbook() returns void
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

  insert into family_members (id, owner_id, name, relation, ink, hand)
    select m.new_id, uid, f.name, f.relation, f.ink, f.hand
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

  insert into annotations (owner_id, recipe_id, author_id, body, created_at,
                           line_kind, line_text, strike_start, strike_end, replacement)
    select uid, r.new_id, m.new_id, x.body, x.created_at,
           x.line_kind, x.line_text, x.strike_start, x.strike_end, x.replacement
    from annotations x
    join recipe_map r on r.old_id = x.recipe_id
    left join member_map m on m.old_id = x.author_id
    where x.is_demo;
end $$;

-- The Morenos: each writes differently, and some of their notes move onto the lines
-- they were about. ---------------------------------------------------------------

update public.family_members set hand = v.hand from (values
  ('d0000000-0000-4000-8000-000000000101'::uuid, 'homemade'),
  ('d0000000-0000-4000-8000-000000000102'::uuid, 'cedarville'),
  ('d0000000-0000-4000-8000-000000000103'::uuid, 'kalam'),
  ('d0000000-0000-4000-8000-000000000104'::uuid, 'caveat'),
  ('d0000000-0000-4000-8000-000000000105'::uuid, 'reenie')
) as v(id, hand) where family_members.id = v.id and is_demo;

-- Anchor a demo note to a line; strike the first occurrence of `strike`, if given.
create function pg_temp.anchor(rid uuid, starts text, kind text, line text, strike text, repl text, new_body text)
returns void language sql as $$
  update public.annotations set
    line_kind = kind,
    line_text = line,
    strike_start = case when strike is null then null else position(strike in line) - 1 end,
    strike_end = case when strike is null then null else position(strike in line) - 1 + char_length(strike) end,
    replacement = repl,
    body = new_body
  where is_demo and recipe_id = rid and body like starts || '%'
$$;

-- Picadillo
select pg_temp.anchor('d0000000-0000-4000-8000-000000000201', 'I use half beef', 'ingredient',
  '2 lb ground beef', 'ground beef', 'beef and pork, half and half', 'Abuela pretends not to notice.');
select pg_temp.anchor('d0000000-0000-4000-8000-000000000201', 'No raisins', 'ingredient',
  '1/3 cup raisins', null, null, 'No raisins on my half, please.');
-- Frijoles
select pg_temp.anchor('d0000000-0000-4000-8000-000000000202', 'A splash of the olive brine', 'ingredient',
  '1 tbsp red wine vinegar', null, null, 'A splash of the olive brine at the end. Trust me.');
-- Flan: Daniel, then Abuela, both on the baking time.
select pg_temp.anchor('d0000000-0000-4000-8000-000000000203', 'Took mine out', 'step',
  'Bake 60 to 70 minutes, until the center jiggles slightly. Cool, then chill overnight.',
  '60 to 70', '55', 'Oven runs hot.');
select pg_temp.anchor('d0000000-0000-4000-8000-000000000203', 'It was a little firm', 'step',
  'Bake 60 to 70 minutes, until the center jiggles slightly. Cool, then chill overnight.',
  '60 to 70', '50', 'It was a little firm, mi amor.');
-- Lechón
select pg_temp.anchor('d0000000-0000-4000-8000-000000000204', 'Bitter oranges', 'ingredient',
  '2 cups sour orange juice (or 1 1/3 cups orange + 2/3 cup lime)', null, null,
  'Bitter oranges from the tree behind the house work best. Bottled is fine in a pinch.');
-- Tostones
select pg_temp.anchor('d0000000-0000-4000-8000-000000000206', 'Salt them the second', 'step',
  'Fry again at 375°F until crisp. Salt immediately.', null, null,
  'The second they come out of the oil, or it won''t stick.');

-- Two new corrections, so the sample shows crossing-out as well as notes.
insert into public.annotations (is_demo, owner_id, recipe_id, author_id, body, created_at,
                                line_kind, line_text, strike_start, strike_end, replacement) values
  (true, null, 'd0000000-0000-4000-8000-000000000203', 'd0000000-0000-4000-8000-000000000104',
   'está muy dulce', '2026-07-01', 'ingredient', '1 cup sugar (for the caramel)', 0, 5, '¾ cup'),
  (true, null, 'd0000000-0000-4000-8000-000000000201', 'd0000000-0000-4000-8000-000000000102',
   'like Mamá said', '2026-03-08', 'ingredient', '1 tsp ground cumin', 0, 5, 'until the kitchen smells right,');
