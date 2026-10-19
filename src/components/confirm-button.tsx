"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

/** A destructive submit that needs a second tap. */
export function ConfirmButton({ label, confirmLabel }: { label: string; confirmLabel: string }) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className="w-full py-2 text-[0.92rem] text-ink-soft underline underline-offset-4">
        {label}
      </button>
    );
  }
  return (
    <div className="flex gap-3">
      <button type="button" onClick={() => setArmed(false)} className="btn btn-quiet flex-1">
        Keep it
      </button>
      <button type="submit" disabled={pending} className="btn flex-1 bg-burgundy text-[#fbf3e6]">
        {pending ? "Removing…" : confirmLabel}
      </button>
    </div>
  );
}
