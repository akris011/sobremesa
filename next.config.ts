import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off: every page is per-user (reads the auth cookie),
  // so there's nothing worth prerendering beyond what Next does by default.
  // Pages are dynamic, so by default every tab tap waited on a server round
  // trip. The bottom-nav links prefetch in full (kept `static` seconds) and
  // visited pages are reused for `dynamic` seconds. Every server action calls
  // revalidatePath, which clears this cache, so your own edits show at once;
  // changes made on another device show within a minute.
  experimental: {
    staleTimes: { dynamic: 30, static: 60 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
