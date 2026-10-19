import Link from "next/link";
import { redirect } from "next/navigation";
import { listFamily } from "@/lib/data";
import { getUserId } from "@/lib/supabase/server";
import { RecipeForm } from "@/components/recipe-form";
import { TopBar } from "@/components/ui";

export const metadata = { title: "New recipe" };

export default async function NewRecipePage() {
  if (!(await getUserId())) redirect("/login?next=/recipes/new");
  const family = await listFamily();
  return (
    <main className="rise">
      <TopBar back={{ href: "/", label: "Cookbook" }} />
      <h1 className="mt-2 mb-1 font-display text-[2.3rem] leading-tight font-semibold">A new card</h1>
      <p className="mb-4 text-ink-soft">Write it the way it&rsquo;s actually made. Changes can go in the margins later.</p>
      <p className="mb-7 text-[0.95rem] text-ink-soft">
        Already have it on a card, in a cookbook or on a website?{" "}
        <Link href="/recipes/import" className="link">
          Bring it in
        </Link>
      </p>
      <RecipeForm family={family} />
    </main>
  );
}
