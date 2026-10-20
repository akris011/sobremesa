import type { CSSProperties } from "react";
import { isCorrection } from "@/lib/libreta";
import { inkColor, pen } from "@/lib/pen";
import type { Annotation } from "@/lib/types";
import { formatDate } from "@/components/ui";

// How notes look once written on the recipe. Everything a family member wrote
// carries .pen-edit, so "Show it as first written" can hide it with CSS alone.

const strikeStyle = (a: Annotation) => ({ "--pen": inkColor(a.author?.ink) }) as CSSProperties;

function range(a: Annotation, length: number) {
  const start = Math.min(Math.max(a.strike_start ?? 0, 0), length);
  return [start, Math.min(Math.max(a.strike_end ?? start, start), length)] as const;
}

function Signed({ note, date }: { note: Annotation; date?: boolean }) {
  return (
    <span className="whitespace-nowrap opacity-75">
      {" "}
      — {note.author?.name ?? "Someone"}
      {date && `, ${formatDate(note.created_at, { month: "short", year: "numeric" })}`}
    </span>
  );
}

/**
 * One ingredient or method line as the family has written on it. The newest
 * correction is drawn into the line itself; earlier ones and plain notes sit
 * underneath, each in its writer's hand.
 */
export function WrittenLine({ text, notes }: { text: string; notes: Annotation[] }) {
  const latest = notes.filter(isCorrection).at(-1);
  const rest = notes.filter((n) => n !== latest);
  const [start, end] = latest ? range(latest, text.length) : [0, 0];

  return (
    <>
      {latest ? (
        <>
          {text.slice(0, start)}
          {end > start && (
            <del className="struck" style={strikeStyle(latest)}>
              {text.slice(start, end)}
            </del>
          )}
          {latest.replacement && (
            <ins {...pen(latest.author, "pen-edit text-[1.3em] leading-none")}>
              {end > start ? " " : "‸"}
              {latest.replacement}
            </ins>
          )}
          {text.slice(end)}
          <span {...pen(latest.author, "pen-edit text-[1.15em] leading-none")}>
            {latest.body && <> {latest.body}</>}
            <Signed note={latest} />
          </span>
        </>
      ) : (
        text
      )}
      {rest.map((n) => (
        <span key={n.id} {...pen(n.author, "pen-edit mt-0.5 block text-[1.2em] leading-[1.3]")}>
          {isCorrection(n) && <EarlierCorrection note={n} />}
          {n.body}
          <Signed note={n} />
        </span>
      ))}
    </>
  );
}

/** An older rewrite of the same line, shown as "~~1 cup~~ ¾ cup". */
function EarlierCorrection({ note }: { note: Annotation }) {
  const text = note.line_text ?? "";
  const [start, end] = range(note, text.length);
  return (
    <>
      {end > start && (
        <del className="struck font-serif text-[0.85em] text-ink-soft" style={strikeStyle(note)}>
          {text.slice(start, end)}
        </del>
      )}
      {end > start ? " " : "‸"}
      {note.replacement}
      {note.body && " · "}
    </>
  );
}

/** A note in the margin. If it was written on a line that has since changed, say which. */
export function MarginNote({ note }: { note: Annotation }) {
  return (
    <>
      {note.line_text && (
        <p className="font-serif text-[0.85rem] leading-[1.75rem] text-ink-faint italic">
          On &ldquo;{note.line_text}&rdquo;, as it read then:
        </p>
      )}
      <p {...pen(note.author, "text-[1.45rem] leading-[1.75rem]")}>
        {isCorrection(note) && <EarlierCorrection note={note} />}
        {note.body}
      </p>
      <p {...pen(note.author, "text-[1.1rem] leading-[1.75rem] opacity-80")}>
        — {note.author?.name ?? "Someone"}, {formatDate(note.created_at, { month: "short", year: "numeric" })}
      </p>
    </>
  );
}
