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
        "rounded-xl border p-3 transition-all duration-200",
        active
          ? "bg-emerald-50 border-emerald-200 border-l-4 border-l-emerald-500 shadow-sm"
          : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 shadow-xs",
      )}
    >
      <div className="flex items-start gap-3">
        <GroupAvatar name={group.name} category={group.category} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={cn("truncate text-sm font-semibold", active ? "text-emerald-900" : "text-gray-900")}>
              {group.name}
            </p>
            <Badge
              variant="outline"
              className="shrink-0 gap-1 border-gray-200 bg-white text-[10px] text-gray-600 shadow-xs"
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
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 font-medium">
              <Users className="w-3.5 h-3.5" aria-hidden />
              {group.member_count} anggota
            </span>
            {group.is_member ? (
              <Button size="sm" variant={active ? "default" : "outline"} className="cursor-pointer" onClick={() => onOpen(group.id)}>
                Buka
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </Button>
            ) : group.visibility === "public" ? (
              <Button size="sm" onClick={() => onJoin(group)} disabled={joining} className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white">
                {joining ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : null}
                Bergabung
              </Button>
            ) : (
              <span className="text-[11px] text-gray-400 font-medium">Butuh undangan</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}