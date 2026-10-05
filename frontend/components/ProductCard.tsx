import { Product } from "@/data/mockData";

export function formatRupiah(num: number | string) {
  const value = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(value)) return "Rp0";
  // If price stored as small number ($/units), normalize to IDR roughly
  const idr = value < 500 ? value * 15000 : value;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(idr);
}

interface ProductCardProps {
  product: Product;
  aspectRatio?: "square" | "book";
}

export default function ProductCard({
  product,
  aspectRatio = "book",
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

  return (
    <div className="group bg-white rounded-xl border border-gray-100 p-3 flex flex-col justify-between hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full">
      <div>
        {/* Cover / Image Box */}
        <div
          className={`relative w-full rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center mb-3 ${
            isBook ? "aspect-[2/3]" : "aspect-square"
          }`}
        >
          {product.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.coverUrl}
              alt={product.title}
              className="w-full h-full object-contain p-2"
              loading="lazy"
            />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${bgGradient} text-white p-3 flex flex-col justify-between relative shadow-inner`}
            >
              <div className="text-[10px] font-bold tracking-widest opacity-60">
                GRAMEDIA
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

          {/* Language Badge */}
          {product.badgeLanguage && (
            <span className="absolute top-2 right-2 bg-gray-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              {product.badgeLanguage}
            </span>
          )}

          {/* Discount Badge */}
          {product.discountPercent && product.discountPercent > 0 && (
            <span className="absolute top-2 left-2 bg-[#e61c24] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-sm">
              {product.discountPercent}%
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

      {/* Pricing & Sales */}
      <div className="mt-3 pt-2 border-t border-gray-50">
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
        {product.soldCount ? (
          <span className="text-[10px] text-gray-400 mt-1 block">
            {product.soldCount > 1000
              ? `${(product.soldCount / 1000).toFixed(1)}rb+ terjual`
              : `${product.soldCount}+ terjual`}
          </span>
        ) : null}
      </div>
    </div>
  );
}
