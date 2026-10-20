import Link from "next/link";
import { listFamily } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { SampleBanner, SectionHeading } from "@/components/ui";
import { AddMemberForm, MemberRow } from "@/components/add-member-form";

export const metadata = { title: "Family" };

export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  const signedIn = !!data?.claims?.sub;
  const family = await listFamily();

  return (
    <main className="rise">
      <header className="pt-6 pb-6">
        <p className="eyebrow">Who writes in this book</p>
        <h1 className="mt-1 font-display text-[2.6rem] leading-none font-semibold">The family</h1>
        <p className="mt-3 text-ink-soft">Everyone writes in their own ink and hand, so you can tell whose note is whose at a glance.</p>
      </header>

      {!signedIn && <SampleBanner />}

      <section>
        <SectionHeading>{signedIn ? "In your cookbook" : "The Morenos"}</SectionHeading>
        <ul className="divide-y divide-rule-soft">
          {family.map((m) => (
            <MemberRow key={m.id} member={m} editable={signedIn} />
          ))}
        </ul>
        {signedIn && <AddMemberForm family={family} />}
      </section>

      <section className="mt-10">
        <SectionHeading>Account</SectionHeading>
        {signedIn ? (
          <div className="space-y-4">
            <p className="text-[0.95rem] text-ink-soft">Signed in as {email}</p>
            <form action={signOut}>
              <button className="btn btn-quiet w-full">Sign out</button>
            </form>
          </div>
        ) : (
          <Link href="/login" className="btn btn-primary w-full">
            Start your own cookbook
          </Link>
        )}
      </section>
    </main>
  );
}
