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
const noOverflowOn = async (p, label) => {
  const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (o > 0) throw new Error(`${label}: horizontal overflow ${o}px at 375`);
};
const shot2 = (p, n) => p.screenshot({ path: `${out}/${n}.png`, fullPage: true });
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
  await page.click('label:has(input[name="contributor_hand"][value="kalam"])');
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

  // La Libreta: rewrite one line; the changed words are crossed out, not replaced.
  await page.getByRole("button", { name: /1 cup sugar/ }).click();
  const editor = page.locator('form:has(input[name="line_text"][value="1 cup sugar"])');
  await editor.locator('select[name="author"]').selectOption({ label: "Mami" });
  await editor.locator('textarea[name="rewrite"]').fill("3/4 cup sugar");
  await editor.locator('input[name="body"]').fill("too sweet otherwise");
  await editor.locator('button:has-text("Write it in")').click();
  await page.locator("del.struck", { hasText: "1" }).waitFor();
  if ((await page.locator("ins.pen-edit").innerText()).trim() !== "3/4") throw new Error("replacement not written in");
  if (!(await page.locator("ins.pen-edit.hand-kalam").count())) throw new Error("edit not in the writer's hand");
  await page.click('label:has-text("Show it as first written")');
  if (await page.locator("ins.pen-edit").isVisible()) throw new Error("original toggle didn't hide edits");
  await page.click('label:has-text("Show it as first written")');
  step("line rewritten: '1' crossed out, '3/4' in Mami's hand; original toggle hides it");
  await shot("02b_line_edit");

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

  // A new person with their own color and hand, then a change to an existing one.
  await page.goto(base + "/account");
  await page.click('summary:has-text("Add someone to the family")');
  await page.fill('input[name="name"]', "Tía Lucia");
  await page.locator('input[type="color"]').fill("#ffd400");
  await page.click('label:has(input[name="hand"][value="homemade"])');
  await page.getByText("Darkened a little so it reads on the page.").waitFor();
  await page.click('button:has-text("Add to the family")');
  const lucia = page.locator("li button", { hasText: "Tía Lucia" }).locator("span.hand-homemade");
  await lucia.waitFor();
  const color = await lucia.evaluate((el) => getComputedStyle(el).color);
  if (color === "rgb(255, 212, 0)") throw new Error("pale custom ink was not darkened");
  await page.locator("li button", { hasText: "Mami" }).click();
  await page.click('label:has(input[name="hand"][value="gochi"])');
  await page.click('button:has-text("Save Mami")');
  await page.locator("li button", { hasText: "Mami" }).locator("span.hand-gochi").waitFor();
  step(`family: custom ink darkened to ${color}; Mami's hand changed`);
  await shot("02c_family");

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

  // Import: every source ends on the normal form, prefilled, and nothing saves until "Add".
  const fixture = (name) => new URL(`./fixtures/import/${name}`, import.meta.url).pathname;
  const draftTitle = () => page.locator('input[name="title"]').inputValue();
  await page.goto(base + "/recipes/new");
  await page.click('a:has-text("Bring it in")');
  await page.waitForURL(base + "/recipes/import");
  await noOverflow("import page");

  await page.click('[role="tab"]:has-text("Paste text")');
  await page.fill('textarea[name="text"]', "Abuela's Arroz con Leche\nServes 6\n\nIngredientes\n1 taza de arroz\n4 tazas de leche\n\nPreparación\nCocina el arroz en la leche\na fuego lento.\nSirve frío.");
  await page.click('button:has-text("Sort it into the form")');
  await page.locator('input[name="title"]').waitFor();
  if ((await draftTitle()) !== "Abuela's Arroz con Leche") throw new Error(`pasted title: ${await draftTitle()}`);
  if ((await page.locator('textarea[name="instructions"]').inputValue()) !== "Cocina el arroz en la leche a fuego lento.\nSirve frío.")
    throw new Error("pasted steps not joined");
  await page.click('button:has-text("Add to the cookbook")');
  await page.waitForURL(/\/recipes\/[0-9a-f-]+\?saved=1/);
  await page.getByText("4 tazas de leche").waitFor();
  step("pasted text sorted into the form and saved after review");

  await page.goto(base + "/recipes/import");
  await page.locator('input[name="file"]:not([disabled])').waitFor({ state: "attached" }); // hydrated
  await page.setInputFiles('input[name="file"]', fixture("website-print.pdf"));
  await page.locator('input[name="title"]').waitFor({ timeout: 30_000 });
  if ((await draftTitle()) !== "Lemon Olive Oil Cake") throw new Error(`pdf title: ${await draftTitle()}`);
  if (!(await page.locator('textarea[name="ingredients"]').inputValue()).includes("2/3 cup olive oil")) throw new Error("pdf ingredients missing");
  step("text PDF read in the browser into a draft");
  await shot("04_import_pdf");

  await page.click('button:has-text("Try another way")');
  await page.locator('input[name="file"]:not([disabled])').waitFor({ state: "attached" });
  await page.setInputFiles('input[name="file"]', fixture("printed-card.jpg"));
  // First OCR run downloads Tesseract and the English + Spanish data from the CDN.
  await page.locator('input[name="title"]').waitFor({ timeout: 120_000 });
  if (!/Black Bean Soup/i.test(await draftTitle())) throw new Error(`ocr title: ${await draftTitle()}`);
  if ((await page.locator('input[name="servings"]').inputValue()) !== "6") throw new Error("ocr servings");
  if (!(await page.locator('textarea[name="ingredients"]').inputValue()).includes("ground cumin")) throw new Error("ocr ingredients");
  step("photo of a printed card read with OCR into a draft");
  await shot("05_import_photo");

  await page.click('button:has-text("Try another way")');
  await page.click('[role="tab"]:has-text("Link")');
  await page.fill('input[name="url"]', "https://localhost/recipe");
  await page.click('button:has-text("Read the recipe")');
  await page.getByText("That address isn't a public website.").waitFor();
  step("link import refuses private addresses");

  for (const p of ["/", "/gatherings", "/account", "/gatherings/new"]) {
    await page.goto(base + p);
    await noOverflow(p);
  }
  step("no horizontal overflow at 375px on main screens");
  await page.goto(base + "/");
  await page.screenshot({ path: `${out}/home_375.png` });

  // Part 3: two phones. The owner shares the family link; a guest joins as
  // Tía Carmen with her own pen; her note shows in her ink for the owner too.
  const phone = { viewport: { width: 375, height: 667 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true };
  const ownerCtx = await browser.newContext(phone);
  const guestCtx = await browser.newContext(phone);
  const owner = await ownerCtx.newPage();
  const guest = await guestCtx.newPage();
  for (const p of [owner, guest]) {
    p.on("console", (m) => m.type() === "error" && errors.push(`${p.url()} :: ${m.text()}`));
    p.on("pageerror", (e) => errors.push(`${p.url()} :: pageerror ${e.message}`));
  }
  await owner.goto(base + "/login");
  await owner.fill('input[name="name"]', "Rosa");
  await owner.fill('input[name="email"]', testEmail("e2e-owner"));
  await owner.fill('input[name="password"]', password);
  await owner.click('button:has-text("Create my cookbook")');
  await owner.waitForURL(base + "/");
  await owner.goto(base + "/recipes/new");
  await owner.fill('input[name="title"]', "Arroz con pollo");
  await owner.fill('textarea[name="ingredients"]', "1 chicken\n2 cups rice");
  await owner.fill('textarea[name="instructions"]', "Brown the chicken.\nAdd the rice.");
  await owner.click('button:has-text("Add to the cookbook")');
  await owner.waitForURL(/\/recipes\/[0-9a-f-]+\?saved=1/);
  const sharedRecipe = owner.url().split("?")[0];
  await owner.goto(base + "/account");
  // The add form starts open when you're the only one in the family.
  const addForm = owner.locator('details:has(summary:has-text("Add someone to the family"))');
  if ((await addForm.getAttribute("open")) === null) await addForm.locator("summary").click();
  await owner.fill('input[name="name"]', "Tía Carmen");
  await owner.click('button:has-text("Add to the family")');
  await owner.locator("li button", { hasText: "Tía Carmen" }).waitFor();
  await owner.click('button:has-text("Rename")');
  await owner.fill('input[name="name"]', "the Moreno family cookbook");
  await owner.click('button:has-text("Save the name")');
  await owner.getByText("the Moreno family cookbook").first().waitFor();
  await owner.click('button:has-text("Make an invite link")');
  const inviteButton = owner.locator("button[data-invite-url]");
  await inviteButton.waitFor();
  const invite = await inviteButton.getAttribute("data-invite-url");
  if (!invite?.startsWith(base + "/join/")) throw new Error(`invite link not on this host: ${invite}`);
  step("owner made a family link on this host");

  await guest.goto(invite);
  await guest.getByRole("heading", { name: "Rosa invited you to the Moreno family cookbook" }).waitFor();
  await guest.fill('input[name="name"]', "Carmen");
  await guest.fill('input[name="email"]', testEmail("e2e-guest"));
  await guest.fill('input[name="password"]', password);
  await guest.click('button:has-text("Make my account")');
  await guest.getByText("Which one are you?").waitFor();
  await guest.click('label:has-text("Tía Carmen")');
  await guest.click('label:has(input[name="ink"][value="teal"])');
  await guest.click('label:has(input[name="hand"][value="kalam"])');
  await noOverflowOn(guest, "join page");
  await shot2(guest, "06_join");
  await guest.click('button:has-text("Join the cookbook")');
  await guest.waitForURL(base + "/?joined=1");
  await guest.getByText("Arroz con pollo").first().waitFor();
  step("guest signed up from the link, claimed Tía Carmen, sees the shared cookbook");

  await guest.goto(sharedRecipe);
  await guest.click('summary:has-text("Write in the margin")');
  const chosen = await guest.locator('select[name="author"] option:checked').innerText();
  if (!chosen.startsWith("Tía Carmen")) throw new Error(`note didn't default to the guest's own person: ${chosen}`);
  if (await guest.locator('select[name="author"] option', { hasText: "Rosa" }).count()) throw new Error("guest can sign as the owner");
  await guest.fill('textarea[name="body"]', "Saffron, not achiote.");
  await guest.click('button:has-text("Add note")');
  await guest.locator(".hand-kalam", { hasText: "Tía Carmen" }).first().waitFor();
  step("guest's note defaults to her and is written in her hand");

  await owner.goto(sharedRecipe);
  await owner.getByText("Saffron, not achiote.").waitFor();
  const carmenInk = await owner.locator(".hand-kalam", { hasText: "Tía Carmen" }).first().evaluate((el) => getComputedStyle(el).color);
  if (await owner.getByRole("button", { name: "Remove note by Tía Carmen" }).count()) throw new Error("owner can remove a claimed person's note");
  await owner.click('summary:has-text("Write in the margin")');
  if (await owner.locator('select[name="author"] option', { hasText: "Tía Carmen" }).count()) throw new Error("owner can sign as Tía Carmen");
  step(`owner sees the note in Carmen's ink (${carmenInk}), can't remove it or sign as her`);
  await shot2(owner, "07_shared_note");

  await owner.goto(base + "/account");
  await owner.locator("li", { hasText: "Tía Carmen" }).getByText("joined").waitFor();
  if (await owner.locator("li button", { hasText: "Tía Carmen" }).count()) throw new Error("owner can open Carmen's pen");
  await owner.click('button:has-text("Turn off this link")');
  await owner.click('button:has-text("Turn it off")');
  await owner.locator('button:has-text("Make an invite link")').waitFor();
  const thirdCtx = await browser.newContext(phone);
  const third = await thirdCtx.newPage();
  await third.goto(invite);
  await third.getByText("This link has been turned off").waitFor();
  step("Carmen shows as joined with no Change for the owner; turned-off link explains itself");
  await Promise.all([ownerCtx.close(), guestCtx.close(), thirdCtx.close()]);
} catch (e) {
  failed = true;
  console.log("✗ FAILED at", page.url(), e.message);
  await shot("failure");
}
console.log("console errors:", errors.length ? "\n" + errors.join("\n") : "none");
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
