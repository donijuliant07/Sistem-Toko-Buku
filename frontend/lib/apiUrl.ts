const DEFAULT_API_URL = "http://localhost:8000/api/v1";
const API_PORT = 8000;

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export type PageLocation = { protocol: string; hostname: string };

/**
 * URL API backend.
 *
 * `NEXT_PUBLIC_API_URL` menang, kecuali host-nya loopback sementara halaman
 * dibuka dari perangkat lain (`http://192.168.1.10:3000`): di sana `localhost`
 * berarti perangkat itu sendiri, bukan mesin backend. Kasus itu diganti host
 * halaman dengan port yang sama seperti URL eksplisit.
 * Dihitung per panggilan agar render server tidak mengunci URL ke `localhost`.
 */
export function resolveApiUrl(
  location: PageLocation | null = typeof window === "undefined" ? null : window.location,
): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!location) return fromEnv || DEFAULT_API_URL;

  if (!fromEnv) return `${location.protocol}//${location.hostname}:${API_PORT}/api/v1`;

  try {
    const url = new URL(fromEnv);
    if (LOOPBACK.has(url.hostname) && !LOOPBACK.has(location.hostname)) {
      // Deploy HTTPS tidak punya backend di `localhost`, dan menukarnya dengan
      // host halaman + port 8000 selalu gagal. Jatuh ke origin halaman agar
      // salah konfigurasi terlihat sebagai 404, bukan koneksi menggantung.
      if (location.protocol === "https:") return `${location.protocol}//${location.hostname}/api/v1`;
      url.hostname = location.hostname;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return fromEnv;
  }
}
