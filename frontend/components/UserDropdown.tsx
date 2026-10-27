"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/AuthProvider";
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Package,
  ShoppingBag,
  LogOut,
  ShieldCheck,
  BookOpen,
  Compass,
  User,
  Coins,
} from "lucide-react";

export default function UserDropdown() {
  const router = useRouter();
  const { session, role, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center gap-2 pl-1 pr-2.5 py-1 bg-slate-100/70 border border-slate-200/60 rounded-full animate-pulse">
        <div className="w-7 h-7 bg-slate-200 rounded-full" />
        <div className="w-14 h-3 bg-slate-200 rounded hidden sm:block" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center gap-2 font-mono" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <Link
          href="/login"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
          className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-[#0052cc] hover:bg-[#0041a8] rounded-full transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer font-mono"
        >
          Masuk
        </Link>
        <Link
          href="/register"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
          className="hidden md:inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold text-gray-700 hover:text-[#0052cc] bg-gray-100 hover:bg-gray-200 rounded-full transition-all active:scale-95 cursor-pointer font-mono"
        >
          Daftar
        </Link>
      </div>
    );
  }

  const user = session.user;
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Pengguna";
  const email = user.email || "";
  // Gunakan foto profil kustom pengguna jika ada, atau fallback ke default shadcn avatar (https://github.com/shadcn.png)
  const avatarUrl =
    user.user_metadata?.avatar_url || "https://github.com/shadcn.png";

  const isAdmin = role === "admin";

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
          className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-2xs transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 cursor-pointer group active:scale-[0.98] font-mono"
          title="Menu Akun"
        >
          {/* Default Shadcn Avatar */}
          <Avatar className="h-7 w-7 border border-slate-200/80 transition-transform duration-200 group-hover:scale-105">
            <AvatarImage
              src={avatarUrl}
              alt={fullName}
              className="aspect-square h-full w-full object-cover"
            />
            <AvatarFallback className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <User className="w-3.5 h-3.5 text-slate-600" />
            </AvatarFallback>
          </Avatar>

          {/* User Name & Role Pill */}
          <div className="flex items-center gap-1.5 text-left">
            <span className="text-xs font-medium text-slate-700 max-w-21.25 sm:max-w-30 truncate tracking-tight group-hover:text-slate-900 transition-colors">
              {fullName}
            </span>

            {/* Professional Role Badge */}
            {isAdmin ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 transition-colors group-hover:bg-amber-100/70">
                <ShieldCheck className="w-2.5 h-2.5 text-amber-600" />
                Admin
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                Member
              </span>
            )}
          </div>

          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
        className="w-72 p-1.5 shadow-lg border border-slate-200/80 rounded-xl bg-white text-slate-900 font-mono"
      >
        {/* User Identity Header Card */}
        <DropdownMenuLabel className="p-2.5 font-normal bg-slate-50/80 rounded-lg mb-1 border border-slate-100">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-slate-200/80 shadow-2xs shrink-0">
              <AvatarImage
                src={avatarUrl}
                alt={fullName}
                className="aspect-square h-full w-full object-cover"
              />
              <AvatarFallback className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <User className="w-5 h-5 text-slate-600" />
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-900 truncate tracking-tight">
                {fullName}
              </span>
              <span
                className="text-[11px] text-slate-500 truncate tracking-tight mt-0.5"
                title={email}
              >
                {email}
              </span>
              <div className="mt-1.5">
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
                    <ShieldCheck className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>Administrator Toko</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Pelanggan Aktif</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-1 bg-slate-100" />

        {/* Role-Specific Actions */}
        {isAdmin ? (
          <>
            <DropdownMenuItem asChild>
              <Link
                href="/admin/dashboard"
                className="group flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-all duration-150 hover:bg-slate-100/80 focus:bg-slate-100/80 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center text-[#0052cc] group-hover:bg-blue-100/90 group-hover:scale-105 transition-all duration-150 shrink-0">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-800 group-hover:text-slate-950 transition-colors">
                      Dashboard Admin
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors">
                      Statistik & ringkasan toko
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shrink-0" />
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/admin/produk"
                className="group flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-all duration-150 hover:bg-slate-100/80 focus:bg-slate-100/80 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100/90 group-hover:scale-105 transition-all duration-150 shrink-0">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-800 group-hover:text-slate-950 transition-colors">
                      Kelola Katalog & Buku
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors">
                      Daftar produk, stok & harga
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shrink-0" />
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/admin/pesanan"
                className="group flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-all duration-150 hover:bg-slate-100/80 focus:bg-slate-100/80 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-100/90 group-hover:scale-105 transition-all duration-150 shrink-0">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-800 group-hover:text-slate-950 transition-colors">
                      Kelola Pesanan Masuk
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors">
                      Verifikasi & status pengiriman
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shrink-0" />
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link
                href="/orders"
                className="group flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-all duration-150 hover:bg-slate-100/80 focus:bg-slate-100/80 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center text-[#0052cc] group-hover:bg-blue-100/90 group-hover:scale-105 transition-all duration-150 shrink-0">
                    <ShoppingBag className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-800 group-hover:text-slate-950 transition-colors">
                      Pesanan Saya
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors">
                      Riwayat & status pesanan
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shrink-0" />
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/poin"
                className="group flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-all duration-150 hover:bg-slate-100/80 focus:bg-slate-100/80 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-100/90 group-hover:scale-105 transition-all duration-150 shrink-0">
                    <Coins className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-800 group-hover:text-slate-950 transition-colors">
                      Poin Saya
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors">
                      Saldo & riwayat poin
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shrink-0" />
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="#katalog"
                className="group flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-all duration-150 hover:bg-slate-100/80 focus:bg-slate-100/80 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100/90 group-hover:scale-105 transition-all duration-150 shrink-0">
                    <Compass className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-800 group-hover:text-slate-950 transition-colors">
                      Jelajahi Katalog
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors">
                      Lihat semua koleksi buku
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shrink-0" />
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator className="my-1 bg-slate-100" />

        {/* Sign Out Button with Micro-interaction */}
        <DropdownMenuItem
          onClick={handleSignOut}
          className="group flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all duration-150 cursor-pointer focus:bg-red-50 focus:text-red-700"
        >
          <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center text-red-500 group-hover:bg-red-100/80 transition-colors shrink-0">
            <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform duration-150" />
          </div>
          <span className="font-medium">Keluar dari Akun</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
