import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// No nonce: Next.js inline scripts and styles are allowed as they are, so pages stay static and cacheable.
// `next dev` also needs eval (React debugging) and a websocket (hot reload); production gets neither.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// The app uses none of these browser features, so no page (or anything injected into it) may ask for them.
const permissionsPolicy = [
  "accelerometer=()",
  "autoplay=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "usb=()",
  "browsing-topics=()",
].join(", ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: permissionsPolicy },
];

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone for the production Docker image.
  output: "standalone",
  // Don't tell visitors which software serves the app (drops `X-Powered-By: Next.js`).
  poweredByHeader: false,
  // Agent instructions live in CLAUDE.md; don't let `next dev` generate AGENTS.md.
  agentRules: false,
  // Keep the dev-mode indicator away from the form's bottom bar.
  devIndicators: { position: "top-right" },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
