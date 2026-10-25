import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

/**
 * Judul tab mengikuti judul buku (`GET /books/{id}`, publik) dan hanya diisi
 * bila buku itu benar-benar ditemukan. Endpoint ini publik, jadi tidak butuh
 * token; kegagalan apa pun jatuh ke "Detail Buku".
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

  try {
    const response = await fetch(`${base}/books/${encodeURIComponent(id)}`, {
      next: { revalidate: 300 },
    });
    if (response.ok) {
      const body = (await response.json()) as { data?: { title?: string; description?: string | null } };
      const title = body.data?.title;
      if (title) {
        return {
          title,
          description: body.data?.description?.slice(0, 160) ?? undefined,
        };
      }
    }
  } catch {
    // Jaringan/API mati: tetap tampilkan judul umum, halaman tetap dirender.
  }

  return { title: "Detail Buku" };
}

export default function BookDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
