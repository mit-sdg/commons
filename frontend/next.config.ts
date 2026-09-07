import { join } from "node:path";
import type { NextConfig } from "next";
import { allowedDevOriginsFromPublicOrigin } from "./deployment-config.ts";

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:4000";
// The laptop's own loopback names stay allowed when the dev server listens on
// every interface for the room's phones.
const ALLOWED_DEV_ORIGINS = allowedDevOriginsFromPublicOrigin(
  process.env.PUBLIC_ORIGIN,
  process.env.PARTICIPANT_ORIGIN,
  "http://127.0.0.1",
  "http://localhost",
);

const nextConfig: NextConfig = {
  allowedDevOrigins: ALLOWED_DEV_ORIGINS,
  // Commons renders images directly; keep the unused optimization endpoint closed.
  images: { unoptimized: true },
  // The participant destination is public configuration, embedded for the
  // client that draws QR codes. Production already requires PUBLIC_ORIGIN; a
  // laptop serving a room over plain http keeps the edge on loopback and
  // names the address phones reach as PARTICIPANT_ORIGIN.
  env: {
    NEXT_PUBLIC_PARTICIPANT_ORIGIN:
      process.env.PARTICIPANT_ORIGIN ?? process.env.PUBLIC_ORIGIN ?? "",
  },
  // The development indicator sits on every phone and covers its counter.
  devIndicators: false,
  output: "standalone",
  outputFileTracingRoot: join(__dirname, ".."),
  experimental: {
    externalDir: true,
  },
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, "");
          },
        ),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        util: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/setup",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
    ];
  },
};

export default nextConfig;
