"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signIn, signUp, type FormState } from "@/app/actions";
import { Field, Submit } from "@/components/form-bits";
import { ErrorNote } from "@/components/ui";

export function AuthForm() {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [inState, inAction] = useActionState<FormState, FormData>(signIn, undefined);
  const [upState, upAction] = useActionState<FormState, FormData>(signUp, undefined);
  const state = mode === "in" ? inState : upState;

  return (
    <>
      <div role="tablist" className="mb-6 grid grid-cols-2 border-b border-rule">
        {(["up", "in"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`-mb-px border-b-2 py-2.5 font-display text-[1.2rem] font-semibold ${
              mode === m ? "border-burgundy text-ink" : "border-transparent text-ink-faint"
            }`}
          >
            {m === "up" ? "Start a cookbook" : "Sign in"}
          </button>
        ))}
      </div>

      <form key={mode} action={mode === "in" ? inAction : upAction} className="space-y-5">
        {mode === "up" && (
          <Field label="Your name" hint="As the family says it">
            <input name="name" required maxLength={60} autoComplete="given-name" placeholder="Mari" className="field" />
          </Field>
        )}
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" inputMode="email" className="field" />
        </Field>
        <Field label="Password" hint={mode === "up" ? "8 characters or more" : undefined}>
          <input
            name="password"
            type="password"
            required
            minLength={mode === "up" ? 8 : undefined}
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            className="field"
          />
        </Field>
        {state?.error && <ErrorNote>{state.error}</ErrorNote>}
        {state?.ok && <p role="status" className="text-[0.92rem] text-olive">{state.ok}</p>}
        <Submit pending={mode === "in" ? "Signing in…" : "Opening your cookbook…"}>
          {mode === "in" ? "Sign in" : "Create my cookbook"}
        </Submit>
      </form>

      <p className="mt-6 text-center text-[0.9rem] text-ink-soft">
        Just looking?{" "}
        <Link href="/" className="link">
          Read the sample cookbook
        </Link>
      </p>
    </>
  );
}
