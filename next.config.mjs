/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API routes read data/sample.csv at runtime; ship it with the serverless functions.
  outputFileTracingIncludes: { "/api/**": ["./data/**"] },
};

export default nextConfig;
