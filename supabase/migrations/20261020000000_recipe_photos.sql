-- Recipe photos, and a fuller sample cookbook.
--
-- A recipe can have one photo. Sample photos are static files in /public/food;
-- uploaded photos live in the public "recipe-photos" bucket at
-- <cookbook_id>/<file>, and only members of that cookbook can write there.

alter table public.recipes add column photo_url text
  check (photo_url is null or photo_url ~ '^(/food/[a-z0-9-]+\.jpg|https://.+)$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', true, 5242880, array['image/jpeg']);

create policy "cookbook members add recipe photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-photos' and public.is_cookbook_member(((storage.foldername(name))[1])::uuid));
create policy "cookbook members list recipe photos" on storage.objects for select to authenticated
  using (bucket_id = 'recipe-photos' and public.is_cookbook_member(((storage.foldername(name))[1])::uuid));
create policy "cookbook members remove recipe photos" on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-photos' and public.is_cookbook_member(((storage.foldername(name))[1])::uuid));

-- The shared-cookbooks version of the copy, now carrying the photo.
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

  insert into recipes (id, cookbook_id, owner_id, title, description, story, ingredients, instructions, servings, contributor_id, photo_url)
    select r.new_id, cb, uid, x.title, x.description, x.story, x.ingredients, x.instructions, x.servings, m.new_id, x.photo_url
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

-- Sample data ----------------------------------------------------------------

update public.recipes set photo_url = v.photo from (values
  ('d0000000-0000-4000-8000-000000000201'::uuid, '/food/picadillo.jpg'),
  ('d0000000-0000-4000-8000-000000000202'::uuid, '/food/frijoles.jpg'),
  ('d0000000-0000-4000-8000-000000000203'::uuid, '/food/flan.jpg'),
  ('d0000000-0000-4000-8000-000000000204'::uuid, '/food/lechon.jpg'),
  ('d0000000-0000-4000-8000-000000000205'::uuid, '/food/arroz.jpg'),
  ('d0000000-0000-4000-8000-000000000206'::uuid, '/food/tostones.jpg')
) as v(id, photo) where recipes.id = v.id;

insert into public.recipes (id, is_demo, owner_id, title, description, story, ingredients, instructions, servings, contributor_id, photo_url, created_at) values
(
  'd0000000-0000-4000-8000-000000000207', true, null,
  'Ropa Vieja',
  'Flank steak braised until it shreds, in a tomato and pepper sauce.',
  'Abuela says the name, "old clothes", is because it looks like rags when it''s done. She makes it the day before so it can sit overnight, and she''s right that it''s better.',
  array[
    '2 1/2 lb flank steak',
    '1 bay leaf',
    '1 onion, thinly sliced',
    '1 green bell pepper, sliced',
    '1 red bell pepper, sliced',
    '5 cloves garlic, minced',
    '1 can (15 oz) crushed tomatoes',
    '1/2 cup dry white wine',
    '1 tsp ground cumin',
    '1 tsp dried oregano',
    '1/4 cup pimiento-stuffed olives',
    'Salt and olive oil'
  ],
  array[
    'Cover the steak with salted water, add the bay leaf and simmer until very tender, about 2 hours. Keep 1 cup of the broth.',
    'Let the meat cool a little, then pull it into thin shreds with two forks.',
    'Cook the onion and peppers in olive oil until soft. Add the garlic, cumin and oregano for a minute.',
    'Add the wine, tomatoes and the cup of broth. Stir in the meat and olives and simmer 20 minutes.',
    'Taste for salt. Serve with white rice and maduros.'
  ],
  6, 'd0000000-0000-4000-8000-000000000101', '/food/ropa.jpg', '2026-03-01'
),
(
  'd0000000-0000-4000-8000-000000000208', true, null,
  'Yuca con Mojo',
  'Boiled yuca under hot garlic, sour orange and onion.',
  'Luis makes this every time there''s lechón, because the mojo is the same and he says it would be a waste not to.',
  array[
    '2 lb yuca, fresh or frozen',
    'Salt',
    '1/2 cup olive oil',
    '8 cloves garlic, thinly sliced',
    '1 onion, sliced into thin rings',
    '1/2 cup sour orange juice (or half orange, half lime)'
  ],
  array[
    'Peel the yuca, cut it into chunks and pull out the woody core.',
    'Boil in salted water until a fork goes in easily and some pieces start to split, 20 to 30 minutes. Drain and put on a platter.',
    'Warm the oil and cook the garlic and onion until soft, not brown.',
    'Take it off the heat, add the juice (it will spit) and pour it over the yuca right away.'
  ],
  6, 'd0000000-0000-4000-8000-000000000103', '/food/yuca.jpg', '2026-03-15'
),
(
  'd0000000-0000-4000-8000-000000000209', true, null,
  'Croquetas de Jamón',
  'Ham croquettes: a thick béchamel, rolled, breaded and fried.',
  'Daniel''s only recipe. He learned it to impress Abuela and it worked. The dough has to chill overnight, so start the day before.',
  array[
    '4 tbsp butter',
    '1 small onion, grated',
    '2/3 cup flour',
    '2 cups whole milk',
    '1/2 lb smoked ham, ground fine',
    'Pinch of nutmeg',
    '2 eggs, beaten',
    '2 cups fine cracker crumbs',
    'Vegetable oil, for frying'
  ],
  array[
    'Melt the butter and cook the onion until soft. Stir in the flour and cook 2 minutes.',
    'Whisk in the milk a little at a time and keep stirring until it is very thick and pulls away from the pan.',
    'Stir in the ham and nutmeg. Spread in a dish, cover and chill overnight.',
    'Roll into small logs, dip in egg, then crumbs. Do the egg and crumbs twice.',
    'Fry at 350°F until deep golden, about 3 minutes. Drain on paper towels.'
  ],
  30, 'd0000000-0000-4000-8000-000000000105', '/food/croquetas.jpg', '2026-04-04'
),
(
  'd0000000-0000-4000-8000-000000000210', true, null,
  'Pastelitos de Guayaba',
  'Puff pastry squares filled with guava paste and cream cheese.',
  'Mari brings these to every birthday. Store-bought puff pastry is fine; nobody has ever complained.',
  array[
    '2 sheets puff pastry, thawed',
    '8 oz guava paste, cut into squares',
    '4 oz cream cheese',
    '1 egg, beaten',
    '1/4 cup sugar'
  ],
  array[
    'Heat the oven to 400°F. Cut each pastry sheet into 9 squares.',
    'Put a square of guava and a little cream cheese on half of them. Top with the other squares and press the edges with a fork.',
    'Brush with egg and sprinkle with sugar.',
    'Bake 15 to 20 minutes, until puffed and golden. Let them cool a little; the guava is very hot.'
  ],
  18, 'd0000000-0000-4000-8000-000000000104', '/food/pastelitos.jpg', '2026-05-02'
);

insert into public.gatherings (id, is_demo, owner_id, name, held_on, location, description) values
  ('d0000000-0000-4000-8000-000000000305', true, null, 'Mari''s graduation', '2026-05-16', 'Luis and Ana''s backyard',
   'Forty people under two tents. Daniel fried croquetas for three hours.'),
  ('d0000000-0000-4000-8000-000000000306', true, null, 'Thanksgiving 2026', '2026-11-26', 'Tía Carmen''s',
   'Turkey, and lechón for the people who want lechón.');

insert into public.menu_items (is_demo, owner_id, gathering_id, recipe_id, preparer_id, note) values
  (true, null, 'd0000000-0000-4000-8000-000000000305', 'd0000000-0000-4000-8000-000000000209', 'd0000000-0000-4000-8000-000000000105', 'Made 120. Gone by 3 p.m.'),
  (true, null, 'd0000000-0000-4000-8000-000000000305', 'd0000000-0000-4000-8000-000000000210', 'd0000000-0000-4000-8000-000000000104', null),
  (true, null, 'd0000000-0000-4000-8000-000000000305', 'd0000000-0000-4000-8000-000000000207', 'd0000000-0000-4000-8000-000000000101', 'Doubled.'),
  (true, null, 'd0000000-0000-4000-8000-000000000305', 'd0000000-0000-4000-8000-000000000206', 'd0000000-0000-4000-8000-000000000104', null),
  (true, null, 'd0000000-0000-4000-8000-000000000301', 'd0000000-0000-4000-8000-000000000208', 'd0000000-0000-4000-8000-000000000103', null),
  (true, null, 'd0000000-0000-4000-8000-000000000306', 'd0000000-0000-4000-8000-000000000204', 'd0000000-0000-4000-8000-000000000103', 'Starting the mojo Tuesday.'),
  (true, null, 'd0000000-0000-4000-8000-000000000306', 'd0000000-0000-4000-8000-000000000208', 'd0000000-0000-4000-8000-000000000103', null),
  (true, null, 'd0000000-0000-4000-8000-000000000306', 'd0000000-0000-4000-8000-000000000210', null, null),
  (true, null, 'd0000000-0000-4000-8000-000000000304', 'd0000000-0000-4000-8000-000000000209', 'd0000000-0000-4000-8000-000000000105', null);

insert into public.annotations (is_demo, owner_id, recipe_id, author_id, body, created_at) values
  (true, null, 'd0000000-0000-4000-8000-000000000207', 'd0000000-0000-4000-8000-000000000102',
   'I use the pressure cooker. 45 minutes. Don''t tell her.', '2026-03-10'),
  (true, null, 'd0000000-0000-4000-8000-000000000207', 'd0000000-0000-4000-8000-000000000104',
   'Leftovers in a Cuban roll the next day.', '2026-05-18'),
  (true, null, 'd0000000-0000-4000-8000-000000000208', 'd0000000-0000-4000-8000-000000000101',
   'Frozen yuca is fine. Fresh is better.', '2025-12-26'),
  (true, null, 'd0000000-0000-4000-8000-000000000209', 'd0000000-0000-4000-8000-000000000101',
   'Too much nutmeg the first time. Better now.', '2026-04-10'),
  (true, null, 'd0000000-0000-4000-8000-000000000209', 'd0000000-0000-4000-8000-000000000103',
   'Freeze them breaded on a tray, then bag them. Fry from frozen.', '2026-05-17');

-- Notes written on a line, Libreta style.
insert into public.annotations (is_demo, owner_id, recipe_id, author_id, body, created_at,
                                line_kind, line_text, strike_start, strike_end, replacement) values
  (true, null, 'd0000000-0000-4000-8000-000000000210', 'd0000000-0000-4000-8000-000000000105',
   'Trust me.', '2026-05-18', 'ingredient', '4 oz cream cheese', 0, 4, '8 oz'),
  (true, null, 'd0000000-0000-4000-8000-000000000208', 'd0000000-0000-4000-8000-000000000102',
   'Less, or nobody talks to you after.', '2025-12-27', 'ingredient', '8 cloves garlic, thinly sliced', 0, 8, '6 cloves'),
  (true, null, 'd0000000-0000-4000-8000-000000000207', 'd0000000-0000-4000-8000-000000000101',
   'Always with maduros. Always.', '2026-03-02', 'step', 'Taste for salt. Serve with white rice and maduros.', null, null, null);
