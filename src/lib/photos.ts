import type { FamilyMember } from "@/lib/types";

// Placeholder portraits for the sample (Moreno) family, from randomuser.me.
// Keyed by the fixed ids in *_sample_cookbook.sql. Copies made with
// copy_sample_cookbook() get new ids, so they show initials like any other member.
const SAMPLE_PHOTOS: Record<string, string> = {
  "d0000000-0000-4000-8000-000000000101": "/people/abuela-rosa.jpg",
  "d0000000-0000-4000-8000-000000000102": "/people/tia-carmen.jpg",
  "d0000000-0000-4000-8000-000000000103": "/people/luis.jpg",
  "d0000000-0000-4000-8000-000000000104": "/people/mari.jpg",
  "d0000000-0000-4000-8000-000000000105": "/people/daniel.jpg",
};

/**
 * The one place that decides a member's photo. When uploads exist, return the
 * stored photo here first; every card and header picks it up without changes.
 */
export function photoFor(member: FamilyMember): string | undefined {
  return SAMPLE_PHOTOS[member.id];
}
