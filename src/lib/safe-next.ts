/** A same-site path for ?next= redirects, or "/" (blocks //evil.com and /\evil.com). */
export function safeNextPath(next: unknown) {
  return typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : "/";
}
