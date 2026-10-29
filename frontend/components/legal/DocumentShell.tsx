import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight, Info } from "lucide-react";

export type DocSection = {
  id: string;
  title: string;
  body: ReactNode;
};

export type DocFact = { label: string; value: string };

const PAGES = [
  { href: "/terms", label: "Ketentuan" },
  { href: "/privacy", label: "Privasi" },
  { href: "/support", label: "Bantuan" },
];

/**
 * Kerangka halaman dokumen (ketentuan, privasi). Tampilannya memakai bahasa
 * visual dashboard admin (kartu putih, kanvas abu, aksen biru) tanpa toolbar
 * admin, karena halaman ini publik dan tidak butuh sesi login. Navigasi bagian
 * diambil dari judul yang sama dengan isi, jadi tidak ada daftar yang bisa basi.
 */
export default function DocumentShell({
  title,
  intro,
  facts,
  sections,
  current,
}: {
  title: string;
  intro: string;
  facts: DocFact[];
  sections: DocSection[];
  current: "/terms" | "/privacy";
}) {
  return (
    <div className="admin-theme min-h-screen bg-[var(--background)] font-sans text-[var(--foreground)] antialiased selection:bg-blue-600 selection:text-white">
      <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 pb-24 sm:p-6 lg:p-8">
        {/* 1. Header Banner */}
        <header className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xs md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-600 uppercase">
                Pusat Informasi
              </span>
              <span className="text-xs text-zinc-400">•</span>
              <span className="text-xs font-medium text-zinc-500">Readr Storefront</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">{title}</h1>
            <p className="mt-1 max-w-xl text-xs leading-relaxed font-normal text-zinc-600 sm:text-sm">
              {intro}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-xs transition-all hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-zinc-600" />
              <span>Kembali ke Toko</span>
            </Link>
          </div>
        </header>

        {/* 2. Ringkasan Fakta */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs transition-all hover:border-zinc-300 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-tight text-zinc-500">
                  {fact.label}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-2xs">
                  <Info className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-base font-bold tracking-tight break-words text-zinc-900 tabular-nums sm:text-lg">
                {fact.value}
              </div>
            </div>
          ))}
        </div>

        {/* 3. Isi Dokumen + Daftar Isi */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs">
            <div className="flex flex-row items-center justify-between border-b border-zinc-100 p-5 pb-4">
              <div>
                <h2 className="text-base font-bold tracking-tight text-zinc-900">
                  Isi {current === "/terms" ? "Ketentuan" : "Kebijakan"}
                </h2>
                <p className="mt-0.5 text-xs font-medium text-zinc-600">
                  {sections.length} bagian, ditulis dengan bahasa sehari-hari
                </p>
              </div>
            </div>

            <div className="divide-y divide-zinc-100">
              {sections.map((section, index) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-6 p-5 transition-colors hover:bg-zinc-50/70 sm:p-6"
                >
                  <h3 className="flex items-center gap-2.5 text-sm font-bold tracking-tight text-zinc-900">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-50 px-1.5 font-mono text-[11px] font-semibold text-blue-600 tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {section.title}
                  </h3>
                  <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-600 [&_a]:font-medium [&_a]:text-zinc-900 [&_a]:underline [&_a]:decoration-blue-500 [&_a]:decoration-2 [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-zinc-900 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
                    {section.body}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs">
              <h3 className="text-xs font-semibold tracking-tight text-zinc-600">Daftar Isi</h3>
              <nav aria-label="Daftar isi" className="mt-3 space-y-1">
                {sections.map((section, index) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100/80 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <span className="font-mono text-[10px] text-zinc-400 tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{section.title}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
                  </a>
                ))}
              </nav>
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs">
              <h3 className="text-xs font-semibold tracking-tight text-zinc-600">Dokumen Lain</h3>
              <div className="mt-3 space-y-1">
                {PAGES.map((page) => (
                  <Link
                    key={page.href}
                    href={page.href}
                    aria-current={page.href === current ? "page" : undefined}
                    className={
                      page.href === current
                        ? "flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-50 px-2.5 py-2 text-xs font-semibold text-blue-700"
                        : "flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100/80 hover:text-zinc-900"
                    }
                  >
                    <span>{page.label}</span>
                    <ChevronRight
                      className={
                        page.href === current ? "h-3.5 w-3.5 text-blue-500" : "h-3.5 w-3.5 text-zinc-300"
                      }
                    />
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 text-xs text-zinc-500 shadow-xs">
          <p>© {new Date().getFullYear()} Readr</p>
          <div className="flex gap-5">
            {PAGES.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="font-medium transition-colors hover:text-zinc-900"
              >
                {page.label}
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
