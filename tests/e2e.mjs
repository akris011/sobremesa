// The main flows in a phone-sized browser, against a running build.
// Usage: npm run build && npx next start -p 3001, then npm run test:e2e
// (or BASE_URL=https://… npm run test:e2e). Screenshots go to tests/output/.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { testEmail } from "./helpers.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const out = new URL("./output", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const email = testEmail("e2e");
const password = "correct-horse-1";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} :: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`${page.url()} :: pageerror ${e.message}`));
const step = (s) => console.log("✓", s);
const shot = (n) => page.screenshot({ path: `${out}/${n}.png`, fullPage: true });
const noOverflow = async (label) => {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (o > 0) throw new Error(`${label}: horizontal overflow ${o}px at 375`);
};
let failed = false;

try {
  // Part 1: new account, recipe, note, gathering, history, sign out.
  await page.goto(base + "/login");
  await page.fill('input[name="name"]', "Mari");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "correct-horse-1");
  await page.click('button:has-text("Create my cookbook")');
  await page.waitForURL(base + "/");
  await page.getByText("An empty cookbook").waitFor();
  step("signed up; empty cookbook shown");
  await shot("01_empty");

  await page.goto(base + "/recipes/new");
  await page.fill('input[name="title"]', "Mami's Flan");
  await page.fill('input[name="description"]', "The one with the extra yolk.");
  await page.selectOption('select[name="contributor"]', "__new");
  await page.fill('input[name="contributor_name"]', "Mami");
  await page.click('label:has(input[name="contributor_ink"][value="plum"])');
  await page.fill('input[name="servings"]', "8");
  await page.fill('textarea[name="ingredients"]', "1 cup sugar\n- 5 eggs\n1 can condensed milk");
  await page.fill('textarea[name="instructions"]', "1. Make the caramel.\n2. Whisk and bake.");
  await page.fill('textarea[name="story"]', "Every birthday since 1998.");
  await page.click('button:has-text("Add to the cookbook")');
  await page.waitForURL(/\/recipes\/[0-9a-f-]+\?saved=1/);
  const recipeUrl = page.url().split("?")[0];
  await page.getByText("Saved to the cookbook.").waitFor();
  step("recipe created");

  await page.reload();
  await page.getByRole("heading", { name: "Mami's Flan" }).waitFor();
  if (!(await page.getByText("5 eggs").isVisible())) throw new Error("list prefix not stripped");
  step("recipe persists after reload (and '- ' prefixes stripped)");

  await page.click('summary:has-text("Write in the margin")');
  await page.selectOption('select[name="author"]', { label: "Mari (Me)" });
  await page.fill('textarea[name="body"]', "I add a pinch of cinnamon.");
  await page.click('button:has-text("Add note")');
  await page.getByText("I add a pinch of cinnamon.").waitFor();
  step("margin note added");
  await shot("02_recipe");

  await page.goto(base + "/gatherings/new");
  await page.fill('input[name="name"]', "Abuela's birthday");
  await page.fill('input[name="held_on"]', "2026-11-08");
  await page.fill('input[name="location"]', "Our place");
  await page.click('button:has-text("Save and set the menu")');
  await page.waitForURL(/\/gatherings\/[0-9a-f-]+$/);
  const gatheringUrl = page.url();
  step("gathering created");

  await page.click('button:has-text("Add a dish from the cookbook")');
  await page.selectOption('select[name="recipe_id"]', { label: "Mami's Flan" });
  await page.selectOption('select[name="preparer"]', { label: "Mami" });
  await page.click('button:has-text("Add to the menu")');
  await page.getByText("Every recipe in the cookbook is on this menu.").waitFor();
  step("dish assigned; recipe no longer offered again (duplicate prevented in UI)");
  await shot("03_gathering");

  await page.goto(recipeUrl);
  await page.locator("text=Abuela's birthday").waitFor();
  if (!(await page.locator("section:has-text('At the table')").getByText("Mami").first().isVisible())) throw new Error("preparer missing in history");
  step("gathering + preparer appear in recipe history");
  await shot("04_history");

  await page.goto(base + "/");
  await page.getByText("Mami's Flan").waitFor();
  await page.getByText("Abuela's birthday").waitFor();
  step("home shows recipe and upcoming gathering");

  // Sample content stays read-only for a signed-in user: their scope hides it.
  const res = await page.goto(base + "/recipes/d0000000-0000-4000-8000-000000000201/edit");
  step(`sample recipe edit page for signed-in user → ${res.status()}`);

  await page.goto(base + "/account");
  await page.click('button:has-text("Sign out")');
  await page.waitForURL(base + "/");
  await page.getByText("The Moreno family cookbook").waitFor();
  const r2 = await page.goto(gatheringUrl);
  step(`signed out; private gathering as visitor → ${r2.status()}`);


  // Part 2: sign back in through ?next, edit, validation, delete, widths.
  await page.goto(base + "/recipes/new");
  await page.waitForURL(/\/login\?next=%2Frecipes%2Fnew|\/login\?next=\/recipes\/new/);
  await page.click('[role="tab"]:has-text("Sign in")');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "wrong-password");
  await page.click('form button[type="submit"]');
  await page.getByText("That email and password don't match.").waitFor();
  step("wrong password shows a readable error");
  await page.fill('input[name="password"]', password);
  await page.click('form button[type="submit"]');
  await page.waitForURL(base + "/recipes/new");
  step("sign in works and returns to /recipes/new (?next honored)");
  await noOverflow("new recipe form");

  // Validation: blank ingredients after whitespace.
  await page.fill('input[name="title"]', "Tía's Pound Cake");
  await page.fill('textarea[name="ingredients"]', "1.5 cups flour\n1 cup butter");
  await page.fill('textarea[name="instructions"]', "Cream the butter.\nBake 1 hour.");
  await page.fill('input[name="servings"]', "12");
  await page.click('button:has-text("Add to the cookbook")');
  await page.waitForURL(/saved=1/);
  if (!(await page.getByText("1.5 cups flour").isVisible())) throw new Error("decimal quantity mangled");
  step("decimal quantity '1.5 cups flour' saved intact");
  const cakeUrl = page.url().split("?")[0];
  await noOverflow("recipe page");

  await page.click('a:has-text("Edit")');
  await page.waitForURL(/\/edit$/);
  await page.fill('input[name="title"]', "Tía's Pound Cake (lemon)");
  await page.fill('input[name="servings"]', "0");
  const valid = await page.$eval('input[name="servings"]', (el) => el.checkValidity());
  if (valid) throw new Error("servings 0 passed browser validation");
  step("invalid servings blocked by browser validation (server also re-checks)");
  // The form must keep what was typed when the server rejects it: blank the
  // ingredients so the server returns an error, then check the title survived.
  await page.fill('input[name="servings"]', "10");
  await page.$eval('textarea[name="ingredients"]', (el) => { el.removeAttribute("required"); el.value = "   "; });
  await page.click('button:has-text("Save changes")');
  await page.getByText("List at least one ingredient.").waitFor();
  const kept = await page.inputValue('input[name="title"]');
  if (kept !== "Tía's Pound Cake (lemon)") throw new Error(`form was reset after error (title="${kept}")`);
  step("server error keeps the typed fields (no form reset)");
  await page.fill('textarea[name="ingredients"]', "1.5 cups flour\n1 cup butter\nZest of 2 lemons");
  await page.fill('input[name="servings"]', "10");
  await page.click('button:has-text("Save changes")');
  await page.waitForURL(/saved=1/);
  await page.getByRole("heading", { name: "Tía's Pound Cake (lemon)" }).waitFor();
  await page.reload();
  await page.getByText("Serves 10").first().waitFor();
  step("recipe edit saved and persists after reload");

  await page.goto(cakeUrl + "/edit");
  await page.click('button:has-text("Remove this recipe")');
  await page.click('button:has-text("Remove it, and its notes and history")');
  await page.waitForURL(base + "/");
  await page.goto(cakeUrl);
  if (!(await page.getByText("This page isn't in the book").isVisible())) throw new Error("deleted recipe still visible");
  step("recipe delete (two-tap confirm) works");

  await page.goto(base + "/gatherings/new");
  const throwaway = `Throwaway ${Date.now()}`;
  await page.fill('input[name="name"]', throwaway);
  await page.fill('input[name="held_on"]', today);
  await page.click('button:has-text("Save and set the menu")');
  await page.waitForURL(/\/gatherings\/[0-9a-f-]+$/);
  await page.getByText("You're invited").waitFor();
  step("gathering dated today counts as upcoming");
  await noOverflow("gathering page");
  await page.click('button:has-text("Cancel this gathering")');
  await page.click('button:has-text("Remove it and its menu")');
  await page.waitForURL(base + "/gatherings");
  await page.getByText(throwaway).waitFor({ state: "detached", timeout: 5000 });
  await page.reload();
  if (await page.getByText(throwaway).count()) throw new Error("gathering not deleted");
  step("gathering delete works");

  for (const p of ["/", "/gatherings", "/account", "/gatherings/new"]) {
    await page.goto(base + p);
    await noOverflow(p);
  }
  step("no horizontal overflow at 375px on main screens");
  await page.goto(base + "/");
  await page.screenshot({ path: `${out}/home_375.png` });
} catch (e) {
  failed = true;
  console.log("✗ FAILED at", page.url(), e.message);
  await shot("failure");
}
console.log("console errors:", errors.length ? "\n" + errors.join("\n") : "none");
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
