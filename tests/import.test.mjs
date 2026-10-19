// Recipe import parsers, offline: JSON-LD from saved pages, loose text, and the
// link fetcher's address checks. Usage: npm run test:import
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { recipeFromHtml } from "../src/lib/import/jsonld.ts";
import { parseRecipeText } from "../src/lib/import/text.ts";
import { fetchPage, isPublicAddress } from "../src/lib/import/fetch-page.ts";
import { extractPdfItems, recipeFromPdfItems } from "../src/lib/import/pdf-layout.ts";
import * as pdfjs from "../node_modules/pdfjs-dist/legacy/build/pdf.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/import/${name}`, import.meta.url), "utf8");
const openPdf = (name, fontExtraProperties = true) =>
  pdfjs.getDocument({ data: new Uint8Array(readFileSync(new URL(`./fixtures/import/${name}`, import.meta.url))), fontExtraProperties, verbosity: 0 }).promise;

test("JSON-LD: WordPress @graph with HowToSections and entities", () => {
  const d = recipeFromHtml(fixture("wordpress-graph.html"));
  assert.equal(d.title, "Tres Leches Cake");
  assert.equal(d.description, "A light sponge soaked in three milks & topped with whipped cream.");
  assert.equal(d.servings, 12);
  assert.deepEqual(d.ingredients.slice(1, 2), ["1 ½ teaspoons baking powder"]);
  assert.equal(d.ingredients.at(-1), "¼ cup whole milk");
  assert.deepEqual(d.instructions, [
    "For the cake:",
    "Heat the oven to 350°F and butter a 9x13 pan.",
    "Beat the eggs, fold in the flour and bake 30 minutes.",
    "For the soak:",
    "Whisk the three milks and pour over the warm cake.",
  ]);
});

test("JSON-LD: @type array, HTML description, instructions as one HTML string", () => {
  const d = recipeFromHtml(fixture("html-string-instructions.html"));
  assert.equal(d.title, "Arroz con Pollo");
  assert.equal(d.description, "Weeknight chicken and rice, the way Tía makes it .");
  assert.equal(d.servings, 4);
  assert.deepEqual(d.ingredients, ["2 lb chicken thighs", "1.5 cups rice", "1 packet sazón", "Salt to taste"]);
  assert.deepEqual(d.instructions, [
    "Brown the chicken in olive oil.",
    "Add the sofrito and rice; stir to coat.",
    "Pour in the broth, cover and simmer 25 minutes.",
  ]);
});

test("JSON-LD: skips a broken block and finds the Recipe in an array", () => {
  const d = recipeFromHtml(fixture("broken-then-array.html"));
  assert.equal(d.title, "Grandma's Shortbread");
  assert.equal(d.servings, 24);
  assert.equal(d.ingredients.length, 3);
  assert.equal(d.instructions.length, 3);
});

test("JSON-LD: a page with no Recipe returns null", () => {
  assert.equal(recipeFromHtml(fixture("no-recipe.html")), null);
});

test("text: headed recipe with servings, bullets and numbered steps", () => {
  const d = parseRecipeText(
    "Mami's Flan\nThe one with the extra yolk.\nServes 8\n\nIngredients:\n- 1 cup sugar\n• 5 eggs\n1.5 cups milk\n\nMethod\n1. Make the caramel and pour\nit into the mold.\n2. Whisk and bake.\n\nNotes\nEvery birthday since 1998.",
  );
  assert.equal(d.title, "Mami's Flan");
  assert.equal(d.description, "The one with the extra yolk.");
  assert.equal(d.servings, 8);
  assert.deepEqual(d.ingredients, ["1 cup sugar", "5 eggs", "1.5 cups milk"]);
  assert.deepEqual(d.instructions, ["Make the caramel and pour it into the mold.", "Whisk and bake."]);
  assert.equal(d.story, "Every birthday since 1998.");
});

test("text: Spanish headings and wrapped OCR lines", () => {
  const d = parseRecipeText(
    "ARROZ CON LECHE\n\nIngredientes\n1 taza de arroz\n4 tazas de leche\nCanela al gusto\n\nPreparación\nCocina el arroz en la leche a fuego\nlento, revolviendo seguido.\nAgrega la canela y sir-\nve frío.",
  );
  assert.equal(d.title, "ARROZ CON LECHE");
  assert.deepEqual(d.ingredients, ["1 taza de arroz", "4 tazas de leche", "Canela al gusto"]);
  assert.deepEqual(d.instructions, ["Cocina el arroz en la leche a fuego lento, revolviendo seguido.", "Agrega la canela y sirve frío."]);
});

test("text: no headings, ingredients guessed from quantities", () => {
  const d = parseRecipeText("Picadillo\n2 lb ground beef\n1 onion, diced\n1/3 cup raisins\nBrown the beef with the onion.\nAdd the raisins and simmer 20 minutes.");
  assert.equal(d.title, "Picadillo");
  assert.deepEqual(d.ingredients, ["2 lb ground beef", "1 onion, diced", "1/3 cup raisins"]);
  assert.deepEqual(d.instructions, ["Brown the beef with the onion.", "Add the raisins and simmer 20 minutes."]);
});

test("text: skips the URL and date a browser prints on a saved PDF", () => {
  const d = parseRecipeText("www.example-recipes.com · Printed 10/19/2026\nLemon Olive Oil Cake\nIngredients\n3 eggs\nInstructions\nBake it.\n1/2");
  assert.equal(d.title, "Lemon Olive Oil Cake");
  assert.deepEqual(d.instructions, ["Bake it."]);
});

test("link fetcher: only public https addresses", async () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])
    assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ["93.184.215.14", "2606:4700::6810:84e5"]) assert.equal(isPublicAddress(ip), true, ip);

  for (const url of ["http://example.com/", "https://127.0.0.1/", "https://[::1]/", "https://localhost/", "https://example.com:8443/", "https://user:pw@example.com/", "file:///etc/passwd"])
    await assert.rejects(fetchPage(url), url);
});

// recipe-card-print.pdf comes from fixtures/import/make-recipe-card-pdf.mjs: a recipe page saved
// with "Save as PDF", with notes, a metadata line, capitalized ingredient groups that run onto
// page 2, bold-labelled steps that wrap, site boilerplate and the browser's header and footer.
for (const fontExtraProperties of [true, false]) {
  test(`PDF layout: saved recipe page, ${fontExtraProperties ? "bold from font names" : "no font names"}`, async () => {
    const { items, links } = await extractPdfItems(await openPdf("recipe-card-print.pdf", fontExtraProperties));
    assert.equal(links[0], "https://akitchenblog.example/2024/05/pan-dulce-conchas/");
    assert.equal(items.some((it) => it.bold), fontExtraProperties);
    const d = recipeFromPdfItems(items);
    assert.equal(d.title, "pan dulce conchas");
    assert.equal(d.servings, 12);
    assert.deepEqual(d.ingredients, [
      "Dough:",
      "3 1/2 cups (455 grams) bread flour",
      "1/2 cup (100 grams) sugar",
      "2 1/4 teaspoons instant yeast",
      "1 teaspoon fine salt",
      "3/4 cup (180 ml) warm milk",
      "2 large eggs",
      "6 tablespoons butter, softened",
      "Topping:",
      "1/2 cup (65 grams) all-purpose flour",
      "1/2 cup (60 grams) powdered sugar",
      "4 tablespoons butter, softened", // on page 2
      "1 tablespoon cocoa powder",
    ]);
    assert.deepEqual(
      d.instructions.map((s) => s.slice(0, 24)),
      ["Make the dough: Whisk th", "First rise: Cover and le", "Divide the dough into 12", "Topping: Rub the flour, ", "Bake: At 350 degrees F f"],
    );
    assert.ok(d.instructions[0].endsWith("pulls away from the bowl."), "wrapped lines joined into one step");
    assert.match(d.story, /^A few notes: The dough is soft/);
    assert.match(d.story, /\n\nDo ahead: The shaped buns keep/);
    const all = JSON.stringify(d);
    for (const junk of ["Print Recipe", "Pinterest", "Amazon", "©", "9:15 AM", "akitchenblog.example/", "1/2\"", "Time:"])
      assert.ok(!all.toLowerCase().includes(junk.toLowerCase()), `kept ${junk}`);
  });
}

test("PDF layout: simple printed page still reads (e2e fixture)", async () => {
  const { items } = await extractPdfItems(await openPdf("website-print.pdf"));
  const d = recipeFromPdfItems(items);
  assert.equal(d.title, "Lemon Olive Oil Cake");
  assert.equal(d.description, "A loose, tender cake that keeps for days. Makes 10 slices.");
  assert.deepEqual(d.ingredients, ["1 1/2 cups flour", "3/4 cup sugar", "3 eggs", "2/3 cup olive oil", "Zest and juice of 2 lemons"]);
  assert.deepEqual(d.instructions, [
    "Heat the oven to 350°F and line a 9-inch pan with parchment paper so the cake releases cleanly when it is done.",
    "Whisk everything together and bake for 40 minutes.",
  ]);
});

test("PDF layout: no text layer returns null so the caller can OCR", () => {
  assert.equal(recipeFromPdfItems([]), null);
  assert.equal(recipeFromPdfItems([{ page: 1, str: "  ", x: 0, y: 0, width: 1, height: 10, bold: false }]), null);
});
