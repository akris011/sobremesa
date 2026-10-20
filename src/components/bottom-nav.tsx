"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BookIcon, PenIcon, PersonIcon, TableIcon } from "@/components/icons";

const TABS = [
  { href: "/", label: "Cookbook", Icon: BookIcon, match: (p: string) => p === "/" || (p.startsWith("/recipes") && p !== "/recipes/new") },
  { href: "/gatherings", label: "Gatherings", Icon: TableIcon, match: (p: string) => p.startsWith("/gatherings") },
  { href: "/recipes/new", label: "Add recipe", Icon: PenIcon, match: (p: string) => p === "/recipes/new" },
  { href: "/account", label: "Family", Icon: PersonIcon, match: (p: string) => p.startsWith("/account") || p.startsWith("/login") },
];

// Signed-out taps on Add recipe land on /login?next=/recipes/new; keep the tab
// they tapped lit rather than Family. useSearchParams needs a Suspense boundary
// for prerendered pages (the 404), where the fallback lights tabs by path only.
export function BottomNav() {
  return (
    <Suspense fallback={<Tabs next={null} />}>
      <TabsWithNext />
    </Suspense>
  );
}

function TabsWithNext() {
  return <Tabs next={useSearchParams().get("next")} />;
}

function Tabs({ next }: { next: string | null }) {
  const pathname = usePathname();
  const signInFor = pathname === "/login" && next?.startsWith("/") ? TABS.find((t) => t.href !== "/account" && t.match(next)) : undefined;
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/95 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex h-(--nav-h) max-w-xl items-stretch justify-around px-2">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = signInFor ? signInFor.href === href : match(pathname);
          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-[0.7rem] tracking-wide transition-colors ${
                  active ? "text-burgundy" : "text-ink-faint hover:text-ink-soft"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span>{label}</span>
                {active && <span className="absolute top-0 h-[2px] w-8 bg-burgundy" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
