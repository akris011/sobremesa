// Builds recipe-card-print.pdf: a recipe-site page saved with the browser's
// "Save as PDF", the layout the PDF parser has to untangle. Notes before the
// recipe, a metadata line, ingredient groups under capitals that run onto page
// 2, bold-labelled steps that wrap, site boilerplate, and the browser's own
// date/title/URL header and footer. Rerun: node tests/fixtures/import/make-recipe-card-pdf.mjs
import { chromium } from "playwright";

const html = `<!doctype html><html><head><title>pan dulce conchas – a kitchen blog</title><style>
  body { font-family: Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.35; margin: 0; }
  h1 { font-size: 28px; margin: 0 0 18px; }
  .notes { font-style: italic; margin: 0 0 22px; }
  .meta { font-size: 13px; text-transform: uppercase; margin: 0 0 18px; }
  .meta b { margin-left: 14px; } .meta b:first-child { margin-left: 0; }
  h3 { font-size: 15px; text-transform: uppercase; margin: 18px 0 6px 6px; }
  ul { list-style: none; padding-left: 12px; margin: 0; } li { margin: 0 0 6px; }
  .method p { margin: 0 0 18px; }
  .footer { font-size: 10px; text-transform: uppercase; text-align: center; margin-top: 40px; }
  .buttons { text-align: center; margin-top: 30px; } .buttons p { margin: 0 0 18px; }
</style></head><body>
<h1>pan dulce conchas</h1>
<p class="notes">A few notes: The dough is soft and should feel a little tacky. Chill it overnight if your kitchen is warm, it is much easier to shape cold.</p>
<p class="meta"><b>Servings:</b> about 12 <b>Time:</b> 3 hours plus rising <b>Source:</b> a kitchen blog</p>
<h3>Dough</h3>
<ul><li>3 1/2 cups (455 grams) bread flour</li><li>1/2 cup (100 grams) sugar</li><li>2 1/4 teaspoons instant yeast</li>
<li>1 teaspoon fine salt</li><li>3/4 cup (180 ml) warm milk</li><li>2 large eggs</li><li>6 tablespoons butter, softened</li></ul>
<h3>Topping</h3>
<ul><li>1/2 cup (65 grams) all-purpose flour</li><li>1/2 cup (60 grams) powdered sugar</li>
<li style="break-before: page">4 tablespoons butter, softened</li><li>1 tablespoon cocoa powder</li></ul>
<div class="method" style="margin-top: 26px">
<p><b>Make the dough:</b> Whisk the flour, sugar, yeast and salt in a large bowl. Add the warm milk and the eggs and mix until shaggy, then knead in the butter a tablespoon at a time until the dough is smooth and pulls away from the bowl.</p>
<p><b>First rise:</b> Cover and let it rise until doubled, about 1 1/2 hours.</p>
<p>Divide the dough into 12 pieces, roll each into a ball and set them on two lined baking sheets, leaving room for them to spread as they rise.</p>
<p><b>Topping:</b> Rub the flour, sugar and butter together until it feels like soft play-dough. Press a disc onto each bun and score it with a shell pattern.</p>
<p><b>Bake:</b> At 350 degrees F for 18 to 20 minutes, until the bottoms are golden.</p>
<p><b>Do ahead:</b> The shaped buns keep in the fridge overnight; let them warm up for an hour before baking.</p>
</div>
<div class="buttons"><p>Print Recipe</p><p>Save to Pinterest</p></div>
<p class="footer">As an Amazon Associate I earn from qualifying purchases. Privacy Policy<br>First published May 2, 2024 on akitchenblog.example | ©2024 A Kitchen Blog.</p>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
await page.pdf({
  path: new URL("./recipe-card-print.pdf", import.meta.url).pathname,
  format: "Letter",
  margin: { top: "60px", bottom: "60px", left: "60px", right: "60px" },
  displayHeaderFooter: true,
  headerTemplate: `<div style="font-size:8px;width:100%;padding:0 24px;display:flex;justify-content:space-between"><span>5/2/24, 9:15 AM</span><span class="title"></span><span></span></div>`,
  footerTemplate: `<div style="font-size:8px;width:100%;padding:0 24px;display:flex;justify-content:space-between"><span>https://akitchenblog.example/2024/05/pan-dulce-conchas/</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
});
await browser.close();
