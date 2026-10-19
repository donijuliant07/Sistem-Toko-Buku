import { cn } from "@/lib/utils";
import { categoryMeta, groupInitials } from "@/lib/community";
import type { GroupCategory } from "@/lib/types";

type GroupAvatarProps = {
  name: string;
  category: GroupCategory;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: "w-8 h-8 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-14 h-14 text-lg",
} as const;

/** Foto grup belum diunggah; inisial + warna kategori dipakai sebagai gantinya. */
export function GroupAvatar({ name, category, size = "md", className }: GroupAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-bold select-none",
        SIZES[size],
        categoryMeta(category).color,
        className,
      )}
    >
      {groupInitials(name) || "?"}
    </span>
  );
}

type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
  className?: string;
};

/** Avatar anggota: URL bila ada, selain itu inisial nama. */
export function UserAvatar({ name, avatarUrl, size = "sm", className }: UserAvatarProps) {
  const initials = groupInitials(name) || "?";
  return avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- avatar eksternal berukuran kecil, tanpa domain next/image
    <img
      src={avatarUrl}
      alt=""
      className={cn("shrink-0 rounded-full object-cover", size === "sm" ? "w-8 h-8" : "w-10 h-10", className)}
    />
  ) : (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-[#0052cc]/10 font-semibold text-[#0052cc] select-none",
        size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm",
        className,
      )}
    >
      {initials}
    </span>
  );
}
