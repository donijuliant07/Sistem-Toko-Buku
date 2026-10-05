"use client"

import * as React from "react"
import { AppSidebar } from "@/components/admin/AppSidebar"
import { SiteHeader } from "@/components/admin/SiteHeader"
import FloatingCS from "@/components/FloatingCS"
import { Toaster } from "sonner"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="flex min-h-screen bg-[var(--surface-muted)] text-[var(--foreground)] font-sans">
      <AppSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <SiteHeader onToggleMobileMenu={() => setMobileOpen(!mobileOpen)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
      <FloatingCS />
      <Toaster position="top-right" richColors />
    </div>
  )
}
