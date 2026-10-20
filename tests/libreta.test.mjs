// Line edits and pens, offline: what a rewrite crosses out, where notes land,
// and custom inks staying readable. Usage: npm run test:import
import assert from "node:assert/strict";
import { test } from "node:test";
import { diffLine, placeNotes } from "../src/lib/libreta.ts";
import { inkColor, parseInk, readableInk } from "../src/lib/pen.ts";

const crossed = (before, after) => {
  const d = diffLine(before, after);
  return d && [before.slice(d.start, d.end), d.replacement];
};

test("a rewrite crosses out whole words", () => {
  assert.deepEqual(crossed("1 cup sugar (for the caramel)", "¾ cup sugar (for the caramel)"), ["1", "¾"]);
  assert.deepEqual(crossed("1 taza de azúcar", "1 tazas de azúcar"), ["taza", "tazas"]);
  assert.deepEqual(crossed("1/2 cup wine", "1/3 cup wine"), ["1/2", "1/3"]);
  assert.deepEqual(crossed("Bake 1 hour.", "Bake 50 min."), ["1 hour", "50 min"]);
  assert.deepEqual(crossed("Salt", "Salt and pepper"), ["", "and pepper"]);
  assert.deepEqual(crossed("Add 1 tsp sugar", "Add sugar"), ["1 tsp", ""]);
  assert.equal(diffLine("same", "same"), null);
});

test("notes sit on their line until the line itself changes", () => {
  const note = (line_kind, line_text) => ({ id: line_text ?? "m", body: "x", line_kind, line_text });
  const { ingredientNotes, stepNotes, margin } = placeNotes(
    [note("ingredient", "2 eggs"), note("step", "Bake."), note("ingredient", "3 eggs"), note(null, null)],
    ["2 eggs", "Milk"],
    ["Bake."],
  );
  assert.equal(ingredientNotes[0].length, 1);
  assert.equal(stepNotes[0].length, 1);
  assert.deepEqual(margin.map((n) => n.id), ["3 eggs", "m"]);
});

test("custom inks are darkened until they read on the card", () => {
  assert.equal(readableInk("#2b4a9b"), "#2b4a9b");
  const pale = readableInk("#ffd400");
  assert.notEqual(pale, "#ffd400");
  assert.match(pale, /^#[0-9a-f]{6}$/);
  assert.equal(parseInk("teal"), "teal");
  assert.equal(parseInk("javascript:1"), null);
  assert.equal(inkColor("nonsense"), inkColor("sepia"));
});
