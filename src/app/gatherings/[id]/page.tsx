import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGathering, listFamily, listRecipes, today } from "@/lib/data";
import { formatDate, SampleBanner, SectionHeading, TopBar } from "@/components/ui";
import { AddDishForm, PreparerForm } from "@/components/menu-forms";
import { ChevronIcon, CloseIcon } from "@/components/icons";
import { deleteGathering, removeMenuItem } from "@/app/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { pen } from "@/lib/pen";

export async function generateMetadata({ params }: PageProps<"/gatherings/[id]">): Promise<Metadata> {
  const data = await getGathering((await params).id);
  return { title: data?.gathering.name ?? "Gathering" };
}

export default async function GatheringPage({ params }: PageProps<"/gatherings/[id]">) {
  const { id } = await params;
  const data = await getGathering(id);
  if (!data) notFound();
  const { gathering, menu, canEdit } = data;
  const [family, recipes] = canEdit ? await Promise.all([listFamily(), listRecipes()]) : [[], []];
  const onMenu = new Set(menu.map((m) => m.recipe?.id));
  const available = recipes.filter((r) => !onMenu.has(r.id));
  const isPast = gathering.held_on < today();

  return (
    <main className="rise">
      <TopBar back={{ href: "/gatherings", label: "Gatherings" }} />
      {gathering.is_demo && <div className="mt-2"><SampleBanner /></div>}

      {/* Styled after a printed dinner invitation. */}
      <header className="index-card mt-3 px-6 py-8 text-center">
        <div className="pointer-events-none absolute inset-2 border border-rule-soft" aria-hidden />
        <p className="eyebrow text-burgundy">{isPast ? "Remembered" : "You're invited"}</p>
        <h1 className="mt-3 font-display text-[2.4rem] leading-[1.05] font-semibold">{gathering.name}</h1>
        <p className="mt-3 font-display text-[1.25rem] italic">{formatDate(gathering.held_on, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
        {gathering.location && <p className="text-[0.95rem] text-ink-soft">{gathering.location}</p>}
        {gathering.description && <p className="mx-auto mt-4 max-w-[34ch] text-[0.95rem] leading-7 text-ink-soft">{gathering.description}</p>}
      </header>

      <section className="mt-9">
        <SectionHeading>{menu.length ? `The menu · ${menu.length}` : "The menu"}</SectionHeading>
        {menu.length === 0 ? (
          <p className="text-[0.95rem] text-ink-soft italic">
            {canEdit ? "Nothing on the menu yet. Add a dish from the cookbook below." : "No dishes recorded."}
          </p>
        ) : (
          <ul className="divide-y divide-rule-soft">
            {menu.map((item) => (
              <li key={item.id} className="py-3.5">
                <div className="flex items-start gap-3">
                  <Link href={`/recipes/${item.recipe?.id}`} className="group min-w-0 flex-1">
                    <span className="flex items-center gap-1 font-display text-[1.4rem] leading-tight font-semibold group-hover:text-burgundy">
                      {item.recipe?.title}
                      <ChevronIcon className="h-4 w-4 shrink-0 text-ink-faint" />
                    </span>
                  </Link>
                  {canEdit && (
                    <form action={removeMenuItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <button aria-label={`Take ${item.recipe?.title} off the menu`} className="-mt-1 -mr-2 p-2 text-ink-faint hover:text-burgundy">
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </form>
                  )}
                </div>
                {canEdit ? (
                  <PreparerForm key={item.preparer?.id ?? "none"} item={item} family={family} />
                ) : (
                  <p className="text-[0.92rem] text-ink-soft">
                    {item.preparer ? (
                      <>
                        {isPast ? "Made by" : "Brought by"}{" "}
                        <span {...pen(item.preparer, "text-[1.3rem]")}>{item.preparer.name}</span>
                      </>
                    ) : (
                      <span className="italic">Still needs someone</span>
                    )}
                  </p>
                )}
                {item.note && <p className="mt-0.5 text-[0.88rem] text-ink-soft italic">{item.note}</p>}
              </li>
            ))}
          </ul>
        )}

        {canEdit && <AddDishForm gatheringId={gathering.id} recipes={available} family={family} hasAnyRecipes={recipes.length > 0} />}
      </section>

      {canEdit && (
        <form action={deleteGathering} className="mt-12 border-t border-rule pt-6">
          <input type="hidden" name="id" value={gathering.id} />
          <ConfirmButton label="Cancel this gathering" confirmLabel="Remove it and its menu" />
        </form>
      )}
    </main>
  );
}
