import { join } from "node:path";
import type { NextConfig } from "next";

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  outputFileTracingRoot: join(__dirname, ".."),
  experimental: {
    externalDir: true,
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
    ];
  },
};

export default nextConfig;
