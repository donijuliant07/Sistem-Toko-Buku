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
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2.5 bg-[#25d366] hover:bg-[#20ba59] px-4 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 group select-none text-left cursor-pointer"
      >
        {/* Chat bubble icon */}
        <div className="w-6 h-6 rounded-full bg-white/95 flex items-center justify-center shrink-0 shadow-xs">
          <svg
            className="w-4 h-4 fill-[#25d366]"
            viewBox="0 0 24 24"
          >
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.63C8.75 21.41 10.38 21.82 12.04 21.82C17.5 21.82 21.95 17.37 21.95 11.91C21.95 6.45 17.5 2 12.04 2ZM12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.82L4.43 19.64L5.27 16.6L5.07 16.29C4.24 14.97 3.81 13.46 3.81 11.91C3.81 7.37 7.5 3.68 12.04 3.68C16.58 3.68 20.27 7.37 20.27 11.91C20.27 16.45 16.58 20.15 12.04 20.15Z" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] uppercase font-bold tracking-wider leading-tight text-white drop-shadow-xs">
            BUTUH BANTUAN?
          </span>
          <span className="text-sm font-extrabold text-[#111b21] leading-tight">
            Chat WhatsApp
          </span>
        </div>
      </a>
    </aside>
  );
}
