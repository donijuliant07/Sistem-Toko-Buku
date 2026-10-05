import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function TopBar() {
  return (
    <div className="bg-[#f8f9fa] border-b border-gray-200 text-xs text-gray-600">
      <div className="max-w-[1200px] mx-auto px-4 h-8 flex items-center justify-between">
        <div className="hidden sm:flex items-center gap-2 text-gray-500">
          <span>{siteConfig.tagline}</span>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          {siteConfig.topBarLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="hover:text-[#0052cc] transition-colors py-0.5 px-1.5 rounded hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
