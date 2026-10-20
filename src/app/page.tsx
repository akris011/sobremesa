import Link from "next/link";
import { listGatherings, listRecipes, today } from "@/lib/data";
import { getUserId } from "@/lib/supabase/server";
import { DeckCard, EmptyState, GatheringRow, RecipeIndex, SampleBanner, SectionHeading } from "@/components/ui";
import { RecipeDeck } from "@/components/recipe-deck";
import { CopySampleButton } from "@/components/copy-sample-button";

export default async function CookbookPage({ searchParams }: PageProps<"/">) {
  const { view } = await searchParams;
  const box = view === "box";
  const [userId, recipes, gatherings] = await Promise.all([getUserId(), listRecipes(), listGatherings()]);
  const upcoming = gatherings.filter((g) => g.held_on >= today()).slice(0, 2);

  return (
    <main className="rise">
      <header className="pt-5 pb-5">
        <p className="hand text-[1.45rem] text-sepia">{userId ? "Our family cookbook" : "The Moreno family cookbook"}</p>
        <h1 className="font-display text-[2.9rem] leading-none font-semibold tracking-tight text-burgundy italic">Sobremesa</h1>
      </header>

      {!userId && <SampleBanner />}

      <section>
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
          <>
            <nav className="flex items-end justify-between border-b border-rule" aria-label="How to show the recipes">
              <div className="flex">
                <Link href="/" className="view-tab" aria-current={box ? undefined : "page"}>
                  The deck
                </Link>
                <Link href="/?view=box" className="view-tab" aria-current={box ? "page" : undefined}>
                  The whole box · {recipes.length}
                </Link>
              </div>
              {userId && (
                <Link href="/recipes/new" className="pb-1.5 text-[0.9rem] text-burgundy">
                  Add a recipe
                </Link>
              )}
            </nav>
            {box ? (
              <div className="pt-5">
                <RecipeIndex recipes={recipes} />
              </div>
            ) : (
              <RecipeDeck>
                {recipes.map((r, i) => (
                  <DeckCard key={r.id} recipe={r} index={i} />
                ))}
              </RecipeDeck>
            )}
          </>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="mt-9">
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
    </main>
  );
}
