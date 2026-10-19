"use client";

import { useActionState } from "react";
import { createGathering, type FormState } from "@/app/actions";
import { Field, Submit } from "@/components/form-bits";
import { ErrorNote } from "@/components/ui";

export function GatheringForm() {
  const [state, action] = useActionState<FormState, FormData>(createGathering, undefined);
  return (
    <form action={action} className="space-y-6">
      <Field label="What's the occasion?">
        <input name="name" required maxLength={120} placeholder="Nochebuena, Sunday dinner, Mami's birthday" className="field font-display text-[1.35rem] font-semibold" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date">
          <input name="held_on" type="date" required className="field min-h-[2.95rem]" />
        </Field>
        <Field label="Where" hint="Optional">
          <input name="location" maxLength={120} placeholder="Abuela's" className="field" />
        </Field>
      </div>
      <Field label="Notes for everyone" hint="Optional">
        <textarea name="description" rows={3} maxLength={2000} placeholder="How many are coming, what to bring, when to arrive" className="field leading-7" />
      </Field>
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <Submit pending="Saving…">Save and set the menu</Submit>
    </form>
  );
}
