import Link from "next/link";
import type { ReactNode } from "react";

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
 * Kerangka halaman dokumen (ketentuan, privasi). Navigasi bagian diambil dari
 * judul yang sama dengan isi, jadi tidak ada daftar yang bisa basi.
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
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface-muted">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 lg:py-14">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <span aria-hidden="true">←</span> Readr
          </Link>

          <h1 className="mt-6 max-w-[22ch] font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            {title}
          </h1>
          <div className="mt-5 h-px w-16 bg-accent" aria-hidden="true" />
          <p className="mt-5 max-w-[62ch] text-[15px] leading-7 text-muted-foreground">{intro}</p>

          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-xs">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-muted-foreground">{fact.label}</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <nav aria-label="Dokumen lain" className="mt-8 flex gap-5 text-xs">
            {PAGES.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                aria-current={page.href === current ? "page" : undefined}
                className={
                  page.href === current
                    ? "font-semibold text-foreground underline decoration-accent decoration-2 underline-offset-4"
                    : "text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {page.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-10 sm:px-8 lg:grid-cols-[13rem_1fr] lg:gap-16 lg:py-14">
        <nav aria-label="Daftar isi" className="lg:sticky lg:top-8 lg:self-start">
          <details className="group lg:hidden" open>
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground marker:content-none">
              Daftar isi
            </summary>
            <ol className="mt-3 space-y-2 border-l border-border pl-4 text-sm">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>

          <ol className="hidden space-y-2.5 border-l border-border pl-4 text-sm lg:block">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="mr-2 tabular-nums text-muted-foreground/70">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-[68ch]">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-8 border-b border-border pb-8 [&:not(:last-child)]:mb-8 last:border-b-0 last:pb-0"
            >
              <h2 className="flex items-baseline gap-3 text-lg font-semibold tracking-tight">
                <span className="font-mono text-xs font-normal tabular-nums text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:decoration-accent [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
                {section.body}
              </div>
            </section>
          ))}
        </article>
      </div>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground sm:px-8">
          <p>© {new Date().getFullYear()} Readr</p>
          <div className="flex gap-5">
            {PAGES.map((page) => (
              <Link key={page.href} href={page.href} className="hover:text-foreground">
                {page.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}