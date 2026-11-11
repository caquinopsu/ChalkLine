import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development"; // true while running `npm run dev`

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // On Vercel, /api/check is served by api/check.py automatically.
  // Locally, `next dev` can't run Python, so we forward /api/check to scripts/dev_py.py on port 8000.
  async rewrites() {
    return isDev ? [{ source: "/api/check", destination: "http://127.0.0.1:8000/api/check" }] : [];
  },
};

export default nextConfig;
