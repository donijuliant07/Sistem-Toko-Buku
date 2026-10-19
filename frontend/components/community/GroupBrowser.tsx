"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupCard } from "@/components/community/GroupCard";
import { CreateGroupDialog } from "@/components/community/CreateGroupDialog";
import { GROUP_CATEGORIES } from "@/lib/community";
import { joinCommunityGroup, listCommunityGroups } from "@/lib/api";
import type { GroupCategory, GroupPage, GroupSummary } from "@/lib/types";

type GroupBrowserProps = {
  accessToken: string;
  selectedId: string | null;
  isAdmin: boolean;
  onSelect: (groupId: string) => void;
  /** Dipanggil setelah join/gabung atau grup baru dibuat, agar halaman induk ikut segar. */
  onChange?: () => void;
};

const PAGE_SIZE = 20;

export function GroupBrowser({ accessToken, selectedId, isAdmin, onSelect, onChange }: GroupBrowserProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  // Filter tab/kategori sekaligus dengan halaman: mengubah filter langsung
  // kembali ke halaman 1 tanpa effect tambahan.
  const [filters, setFilters] = useState<{
    category: GroupCategory | "";
    tab: "all" | "mine";
    page: number;
  }>({ category: "", tab: "all", page: 1 });
  // `null` = permintaan untuk query/filter ini masih berjalan.
  const [data, setData] = useState<GroupPage | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { category, tab, page } = filters;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    listCommunityGroups(
      {
        q: debouncedQuery || undefined,
        category: category || undefined,
        mine: tab === "mine",
        page,
        page_size: PAGE_SIZE,
      },
      accessToken,
    )
      .then((result) => {
        if (!active) return;
        setData((previous) =>
          page > 1 && previous
            ? { ...result, items: [...previous.items, ...result.items] }
            : result,
        );
        setError("");
        setLoadingMore(false);
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Daftar grup gagal dimuat.");
        setLoadingMore(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, debouncedQuery, category, tab, page, refreshKey]);

  const loading = data === null;
  /** Ganti query/filter: langsung tampilkan skeleton dan kembali ke halaman 1. */
  const updateFilters = (next: Partial<typeof filters>) => {
    setData(null);
    setFilters((current) => ({ ...current, page: 1, ...next }));
  };

  const refresh = useCallback(() => {
    setData(null);
    setFilters((current) => ({ ...current, page: 1 }));
    setRefreshKey((key) => key + 1);
  }, []);

  const handleJoin = async (group: GroupSummary) => {
    setJoiningId(group.id);
    try {
      await joinCommunityGroup(group.id, accessToken);
      toast.success(`Bergabung ke ${group.name}.`);
      onChange?.();
      onSelect(group.id);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal bergabung ke grup.");
    } finally {
      setJoiningId(null);
    }
  };

  const groups = data?.items ?? [];
  const hasMore = !!data && groups.length < data.total;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-gray-900">Komunitas</h1>
          <p className="text-xs text-gray-500">Diskusi buku bareng pembaca lain.</p>
        </div>
        {isAdmin ? (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="cursor-pointer">
            <Plus className="w-4 h-4" aria-hidden />
            Buat
          </Button>
        ) : null}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari grup atau topik…"
          aria-label="Cari grup"
          className="pl-9 pr-9"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Hapus pencarian"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5" role="tablist" aria-label="Filter grup">
          {(["all", "mine"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => tab !== value && updateFilters({ tab: value })}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                tab === value ? "bg-white text-gray-900 shadow-2xs" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {value === "all" ? "Semua" : "Grup Saya"}
            </button>
          ))}
        </div>
        <select
          value={category}
          onChange={(event) => updateFilters({ category: event.target.value as GroupCategory | "" })}
          aria-label="Filter kategori"
          className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0052cc]/20"
        >
          <option value="">Semua kategori</option>
          {GROUP_CATEGORIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
          <p>{error}</p>
          <Button size="sm" variant="outline" onClick={refresh} className="mt-2 cursor-pointer">
            Coba lagi
          </Button>
        </div>
      ) : loading && groups.length === 0 ? (
        <div className="space-y-2" aria-label="Memuat grup">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-[104px] rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
          <p className="text-sm font-medium text-gray-700">
            {tab === "mine" ? "Belum ikut grup mana pun." : "Belum ada grup yang cocok."}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {tab === "mine"
              ? "Cari grup publik lalu bergabung, atau minta owner menambahkan Anda."
              : "Coba kata kunci atau kategori lain."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              active={group.id === selectedId}
              joining={joiningId === group.id}
              onOpen={onSelect}
              onJoin={handleJoin}
            />
          ))}
          {hasMore ? (
            <Button
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={() => {
                setLoadingMore(true);
                setFilters((current) => ({ ...current, page: current.page + 1 }));
              }}
              className="w-full cursor-pointer"
            >
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
              Muat grup lain
            </Button>
          ) : null}
        </div>
      )}

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accessToken={accessToken}
        onCreated={(group) => {
          refresh();
          onChange?.();
          onSelect(group.id);
        }}
      />
    </div>
  );
}
