"use client";

import { useActionState, useEffect, useRef } from "react";
import { addAnnotation, type FormState } from "@/app/actions";
import { PersonPicker, Submit } from "@/components/form-bits";
import type { FamilyMember } from "@/lib/types";

export function AnnotationForm({ recipeId, family }: { recipeId: string; family: FamilyMember[] }) {
  const [state, action] = useActionState<FormState, FormData>(addAnnotation, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <details className="group mt-4">
      <summary className="btn btn-quiet w-full cursor-pointer list-none">Write in the margin</summary>
      <form ref={formRef} action={action} className="mt-4 space-y-4">
        <input type="hidden" name="recipe_id" value={recipeId} />
        <PersonPicker name="author" label="Who's writing?" family={family} />
        <textarea
          name="body"
          rows={3}
          maxLength={600}
          required
          placeholder="Less sugar, a squeeze of lime, the year it burned…"
          className="field hand text-[1.4rem] leading-snug"
        />
        {state?.error && <p className="text-[0.9rem] text-burgundy">{state.error}</p>}
        {state?.ok && <p role="status" className="text-[0.9rem] text-olive italic">{state.ok}</p>}
        <Submit pending="Writing…">Add note</Submit>
      </form>
    </details>
  );
}
