"use client";

import Link from "next/link";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/components/AuthProvider";
import { Sparkles, ShieldCheck } from "lucide-react";

export default function TopBar() {
  const { session, role } = useAuth();
  const user = session?.user;
  const fullName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0];

  return (
    <div className="bg-[#f8f9fa] border-b border-gray-200/80 text-[11px] text-gray-600">
      <div className="max-w-[1200px] mx-auto px-4 h-8 flex items-center justify-between">
        {/* Left: Tagline or User Greeting */}
        <div className="flex items-center gap-2 text-gray-500 truncate">
          {session ? (
            role === "admin" ? (
              <span className="flex items-center gap-1.5 text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Administrator Toko: <strong className="font-semibold text-amber-900">{fullName}</strong></span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-gray-700">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  Selamat datang kembali, <strong className="font-semibold text-gray-900">{fullName}</strong>!
                </span>
                <span className="hidden md:inline text-gray-400">|</span>
                <span className="hidden md:inline text-gray-500">Nikmati promo & gratis ongkir pilihan hari ini</span>
              </span>
            )
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{siteConfig.tagline}</span>
            </span>
          )}
        </div>

        {/* Right: Quick Links */}
        <div className="flex items-center gap-3 sm:gap-4 ml-auto shrink-0">
          {siteConfig.topBarLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="hover:text-[#0052cc] transition-colors py-0.5 px-1 rounded hover:bg-gray-100 text-gray-600"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
