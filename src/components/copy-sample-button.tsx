"use client";

import { useActionState } from "react";
import { copySampleCookbook, type FormState } from "@/app/actions";
import { Submit } from "@/components/form-bits";

export function CopySampleButton() {
  const [state, action] = useActionState<FormState, FormData>(copySampleCookbook, undefined);
  return (
    <form action={action} className="w-full max-w-64">
      <Submit pending="Copying the Morenos' recipes…" className="btn btn-quiet w-full">
        Or start from the sample recipes
      </Submit>
      {state?.error && <p className="mt-2 text-[0.85rem] text-burgundy">{state.error}</p>}
    </form>
  );
}
