-- The public sample cookbook (is_demo = true, owner_id null). Readable by anyone,
-- writable by no one through the API. The Moreno family is fictional.

insert into public.family_members (id, is_demo, owner_id, name, relation, ink) values
  ('d0000000-0000-4000-8000-000000000101', true, null, 'Abuela Rosa', 'Grandmother', 'burgundy'),
  ('d0000000-0000-4000-8000-000000000102', true, null, 'Tía Carmen', 'Aunt', 'olive'),
  ('d0000000-0000-4000-8000-000000000103', true, null, 'Luis', 'Dad', 'indigo'),
  ('d0000000-0000-4000-8000-000000000104', true, null, 'Mari', 'Cousin', 'terracotta'),
  ('d0000000-0000-4000-8000-000000000105', true, null, 'Daniel', 'Brother', 'plum');

insert into public.recipes (id, is_demo, owner_id, title, description, story, ingredients, instructions, servings, contributor_id, created_at) values
(
  'd0000000-0000-4000-8000-000000000201', true, null,
  'Picadillo de Abuela',
  'Ground beef simmered with tomato, olives and raisins. Served over white rice.',
  'Abuela Rosa learned this in her mother''s kitchen in Camagüey and made it every Thursday for forty years. She never measured the cumin; she says you add it until the kitchen smells right. This card is the closest anyone has come to writing it down.',
  array[
    '2 lb ground beef',
    '1 large yellow onion, diced',
    '1 green bell pepper, diced',
    '4 cloves garlic, minced',
    '1 can (8 oz) tomato sauce',
    '1/2 cup dry white wine',
    '1/2 cup pimiento-stuffed olives, halved',
    '1/3 cup raisins',
    '1 tsp ground cumin',
    '1 tsp dried oregano',
    '1 bay leaf',
    'Salt and black pepper',
    'Olive oil'
  ],
  array[
    'Warm a few tablespoons of olive oil in a wide pan. Cook the onion and pepper until soft, about 8 minutes, then add the garlic for one more minute.',
    'Add the beef and break it up as it browns. Pour off most of the fat.',
    'Stir in the cumin, oregano and bay leaf, then the wine. Let it bubble until mostly gone.',
    'Add the tomato sauce, olives and raisins. Cover and simmer on low for 20 minutes.',
    'Taste for salt. Remove the bay leaf and serve over white rice.'
  ],
  6, 'd0000000-0000-4000-8000-000000000101', '2025-11-02'
),
(
  'd0000000-0000-4000-8000-000000000202', true, null,
  'Frijoles Negros',
  'Slow-cooked black beans with a sofrito stirred in at the end.',
  'The pot that never leaves the stove at Nochebuena. Tía Carmen brings hers in the same dented aluminum pot every year, wrapped in two towels.',
  array[
    '1 lb dried black beans, soaked overnight',
    '1 green bell pepper, halved',
    '1 onion, diced',
    '6 cloves garlic, minced',
    '1/4 cup olive oil',
    '2 bay leaves',
    '1 tsp ground cumin',
    '1 tsp dried oregano',
    '1 tbsp red wine vinegar',
    '1 tsp sugar',
    'Salt'
  ],
  array[
    'Drain the beans. Cover with fresh water by two inches, add half the pepper and the bay leaves, and simmer until tender, 1 1/2 to 2 hours.',
    'Meanwhile dice the remaining pepper. Make a sofrito: cook it with the onion in olive oil until soft, then add garlic, cumin and oregano.',
    'Stir the sofrito into the beans. Mash a ladleful of beans against the pot to thicken.',
    'Add vinegar, sugar and salt. Simmer uncovered 30 minutes more. Better the next day.'
  ],
  8, 'd0000000-0000-4000-8000-000000000102', '2025-11-09'
),
(
  'd0000000-0000-4000-8000-000000000203', true, null,
  'Flan de Leche',
  'Silky baked custard under a dark caramel.',
  'Abuela makes the caramel in the flanera directly on the burner and turns it with a fork wrapped in a dish towel. Every grandchild has been told to stand back.',
  array[
    '1 cup sugar (for the caramel)',
    '5 large eggs',
    '1 can (14 oz) sweetened condensed milk',
    '1 can (12 oz) evaporated milk',
    '1 tsp vanilla extract',
    'Pinch of salt'
  ],
  array[
    'Heat the oven to 350°F. Melt the sugar in the flan mold over medium heat until it turns deep amber. Tilt to coat the sides and let it set.',
    'Whisk the eggs, both milks, vanilla and salt until smooth. Strain into the mold.',
    'Cover with foil and set in a larger pan. Pour hot water halfway up the sides.',
    'Bake 60 to 70 minutes, until the center jiggles slightly. Cool, then chill overnight.',
    'Run a knife around the edge and flip onto a plate with a lip to catch the caramel.'
  ],
  8, 'd0000000-0000-4000-8000-000000000101', '2025-11-15'
),
(
  'd0000000-0000-4000-8000-000000000204', true, null,
  'Lechón Asado',
  'Pork shoulder marinated overnight in sour-orange mojo, roasted until it falls apart.',
  'Dad took over the lechón in 2009 when Abuelo''s back gave out. He still calls Abuelo halfway through every year to ask whether it is done.',
  array[
    '1 bone-in pork shoulder, 8 to 10 lb',
    '2 cups sour orange juice (or 1 1/3 cups orange + 2/3 cup lime)',
    '1 head garlic, peeled',
    '1 tbsp ground cumin',
    '1 tbsp dried oregano',
    '1 tbsp salt',
    '1 tsp black pepper',
    '1/2 cup olive oil',
    '2 onions, sliced into rings'
  ],
  array[
    'Mash the garlic with the salt into a paste. Whisk in cumin, oregano, pepper, juice and oil.',
    'Score the pork, pour the mojo over it and work it into the cuts. Cover with onions and refrigerate overnight, turning once.',
    'Roast at 325°F, skin side up, about 35 minutes per pound, basting with the marinade.',
    'When it pulls apart, raise the oven to 450°F for 15 minutes to crisp the skin.',
    'Rest 20 minutes before pulling.'
  ],
  14, 'd0000000-0000-4000-8000-000000000103', '2025-11-20'
),
(
  'd0000000-0000-4000-8000-000000000205', true, null,
  'Arroz con Pollo',
  'Saffron-yellow rice baked with chicken, peppers and a splash of beer.',
  'Tía Carmen''s Sunday dish. She swears the beer is the secret and refuses to say which one.',
  array[
    '3 lb chicken thighs, bone-in',
    '2 cups Valencia rice',
    '1 bottle (12 oz) lager',
    '3 cups chicken stock',
    '1 onion, diced',
    '1 red bell pepper, diced',
    '4 cloves garlic, minced',
    '1/2 cup tomato sauce',
    'Pinch of saffron or 1 packet bijol',
    '1 cup frozen peas',
    'Roasted red peppers, for the top'
  ],
  array[
    'Season the chicken with salt, pepper and a little cumin. Brown it in a wide pot and set aside.',
    'In the same pot cook onion, pepper and garlic until soft. Add tomato sauce and saffron.',
    'Stir in the rice to coat, then add the beer and stock. Return the chicken.',
    'Bring to a boil, cover and bake at 350°F for 25 minutes.',
    'Scatter peas and roasted peppers on top, cover and rest 10 minutes.'
  ],
  6, 'd0000000-0000-4000-8000-000000000102', '2026-01-10'
),
(
  'd0000000-0000-4000-8000-000000000206', true, null,
  'Tostones',
  'Twice-fried green plantains with garlic mojo for dipping.',
  'Mari started making these for the kids'' table and now nobody else is allowed to.',
  array[
    '3 green plantains',
    'Vegetable oil, for frying',
    'Coarse salt',
    '4 cloves garlic, minced',
    '1/4 cup olive oil',
    'Juice of 1 lime'
  ],
  array[
    'Peel the plantains and cut into 1-inch rounds.',
    'Fry at 325°F until pale gold, about 3 minutes. Drain.',
    'Smash each piece flat with the bottom of a glass.',
    'Fry again at 375°F until crisp. Salt immediately.',
    'For the mojo, warm the garlic in olive oil until fragrant, then add the lime juice.'
  ],
  4, 'd0000000-0000-4000-8000-000000000104', '2026-02-01'
);

insert into public.gatherings (id, is_demo, owner_id, name, held_on, location, description) values
  ('d0000000-0000-4000-8000-000000000301', true, null, 'Nochebuena 2025', '2025-12-24', 'Abuela''s house, Hialeah',
   'Twenty-two people, two tables pushed together, and the lechón out by noon.'),
  ('d0000000-0000-4000-8000-000000000302', true, null, 'Abuela Rosa''s 80th', '2026-06-14', 'Tía Carmen''s backyard',
   'Everyone cooked one of Abuela''s recipes for her. She critiqued each one.'),
  ('d0000000-0000-4000-8000-000000000303', true, null, 'Sunday dinner', '2026-10-25', 'Tía Carmen''s',
   'Regular Sunday. Bring a chair if you are coming.'),
  ('d0000000-0000-4000-8000-000000000304', true, null, 'Nochebuena 2026', '2026-12-24', 'Abuela''s house, Hialeah',
   'Same as always. Daniel is on flan this year, supervised.');

insert into public.menu_items (is_demo, owner_id, gathering_id, recipe_id, preparer_id, note) values
  (true, null, 'd0000000-0000-4000-8000-000000000301', 'd0000000-0000-4000-8000-000000000204', 'd0000000-0000-4000-8000-000000000103', 'Started at 5 a.m.'),
  (true, null, 'd0000000-0000-4000-8000-000000000301', 'd0000000-0000-4000-8000-000000000202', 'd0000000-0000-4000-8000-000000000102', null),
  (true, null, 'd0000000-0000-4000-8000-000000000301', 'd0000000-0000-4000-8000-000000000203', 'd0000000-0000-4000-8000-000000000101', 'Two flans this time.'),
  (true, null, 'd0000000-0000-4000-8000-000000000301', 'd0000000-0000-4000-8000-000000000206', 'd0000000-0000-4000-8000-000000000104', null),
  (true, null, 'd0000000-0000-4000-8000-000000000302', 'd0000000-0000-4000-8000-000000000201', 'd0000000-0000-4000-8000-000000000104', 'Mari''s first try. Abuela approved.'),
  (true, null, 'd0000000-0000-4000-8000-000000000302', 'd0000000-0000-4000-8000-000000000203', 'd0000000-0000-4000-8000-000000000105', null),
  (true, null, 'd0000000-0000-4000-8000-000000000302', 'd0000000-0000-4000-8000-000000000205', 'd0000000-0000-4000-8000-000000000102', null),
  (true, null, 'd0000000-0000-4000-8000-000000000303', 'd0000000-0000-4000-8000-000000000205', 'd0000000-0000-4000-8000-000000000102', null),
  (true, null, 'd0000000-0000-4000-8000-000000000303', 'd0000000-0000-4000-8000-000000000206', null, null),
  (true, null, 'd0000000-0000-4000-8000-000000000304', 'd0000000-0000-4000-8000-000000000204', 'd0000000-0000-4000-8000-000000000103', null),
  (true, null, 'd0000000-0000-4000-8000-000000000304', 'd0000000-0000-4000-8000-000000000203', 'd0000000-0000-4000-8000-000000000105', null),
  (true, null, 'd0000000-0000-4000-8000-000000000304', 'd0000000-0000-4000-8000-000000000202', 'd0000000-0000-4000-8000-000000000102', null);

insert into public.annotations (is_demo, owner_id, recipe_id, author_id, body, created_at) values
  (true, null, 'd0000000-0000-4000-8000-000000000201', 'd0000000-0000-4000-8000-000000000104',
   'I use half beef, half ground pork. Abuela pretends not to notice.', '2026-06-15'),
  (true, null, 'd0000000-0000-4000-8000-000000000201', 'd0000000-0000-4000-8000-000000000101',
   'Capers too, if you have them. Not too many.', '2026-06-20'),
  (true, null, 'd0000000-0000-4000-8000-000000000201', 'd0000000-0000-4000-8000-000000000105',
   'No raisins on my half, please.', '2026-07-02'),
  (true, null, 'd0000000-0000-4000-8000-000000000202', 'd0000000-0000-4000-8000-000000000103',
   'A splash of the olive brine at the end. Trust me.', '2025-12-26'),
  (true, null, 'd0000000-0000-4000-8000-000000000203', 'd0000000-0000-4000-8000-000000000105',
   'Took mine out at 55 minutes and it was perfect. Oven runs hot.', '2026-06-15'),
  (true, null, 'd0000000-0000-4000-8000-000000000203', 'd0000000-0000-4000-8000-000000000101',
   'It was a little firm, mi amor. 50 next time.', '2026-06-16'),
  (true, null, 'd0000000-0000-4000-8000-000000000204', 'd0000000-0000-4000-8000-000000000102',
   'Bitter oranges from the tree behind the house work best. Bottled is fine in a pinch.', '2025-12-27'),
  (true, null, 'd0000000-0000-4000-8000-000000000205', 'd0000000-0000-4000-8000-000000000104',
   'Doubled it for the 80th in the big paella pan. Needed an extra 10 minutes.', '2026-06-15'),
  (true, null, 'd0000000-0000-4000-8000-000000000206', 'd0000000-0000-4000-8000-000000000103',
   'Salt them the second they come out of the oil or it won''t stick.', '2026-02-03');
