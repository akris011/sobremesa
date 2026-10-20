"use client";

import { useActionState, useState } from "react";
import { acceptInvite, type FormState } from "@/app/actions";
import { ActionForm, PenFields, Submit } from "@/components/form-bits";
import { ErrorNote } from "@/components/ui";
import { freshInk, pen } from "@/lib/pen";
import type { FamilyMember, Ink } from "@/lib/types";

/**
 * "Which one are you?": claim one of the people already in the book, or add
 * yourself. Either way you choose your own name, ink and hand; from then on
 * only you can change that pen or sign with it.
 */
export function JoinForm({ token, people, inks }: { token: string; people: FamilyMember[]; inks: Ink[] }) {
  const [choice, setChoice] = useState<string>("");
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInvite, undefined);
  const person = people.find((p) => p.id === choice);

  return (
    <ActionForm action={action} pending={pending} className="space-y-6">
      <input type="hidden" name="token" value={token} />
      <fieldset>
        <legend className="mb-3 font-display text-[1.6rem] leading-tight font-semibold">Which one are you?</legend>
        <div className="divide-y divide-rule-soft border-y border-rule-soft">
          {people.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-3 py-3">
              <input type="radio" name="member" value={p.id} checked={choice === p.id} onChange={() => setChoice(p.id)} className="h-5 w-5 accent-burgundy" />
              <span {...pen(p, "text-[1.7rem] leading-none")}>{p.name}</span>
              {p.relation && <span className="eyebrow ml-auto">{p.relation}</span>}
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-3 py-3">
            <input type="radio" name="member" value="__new" checked={choice === "__new"} onChange={() => setChoice("__new")} className="h-5 w-5 accent-burgundy" />
            <span className="text-[1.05rem]">I&rsquo;m not listed</span>
          </label>
        </div>
      </fieldset>

      {choice && (
        <div className="index-card space-y-4 px-5 py-5">
          <p className="text-[0.95rem] text-ink-soft">
            {person
              ? "This is how your notes will look. Make it yours; once you join, only you can change it."
              : "Choose how your notes will look: an ink nobody else uses, and a hand that looks like yours."}
          </p>
          <PenFields
            key={choice}
            nameField="name"
            prefix=""
            defaultName={person?.name ?? ""}
            relation={person?.relation ?? null}
            defaultInk={person?.ink ?? freshInk(inks.map((ink) => ({ ink })))}
            defaultHand={person?.hand}
          />
        </div>
      )}

      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <Submit pending="Joining…">Join the cookbook</Submit>
    </ActionForm>
  );
}
