import Link from "next/link";
import { headers } from "next/headers";
import { getCookbook, getInvite, listFamily, listJoined } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { formatDate, SampleBanner, SectionHeading } from "@/components/ui";
import { AddMemberForm, MemberRow } from "@/components/add-member-form";
import { CookbookName, InviteFamily } from "@/components/invite-family";
import { pen } from "@/lib/pen";

export const metadata = { title: "Family" };

/** The invite URL on whatever host served this page (preview, production, localhost). */
async function joinUrl(token: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/join/${token}`;
}

export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  const signedIn = !!data?.claims?.sub;
  const [family, cookbook, invite, joined] = await Promise.all([listFamily(), getCookbook(), getInvite(), listJoined()]);
  const owner = joined.find((j) => j.owner);

  return (
    <main className="rise">
      <header className="pt-6 pb-6">
        <p className="eyebrow">Who writes in this book</p>
        <h1 className="mt-1 font-display text-[2.6rem] leading-none font-semibold">The family</h1>
        <p className="mt-3 text-ink-soft">Everyone writes in their own ink and hand, so you can tell whose note is whose at a glance.</p>
      </header>

      {!signedIn && <SampleBanner />}

      {cookbook && (
        <section className="mb-10">
          <SectionHeading>Invite family</SectionHeading>
          <div className="mb-4">
            {cookbook.isOwner ? (
              <CookbookName id={cookbook.id} name={cookbook.name} />
            ) : (
              <p className="font-display text-[1.45rem] leading-tight font-semibold">{cookbook.name}</p>
            )}
          </div>
          <InviteFamily
            url={invite ? await joinUrl(invite.token) : null}
            expiresOn={invite ? formatDate(invite.expires_at) : null}
            cookbookName={cookbook.name}
            isOwner={cookbook.isOwner}
            ownerName={owner?.name ?? null}
          />
          {joined.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow mb-2">Has joined</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {joined.map((j) => (
                  <li key={j.id} className="flex items-baseline gap-1.5">
                    <span {...pen(j, "text-[1.4rem] leading-none")}>{j.name}</span>
                    {(j.owner || j.mine) && (
                      <span className="text-[0.8rem] text-ink-faint italic">
                        {[j.mine && "you", j.owner && "started it"].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section>
        <SectionHeading>{signedIn ? "In your cookbook" : "The Morenos"}</SectionHeading>
        <ul className="divide-y divide-rule-soft">
          {family.map((m) => (
            <MemberRow key={m.id} member={m} signedIn={signedIn} />
          ))}
        </ul>
        {signedIn && <AddMemberForm family={family} />}
        {signedIn && (
          <p className="mt-3 text-[0.85rem] text-ink-soft">
            Add people who won&rsquo;t sign up, like Abuela, so you can write down their recipes. Anyone in the family can change their pen until they join and claim it.
          </p>
        )}
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
