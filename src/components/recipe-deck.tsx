"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { BackIcon, ChevronIcon } from "@/components/icons";

/**
 * Recipe cards side by side; swipe (or use the arrows) to flip through.
 * Native scroll-snap does the swiping, so momentum, keyboard and screen
 * readers work without a gesture library.
 */
export function RecipeDeck({ children }: { children: ReactNode }) {
  const cards = Children.toArray(children);
  const track = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const mid = el.scrollLeft + el.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        Array.from(el.children).forEach((child, i) => {
          const c = child as HTMLElement;
          const dist = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
          if (dist < bestDist) [best, bestDist] = [i, dist];
        });
        setCurrent(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  function go(i: number) {
    const card = track.current?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  return (
    <div>
      <ul
        ref={track}
        tabIndex={0}
        aria-label="Recipe cards"
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[8%] pt-5 pb-6 focus-visible:outline-none"
      >
        {cards.map((card, i) => (
          <li key={i} className="w-[84%] shrink-0 snap-center" aria-current={i === current ? "true" : undefined}>
            {card}
          </li>
        ))}
      </ul>
      {cards.length > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            aria-label="Previous recipe"
            className="-ml-2 p-2 text-ink-soft disabled:opacity-30"
          >
            <BackIcon className="h-6 w-6" />
          </button>
          <p className="text-[0.92rem] text-ink-soft italic" aria-live="polite">
            Card {current + 1} of {cards.length}
          </p>
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={current === cards.length - 1}
            aria-label="Next recipe"
            className="-mr-2 p-2 text-ink-soft disabled:opacity-30"
          >
            <ChevronIcon className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  );
}
