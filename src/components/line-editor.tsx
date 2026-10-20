"use client";

import { useActionState, useState, type ReactNode } from "react";
import { addLineNote, deleteAnnotation, type FormState } from "@/app/actions";
import { ActionForm, Field, PersonPicker, Submit } from "@/components/form-bits";
import { CloseIcon } from "@/components/icons";
import type { FamilyMember } from "@/lib/types";

/**
 * Tap a recipe line to write on it: rewrite it (the changed words get crossed
 * out in your ink) and/or add a note beside it. The line's own notes can be
 * removed from here too.
 */
export function LineEditor({
  recipeId,
  kind,
  line,
  family,
  notes,
  children,
}: {
  recipeId: string;
  kind: "ingredient" | "step";
  line: string;
  family: FamilyMember[];
  notes: { id: string; author: string }[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await addLineNote(prev, fd);
    if (result?.ok) setOpen(false);
    return result;
  }, undefined);

  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="block w-full cursor-text text-left"
      >
        {children}
        <span className="sr-only"> (write on this line)</span>
      </button>
      {open && (
        <div className="mt-3 mb-2 space-y-3 border-l-2 border-rule pl-3">
          <ActionForm action={action} pending={pending} className="space-y-3">
            <input type="hidden" name="recipe_id" value={recipeId} />
            <input type="hidden" name="line_kind" value={kind} />
            <input type="hidden" name="line_text" value={line} />
            <PersonPicker name="author" label="Who's writing?" family={family} />
            <Field label="Rewrite it your way" hint="the changed words get crossed out">
              <textarea name="rewrite" defaultValue={line} rows={kind === "step" ? 4 : 2} className="field leading-snug" />
            </Field>
            <Field label="A note beside it" hint="optional">
              <input name="body" maxLength={600} placeholder="Too sweet otherwise" className="field hand text-[1.35rem]" autoComplete="off" />
            </Field>
            {state?.error && <p className="text-[0.9rem] text-burgundy">{state.error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet flex-1">
                Cancel
              </button>
              <div className="flex-[2]">
                <Submit pending="Writing…">Write it in</Submit>
              </div>
            </div>
          </ActionForm>
          {notes.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.85rem] text-ink-soft">
              <span>Remove a note:</span>
              {notes.map((n) => (
                <form key={n.id} action={deleteAnnotation}>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="recipe_id" value={recipeId} />
                  <button className="flex items-center gap-1 py-1 hover:text-burgundy" aria-label={`Remove ${n.author}'s note on this line`}>
                    <CloseIcon className="h-3.5 w-3.5" />
                    {n.author}
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
