import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
  outputFileTracingExcludes: {
    '*': ['./**/*'],
  },
};

export default nextConfig;
