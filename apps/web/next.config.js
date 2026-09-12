/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Local MinIO in development. Add the production S3/CDN host here
      // once real object storage is provisioned.
      { protocol: "http", hostname: "localhost", port: "9000" },
      // Placeholder images used only by the development seed data
      // (apps/api/prisma/seed.ts) until real product photography exists.
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
