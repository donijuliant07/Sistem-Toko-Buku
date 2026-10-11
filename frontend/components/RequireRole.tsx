"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

/**
 * Guard sisi klien untuk halaman yang hanya boleh diakses satu role.
 *
 * Ini lapisan UX saja — penolakan yang mengikat ada di backend (dependency
 * `require_user`/`require_admin`) dan RLS. Tujuannya mencegah admin membuka
 * alur pelanggan (checkout/pesanan) dan sebaliknya, tanpa mengandalkan
 * `localStorage` atau state yang bisa dimanipulasi.
 */
export default function RequireRole({
  role,
  children,
}: {
  role: "admin" | "user";
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, role: currentRole, roleLoading, loading } = useAuth();

  const waiting = loading || (!!session && roleLoading);

  useEffect(() => {
    if (waiting) return;
    if (!session) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (currentRole !== role) {
      // Admin yang membuka alur pelanggan dikembalikan ke dashboard-nya.
      router.replace(currentRole === "admin" ? "/admin/dashboard" : "/");
    }
  }, [waiting, session, currentRole, role, router, pathname]);

  if (waiting || !session || currentRole !== role) {
    return (
      <div className="flex items-center justify-center py-28">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return <>{children}</>;
}
