"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingCart,
  BookOpen,
  Boxes,
  Users,
  Tag,
  Image as ImageIcon,
  MessageSquare,
  BarChart3,
  TrendingUp,
  Settings,
  HelpCircle,
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
      { title: "Pesanan", href: "/admin/pesanan", icon: ShoppingCart, badge: 5 },
      { title: "Produk", href: "/admin/produk", icon: BookOpen },
      { title: "Inventori / Stok", href: "/admin/inventori", icon: Boxes, badge: "3 Kritis" },
      { title: "Pelanggan", href: "/admin/pelanggan", icon: Users },
    ],
  },
  {
    label: "Pemasaran",
    items: [
      { title: "Promo & Voucher", href: "/admin/promo", icon: Tag },
      { title: "Link Harga Marketplace", href: "/admin/marketplace-sources", icon: Link2 },
      { title: "Banner Toko", href: "/admin/promo#banner", icon: ImageIcon },
      { title: "Ulasan Produk", href: "/admin/produk#ulasan", icon: MessageSquare },
    ],
  },
  {
    label: "Laporan",
    items: [
      { title: "Laporan Penjualan", href: "/admin/laporan", icon: BarChart3 },
      { title: "Produk Terlaris", href: "/admin/laporan#terlaris", icon: TrendingUp },
    ],
  },
  {
    label: "Sistem",
    items: [
      { title: "Poin & Reward", href: "/admin/rewards", icon: Coins },
      { title: "Pengaturan", href: "/admin/pengaturan", icon: Settings },
      { title: "Bantuan & CS", href: "/admin/pengaturan#bantuan", icon: HelpCircle },
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
        <div className="space-y-6 px-3 py-4 overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-none">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href))
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
                <AvatarImage src={siteConfig.adminUser.avatar} alt={siteConfig.adminUser.name} />
                <AvatarFallback className="rounded-xl bg-zinc-100 text-zinc-800 text-xs font-bold">
                  RP
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate text-xs font-semibold text-zinc-900">
                      {siteConfig.adminUser.name}
                    </span>
                    <span className="truncate text-[10px] text-zinc-500">
                      {siteConfig.adminUser.email}
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
                <p className="text-xs font-semibold text-zinc-900">{siteConfig.adminUser.name}</p>
                <p className="text-[10px] text-zinc-500">{siteConfig.adminUser.role}</p>
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
              onClick={() => {
                alert("Simulasi Logout berhasil.")
              }}
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
          "hidden md:flex flex-col border-r border-zinc-200/80 bg-white transition-all duration-300 ease-in-out shrink-0 sticky top-0 h-screen",
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
          "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-zinc-200/80 shadow-xl transition-transform duration-300 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>
    </>
  )
}
