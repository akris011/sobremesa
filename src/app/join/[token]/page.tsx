import Link from "next/link";
import { invitePreview } from "@/lib/data";
import { getUserId } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { AuthForm } from "@/components/auth-form";
import { JoinForm } from "@/components/join-form";

export const metadata = { title: "Join the cookbook" };

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="rise pt-10">
      <div className="index-card px-5 py-7 text-center">
        <h1 className="font-display text-[1.9rem] leading-tight font-semibold">{title}</h1>
        <div className="mx-auto mt-3 max-w-[32ch] text-ink-soft">{children}</div>
      </div>
    </main>
  );
}

/** Where the family group-chat link lands: greet, sign up or in, then "Which one are you?". */
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const [invite, userId] = await Promise.all([invitePreview(token), getUserId()]);
  const who = invite.inviter ?? "Whoever sent it";

  if (invite.status === "unknown") {
    return (
      <Notice title="This invite link doesn't work">
        <p>Check that the whole link was copied, or ask for a new one.</p>
      </Notice>
    );
  }
  if (invite.status === "revoked") {
    return (
      <Notice title="This link has been turned off">
        <p>{who} turned off the invite link to {invite.cookbook}. Ask them for a new one.</p>
      </Notice>
    );
  }
  if (invite.status === "expired") {
    return (
      <Notice title="This invite link has expired">
        <p>Links last two weeks. Ask {invite.inviter ?? "whoever sent it"} for a new one to {invite.cookbook}.</p>
      </Notice>
    );
  }

  const greeting = (
    <div className="text-center">
      <p className="eyebrow">An invitation</p>
      <h1 className="mt-2 font-display text-[2.2rem] leading-tight font-semibold">
        {invite.inviter ? `${invite.inviter} invited you to ${invite.cookbook}` : `Join ${invite.cookbook}`}
      </h1>
    </div>
  );

  if (!userId) {
    return (
      <main className="rise pt-8">
        {greeting}
        <p className="mx-auto mt-3 max-w-[32ch] text-center text-ink-soft">
          Make an account or sign in. Then tell us which one you are, and write in the family&rsquo;s recipes in your own hand.
        </p>
        <div className="index-card mt-8 px-5 py-6">
          <AuthForm next={`/join/${token}`} joining />
        </div>
      </main>
    );
  }

  if (invite.has_profile) {
    return (
      <Notice title={`You're in ${invite.cookbook}`}>
        <Link href="/" className="btn btn-primary mt-3 w-full">
          Open the cookbook
        </Link>
      </Notice>
    );
  }

  if (invite.blocked) {
    return (
      <Notice title="This account already has a cookbook">
        <p>
          It has recipes or people in it, and for now an account can be in only one cookbook. To join {invite.cookbook}, sign out and
          make a new account with another email.
        </p>
        <form action={signOut} className="mt-5">
          <input type="hidden" name="next" value={`/join/${token}`} />
          <button className="btn btn-quiet w-full">Sign out and join</button>
        </form>
      </Notice>
    );
  }

  return (
    <main className="rise pt-8">
      {greeting}
      <div className="mt-8">
        <JoinForm token={token} people={invite.people ?? []} inks={invite.inks ?? []} />
      </div>
    </main>
  );
}
