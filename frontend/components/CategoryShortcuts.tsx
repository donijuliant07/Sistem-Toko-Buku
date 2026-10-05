import { CATEGORIES } from "@/data/mockData";

interface CategoryShortcutsProps {
  onSelectCategory?: (id: string) => void;
  activeId?: string;
}

export default function CategoryShortcuts({ onSelectCategory, activeId }: CategoryShortcutsProps) {
  return (
    <section className="max-w-[1200px] mx-auto px-4 py-4">
      <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-2 scrollbar-none sm:justify-between">
        {CATEGORIES.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory?.(cat.id)}
              className="flex flex-col items-center gap-2 group shrink-0 focus:outline-none"
            >
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-md border ${
                  isActive
                    ? "border-[#0052cc] bg-blue-50 ring-2 ring-[#0052cc]/20"
                    : "border-gray-100 bg-white"
                }`}
              >
                <span>{cat.icon}</span>
              </div>
              <span
                className={`text-xs font-medium transition-colors text-center max-w-[70px] truncate ${
                  isActive ? "text-[#0052cc] font-bold" : "text-gray-700 group-hover:text-[#0052cc]"
                }`}
              >
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
