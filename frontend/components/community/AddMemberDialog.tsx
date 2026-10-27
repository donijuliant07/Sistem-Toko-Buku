"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/community/GroupAvatar";
import { memberDisplayName } from "@/lib/community";
import { addGroupMember, searchMemberCandidates } from "@/lib/api";
import type { UserSearchResult } from "@/lib/types";

type AddMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  accessToken: string;
  /** Anggota yang sudah ada, disembunyikan dari hasil pencarian. */
  existingIds: string[];
  onAdded: () => Promise<void> | void;
};

type SearchState = {
  term: string;
  users: UserSearchResult[];
  error: string;
};

/** Tambah anggota berdasarkan username atau nama (owner/moderator). */
export function AddMemberDialog({
  open,
  onOpenChange,
  groupId,
  accessToken,
  existingIds,
  onAdded,
}: AddMemberDialogProps) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const term = query.trim();

  useEffect(() => {
    if (!open || term.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      searchMemberCandidates(groupId, term, accessToken)
        .then((rows) => {
          if (active) setState({ term, users: rows, error: "" });
        })
        .catch((cause) => {
          if (active) {
            setState({
              term,
              users: [],
              error: cause instanceof Error ? cause.message : "Pencarian gagal.",
            });
          }
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, term, groupId, accessToken]);

  // Hasil untuk istilah lain dianggap belum ada — tanpa setState sinkron di effect.
  const ready = state?.term === term;
  const results = ready ? state.users.filter((row) => !existingIds.includes(row.id)) : [];
  const error = ready ? state.error : "";
  const searching = term.length >= 2 && !ready;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery("");
      setState(null);
    }
    onOpenChange(next);
  };

  const handleAdd = async (user: UserSearchResult) => {
    setAddingId(user.id);
    try {
      await addGroupMember(groupId, user.id, accessToken);
      setState((current) =>
        current ? { ...current, users: current.users.filter((row) => row.id !== user.id) } : current,
      );
      await onAdded();
      toast.success(`${memberDisplayName(user)} ditambahkan ke grup.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Anggota gagal ditambahkan.");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="font-community max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah anggota</DialogTitle>
          <DialogDescription>Cari pengguna berdasarkan nama atau username (minimal 2 huruf).</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari pengguna…"
            aria-label="Cari pengguna"
            className="pl-9"
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {error ? (
            <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>
          ) : term.length < 2 ? (
            <p className="py-6 text-center text-xs text-gray-500">Ketik minimal 2 huruf untuk mencari.</p>
          ) : searching ? (
            <div className="space-y-2">
              {[0, 1].map((key) => (
                <Skeleton key={key} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-500">Tidak ada pengguna yang cocok.</p>
          ) : (
            <ul className="space-y-1">
              {results.map((user) => (
                <li key={user.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-gray-50">
                  <UserAvatar name={memberDisplayName(user)} avatarUrl={user.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{memberDisplayName(user)}</p>
                    {user.username ? (
                      <p className="truncate text-[11px] text-gray-500">@{user.username}</p>
                    ) : null}
                  </div>
                  <Button size="sm" disabled={addingId === user.id} onClick={() => void handleAdd(user)}>
                    {addingId === user.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" aria-hidden />
                    )}
                    Tambah
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
