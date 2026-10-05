"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"

export function AdminBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  const labelMap: Record<string, string> = {
    admin: "Admin",
    dashboard: "Dashboard",
    produk: "Produk",
    pesanan: "Pesanan",
    pelanggan: "Pelanggan",
    inventori: "Inventori & Stok",
    promo: "Promo & Voucher",
    laporan: "Laporan Penjualan",
    pengaturan: "Pengaturan Toko",
  }

  if (segments.length <= 1) {
    return (
      <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs text-[var(--muted-foreground)]">
        <Home className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
        <ChevronRight className="h-3 w-3 text-[var(--border-strong)]" />
        <span className="font-semibold text-[var(--foreground)]">Dashboard</span>
      </nav>
    )
  }

  const breadcrumbs = segments.slice(1).map((seg, idx) => {
    const href = "/admin/" + segments.slice(1, idx + 2).join("/")
    const isLast = idx === segments.length - 2
    const label = labelMap[seg] || seg

    return { href, label, isLast }
  })

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs text-[var(--muted-foreground)]">
      <Link href="/admin/dashboard" className="hover:text-[var(--primary)]">
        <Home className="h-3.5 w-3.5 text-[var(--muted-foreground)] hover:text-[var(--primary)]" />
      </Link>
      {breadcrumbs.map((item) => (
        <React.Fragment key={item.href}>
          <ChevronRight className="h-3 w-3 text-[var(--border-strong)] shrink-0" />
          {item.isLast ? (
            <span className="font-semibold text-[var(--foreground)]">{item.label}</span>
          ) : (
            <Link href={item.href} className="hover:text-[var(--primary)]">
              {item.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
