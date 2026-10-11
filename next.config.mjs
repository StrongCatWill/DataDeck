/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API routes read data/sample.csv at runtime; ship it with the serverless functions.
  outputFileTracingIncludes: { "/api/**": ["./data/**"] },
  // The deck prototype (public/deck) is the entry point at "/". beforeFiles wins over src/app/page.tsx,
  // so the original Dashboard moves to /dashboard. /app and /deck still open the prototypes directly; the earlier
  // two-pane deck with the researcher portal is at /deck/portal.html.
  // The web build (port 3080, scripts/web-proxy.mjs) tags requests with x-datadeck-variant: web and gets the portal
  // at "/" instead. Both ports hit the same server, so grants and keys stay shared.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "header", key: "x-datadeck-variant", value: "web" }],
          destination: "/deck/portal.html",
        },
        { source: "/", destination: "/deck/index.html" },
      ],
      afterFiles: [
        { source: "/app", destination: "/app/index.html" },
        { source: "/deck", destination: "/deck/index.html" },
      ],
    };
  },
};

export default nextConfig;
