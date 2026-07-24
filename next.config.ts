import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: { cpus: 4 },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
