import { redirect } from "next/navigation";
import { getUserId } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth-form";
import { safeNextPath } from "@/lib/safe-next";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getUserId()) redirect(nextPath);
  return (
    <main className="rise pt-10">
      <div className="text-center">
        <p className="eyebrow">Your family&rsquo;s cookbook</p>
        <h1 className="mt-2 font-display text-[2.8rem] leading-none font-semibold text-burgundy italic">Sobremesa</h1>
        <p className="mx-auto mt-3 max-w-[30ch] text-ink-soft">
          Keep the recipes, the stories, and who brought what to every dinner.
        </p>
      </div>
      <div className="index-card mt-8 px-5 py-6">
        <AuthForm next={nextPath} />
      </div>
    </main>
  );
}
