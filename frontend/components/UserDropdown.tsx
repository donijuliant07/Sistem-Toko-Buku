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
  LayoutDashboard,
  Package,
  ShoppingBag,
  LogOut,
  ShieldCheck,
  BookOpen,
  Compass,
} from "lucide-react";

export default function UserDropdown() {
  const router = useRouter();
  const { session, role, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 animate-pulse bg-gray-100 rounded-full">
        <div className="w-7 h-7 bg-gray-200 rounded-full" />
        <div className="w-16 h-3 bg-gray-200 rounded hidden sm:block" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-[#0052cc] hover:bg-[#0041a8] rounded-full transition-all shadow-sm hover:shadow active:scale-95"
        >
          Masuk
        </Link>
        <Link
          href="/register"
          className="hidden md:inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold text-gray-700 hover:text-[#0052cc] bg-gray-100 hover:bg-gray-200 rounded-full transition-all active:scale-95"
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
  const avatarUrl = user.user_metadata?.avatar_url || "";
  const initials =
    fullName
      .split(" ")
      .map((part: string) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

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
          className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 transition-all focus:outline-none focus:ring-2 focus:ring-[#0052cc]/20 cursor-pointer group"
          title="Akun Saya"
        >
          {/* Avatar Identifier */}
          <Avatar className="h-7 w-7 ring-2 ring-white shadow-xs">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
            <AvatarFallback
              className={`text-[11px] font-bold text-white ${
                isAdmin
                  ? "bg-gradient-to-tr from-amber-600 to-indigo-600"
                  : "bg-gradient-to-tr from-blue-600 to-teal-500"
              }`}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* User Name & Role Pill */}
          <div className="flex items-center gap-1.5 text-left">
            <span className="text-xs font-semibold text-gray-800 max-w-[90px] sm:max-w-[120px] truncate group-hover:text-[#0052cc] transition-colors">
              {fullName}
            </span>

            {/* Role Badge Indicator */}
            {isAdmin ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <ShieldCheck className="w-2.5 h-2.5 text-amber-600" />
                Admin
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                Member
              </span>
            )}
          </div>

          <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-1.5 shadow-xl border border-gray-200/80 rounded-xl bg-white">
        {/* User Identity Header Card */}
        <DropdownMenuLabel className="p-2 font-normal bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-lg mb-1 border border-gray-100">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-white shadow-xs">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
              <AvatarFallback
                className={`text-xs font-bold text-white ${
                  isAdmin
                    ? "bg-gradient-to-tr from-amber-600 to-indigo-600"
                    : "bg-gradient-to-tr from-blue-600 to-teal-500"
                }`}
              >
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-gray-900 truncate flex items-center gap-1.5">
                {fullName}
              </span>
              <span className="text-[11px] text-gray-500 truncate" title={email}>
                {email}
              </span>
              <span
                className={`inline-block self-start mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  isAdmin
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                }`}
              >
                {isAdmin ? "🛡️ Administrator Toko" : "🛍️ Pelanggan Aktif"}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-1 bg-gray-100" />

        {/* Role-Specific Actions */}
        {isAdmin ? (
          <>
            <DropdownMenuItem asChild>
              <Link
                href="/admin/dashboard"
                className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-gray-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4 text-[#0052cc]" />
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-800">Dashboard Admin</span>
                  <span className="text-[10px] text-gray-500">Statistik & ringkasan toko</span>
                </div>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/admin/produk"
                className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-gray-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>Kelola Katalog & Buku</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/admin/pesanan"
                className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-gray-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              >
                <Package className="w-4 h-4 text-purple-600" />
                <span>Kelola Pesanan Masuk</span>
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link
                href="/orders"
                className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-gray-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-[#0052cc]" />
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-800">Pesanan Saya</span>
                  <span className="text-[10px] text-gray-500">Riwayat & status pengiriman</span>
                </div>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="#katalog"
                className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-gray-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-800">Jelajahi Katalog</span>
                  <span className="text-[10px] text-gray-500">Lihat semua koleksi buku</span>
                </div>
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator className="my-1 bg-gray-100" />

        {/* Sign Out Button */}
        <DropdownMenuItem
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-red-500" />
          <span>Keluar dari Akun</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
