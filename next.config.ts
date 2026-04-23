import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — let Next bundle it on the server only
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
