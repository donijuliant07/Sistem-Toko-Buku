import type { NextConfig } from "next";

/**
 * Origin tambahan yang boleh memuat aset dev (`/_next/*`, HMR) saat dev server
 * dibuka lewat IP LAN. Hanya berpengaruh pada `next dev`.
 * Contoh: `NEXT_DEV_ALLOWED_ORIGINS=192.168.*.*,10.*.*.*`.
 */
const allowedDevOrigins = (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
