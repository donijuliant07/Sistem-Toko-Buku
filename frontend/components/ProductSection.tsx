import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/data/mockData";

interface SideBannerInfo {
  title: string;
  subtitle: string;
  tag: string;
  bgGradient: string;
  href?: string;
}

interface ProductSectionProps {
  id?: string;
  title: string;
  seeAllHref?: string;
  products: Product[];
  sideBanner?: SideBannerInfo;
  cardAspect?: "square" | "book";
  onSelectProduct?: (product: Product) => void;
}

export default function ProductSection({
  id,
  title,
  seeAllHref = "#katalog",
  products,
  sideBanner,
  cardAspect = "book",
  onSelectProduct,
}: ProductSectionProps) {
  return (
    <section id={id} className="max-w-[1200px] mx-auto px-4 py-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
          {title}
        </h3>
        <Link
          href={seeAllHref}
          className="text-xs sm:text-sm font-semibold text-[#0052cc] hover:underline flex items-center gap-1"
        >
          Lihat Semua
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Main Content Layout */}
      {sideBanner ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Side Thematic Banner */}
          <div
            className={`lg:col-span-3 rounded-2xl p-6 text-white bg-gradient-to-br ${sideBanner.bgGradient} flex flex-col justify-between shadow-sm min-h-[220px] lg:min-h-auto`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-black/25 text-amber-300 tracking-wider">
                {sideBanner.tag}
              </span>
              <h4 className="text-xl sm:text-2xl font-black mt-3 leading-snug">
                {sideBanner.title}
              </h4>
              <p className="text-xs text-white/80 mt-2 leading-relaxed">
                {sideBanner.subtitle}
              </p>
            </div>
            <Link
              href={sideBanner.href || seeAllHref}
              className="mt-6 inline-flex items-center gap-2 self-start px-4 py-2 bg-white text-gray-900 rounded-lg text-xs font-bold shadow hover:bg-gray-100 transition-colors"
            >
              Jelajahi &rarr;
            </Link>
          </div>

          {/* Product Grid / Row */}
          <div className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {products.slice(0, 4).map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                aspectRatio={cardAspect}
                onSelect={onSelectProduct}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Regular Scrollable / Grid Section */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {products.map((item) => (
            <ProductCard
              key={item.id}
              product={item}
              aspectRatio={cardAspect}
              onSelect={onSelectProduct}
            />
          ))}
        </div>
      )}
    </section>
  );
}
