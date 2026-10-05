"use client";

import { siteConfig } from "@/config/site";

export default function FloatingCS() {
  const waUrl = `https://wa.me/${siteConfig.whatsappNumber}?text=Halo%20Gramedia,%20saya%20butuh%20bantuan%20pesanan.`;

  return (
    <aside aria-label="Customer Service">
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hubungi Customer Service lewat WhatsApp"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-[#25d366] hover:bg-[#20ba59] text-white px-4 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 group"
      >
        <span className="text-xl leading-none">💬</span>
        <div className="flex flex-col text-left">
          <span className="text-[10px] uppercase font-bold tracking-wider leading-none text-emerald-100">
            Butuh Bantuan?
          </span>
          <span className="text-xs font-extrabold leading-tight">
            Chat WhatsApp
          </span>
        </div>
      </a>
    </aside>
  );
}
