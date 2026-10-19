"use client";

import { useActionState } from "react";
import { saveRecipe, type FormState } from "@/app/actions";
import { Field, PersonPicker, Submit } from "@/components/form-bits";
import { ErrorNote } from "@/components/ui";
import type { FamilyMember, Recipe } from "@/lib/types";

export function RecipeForm({ recipe, family }: { recipe?: Recipe; family: FamilyMember[] }) {
  const [state, action] = useActionState<FormState, FormData>(saveRecipe, undefined);

  return (
    <form action={action} className="space-y-6">
      {recipe && <input type="hidden" name="id" value={recipe.id} />}

      <Field label="Recipe name">
        <input name="title" required maxLength={120} defaultValue={recipe?.title} placeholder="Abuela's picadillo" className="field font-display text-[1.35rem] font-semibold" />
      </Field>

      <Field label="In a sentence" hint="Optional">
        <input name="description" maxLength={500} defaultValue={recipe?.description ?? ""} placeholder="What it is and how it's served" className="field" />
      </Field>

      <div className="grid grid-cols-[1fr_6.5rem] items-start gap-4">
        <PersonPicker name="contributor" label="Whose recipe is it?" family={family} defaultValue={recipe?.contributor_id} allowNone noneLabel="Unknown" />
        <Field label="Serves">
          <input name="servings" type="number" inputMode="numeric" min={1} max={200} defaultValue={recipe?.servings ?? ""} placeholder="6" className="field" />
        </Field>
      </div>

      <Field label="Ingredients" hint="One per line">
        <textarea
          name="ingredients"
          required
          rows={7}
          defaultValue={recipe?.ingredients.join("\n")}
          placeholder={"2 lb ground beef\n1 onion, diced\n1/3 cup raisins"}
          className="field leading-7"
        />
      </Field>

      <Field label="Method" hint="One step per line">
        <textarea
          name="instructions"
          required
          rows={7}
          defaultValue={recipe?.instructions.join("\n")}
          placeholder={"Brown the beef with the onion.\nAdd the tomato sauce and simmer 20 minutes."}
          className="field leading-7"
        />
      </Field>

      <Field label="The story behind it" hint="Optional">
        <textarea
          name="story"
          rows={4}
          maxLength={4000}
          defaultValue={recipe?.story ?? ""}
          placeholder="Who made it first, when it comes out, what everyone remembers"
          className="field leading-7 italic"
        />
      </Field>

      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <Submit pending="Saving…">{recipe ? "Save changes" : "Add to the cookbook"}</Submit>
    </form>
  );
}
