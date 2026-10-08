import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libSQL ships native binaries; load it from node_modules instead of bundling.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Keep the dev-mode badge from covering the app's bottom tab bar in demos.
  devIndicators: false,
  experimental: {
    serverActions: {
      // Photos are compressed in the browser first, but leave room for a
      // vet record plus a pet photo in one request.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
