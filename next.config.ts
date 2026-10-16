import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone for the production Docker image.
  output: "standalone",
  // Agent instructions live in CLAUDE.md; don't let `next dev` generate AGENTS.md.
  agentRules: false,
  // Keep the dev-mode indicator away from the form's bottom bar.
  devIndicators: { position: "top-right" },
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
