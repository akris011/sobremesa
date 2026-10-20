"use client";

import { useActionState, useState } from "react";
import { addFamilyMember, updateFamilyMember, type FormState } from "@/app/actions";
import { ActionForm, PenFields, Submit } from "@/components/form-bits";
import { freshInk, pen } from "@/lib/pen";
import type { FamilyMember } from "@/lib/types";

export function AddMemberForm({ family }: { family: FamilyMember[] }) {
  // The pen fields are controlled; a new key clears them after each add.
  const [round, setRound] = useState(0);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await addFamilyMember(prev, fd);
    if (result?.ok) setRound((r) => r + 1);
    return result;
  }, undefined);

  return (
    <details className="mt-5" open={family.length <= 1 || undefined}>
      <summary className="btn btn-quiet w-full cursor-pointer list-none">Add someone to the family</summary>
      <ActionForm action={action} pending={pending} className="index-card mt-4 space-y-4 px-5 py-5">
        <p className="text-[0.95rem] text-ink-soft">
          Choose how their notes will look: an ink nobody else uses, and a hand that looks like theirs.
        </p>
        <PenFields key={round} nameField="name" prefix="" relation={null} defaultInk={freshInk(family)} />
        {state?.error && <p className="text-[0.9rem] text-burgundy">{state.error}</p>}
        {state?.ok && <p role="status" className="text-[0.9rem] text-olive italic">{state.ok}</p>}
        <Submit pending="Adding…">Add to the family</Submit>
      </ActionForm>
    </details>
  );
}

/**
 * One person in the family list, with their pen open for changes. Someone who
 * has joined owns their pen: only they see "Change" (and RLS agrees).
 */
export function MemberRow({ member, signedIn }: { member: FamilyMember; signedIn: boolean }) {
  const editable = signedIn && (!member.claimed || !!member.mine);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await updateFamilyMember(prev, fd);
    if (result?.ok) setOpen(false);
    return result;
  }, undefined);

  const row = (
    <span className="flex items-baseline justify-between gap-3">
      <span {...pen(member, "text-[1.7rem] leading-none")}>{member.name}</span>
      <span className="flex items-baseline gap-3">
        {member.relation && <span className="eyebrow">{member.relation}</span>}
        {signedIn && member.claimed && !member.mine && <span className="text-[0.82rem] text-ink-faint italic">joined</span>}
        {editable && <span className="text-[0.88rem] text-burgundy">{open ? "Close" : member.mine ? "Change your pen" : "Change"}</span>}
      </span>
    </span>
  );

  if (!editable) return <li className="py-3">{row}</li>;
  return (
    <li className="py-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="block w-full text-left">
        {row}
      </button>
      {state?.ok && !open && <p role="status" className="mt-1 text-[0.85rem] text-olive italic">{state.ok}</p>}
      {open && (
        <ActionForm action={action} pending={pending} className="mt-3 space-y-4">
          <input type="hidden" name="id" value={member.id} />
          <PenFields
            nameField="name"
            prefix=""
            defaultName={member.name}
            relation={member.relation}
            defaultInk={member.ink}
            defaultHand={member.hand}
          />
          {state?.error && <p className="text-[0.9rem] text-burgundy">{state.error}</p>}
          <Submit pending="Saving…">Save {member.name.split(" ")[0]}&rsquo;s pen</Submit>
        </ActionForm>
      )}
    </li>
  );
}
