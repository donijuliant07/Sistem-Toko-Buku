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

/** Satu baris daftar grup; tombol menyesuaikan keanggotaan dan visibilitas. */
export function GroupCard({ group, active, joining, onOpen, onJoin }: GroupCardProps) {
  const meta = categoryMeta(group.category);

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-3 transition-colors",
        active
          ? "border-[var(--primary)] ring-1 ring-[var(--primary)]/20"
          : "border-gray-200 hover:border-gray-300",
      )}
    >
      <div className="flex items-start gap-3">
        <GroupAvatar name={group.name} category={group.category} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{group.name}</p>
            <Badge
              variant="outline"
              className="shrink-0 gap-1 border-gray-200 text-[10px] text-gray-600"
            >
              {group.visibility === "public" ? (
                <Globe className="w-3 h-3" aria-hidden />
              ) : (
                <Lock className="w-3 h-3" aria-hidden />
              )}
              {VISIBILITY_LABELS[group.visibility]}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px] font-medium text-gray-500">{meta.label}</p>
          {group.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-gray-600">{group.description}</p>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
              <Users className="w-3.5 h-3.5" aria-hidden />
              {group.member_count} anggota
            </span>
            {group.is_member ? (
              <Button size="sm" variant="outline" onClick={() => onOpen(group.id)}>
                Buka
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </Button>
            ) : group.visibility === "public" ? (
              <Button size="sm" onClick={() => onJoin(group)} disabled={joining}>
                {joining ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : null}
                Bergabung
              </Button>
            ) : (
              <span className="text-[11px] text-gray-400">Undangan anggota</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
