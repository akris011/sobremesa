import type { FamilyMember } from "@/lib/types";

/**
 * A small photo of a family member, taped to the card. There's no photo
 * storage yet, so without `src` it shows their initial in their ink.
 */
export function Snapshot({ member, src, className = "" }: { member: FamilyMember; src?: string; className?: string }) {
  return (
    <span className={`snapshot ${className}`} aria-hidden={!src}>
      <span className="tape" />
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={member.name} className="h-full w-full object-cover" />
      ) : (
        <span className={`hand flex h-full w-full items-center justify-center bg-paper-deep text-[2.1em] ink-${member.ink}`}>
          {member.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
