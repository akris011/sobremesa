"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { INKS, type FamilyMember, type Ink } from "@/lib/types";

export function Submit({ children, pending, className = "btn btn-primary w-full" }: { children: ReactNode; pending: string; className?: string }) {
  const status = useFormStatus();
  return (
    <button type="submit" className={className} disabled={status.pending}>
      {status.pending ? pending : children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[0.92rem] font-medium text-ink">{label}</span>
        {hint && <span className="text-[0.8rem] text-ink-faint italic">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function InkPicker({ name, value, onChange }: { name: string; value: Ink; onChange?: (ink: Ink) => void }) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Ink color</legend>
      {INKS.map((ink) => (
        <label key={ink} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={ink}
            checked={value === ink}
            onChange={() => onChange?.(ink)}
            className="peer sr-only"
          />
          <span
            className={`hand block rounded-sm border border-rule bg-card px-2.5 py-0.5 text-[1.25rem] ink-${ink} peer-checked:border-current peer-checked:ring-1 peer-checked:ring-current peer-focus-visible:outline-2`}
          >
            {ink}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Choose an existing family member or type a new one, with their ink. */
export function PersonPicker({
  name,
  label,
  family,
  defaultValue,
  allowNone,
  noneLabel = "Not decided yet",
}: {
  name: string;
  label: string;
  family: FamilyMember[];
  defaultValue?: string | null;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const [choice, setChoice] = useState<string>(defaultValue ?? (allowNone ? "" : family[0]?.id ?? "__new"));
  const [ink, setInk] = useState<Ink>("olive");
  const chosen = family.find((m) => m.id === choice);

  return (
    <div className="space-y-2.5">
      <Field label={label}>
        <select name={name} value={choice} onChange={(e) => setChoice(e.target.value)} className={`field ${chosen ? `ink-${chosen.ink}` : ""}`}>
          {allowNone && <option value="">{noneLabel}</option>}
          {family.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.relation && m.relation !== m.name ? ` (${m.relation})` : ""}
            </option>
          ))}
          <option value="__new">Someone new…</option>
        </select>
      </Field>
      {choice === "__new" && (
        <div className="space-y-2.5 border-l-2 border-rule pl-3">
          <input name={`${name}_name`} placeholder="Their name, e.g. Tía Lucia" className="field" autoComplete="off" required />
          <div>
            <p className="mb-1.5 text-[0.85rem] text-ink-soft">Their ink</p>
            <InkPicker name={`${name}_ink`} value={ink} onChange={setInk} />
          </div>
        </div>
      )}
    </div>
  );
}
