"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addFamilyMember, type FormState } from "@/app/actions";
import { InkPicker, Submit } from "@/components/form-bits";
import type { Ink } from "@/lib/types";

export function AddMemberForm() {
  const [state, action] = useActionState<FormState, FormData>(addFamilyMember, undefined);
  const [ink, setInk] = useState<Ink>("terracotta");
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="index-card mt-5 space-y-3 px-5 py-5">
      <p className="font-display text-[1.3rem] font-semibold">Add someone</p>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <input name="name" required maxLength={60} placeholder="Name" aria-label="Name" className="field" />
        <input name="relation" maxLength={60} placeholder="Aunt, cousin…" aria-label="Relation" className="field" />
      </div>
      <InkPicker name="ink" value={ink} onChange={setInk} />
      {state?.error && <p className="text-[0.9rem] text-burgundy">{state.error}</p>}
      {state?.ok && <p role="status" className="text-[0.9rem] text-olive italic">{state.ok}</p>}
      <Submit pending="Adding…" className="btn btn-quiet w-full">Add to the family</Submit>
    </form>
  );
}
