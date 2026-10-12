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
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 rounded-xl text-zinc-700 hover:bg-zinc-100"
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
            className="flex h-9 w-44 sm:w-64 items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/70 hover:bg-zinc-100/70 hover:border-zinc-300 px-3 text-xs text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 cursor-pointer transition-all shadow-2xs"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 text-zinc-400" />
              <span className="truncate">Cari di toko...</span>
            </div>
            <kbd className="hidden sm:inline-block rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 shadow-2xs">
              ⌘K
            </kbd>
          </button>

          {/* Notification Menu with Badge */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
                <span className="sr-only">Notifikasi</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-2 rounded-2xl border-zinc-200/80 shadow-lg bg-white">
              <DropdownMenuLabel className="flex items-center justify-between text-xs font-semibold px-2 py-1.5">
                <span className="text-zinc-900">Notifikasi</span>
                <span className="rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold">
                  3 Baru
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-100" />
              <div className="space-y-1 py-1">
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-2 text-xs rounded-xl cursor-pointer hover:bg-zinc-50">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-zinc-900">Pesanan Baru #ORD-001</span>
                    <span className="text-[10px] text-zinc-400">5m lalu</span>
                  </div>
                  <p className="text-zinc-500 text-[11px]">Ahmad Fauzi melakukan checkout Rp191.950</p>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-2 text-xs rounded-xl cursor-pointer hover:bg-zinc-50">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-rose-600">Peringatan Stok</span>
                    <span className="text-[10px] text-zinc-400">20m lalu</span>
                  </div>
                  <p className="text-zinc-500 text-[11px]">Atomic Habits tersisa 4 eksemplar</p>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-2 text-xs rounded-xl cursor-pointer hover:bg-zinc-50">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-emerald-600">Pembayaran Sukses</span>
                    <span className="text-[10px] text-zinc-400">1j lalu</span>
                  </div>
                  <p className="text-zinc-500 text-[11px]">Budi Santoso telah membayar via QRIS</p>
                </DropdownMenuItem>
              </div>
              <DropdownMenuSeparator className="bg-zinc-100" />
              <DropdownMenuItem asChild className="justify-center text-center text-xs font-semibold text-zinc-900 hover:bg-zinc-100 rounded-xl cursor-pointer">
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
            className="hidden lg:flex items-center gap-1.5 text-xs border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 rounded-xl font-medium shadow-2xs transition-all"
          >
            <Link href="/" target="_blank">
              <span>Buka Toko</span>
              <ExternalLink className="h-3 w-3 text-zinc-400" />
            </Link>
          </Button>
        </div>
      </header>

      <CommandSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
