"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import { importFromLink, type ImportState } from "@/app/import-actions";
import { ActionForm, Field, Submit } from "@/components/form-bits";
import { RecipeForm } from "@/components/recipe-form";
import { ErrorNote } from "@/components/ui";
import type { RecipeDraft } from "@/lib/import/draft";
import { readRecipeFile } from "@/lib/import/read-file";
import { parseRecipeText } from "@/lib/import/text";
import type { FamilyMember } from "@/lib/types";

type Source = "file" | "link" | "text";
const SOURCES: { id: Source; label: string }[] = [
  { id: "file", label: "Photo or PDF" },
  { id: "link", label: "Link" },
  { id: "text", label: "Paste text" },
];

/** False during server render and hydration, so nothing is chosen before the handlers exist. */
const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

/** Keep imported text inside the recipe form's limits. */
const fit = (d: RecipeDraft): RecipeDraft => ({
  ...d,
  title: d.title.slice(0, 120),
  description: d.description.slice(0, 500),
  story: d.story.slice(0, 4000),
});

export function RecipeImport({ family }: { family: FamilyMember[] }) {
  const [source, setSource] = useState<Source>("file");
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [round, setRound] = useState(0); // remounts the form for each new draft
  const hydrated = useHydrated();

  const show = (d: RecipeDraft) => {
    setDraft(fit(d));
    setRound((r) => r + 1);
    window.scrollTo({ top: 0 });
  };

  if (draft) {
    const empty = !draft.title && draft.ingredients.length === 0 && draft.instructions.length === 0;
    return (
      <div className="space-y-6">
        <div className="space-y-2 border-l-2 border-olive pl-3 text-[0.95rem] text-ink-soft">
          <p>
            {empty
              ? "We couldn't find a recipe in that. Fill it in below, or try another way."
              : "Here's what we read. Check it against the original, fix anything that's off, then add it."}
          </p>
          {draft.unread && draft.unread.length > 0 && (
            <p>
              We couldn&rsquo;t read these words clearly: <span className="text-ink">{draft.unread.join(", ")}</span>
            </p>
          )}
          <button type="button" onClick={() => setDraft(null)} className="link">
            Try another way
          </button>
        </div>
        <RecipeForm key={round} draft={draft} family={family} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Where the recipe is" className="grid grid-cols-3 border-b border-rule">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={source === s.id}
            disabled={!hydrated}
            onClick={() => setSource(s.id)}
            className={`-mb-px min-h-11 border-b-2 px-1 text-[0.95rem] ${source === s.id ? "border-burgundy text-ink" : "border-transparent text-ink-soft"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {source === "file" && <FileImport onDraft={show} ready={hydrated} />}
      {source === "link" && <LinkImport onDraft={show} />}
      {source === "text" && <TextImport onDraft={show} />}
    </div>
  );
}

function FileImport({ onDraft, ready }: { onDraft: (d: RecipeDraft) => void; ready: boolean }) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File | undefined) {
    if (!file) return;
    setError(null);
    setStatus("Opening…");
    try {
      const { draft, sourceUrl } = await readRecipeFile(file, setStatus);
      // A web page saved as PDF records its address. If that page publishes its
      // recipe as structured data, that beats anything read off the printout.
      if (sourceUrl) {
        setStatus("Checking the original page…");
        const fd = new FormData();
        fd.set("url", sourceUrl);
        const fromSite = await importFromLink(undefined, fd).catch(() => undefined);
        if (fromSite?.draft) return onDraft(fromSite.draft);
      }
      const from = sourceUrl ? `From ${new URL(sourceUrl).hostname.replace(/^www\./, "")}: ${sourceUrl}` : "";
      onDraft({ ...draft, story: [draft.story, from].filter(Boolean).join("\n\n") });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We couldn't read that file.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[0.95rem] text-ink-soft">
        Take a photo of the card or the cookbook page, or choose a PDF. It&rsquo;s read on this phone and not uploaded. Printed
        recipes come out best; handwriting will need more fixing.
      </p>
      <label className={`btn btn-primary w-full ${status || !ready ? "pointer-events-none opacity-55" : "cursor-pointer"}`}>
        {status ?? "Take a photo or choose a file"}
        <input
          type="file"
          name="file"
          accept="image/*,application/pdf"
          className="sr-only"
          disabled={!!status || !ready}
          onChange={(e) => {
            void read(e.target.files?.[0]);
            e.target.value = ""; // so choosing the same file again still fires
          }}
        />
      </label>
      {status && <p role="status" className="sr-only">{status}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <p className="text-[0.85rem] text-ink-faint italic">
        For a clear read: flat page, good light, no shadow across the text, one recipe in the frame.
      </p>
    </div>
  );
}

function LinkImport({ onDraft }: { onDraft: (d: RecipeDraft) => void }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importFromLink, undefined);
  useEffect(() => {
    if (state?.draft) onDraft(state.draft);
  }, [state, onDraft]);

  return (
    <ActionForm action={action} pending={pending} className="space-y-4">
      <Field label="Link to the recipe">
        <input name="url" type="url" inputMode="url" autoComplete="off" required placeholder="https://" className="field" />
      </Field>
      <p className="text-[0.85rem] text-ink-faint italic">Works with most recipe sites. Paywalled pages won&rsquo;t load.</p>
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <Submit pending="Reading the page…">Read the recipe</Submit>
    </ActionForm>
  );
}

function TextImport({ onDraft }: { onDraft: (d: RecipeDraft) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onDraft(parseRecipeText(text));
      }}
    >
      <Field label="The recipe" hint="Title, ingredients, then the steps">
        <textarea
          name="text"
          required
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Arroz con leche\n\nIngredients\n1 cup rice\n4 cups milk\n\nMethod\nSimmer the rice in the milk until thick."}
          className="field leading-7"
        />
      </Field>
      <button type="submit" className="btn btn-primary w-full">
        Sort it into the form
      </button>
    </form>
  );
}
