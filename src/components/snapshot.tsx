import { photoFor } from "@/lib/photos";
import type { FamilyMember } from "@/lib/types";
import { pen } from "@/lib/pen";

/**
 * A small photo of a family member, taped to the card. Members without a
 * photo get their initial in their ink. Decorative: the name is always
 * written next to it.
 */
/** A photo of the dish, taped down like a print. Decorative: the title is right beside it. */
export function DishPhoto({ src, className = "" }: { src: string; className?: string }) {
  return (
    <span className={`snapshot ${className}`} aria-hidden>
      <span className="tape" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
    </span>
  );
}

export function Snapshot({ member, className = "" }: { member: FamilyMember; className?: string }) {
  const src = photoFor(member);
  return (
    <span className={`snapshot ${className}`} aria-hidden>
      <span className="tape" />
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span {...pen(member, "flex h-full w-full items-center justify-center bg-paper-deep text-[2.1em]")}>
          {member.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
