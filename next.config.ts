import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off: every page is per-user (reads the auth cookie),
  // so there's nothing worth prerendering beyond what Next does by default.
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
