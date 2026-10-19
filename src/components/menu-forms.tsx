"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addMenuItem, setPreparer, type FormState } from "@/app/actions";
import { ActionForm, Field, InkPicker, PersonPicker, Submit } from "@/components/form-bits";
import { ErrorNote } from "@/components/ui";
import type { FamilyMember, Ink, MenuItem, Recipe } from "@/lib/types";

export function AddDishForm({
  gatheringId,
  recipes,
  family,
  hasAnyRecipes,
}: {
  gatheringId: string;
  recipes: Recipe[];
  family: FamilyMember[];
  hasAnyRecipes: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await addMenuItem(prev, fd);
    if (result?.ok) setOpen(false);
    return result;
  }, undefined);

  if (!hasAnyRecipes) {
    return (
      <p className="mt-5 text-[0.95rem] text-ink-soft">
        The menu is built from your cookbook.{" "}
        <Link href="/recipes/new" className="link">Add a recipe first</Link>.
      </p>
    );
  }
  if (recipes.length === 0) {
    return <p className="mt-5 text-[0.9rem] text-ink-soft italic">Every recipe in the cookbook is on this menu.</p>;
  }

  if (!open) {
    return (
      <div className="mt-5">
        {state?.ok && <p role="status" className="mb-3 text-center text-[0.9rem] text-olive italic">{state.ok}</p>}
        <button type="button" onClick={() => setOpen(true)} className="btn btn-quiet w-full">
          Add a dish from the cookbook
        </button>
      </div>
    );
  }

  return (
    <ActionForm action={action} pending={pending} className="index-card mt-5 space-y-5 px-5 py-5">
      <input type="hidden" name="gathering_id" value={gatheringId} />
      <Field label="Dish">
        <select name="recipe_id" required defaultValue="" className="field">
          <option value="" disabled>
            Choose a recipe
          </option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </Field>
      <PersonPicker name="preparer" label="Who's making it?" family={family} allowNone noneLabel="Nobody yet" />
      <Field label="Note" hint="Optional">
        <input name="note" maxLength={280} placeholder="Double batch, bring the big pot" className="field" />
      </Field>
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <div className="flex gap-3">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet flex-1">
          Cancel
        </button>
        <div className="flex-[2]">
          <Submit pending="Adding…">Add to the menu</Submit>
        </div>
      </div>
    </ActionForm>
  );
}

/** Inline "who's bringing it" control on each menu line. Key it by preparer id so it resets after a save. */
export function PreparerForm({ item, family }: { item: MenuItem; family: FamilyMember[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setPreparer, undefined);
  const initial = item.preparer?.id ?? "";
  const [choice, setChoice] = useState(initial);
  const [ink, setInk] = useState<Ink>("olive");
  const chosen = family.find((m) => m.id === choice);
  const dirty = choice !== initial;

  return (
    <ActionForm action={action} pending={pending} className="mt-1">
      <input type="hidden" name="id" value={item.id} />
      <label className="flex items-center gap-2 text-[0.92rem] text-ink-soft">
        <span className="shrink-0">Brought by</span>
        <select
          name="preparer"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          aria-label={`Who's bringing ${item.recipe?.title}`}
          className={`hand min-w-0 flex-1 appearance-none border-b border-dashed border-rule bg-transparent py-0.5 text-[1.35rem] focus:border-burgundy focus:outline-none ${chosen ? `ink-${chosen.ink}` : "text-ink-faint"}`}
        >
          <option value="">nobody yet</option>
          {family.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
          <option value="__new">someone new…</option>
        </select>
      </label>
      {choice === "__new" && (
        <div className="mt-2 space-y-2">
          <input name="preparer_name" required placeholder="Their name" className="field" />
          <InkPicker name="preparer_ink" value={ink} onChange={setInk} />
        </div>
      )}
      {dirty && (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setChoice(initial)} className="btn btn-quiet min-h-9 flex-1 text-[0.9rem]">
            Undo
          </button>
          <div className="flex-1">
            <Submit pending="Saving…" className="btn btn-primary min-h-9 w-full text-[0.9rem]">
              Save
            </Submit>
          </div>
        </div>
      )}
      {state?.error && <p className="mt-1 text-[0.85rem] text-burgundy">{state.error}</p>}
    </ActionForm>
  );
}
