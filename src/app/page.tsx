import Link from "next/link";
import { listGatherings, listRecipes, today } from "@/lib/data";
import { getUserId } from "@/lib/supabase/server";
import { EmptyState, GatheringRow, RecipeCard, SampleBanner, SectionHeading } from "@/components/ui";
import { CopySampleButton } from "@/components/copy-sample-button";

export default async function CookbookPage() {
  const [userId, recipes, gatherings] = await Promise.all([getUserId(), listRecipes(), listGatherings()]);
  const upcoming = gatherings.filter((g) => g.held_on >= today()).slice(0, 2);

  return (
    <main className="rise">
      <header className="pt-6 pb-7 text-center">
        <p className="eyebrow">{userId ? "Our family cookbook" : "The Moreno family cookbook"}</p>
        <h1 className="mt-2 font-display text-[3.4rem] leading-none font-semibold tracking-tight text-burgundy italic">
          Sobremesa
        </h1>
        <p className="mx-auto mt-3 max-w-[30ch] text-[0.98rem] text-ink-soft">
          The recipes we cook for each other, and the dinners where we cooked them.
        </p>
      </header>

      {!userId && <SampleBanner />}

      {upcoming.length > 0 && (
        <section className="mb-9">
          <SectionHeading
            action={
              <Link href="/gatherings" className="text-[0.85rem] text-burgundy">
                All gatherings
              </Link>
            }
          >
            At the table soon
          </SectionHeading>
          <div className="divide-y divide-rule-soft">
            {upcoming.map((g) => (
              <GatheringRow key={g.id} gathering={g} dishes={g.dishes} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading
          action={
            userId && recipes.length > 0 ? (
              <Link href="/recipes/new" className="text-[0.85rem] text-burgundy">
                Add a recipe
              </Link>
            ) : undefined
          }
        >
          {recipes.length > 0 ? `The recipes · ${recipes.length}` : "The recipes"}
        </SectionHeading>

        {recipes.length === 0 ? (
          <EmptyState
            title="An empty cookbook"
            action={
              <div className="flex flex-col items-center gap-3">
                <Link href="/recipes/new" className="btn btn-primary w-full max-w-64">
                  Write the first recipe
                </Link>
                <CopySampleButton />
              </div>
            }
          >
            Start with the dish someone always asks you to bring.
          </EmptyState>
        ) : (
          <ul className="space-y-4">
            {recipes.map((r, i) => (
              <li key={r.id}>
                <RecipeCard recipe={r} index={recipes.length - 1 - i} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
