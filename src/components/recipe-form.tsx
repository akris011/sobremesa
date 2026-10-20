"use client";

import { useActionState, useState } from "react";
import { saveRecipe, type FormState } from "@/app/actions";
import { ActionForm, Field, PersonPicker, Submit } from "@/components/form-bits";
import { ErrorNote } from "@/components/ui";
import { DishPhoto } from "@/components/snapshot";
import type { RecipeDraft } from "@/lib/import/draft";
import type { FamilyMember, Recipe } from "@/lib/types";

/** Edits `recipe` when given; otherwise creates a new one, prefilled from an imported `draft` if there is one. */
export function RecipeForm({ recipe, draft, family }: { recipe?: Recipe; draft?: RecipeDraft; family: FamilyMember[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRecipe, undefined);
  const initial = recipe ?? draft;

  return (
    <ActionForm action={action} pending={pending} className="space-y-6">
      {recipe && <input type="hidden" name="id" value={recipe.id} />}

      <Field label="Recipe name">
        <input name="title" required maxLength={120} defaultValue={initial?.title} placeholder="Abuela's picadillo" className="field font-display text-[1.35rem] font-semibold" />
      </Field>

      <PhotoField current={recipe?.photo_url ?? null} />

      <Field label="In a sentence" hint="Optional">
        <input name="description" maxLength={500} defaultValue={initial?.description ?? ""} placeholder="What it is and how it's served" className="field" />
      </Field>

      <div className="grid grid-cols-[1fr_6.5rem] items-start gap-4">
        <PersonPicker name="contributor" label="Whose recipe is it?" family={family} defaultValue={recipe?.contributor_id} allowNone noneLabel="Unknown" />
        <Field label="Serves">
          <input name="servings" type="number" inputMode="numeric" min={1} max={200} defaultValue={initial?.servings ?? ""} placeholder="6" className="field" />
        </Field>
      </div>

      <Field label="Ingredients" hint="One per line">
        <textarea
          name="ingredients"
          required
          rows={7}
          defaultValue={initial?.ingredients.join("\n")}
          placeholder={"2 lb ground beef\n1 onion, diced\n1/3 cup raisins"}
          className="field leading-7"
        />
      </Field>

      <Field label="Method" hint="One step per line">
        <textarea
          name="instructions"
          required
          rows={7}
          defaultValue={initial?.instructions.join("\n")}
          placeholder={"Brown the beef with the onion.\nAdd the tomato sauce and simmer 20 minutes."}
          className="field leading-7"
        />
      </Field>

      <Field label="The story behind it" hint="Optional">
        <textarea
          name="story"
          rows={4}
          maxLength={4000}
          defaultValue={initial?.story ?? ""}
          placeholder="Who made it first, when it comes out, what everyone remembers"
          className="field leading-7 italic"
        />
      </Field>

      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <Submit pending="Saving…">{recipe ? "Save changes" : "Add to the cookbook"}</Submit>
    </ActionForm>
  );
}

const PHOTO_LONG_EDGE = 1600; // px; sharp on a phone, a few hundred KB as JPEG

/** Shrinks a chosen photo to a JPEG on the phone, so the upload is small and any format the browser can show works. */
async function shrink(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, PHOTO_LONG_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.82));
    if (!blob) throw new Error("toBlob failed");
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PhotoField({ current }: { current: string | null }) {
  const [preview, setPreview] = useState<string | null>(current);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  async function choose(input: HTMLInputElement) {
    const file = input.files?.[0];
    setProblem(null);
    if (!file) return;
    setBusy(true);
    try {
      const small = await shrink(file);
      const list = new DataTransfer();
      list.items.add(small);
      input.files = list.files;
      setPreview(URL.createObjectURL(small));
      setRemoved(false);
    } catch {
      input.value = "";
      setProblem("That photo couldn't be read. Try another one.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="block">
        <span className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[0.92rem] font-medium text-ink">A photo of the dish</span>
          <span className="text-[0.8rem] text-ink-faint italic">Optional</span>
        </span>
        {preview && !removed && <DishPhoto src={preview} className="relative mx-auto mt-3 mb-4 block aspect-[4/3] w-[80%] rotate-[0.8deg]" />}
        <input
          name="photo"
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => choose(e.currentTarget)}
          className="block w-full text-[1rem] text-ink-soft file:mr-3 file:border-0 file:bg-paper-deep file:px-4 file:py-2 file:text-ink"
        />
      </label>
      {busy && <p className="mt-2 text-[0.9rem] text-ink-faint italic">Getting the photo ready…</p>}
      {problem && <ErrorNote>{problem}</ErrorNote>}
      {current && (
        <label className="mt-3 flex items-center gap-2 text-[0.95rem] text-ink-soft">
          <input type="checkbox" name="remove_photo" checked={removed} onChange={(e) => setRemoved(e.currentTarget.checked)} />
          Take the photo off
        </label>
      )}
    </div>
  );
}
