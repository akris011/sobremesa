import Link from "next/link";
import { listGatherings, today } from "@/lib/data";
import { getUserId } from "@/lib/supabase/server";
import { EmptyState, GatheringRow, SampleBanner, SectionHeading } from "@/components/ui";
import { PlusIcon } from "@/components/icons";

export const metadata = { title: "Gatherings" };

export default async function GatheringsPage() {
  const [userId, gatherings] = await Promise.all([getUserId(), listGatherings()]);
  const now = today();
  const upcoming = gatherings.filter((g) => g.held_on >= now);
  const past = gatherings.filter((g) => g.held_on < now).reverse();

  return (
    <main className="rise">
      <header className="flex items-end justify-between gap-4 pt-6 pb-6">
        <div>
          <p className="eyebrow">Dinners &amp; celebrations</p>
          <h1 className="mt-1 font-display text-[2.6rem] leading-none font-semibold">Gatherings</h1>
        </div>
        {userId && (
          <Link href="/gatherings/new" className="btn btn-primary min-h-10 px-3.5 text-[0.92rem]">
            <PlusIcon className="h-4 w-4" />
            Plan one
          </Link>
        )}
      </header>

      {!userId && <SampleBanner />}

      {gatherings.length === 0 ? (
        <EmptyState
          title="No dinners planned"
          action={
            <Link href="/gatherings/new" className="btn btn-primary">
              Plan a gathering
            </Link>
          }
        >
          Plan the next one, decide the menu, and see who&rsquo;s bringing what.
        </EmptyState>
      ) : (
        <>
          <section className="mb-9">
            <SectionHeading>Coming up</SectionHeading>
            {upcoming.length === 0 ? (
              <p className="text-[0.95rem] text-ink-soft italic">Nothing on the calendar.</p>
            ) : (
              <div className="divide-y divide-rule-soft">
                {upcoming.map((g) => (
                  <GatheringRow key={g.id} gathering={g} dishes={g.dishes} />
                ))}
              </div>
            )}
          </section>
          {past.length > 0 && (
            <section>
              <SectionHeading>Remembered</SectionHeading>
              <div className="divide-y divide-rule-soft">
                {past.map((g) => (
                  <GatheringRow key={g.id} gathering={g} dishes={g.dishes} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
