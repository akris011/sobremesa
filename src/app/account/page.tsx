import Link from "next/link";
import { listFamily } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { setMemberInk, signOut } from "@/app/actions";
import { SampleBanner, SectionHeading } from "@/components/ui";
import { AddMemberForm } from "@/components/add-member-form";
import { INKS } from "@/lib/types";

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
        <p className="mt-3 text-ink-soft">Everyone gets their own ink, so you can tell whose note is whose at a glance.</p>
      </header>

      {!signedIn && <SampleBanner />}

      <section>
        <SectionHeading>{signedIn ? "In your cookbook" : "The Morenos"}</SectionHeading>
        <ul className="divide-y divide-rule-soft">
          {family.map((m) => (
            <li key={m.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`hand text-[1.7rem] leading-none ink-${m.ink}`}>{m.name}</span>
                {m.relation && <span className="eyebrow">{m.relation}</span>}
              </div>
              {signedIn && (
                <form action={setMemberInk} className="mt-2 flex flex-wrap gap-1.5">
                  <input type="hidden" name="id" value={m.id} />
                  {INKS.map((ink) => (
                    <button
                      key={ink}
                      name="ink"
                      value={ink}
                      aria-label={`${ink} ink for ${m.name}`}
                      aria-pressed={m.ink === ink}
                      className={`h-7 w-7 rounded-full border-2 ${m.ink === ink ? "border-ink" : "border-transparent"}`}
                    >
                      <span className={`mx-auto block h-4 w-4 rounded-full bg-current ink-${ink}`} />
                    </button>
                  ))}
                </form>
              )}
            </li>
          ))}
        </ul>
        {signedIn && <AddMemberForm />}
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
