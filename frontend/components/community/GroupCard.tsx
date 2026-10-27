"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GroupAvatar } from "@/components/community/GroupAvatar";
import { categoryMeta, VISIBILITY_LABELS } from "@/lib/community";
import { cn } from "@/lib/utils";
import type { GroupSummary } from "@/lib/types";
import { ArrowRight, Globe, Loader2, Lock, Users } from "lucide-react";

type GroupCardProps = {
  group: GroupSummary;
  active?: boolean;
  joining?: boolean;
  onOpen: (groupId: string) => void;
  onJoin: (group: GroupSummary) => void;
};

export function GroupCard({ group, active, joining, onOpen, onJoin }: GroupCardProps) {
  const meta = categoryMeta(group.category);

  return (
    <div
      className={cn(
        "group/card relative overflow-hidden rounded-xl border p-3 transition-[transform,box-shadow,border-color,background-color] duration-150",
        !active && "hover:-translate-y-px hover:shadow-sm",
        active
          ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-sm"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]",
      )}
    >
      {/* Penanda aktif: bilah yang tumbuh, bukan border-l yang menggeser isi kartu. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-0.5 origin-top bg-[var(--primary)] transition-transform duration-200",
          active ? "scale-y-100" : "scale-y-0",
        )}
      />
      <div className="flex items-start gap-3">
        <GroupAvatar name={group.name} avatarUrl={group.avatar_url} category={group.category} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={cn("truncate text-sm font-semibold", active ? "text-[var(--primary-deep)]" : "text-[var(--foreground)]")}>
              {group.name}
            </p>
            <Badge
              variant="outline"
              className="shrink-0 gap-1 border-[var(--border)] bg-[var(--surface)] text-[10px] text-[var(--muted-foreground)] shadow-xs"
            >
              {group.visibility === "public" ? (
                <Globe className="w-3 h-3" aria-hidden />
              ) : (
                <Lock className="w-3 h-3" aria-hidden />
              )}
              {VISIBILITY_LABELS[group.visibility]}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">{meta.label}</p>
          {group.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-[var(--muted-foreground)]">{group.description}</p>
          ) : null}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--muted-foreground)]">
              <Users className="w-3.5 h-3.5" aria-hidden />
              {group.member_count} anggota
            </span>
            {group.is_member ? (
              <Button
                size="sm"
                variant={active ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => onOpen(group.id)}
              >
                Buka
                <ArrowRight
                  className="w-3.5 h-3.5 transition-transform duration-150 group-hover/card:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </Button>
            ) : group.visibility === "public" ? (
              <Button
                size="sm"
                onClick={() => onJoin(group)}
                disabled={joining}
                className="cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {joining ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : null}
                Bergabung
              </Button>
            ) : (
              <span className="text-[11px] font-medium text-[var(--muted-foreground)]">Butuh undangan</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}