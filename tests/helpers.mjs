// Shared setup for the test scripts. Reads the public Supabase URL and key
// from .env.local, the same values the app uses.
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(new URL("../.env.local", import.meta.url));

export const supabase = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

// Each run signs up fresh accounts. Set TEST_EMAIL to an address you own with
// "{tag}" where the unique part goes, e.g. "you+{tag}@gmail.com", so the
// accounts are easy to find and delete in the Supabase dashboard.
export const testEmail = (kind) => {
  const tag = `sobremesa-${kind}-${Date.now()}`;
  return process.env.TEST_EMAIL ? process.env.TEST_EMAIL.replace("{tag}", tag) : `sobremesa.${kind}+${Date.now()}@gmail.com`;
};

export function checker() {
  let pass = 0, fail = 0;
  return {
    expect(name, ok, detail = "") {
      if (ok) pass++;
      else fail++;
      console.log(ok ? "PASS" : "FAIL", name, ok ? "" : detail);
    },
    done() {
      console.log(`\n${pass} passed, ${fail} failed`);
      process.exit(fail ? 1 : 0);
    },
  };
}
