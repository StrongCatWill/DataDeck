/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API routes read data/sample.csv at runtime; ship it with the serverless functions.
  outputFileTracingIncludes: { "/api/**": ["./data/**"] },
  // The mobile app (public/app, from the design prototype) opens at /app.
  async rewrites() {
    return [{ source: "/app", destination: "/app/index.html" }];
  },
};

export default nextConfig;
