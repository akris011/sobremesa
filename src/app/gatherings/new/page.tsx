import { redirect } from "next/navigation";
import { getUserId } from "@/lib/supabase/server";
import { GatheringForm } from "@/components/gathering-form";
import { TopBar } from "@/components/ui";

export const metadata = { title: "Plan a gathering" };

export default async function NewGatheringPage() {
  if (!(await getUserId())) redirect("/login?next=/gatherings/new");
  return (
    <main className="rise">
      <TopBar back={{ href: "/gatherings", label: "Gatherings" }} />
      <h1 className="mt-2 mb-1 font-display text-[2.3rem] leading-tight font-semibold">Plan a gathering</h1>
      <p className="mb-7 text-ink-soft">You&rsquo;ll set the menu on the next page.</p>
      <GatheringForm />
    </main>
  );
}
