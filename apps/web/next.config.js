/** @type {import('next').NextConfig} */

// next.config.js runs in Node at build time, not the browser, so it can
// read any server-side env var directly (no NEXT_PUBLIC_ prefix needed
// here) — used to derive the image remotePattern for wherever object
// storage actually lives, rather than hardcoding it. Without this, an
// admin-entered product image or producer photo URL pointing at a real
// production S3/CDN host would silently fail to render: next/image
// throws for any remote host not explicitly allow-listed, and this file
// previously only allow-listed localhost:9000 (dev MinIO) and
// placehold.co (seed-data placeholders) — meaning the one remote host
// actually used in production was never on the list.
function s3RemotePattern() {
  const raw = process.env.S3_PUBLIC_BASE_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return {
      protocol: url.protocol.replace(":", ""),
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
    };
  } catch {
    // Malformed S3_PUBLIC_BASE_URL — fail open on image loading rather
    // than crashing the whole build over a misconfigured env var; the
    // images simply won't render until it's corrected.
    return null;
  }
}

const s3Pattern = s3RemotePattern();

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Local MinIO in development (also covers a same-host production
      // MinIO reachable at this exact address/port, though most
      // deployments will set S3_PUBLIC_BASE_URL to a real domain instead).
      { protocol: "http", hostname: "localhost", port: "9000" },
      // Placeholder images used only by the development seed data
      // (apps/api/prisma/seed.ts) until real product photography exists.
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "dkstatics-public.digikala.com" },
      { protocol: "https", hostname: "randomimageurl.com" },
      { protocol: "https", hostname: "dl.toolschi.com" },
      // Wherever S3_PUBLIC_BASE_URL actually points in this environment
      // (see the comment above) — omitted if that var isn't set or is
      // malformed, in which case only the two static entries above apply.
      ...(s3Pattern ? [s3Pattern] : []),
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
