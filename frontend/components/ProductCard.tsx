import { Product } from "@/data/mockData";
import { Star, Eye } from "lucide-react";

export function formatRupiah(num: number | string) {
  const value = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(value)) return "Rp0";
  // Semua harga di database sudah dalam Rupiah; tidak ada konversi mata uang.
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

interface ProductCardProps {
  product: Product;
  aspectRatio?: "square" | "book";
  onSelect?: (product: Product) => void;
}

export default function ProductCard({
  product,
  aspectRatio = "book",
  onSelect,
}: ProductCardProps) {
  const isBook = aspectRatio === "book" || product.type === "book";

  // Fallback visual gradients for covers
  const hues = [
    "from-slate-800 to-indigo-950",
    "from-rose-900 to-stone-900",
    "from-emerald-900 to-teal-950",
    "from-amber-900 to-neutral-900",
    "from-cyan-950 to-blue-900",
  ];
  const hash = product.title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const bgGradient = hues[hash % hues.length];

  const isOutOfStock = product.stock !== undefined && product.stock === 0;
  const isLowStock = product.stock !== undefined && product.stock > 0 && product.stock <= 5;

  return (
    <div
      onClick={() => onSelect?.(product)}
      className="group bg-white rounded-xl border border-gray-100 p-3 flex flex-col justify-between hover:shadow-lg hover:border-blue-100 hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full relative"
    >
      <div>
        {/* Cover / Image Box */}
        <div
          className={`relative w-full rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center mb-3 group-hover:shadow-inner transition-all ${
            isBook ? "aspect-[2/3]" : "aspect-square"
          }`}
        >
          {product.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.coverUrl}
              alt={product.title}
              className={`w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105 ${
                isOutOfStock ? "grayscale opacity-60" : ""
              }`}
              loading="lazy"
            />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${bgGradient} text-white p-3 flex flex-col justify-between relative shadow-inner`}
            >
              <div className="text-[10px] font-bold tracking-widest opacity-60">
                READR
              </div>
              <div>
                <span className="text-xl font-black block mb-1 opacity-40">
                  {product.title.slice(0, 2).toUpperCase()}
                </span>
                <p className="text-[11px] font-bold leading-tight line-clamp-2">
                  {product.title}
                </p>
              </div>
            </div>
          )}

          {/* Out of Stock Overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-10">
              <span className="bg-red-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-sm">
                Habis
              </span>
            </div>
          )}

          {/* Quick View Button on Hover */}
          {!isOutOfStock && (
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <span className="bg-white/95 text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                <Eye className="w-3.5 h-3.5 text-[#0052cc]" />
                Lihat Buku
              </span>
            </div>
          )}

          {/* Language Badge */}
          {product.badgeLanguage && (
            <span className="absolute top-2 right-2 bg-gray-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-10">
              {product.badgeLanguage}
            </span>
          )}

          {/* Discount Badge */}
          {product.discountPercent && product.discountPercent > 0 && !isOutOfStock && (
            <span className="absolute top-2 left-2 bg-[#e61c24] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-xs z-10">
              {product.discountPercent}%
            </span>
          )}

          {/* Low Stock Urgent Badge */}
          {isLowStock && (
            <span className="absolute bottom-2 left-2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs z-10 animate-pulse">
              Sisa {product.stock}!
            </span>
          )}
        </div>

        {/* Info */}
        <span className="text-[11px] text-gray-500 font-medium block truncate mb-1">
          {product.authorOrBrand}
        </span>
        <h4 className="text-xs sm:text-sm font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-[#0052cc] transition-colors">
          {product.title}
        </h4>
      </div>

      {/* Pricing & Ratings */}
      <div className="mt-3 pt-2 border-t border-gray-100">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm sm:text-base font-bold text-[#0052cc]">
            {formatRupiah(product.price)}
          </span>
          {product.originalPrice && (
            <span className="text-[11px] text-gray-400 line-through">
              {formatRupiah(product.originalPrice)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-500">
          <div className="flex items-center gap-1">
            {product.rating ? (
              <>
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="font-semibold text-gray-700">{product.rating.toFixed(1)}</span>
              </>
            ) : (
              <span className="text-gray-400">Belum ada ulasan</span>
            )}
          </div>
          {product.soldCount ? (
            <span>
              {product.soldCount > 1000
                ? `${(product.soldCount / 1000).toFixed(1)}rb+ terjual`
                : `${product.soldCount}+ terjual`}
            </span>
          ) : (
            <span>Tersedia</span>
          )}
        </div>
      </div>
    </div>
  );
}
