import type { FamilyMember } from "@/lib/types";

/**
 * The one place that decides a member's photo. Nobody has one yet, so every
 * card shows the member's initial in their ink. When uploads exist, return the
 * stored photo here; every card and header picks it up without changes.
 */
export function photoFor(member: FamilyMember): string | undefined {
  void member;
  return undefined;
}
