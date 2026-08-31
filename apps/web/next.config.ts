import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
  // Next.js blocks cross-origin requests to dev-only assets by default —
  // needed to load the dev server from a LAN IP (e.g. testing on a phone).
  // Wildcarded to the subnet so it survives a DHCP lease renewal, not
  // pinned to today's specific IP.
  allowedDevOrigins: ["192.168.100.*"],
};

export default nextConfig;
