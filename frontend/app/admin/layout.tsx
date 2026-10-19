"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { AppSidebar } from "@/components/admin/AppSidebar"
import { SiteHeader } from "@/components/admin/SiteHeader"
import AccessDenied from "@/components/AccessDenied"
import { useAuth } from "@/components/AuthProvider"
import { Toaster } from "sonner"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const router = useRouter()
  const pathname = usePathname()
  const { session, role, roleLoading, loading } = useAuth()

  // Satu guard untuk seluruh 9 route /admin/*. Hanya UX: penolakan yang
  // mengikat tetap di backend (`require_admin`) dan RLS.
  const waiting = loading || (!!session && roleLoading)

  React.useEffect(() => {
    if (waiting) return
    if (!session) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    }
  }, [waiting, session, router, pathname])

  if (waiting) {
    return (
      <div className="admin-theme flex min-h-screen items-center justify-center bg-[#F4F5F7]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="admin-theme flex min-h-screen items-center justify-center bg-[#F4F5F7]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (role !== "admin") {
    return (
      <AccessDenied
        message="Halaman ini khusus untuk administrator toko. Akun Anda tidak memiliki hak akses admin."
      />
    )
  }

  return (
    <div className="admin-theme flex min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans antialiased selection:bg-zinc-900 selection:text-white">
      <AppSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <SiteHeader onToggleMobileMenu={() => setMobileOpen(!mobileOpen)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  )
}
