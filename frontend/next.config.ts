import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Tailwind CSS v4 via its Turbopack loader (resolves @import "tw-animate-css", @utility, @theme...).
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"] },
    },
  },
  // The browser only ever talks to the Next.js origin. API calls and uploaded
  // images are proxied to Express, so auth cookies are first-party and the
  // proxy (route guard) can read them.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${BACKEND_URL}/uploads/:path*` },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75],
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/uploads/**", search: "" },
    ],
  },
};

export default nextConfig;
