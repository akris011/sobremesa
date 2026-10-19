import { notFound, redirect } from "next/navigation";
import { getRecipe, listFamily } from "@/lib/data";
import { getUserId } from "@/lib/supabase/server";
import { deleteRecipe } from "@/app/actions";
import { RecipeForm } from "@/components/recipe-form";
import { TopBar } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";

export const metadata = { title: "Edit recipe" };

export default async function EditRecipePage({ params }: PageProps<"/recipes/[id]/edit">) {
  const { id } = await params;
  if (!(await getUserId())) redirect("/login");
  const data = await getRecipe(id);
  if (!data || !data.canEdit) notFound();
  const family = await listFamily();

  return (
    <main className="rise">
      <TopBar back={{ href: `/recipes/${id}`, label: "Back" }} />
      <h1 className="mt-2 mb-7 font-display text-[2.3rem] leading-tight font-semibold">Edit the card</h1>
      <RecipeForm recipe={data.recipe} family={family} />
      <form action={deleteRecipe} className="mt-10 border-t border-rule pt-6">
        <input type="hidden" name="id" value={id} />
        <ConfirmButton label="Remove this recipe" confirmLabel="Remove it, and its notes and history" />
      </form>
    </main>
  );
}
