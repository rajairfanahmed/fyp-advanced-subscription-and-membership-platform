import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // Hide the floating Next.js "N" badge (dev-only; not part of the product).
  devIndicators: false,
};

export default nextConfig;
