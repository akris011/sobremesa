"use client";

import { createContext, startTransition, useContext, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { freshInk, HAND_LABELS, INK_LABELS, inkColor, pen, readableInk } from "@/lib/pen";
import { canSignAs, HANDS, INKS, type FamilyMember, type Hand, type Ink, type NamedInk } from "@/lib/types";

const PendingContext = createContext(false);

/**
 * A form for useActionState actions. React resets uncontrolled fields after
 * every `<form action>` submit, even when the action returns an error, which
 * would wipe a half-written recipe. Submitting via onSubmit avoids that; forms
 * that should clear on success reset themselves.
 */
export function ActionForm({
  action,
  pending,
  children,
  ...props
}: Omit<ComponentProps<"form">, "action" | "onSubmit"> & { action: (fd: FormData) => void; pending: boolean }) {
  return (
    <form
      {...props}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <PendingContext value={pending}>{children}</PendingContext>
    </form>
  );
}

export function Submit({ children, pending, className = "btn btn-primary w-full" }: { children: ReactNode; pending: string; className?: string }) {
  const actionPending = useContext(PendingContext);
  const status = useFormStatus();
  const busy = actionPending || status.pending;
  return (
    <button type="submit" className={className} disabled={busy}>
      {busy ? pending : children}
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

/**
 * Name, ink and handwriting for a family member, with their signature written
 * out as you choose. Posts `<nameField>`, `<prefix>ink` (a named ink or
 * "custom"), `<prefix>ink_custom` and `<prefix>hand`; see penFrom() in actions.
 */
export function PenFields({
  nameField,
  prefix,
  defaultName = "",
  defaultInk,
  defaultHand = "caveat",
  relation,
  autoFocus,
}: {
  nameField: string;
  prefix: string;
  defaultName?: string;
  defaultInk: Ink;
  defaultHand?: Hand;
  /** Show a relation field with this default value. */
  relation?: string | null;
  autoFocus?: boolean;
}) {
  const named = (INKS as readonly string[]).includes(defaultInk);
  const [name, setName] = useState(defaultName);
  const [ink, setInk] = useState<string>(named ? defaultInk : "custom");
  const [custom, setCustom] = useState<string>(named ? "#b5651d" : defaultInk);
  const [picked, setPicked] = useState(custom);
  const [hand, setHand] = useState<Hand>(defaultHand);
  const chosenInk = (ink === "custom" ? custom : ink) as Ink;
  const signature = name.trim() || "Their name";

  return (
    <div className="space-y-4">
      <div className={relation !== undefined ? "grid grid-cols-[1fr_8rem] gap-3" : ""}>
        <input
          name={nameField}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={60}
          placeholder={relation !== undefined ? "Their name" : "Their name, e.g. Tía Lucia"}
          aria-label="Name"
          autoComplete="off"
          autoFocus={autoFocus}
          className="field"
        />
        {relation !== undefined && (
          <input name="relation" defaultValue={relation ?? ""} maxLength={60} placeholder="Aunt, cousin…" aria-label="Relation" className="field" />
        )}
      </div>

      <p className="index-card index-card-lined flex h-[5.4rem] items-end overflow-hidden px-4 pb-1.5" aria-hidden>
        <span {...pen({ ink: chosenInk, hand }, `truncate text-[2rem] leading-[2.6rem] ${name.trim() ? "" : "opacity-50"}`)}>
          {signature}
        </span>
      </p>

      <fieldset>
        <legend className="mb-2 text-[0.85rem] text-ink-soft">
          Ink · <span className="text-ink">{ink === "custom" ? "Their own color" : INK_LABELS[ink as NamedInk]}</span>
        </legend>
        <div className="flex flex-wrap gap-1">
          {INKS.map((i) => (
            <label key={i} className="cursor-pointer" title={INK_LABELS[i]}>
              <input
                type="radio"
                name={`${prefix}ink`}
                value={i}
                checked={ink === i}
                onChange={() => setInk(i)}
                aria-label={INK_LABELS[i]}
                className="peer sr-only"
              />
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-transparent peer-checked:border-ink peer-focus-visible:outline-2">
                <span className="block h-6 w-6 rounded-full" style={{ background: inkColor(i) }} />
              </span>
            </label>
          ))}
          <label className="cursor-pointer" title="Add a color">
            <input
              type="radio"
              name={`${prefix}ink`}
              value="custom"
              checked={ink === "custom"}
              onChange={() => setInk("custom")}
              aria-label="Their own color"
              className="peer sr-only"
            />
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-transparent peer-checked:border-ink peer-focus-visible:outline-2">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-ink-faint text-[1rem] leading-none text-ink-soft"
                style={ink === "custom" ? { background: custom, borderStyle: "solid", borderColor: custom } : undefined}
              >
                {ink !== "custom" && "+"}
              </span>
              {/* The native picker opens on tap; choosing a color selects "their own". */}
              <input
                type="color"
                value={picked}
                onChange={(e) => {
                  setPicked(e.target.value);
                  setCustom(readableInk(e.target.value) ?? custom);
                  setInk("custom");
                }}
                aria-label="Choose their own color"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </span>
          </label>
        </div>
        <input type="hidden" name={`${prefix}ink_custom`} value={custom} />
        {ink === "custom" && picked.toLowerCase() !== custom && (
          <p className="mt-1.5 text-[0.82rem] text-ink-faint italic">Darkened a little so it reads on the page.</p>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[0.85rem] text-ink-soft">Handwriting</legend>
        <div className="grid grid-cols-2 gap-2">
          {HANDS.map((h) => (
            <label key={h} className="cursor-pointer">
              <input
                type="radio"
                name={`${prefix}hand`}
                value={h}
                checked={hand === h}
                onChange={() => setHand(h)}
                className="peer sr-only"
              />
              <span className="block rounded-[3px] border border-rule bg-card px-3 pt-1 pb-1.5 peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline-2">
                <span {...pen({ ink: chosenInk, hand: h }, "block truncate text-[1.45rem] leading-[2rem]")}>{signature}</span>
                <span className="block text-[0.78rem] text-ink-faint">{HAND_LABELS[h]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/**
 * People a form may name as its writer: unclaimed people and yourself (someone
 * who has joined signs only for themselves), plus whoever is already chosen.
 */
export function signable(family: FamilyMember[], current?: string | null) {
  return family.filter((m) => canSignAs(m) || m.id === current);
}

/** Choose an existing family member or type a new one, with their ink. Defaults to you. */
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
  const people = signable(family, defaultValue);
  const me = people.find((m) => m.mine);
  const [choice, setChoice] = useState<string>(defaultValue ?? (allowNone ? "" : (me ?? people[0])?.id ?? "__new"));
  const chosen = people.find((m) => m.id === choice);

  return (
    <div className="space-y-2.5">
      <Field label={label}>
        <select
          name={name}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="field"
          style={chosen ? { color: inkColor(chosen.ink) } : undefined}
        >
          {allowNone && <option value="">{noneLabel}</option>}
          {people.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.relation && m.relation !== m.name ? ` (${m.relation})` : ""}
            </option>
          ))}
          <option value="__new">Someone new…</option>
        </select>
      </Field>
      {choice === "__new" && (
        <div className="border-l-2 border-rule pl-3">
          <PenFields nameField={`${name}_name`} prefix={`${name}_`} defaultInk={freshInk(family)} autoFocus />
        </div>
      )}
    </div>
  );
}
