import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
    webpackBuildWorker: false,
  },
};

export default nextConfig;
