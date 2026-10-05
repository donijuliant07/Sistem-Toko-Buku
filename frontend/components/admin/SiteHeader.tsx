"use client"

import * as React from "react"
import { Menu, Search, Bell, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb"
import { ThemeToggle } from "@/components/admin/ThemeToggle"
import { CommandSearchDialog } from "@/components/admin/CommandSearchDialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SiteHeaderProps {
  onToggleMobileMenu: () => void
}

export function SiteHeader({ onToggleMobileMenu }: SiteHeaderProps) {
  const [searchOpen, setSearchOpen] = React.useState(false)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 text-slate-600"
            onClick={onToggleMobileMenu}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Buka Navigasi</span>
          </Button>

          {/* Breadcrumb */}
          <div className="hidden sm:block">
            <AdminBreadcrumb />
          </div>
        </div>

        {/* Action Right: Global Search, Notification, Theme, Storefront Link */}
        <div className="flex items-center gap-2">
          {/* Global Search Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-44 sm:w-64 items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-400 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span className="truncate">Cari di toko...</span>
            </div>
            <kbd className="hidden sm:inline-block rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              ⌘K
            </kbd>
          </button>

          {/* Notification Menu with Badge */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-red-600 ring-2 ring-white dark:ring-slate-900" />
                <span className="sr-only">Notifikasi</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-2">
              <DropdownMenuLabel className="flex items-center justify-between text-xs font-semibold">
                <span>Notifikasi</span>
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold">
                  3 Baru
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="space-y-1 py-1">
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-2 text-xs cursor-pointer">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Pesanan Baru #ORD-001</span>
                    <span className="text-[10px] text-slate-400">5m lalu</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">Ahmad Fauzi melakukan checkout Rp191.950</p>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-2 text-xs cursor-pointer">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-red-600 dark:text-red-400">Peringatan Stok</span>
                    <span className="text-[10px] text-slate-400">20m lalu</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">Atomic Habits tersisa 4 eksemplar</p>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-2 text-xs cursor-pointer">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Pembayaran Sukses</span>
                    <span className="text-[10px] text-slate-400">1j lalu</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">Budi Santoso telah membayar via QRIS</p>
                </DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="justify-center text-center text-xs font-semibold text-blue-600">
                <Link href="/admin/pesanan">Lihat Semua Notifikasi</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* View Public Storefront */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden lg:flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"
          >
            <Link href="/" target="_blank">
              <span>Buka Toko</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </header>

      <CommandSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
