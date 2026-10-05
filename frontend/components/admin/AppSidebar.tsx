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
    <div className="flex h-full flex-col justify-between overflow-hidden">
      {/* Header Logo */}
      <div>
        <div className="flex h-16 items-center justify-between px-4 border-b border-[var(--border)]">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 shrink-0 font-bold text-[var(--foreground)]"
          >
            <div className="w-9 h-9 rounded-lg bg-[var(--primary)] flex items-center justify-center text-[var(--primary-foreground)] font-extrabold text-xl shadow-xs">
              G
            </div>
            {!collapsed && (
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-extrabold tracking-tight text-[var(--primary)]">
                  {siteConfig.brandName}
                </span>
                <span className="text-[10px] text-[var(--muted-foreground)] font-medium tracking-wider uppercase">
                  Admin Dashboard
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] cursor-pointer"
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
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
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
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all group relative border-l-4",
                      isActive
                        ? "bg-[var(--primary-soft)] text-[var(--primary)] font-semibold border-[var(--primary)]"
                        : "border-transparent text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "text-[var(--primary)]"
                          : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]"
                      )}
                    />
                    {!collapsed && (
                      <span className="flex-1 truncate">{item.title}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span
                        className={cn(
                          "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          typeof item.badge === "string"
                            ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                            : "bg-[var(--primary)] text-[var(--primary-foreground)]"
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
      <div className="border-t border-[var(--border)] p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-[var(--surface-muted)] cursor-pointer transition-colors">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={siteConfig.adminUser.avatar} alt={siteConfig.adminUser.name} />
                <AvatarFallback className="rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-bold">
                  RP
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate text-xs font-semibold text-[var(--foreground)]">
                      {siteConfig.adminUser.name}
                    </span>
                    <span className="truncate text-[10px] text-[var(--muted-foreground)]">
                      {siteConfig.adminUser.email}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mb-2">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-semibold">{siteConfig.adminUser.name}</p>
                <p className="text-[10px] text-slate-500">{siteConfig.adminUser.role}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/pengaturan" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Profil Akun</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/pengaturan" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Pengaturan Sistem</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
              onClick={() => {
                alert("Simulasi Logout berhasil.")
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
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
          "hidden md:flex flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-300 ease-in-out shrink-0 sticky top-0 h-screen",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-[var(--surface)] border-r border-[var(--border)] shadow-xl transition-transform duration-300 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>
    </>
  )
}
