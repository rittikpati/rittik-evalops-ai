import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  experimental: { proxyClientMaxBodySize: "30mb" },
  serverExternalPackages: ["xlsx", "pdf-parse", "mammoth"],
};

export default nextConfig;
