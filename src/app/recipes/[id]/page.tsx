import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipe, listFamily } from "@/lib/data";
import { Byline, formatDate, SampleBanner, SectionHeading, TopBar } from "@/components/ui";
import { AnnotationForm } from "@/components/annotation-form";
import { deleteAnnotation } from "@/app/actions";
import { CloseIcon } from "@/components/icons";
import { Snapshot } from "@/components/snapshot";

export async function generateMetadata({ params }: PageProps<"/recipes/[id]">): Promise<Metadata> {
  const data = await getRecipe((await params).id);
  return { title: data?.recipe.title ?? "Recipe" };
}

export default async function RecipePage({ params, searchParams }: PageProps<"/recipes/[id]">) {
  const { id } = await params;
  const { saved } = await searchParams;
  const data = await getRecipe(id);
  if (!data) notFound();
  const { recipe, annotations, history, canEdit } = data;
  const family = canEdit ? await listFamily() : [];

  return (
    <main className="rise">
      <TopBar
        back={{ href: "/", label: "Cookbook" }}
        action={
          canEdit && (
            <Link href={`/recipes/${recipe.id}/edit`} className="py-2 pl-3 text-[0.95rem] text-burgundy">
              Edit
            </Link>
          )
        }
      />
      {recipe.is_demo && <div className="mt-2"><SampleBanner /></div>}
      {saved && (
        <p role="status" className="mt-2 mb-4 text-center text-[0.9rem] text-olive italic">
          Saved to the cookbook.
        </p>
      )}

      <article>
        <header className="index-card index-card-lined relative mt-4 -rotate-[0.4deg] px-5 pb-6">
          <div className="flex h-[2.6rem] items-center">
            {recipe.servings && <span className="text-[0.9rem] text-ink-faint italic">Serves {recipe.servings}</span>}
          </div>
          {recipe.contributor && (
            <Snapshot member={recipe.contributor} className="absolute top-3 right-4 h-[5.6rem] w-[4.8rem] rotate-3" />
          )}
          <h1
            className={`font-display text-[2.3rem] leading-[3.5rem] font-semibold text-ink ${recipe.contributor ? "pr-20" : ""}`}
          >
            {recipe.title}
          </h1>
          {recipe.description && <p className="leading-7 text-ink-soft">{recipe.description}</p>}
          <p className="text-[0.95rem] leading-7">
            <Byline member={recipe.contributor} prefix="Passed down by" />
          </p>
        </header>

        {recipe.story && (
          <section className="mt-8">
            <SectionHeading>The story</SectionHeading>
            <p className="text-[1.02rem] leading-[1.75] italic first-letter:float-left first-letter:mt-1 first-letter:mr-2 first-letter:font-display first-letter:text-[3.2rem] first-letter:leading-[0.8] first-letter:font-semibold first-letter:text-burgundy first-letter:not-italic">
              {recipe.story}
            </p>
          </section>
        )}

        <section className="mt-8">
          <SectionHeading>Ingredients</SectionHeading>
          <ul className="space-y-0">
            {recipe.ingredients.map((item, i) => (
              <li key={i} className="flex gap-3 border-b border-dotted border-rule py-2 leading-6">
                <span className="mt-[0.6rem] h-1 w-1 shrink-0 rotate-45 bg-terracotta" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <SectionHeading>Method</SectionHeading>
          <ol className="space-y-4">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-4 leading-7">
                <span className="w-6 shrink-0 text-right font-display text-[1.5rem] leading-7 font-semibold text-burgundy">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10" aria-labelledby="margins">
          <SectionHeading>
            <span id="margins">In the margins</span>
          </SectionHeading>
          {annotations.length === 0 ? (
            <p className="text-[0.95rem] text-ink-soft italic">
              No notes yet. When someone changes this recipe, their twist goes here, and the original stays as written.
            </p>
          ) : (
            <ul className="index-card index-card-lined space-y-1 px-5 pt-12 pb-4">
              {annotations.map((a, i) => (
                <li
                  key={a.id}
                  className={`group relative py-1 ${i % 2 ? "rotate-[0.6deg] pl-6" : "-rotate-[0.5deg]"}`}
                >
                  <p className={`hand text-[1.45rem] leading-[1.75rem] ink-${a.author?.ink ?? "sepia"}`}>{a.body}</p>
                  <p className={`hand text-[1.1rem] leading-[1.75rem] opacity-80 ink-${a.author?.ink ?? "sepia"}`}>
                    — {a.author?.name ?? "Someone"}, {formatDate(a.created_at, { month: "short", year: "numeric" })}
                  </p>
                  {canEdit && (
                    <form action={deleteAnnotation} className="absolute top-1 -right-3">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="recipe_id" value={recipe.id} />
                      <button aria-label={`Remove note by ${a.author?.name ?? "someone"}`} className="p-2 text-ink-faint hover:text-burgundy">
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit ? (
            <AnnotationForm recipeId={recipe.id} family={family} />
          ) : (
            <p className="mt-4 text-[0.9rem] text-ink-soft">
              <Link href="/login" className="link">Sign in</Link> to write notes in your own cookbook.
            </p>
          )}
        </section>

        <section className="mt-10">
          <SectionHeading>At the table</SectionHeading>
          {history.length === 0 ? (
            <p className="text-[0.95rem] text-ink-soft italic">
              Not served at a gathering yet.{" "}
              {canEdit && (
                <Link href="/gatherings" className="link not-italic">
                  Add it to a menu
                </Link>
              )}
            </p>
          ) : (
            <ol className="relative ml-2 border-l border-rule">
              {history.map((h) => (
                <li key={h.id} className="relative pb-5 pl-6 last:pb-0">
                  <span className="absolute top-2 -left-[5px] h-[9px] w-[9px] rotate-45 border border-burgundy bg-paper" aria-hidden />
                  <p className="eyebrow">{formatDate(h.gathering.held_on)}</p>
                  <Link href={`/gatherings/${h.gathering.id}`} className="font-display text-[1.35rem] leading-tight font-semibold hover:text-burgundy">
                    {h.gathering.name}
                  </Link>
                  <p className="text-[0.92rem] text-ink-soft">
                    {h.preparer ? (
                      <>
                        Made by <span className={`hand text-[1.25rem] ink-${h.preparer.ink}`}>{h.preparer.name}</span>
                      </>
                    ) : (
                      "Nobody has claimed it yet"
                    )}
                    {h.note && <span className="italic"> · {h.note}</span>}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </article>
    </main>
  );
}
