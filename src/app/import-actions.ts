"use server";

import { redirect } from "next/navigation";
import { getUserId } from "@/lib/supabase/server";
import { FetchPageError, fetchPage } from "@/lib/import/fetch-page";
import { recipeFromHtml } from "@/lib/import/jsonld";
import type { RecipeDraft } from "@/lib/import/draft";

export type ImportState = { error?: string; draft?: RecipeDraft } | undefined;

/**
 * Read a recipe from a link. Files and pasted text are read in the browser;
 * only links come here, because the page has to be fetched from the server.
 */
export async function importFromLink(_: ImportState, fd: FormData): Promise<ImportState> {
  // Signed-in only, so the public site can't be used to fetch arbitrary pages.
  if (!(await getUserId())) redirect("/login?next=/recipes/import");
  const raw = String(fd.get("url") ?? "").trim();
  if (!raw) return { error: "Paste the link to the recipe." };

  let page;
  try {
    page = await fetchPage(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch (e) {
    return { error: e instanceof FetchPageError ? e.message : "We couldn't load that page." };
  }

  const draft = recipeFromHtml(page.html);
  if (!draft || (draft.ingredients.length === 0 && draft.instructions.length === 0)) {
    return {
      error:
        "That page doesn't list its recipe in a form we can read. Save the page as a PDF and choose it under “Photo or PDF”, or copy the text and paste it.",
    };
  }
  draft.story = `From ${page.url.hostname.replace(/^www\./, "")}: ${page.url.toString()}`;
  return { draft };
}
