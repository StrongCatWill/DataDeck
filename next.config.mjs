/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API routes read data/sample.csv at runtime; ship it with the serverless functions.
  outputFileTracingIncludes: { "/api/**": ["./data/**"] },
  // The design prototypes (public/app, public/deck) open at /app and /deck.
  async rewrites() {
    return [
      { source: "/app", destination: "/app/index.html" },
      { source: "/deck", destination: "/deck/index.html" },
    ];
  },
};

export default nextConfig;
