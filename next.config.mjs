/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API routes read data/sample.csv at runtime; ship it with the serverless functions.
  outputFileTracingIncludes: { "/api/**": ["./data/**"] },
  // The deck prototype (public/deck) is the entry point at "/". beforeFiles wins over src/app/page.tsx,
  // so the original Dashboard moves to /dashboard. /app and /deck still open the prototypes directly.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/deck/index.html" }],
      afterFiles: [
        { source: "/app", destination: "/app/index.html" },
        { source: "/deck", destination: "/deck/index.html" },
      ],
    };
  },
};

export default nextConfig;
