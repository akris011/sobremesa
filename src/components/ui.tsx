import Link from "next/link";
import type { ReactNode } from "react";
import { BackIcon, ChevronIcon, Sprig } from "@/components/icons";
import { DishPhoto, Snapshot } from "@/components/snapshot";
import type { FamilyMember, Gathering, Recipe } from "@/lib/types";
import { pen } from "@/lib/pen";

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" }) {
  // Dates are plain calendar days; parse as UTC so they never shift a day.
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function TopBar({ back, action }: { back?: { href: string; label: string }; action?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between">
      {back ? (
        <Link href={back.href} className="-ml-2 flex items-center gap-1 py-2 pr-3 pl-1 text-[0.95rem] text-ink-soft hover:text-ink">
          <BackIcon className="h-5 w-5" />
          {back.label}
        </Link>
      ) : (
        <span />
      )}
      {action}
    </div>
  );
}

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-rule pb-2">
      <h2 className="eyebrow">{children}</h2>
      {action}
    </div>
  );
}

export function Ornament() {
  return (
    <div className="ornament my-8" aria-hidden>
      <Sprig className="h-4 w-10 text-ink-faint" />
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="index-card px-6 py-9 text-center">
      <Sprig className="mx-auto mb-4 h-5 w-12 text-ink-faint" />
      <p className="font-display text-2xl font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-[28ch] text-[0.95rem] text-ink-soft">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SampleBanner() {
  return (
    <div className="mb-6 border-y border-dashed border-rule py-2.5 text-center text-[0.85rem] text-ink-soft">
      You&rsquo;re reading a sample cookbook (the Morenos are fictional).{" "}
      <Link href="/login" className="link">
        Start your own
      </Link>
    </div>
  );
}

export function Byline({ member, prefix = "From" }: { member: FamilyMember | null; prefix?: string }) {
  if (!member) return null;
  return (
    <span className="italic text-ink-soft">
      {prefix} <span {...pen(member, "not-italic text-[1.3em]")}>{member.name}</span>
    </span>
  );
}

// A few fixed tilts so the deck looks hand-stacked but renders the same every time.
const TILTS = ["-1.1deg", "0.7deg", "-0.4deg", "1deg", "-0.8deg"];
const DECK_INGREDIENTS = 5;

/**
 * One recipe as a lined index card in the deck. The ingredients are written
 * in the contributor's hand and ink, the way they'd have copied it out; the
 * recipe page keeps everything typeset for reading while cooking.
 * Every row is 1.75rem tall so text sits on the printed lines.
 */
export function DeckCard({ recipe, index }: { recipe: Recipe; index: number }) {
  const shown = recipe.ingredients.slice(0, DECK_INGREDIENTS);
  const more = recipe.ingredients.length - shown.length;
  const clearPhoto = recipe.photo_url ? "pr-24" : recipe.contributor ? "pr-16" : "";
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      style={{ rotate: TILTS[index % TILTS.length] }}
      className="index-card index-card-lined group relative block h-[23.5rem] overflow-hidden px-5 transition-transform active:scale-[0.99]"
    >
      <div className="flex h-[2.6rem] items-center">
        {recipe.servings && <span className="text-[0.85rem] text-ink-faint italic">Serves {recipe.servings}</span>}
      </div>
      {recipe.photo_url ? (
        <DishPhoto src={recipe.photo_url} className="absolute top-3 right-4 h-[5.4rem] w-[6.2rem] rotate-3" />
      ) : (
        recipe.contributor && <Snapshot member={recipe.contributor} className="absolute top-3 right-4 h-[4.4rem] w-[3.8rem] rotate-3" />
      )}
      <h3 className={`font-display text-[1.6rem] leading-7 font-semibold text-ink group-hover:text-burgundy ${clearPhoto}`}>
        {recipe.title}
      </h3>
      <p className={`text-[0.92rem] leading-7 ${clearPhoto}`}>
        <Byline member={recipe.contributor} />
      </p>
      {recipe.description && <p className="line-clamp-2 text-[0.92rem] leading-7 text-ink-soft">{recipe.description}</p>}
      <ul {...pen(recipe.contributor, "mt-7 text-[1.3rem] leading-7")}>
        {shown.map((item, i) => (
          <li key={i} className="truncate">
            {item}
          </li>
        ))}
        {more > 0 && <li className="opacity-75">…and {more} more</li>}
      </ul>
    </Link>
  );
}

/** The whole box: every recipe by title, behind A–Z divider tabs. */
export function RecipeIndex({ recipes }: { recipes: Recipe[] }) {
  const groups = new Map<string, Recipe[]>();
  for (const r of [...recipes].sort((a, b) => a.title.localeCompare(b.title))) {
    const letter = /[a-z]/i.test(r.title.charAt(0)) ? r.title.charAt(0).toUpperCase() : "#";
    groups.set(letter, [...(groups.get(letter) ?? []), r]);
  }
  return (
    <div className="space-y-5">
      {[...groups].map(([letter, list]) => (
        <section key={letter}>
          <span className="divider-tab">{letter}</span>
          <ul className="index-card px-4">
            {list.map((r) => (
              <li key={r.id} className="border-b border-dotted border-rule last:border-0">
                <Link href={`/recipes/${r.id}`} className="group flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[1.3rem] leading-tight font-semibold group-hover:text-burgundy">{r.title}</p>
                    {r.contributor && (
                      <p className="text-[0.88rem]">
                        <Byline member={r.contributor} />
                      </p>
                    )}
                  </div>
                  <ChevronIcon className="h-5 w-5 shrink-0 text-ink-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function GatheringRow({ gathering, dishes }: { gathering: Gathering; dishes?: number }) {
  const day = formatDate(gathering.held_on, { day: "numeric" });
  const month = formatDate(gathering.held_on, { month: "short" });
  const year = formatDate(gathering.held_on, { year: "numeric" });
  return (
    <Link href={`/gatherings/${gathering.id}`} className="group flex items-center gap-4 py-3.5">
      <div className="flex w-14 shrink-0 flex-col items-center border border-rule bg-card py-1.5 leading-none">
        <span className="eyebrow text-[0.62rem] text-burgundy">{month}</span>
        <span className="mt-0.5 font-display text-[1.7rem] font-semibold">{day}</span>
        <span className="text-[0.62rem] text-ink-faint">{year}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[1.35rem] leading-tight font-semibold group-hover:text-burgundy">{gathering.name}</p>
        <p className="truncate text-[0.88rem] text-ink-soft">
          {[gathering.location, dishes !== undefined ? `${dishes} ${dishes === 1 ? "dish" : "dishes"}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <ChevronIcon className="h-5 w-5 shrink-0 text-ink-faint" />
    </Link>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="border-l-2 border-burgundy bg-burgundy/5 px-3 py-2 text-[0.92rem] text-burgundy">
      {children}
    </p>
  );
}
