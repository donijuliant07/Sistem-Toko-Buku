import type { GroupCategory, GroupVisibility, MemberRole } from "./types";

/** Metadata kategori untuk badge, filter, dan warna inisial grup. */
export const GROUP_CATEGORIES: {
  value: GroupCategory;
  label: string;
  /** Warna latar inisial (kelas Tailwind statis agar tidak dipurge). */
  color: string;
}[] = [
  { value: "book_club", label: "Klub Buku", color: "bg-emerald-100 text-emerald-800" },
  { value: "manga_anime", label: "Manga & Anime", color: "bg-rose-100 text-rose-800" },
  { value: "business_startup", label: "Bisnis & Startup", color: "bg-amber-100 text-amber-800" },
  { value: "self_improvement", label: "Pengembangan Diri", color: "bg-sky-100 text-sky-800" },
  { value: "fantasy_fiction", label: "Fantasi & Fiksi", color: "bg-violet-100 text-violet-800" },
  { value: "technology", label: "Teknologi", color: "bg-slate-200 text-slate-800" },
  { value: "general", label: "Umum", color: "bg-stone-200 text-stone-800" },
];

export const VISIBILITY_LABELS: Record<GroupVisibility, string> = {
  public: "Publik",
  private: "Privat",
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Pemilik",
  moderator: "Moderator",
  member: "Anggota",
};

export function categoryMeta(value: GroupCategory) {
  return GROUP_CATEGORIES.find((item) => item.value === value) ?? GROUP_CATEGORIES[GROUP_CATEGORIES.length - 1];
}

/** Inisial maksimal dua huruf dari nama grup (pengganti foto grup). */
export function groupInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function memberDisplayName(user: { full_name: string | null; username: string | null }): string {
  return user.full_name?.trim() || user.username || "Anggota";
}
