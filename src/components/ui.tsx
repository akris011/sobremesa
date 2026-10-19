import Link from "next/link";
import type { ReactNode } from "react";
import { BackIcon, ChevronIcon, Sprig } from "@/components/icons";
import type { FamilyMember, Gathering, Recipe } from "@/lib/types";

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
      {prefix} <span className={`hand not-italic text-[1.3em] ink-${member.ink}`}>{member.name}</span>
    </span>
  );
}

export function RecipeCard({ recipe, index }: { recipe: Recipe; index?: number }) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="index-card index-card-lined group block px-5 pt-2.5 pb-5 transition-transform active:scale-[0.99]"
    >
      <div className="flex h-8 items-center justify-between">
        <span className="eyebrow">{index !== undefined ? `No. ${String(index + 1).padStart(2, "0")}` : "Recipe"}</span>
        {recipe.servings && <span className="eyebrow">Serves {recipe.servings}</span>}
      </div>
      <h3 className="mt-3 font-display text-[1.65rem] leading-tight font-semibold text-ink group-hover:text-burgundy">
        {recipe.title}
      </h3>
      {recipe.description && <p className="mt-1 line-clamp-2 text-[0.95rem] leading-7 text-ink-soft">{recipe.description}</p>}
      <p className="mt-2 text-[0.9rem]">
        <Byline member={recipe.contributor} />
      </p>
    </Link>
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
