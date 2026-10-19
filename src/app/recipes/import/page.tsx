import { redirect } from "next/navigation";
import { listFamily } from "@/lib/data";
import { getUserId } from "@/lib/supabase/server";
import { RecipeImport } from "@/components/recipe-import";
import { TopBar } from "@/components/ui";

export const metadata = { title: "Bring in a recipe" };

export default async function ImportRecipePage() {
  if (!(await getUserId())) redirect("/login?next=/recipes/import");
  const family = await listFamily();
  return (
    <main className="rise">
      <TopBar back={{ href: "/recipes/new", label: "New recipe" }} />
      <h1 className="mt-2 mb-1 font-display text-[2.3rem] leading-tight font-semibold">Bring in a recipe</h1>
      <p className="mb-7 text-ink-soft">From a photo, a PDF, a website or pasted text. You&rsquo;ll check it before it&rsquo;s added.</p>
      <RecipeImport family={family} />
    </main>
  );
}
