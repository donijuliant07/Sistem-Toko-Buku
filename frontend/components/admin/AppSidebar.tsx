"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingCart,
  Wallet,
  BookOpen,
  Boxes,
  Users,
  Tag,
  BarChart3,
  Settings,
  ChevronDown,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Library,
  Link2,
  Coins,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { siteConfig } from "@/config/site"
import { useAuth } from "@/components/AuthProvider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface AppSidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | number
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "Utama",
    items: [
      { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      // Tanpa badge: jumlahnya hanya bisa diketahui dari API, dan angka tetap
      // yang ditulis di sini akan berbohong saat data berubah.
      { title: "Pesanan", href: "/admin/pesanan", icon: ShoppingCart },
      { title: "Verifikasi Pembayaran", href: "/admin/pembayaran", icon: Wallet },
      { title: "Produk", href: "/admin/produk", icon: BookOpen },
      { title: "Inventori / Stok", href: "/admin/inventori", icon: Boxes },
      { title: "Pelanggan", href: "/admin/pelanggan", icon: Users },
    ],
  },
  {
    label: "Pemasaran",
    items: [
      { title: "Promo & Voucher", href: "/admin/promo", icon: Tag },
      { title: "Link Harga Marketplace", href: "/admin/marketplace-sources", icon: Link2 },
    ],
  },
  {
    label: "Laporan",
    items: [
      { title: "Laporan Penjualan", href: "/admin/laporan", icon: BarChart3 },
    ],
  },
  {
    label: "Sistem",
    items: [
      { title: "Poin & Reward", href: "/admin/rewards", icon: Coins },
      { title: "Pengaturan", href: "/admin/pengaturan", icon: Settings },
    ],
  },
]

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { session, signOut } = useAuth()

  // Identitas diambil dari sesi yang sedang login, bukan dari `siteConfig`
  // (yang berisi nama pemilik toko fiktif untuk halaman statis).
  const adminName =
    (session?.user.user_metadata?.full_name as string | undefined) ||
    (session?.user.user_metadata?.name as string | undefined) ||
    session?.user.email?.split("@")[0] ||
    "Administrator"
  const adminEmail = session?.user.email ?? ""
  const adminRole = "Administrator"

  const handleSignOut = async () => {
    try {
      await signOut()
      router.replace("/login")
    } catch (error) {
      console.error("Gagal keluar", error)
    }
  }

  // Tanda aktif hanya untuk halaman itu sendiri, bukan `#anchor` di halaman
  // yang sama — dua menu dengan path sama akan tampak aktif bersamaan.
  const activeBase = (href: string) => href.split("#")[0]

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-hidden bg-white">
      {/* Header Logo */}
      <div>
        <div className="flex h-16 items-center justify-between px-4 border-b border-zinc-200/80">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2.5 shrink-0 font-bold text-zinc-900"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-white font-bold text-base shadow-xs">
              <Library className="h-4.5 w-4.5 text-zinc-100" />
            </div>
            {!collapsed && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-zinc-900">
                  {siteConfig.brandName}
                </span>
                <span className="rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-bold px-1.5 py-0.5 tracking-wider uppercase">
                  PRO
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer transition-colors"
            title={collapsed ? "Buka Sidebar" : "Ciutkan Sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav Items */}
        <div className="space-y-6 px-3 py-4 overflow-y-auto max-h-[calc(100dvh-140px)] scrollbar-none">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const base = activeBase(item.href)
                const isActive = pathname === base || (base !== "/admin/dashboard" && pathname.startsWith(base))
                const Icon = item.icon

                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all group relative",
                      isActive
                        ? "bg-zinc-900 text-white shadow-xs"
                        : "text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "!text-white text-white"
                          : "text-zinc-400 group-hover:text-zinc-700"
                      )}
                    />
                    {!collapsed && (
                      <span
                        className={cn(
                          "flex-1 truncate tracking-tight font-medium",
                          isActive ? "!text-white text-white" : "text-zinc-600 group-hover:text-zinc-900"
                        )}
                      >
                        {item.title}
                      </span>
                    )}
                    {!collapsed && item.badge && (
                      <span
                        className={cn(
                          "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                          typeof item.badge === "string"
                            ? "bg-rose-50 text-rose-600 border border-rose-200/60"
                            : isActive
                            ? "bg-white/20 !text-white text-white"
                            : "bg-zinc-100 text-zinc-700 border border-zinc-200/60"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer User Profile */}
      <div className="border-t border-zinc-200/80 p-3 bg-white">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-zinc-100/80 cursor-pointer transition-colors">
              <Avatar className="h-8 w-8 rounded-xl ring-1 ring-zinc-200/80">
                <AvatarImage src={siteConfig.adminUser.avatar} alt={adminName} />
                <AvatarFallback className="rounded-xl bg-zinc-100 text-zinc-800 text-xs font-bold">
                  {adminName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate text-xs font-semibold text-zinc-900">
                      {adminName}
                    </span>
                    <span className="truncate text-[10px] text-zinc-500">
                      {adminEmail}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mb-2 bg-white text-zinc-800 border-zinc-200/80 shadow-lg rounded-xl">
            <DropdownMenuLabel className="font-normal p-3">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-semibold text-zinc-900">{adminName}</p>
                <p className="text-[10px] text-zinc-500">{adminRole}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-zinc-100" />
            <DropdownMenuItem asChild>
              <Link href="/admin/pengaturan" className="flex items-center gap-2 text-xs text-zinc-700 hover:bg-zinc-100/80 rounded-lg cursor-pointer">
                <User className="h-4 w-4 text-zinc-500" />
                <span>Profil Akun</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/pengaturan" className="flex items-center gap-2 text-xs text-zinc-700 hover:bg-zinc-100/80 rounded-lg cursor-pointer">
                <Settings className="h-4 w-4 text-zinc-500" />
                <span>Pengaturan Sistem</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-100" />
            <DropdownMenuItem
              className="text-xs cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50 rounded-lg"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2 text-rose-500" />
              <span>Keluar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Inset Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-zinc-200/80 bg-white transition-all duration-300 ease-in-out shrink-0 sticky top-0 h-dvh",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/30 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-zinc-200/80 shadow-xl transition-transform duration-300 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>
    </>
  )
}
