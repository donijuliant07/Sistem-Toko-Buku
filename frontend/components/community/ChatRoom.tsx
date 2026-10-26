"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Loader2, Lock, Send, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupAvatar } from "@/components/community/GroupAvatar";
import { BookMessageCard } from "@/components/community/BookMessageCard";
import { BookShareDialog } from "@/components/community/BookShareDialog";
import { MemberPanel } from "@/components/community/MemberPanel";
import { EditGroupDialog } from "@/components/community/CreateGroupDialog";
import { ConfirmDialog } from "@/components/community/ConfirmDialog";
import { useGroupRealtime } from "@/hooks/useGroupRealtime";
import { categoryMeta, memberDisplayName, VISIBILITY_LABELS } from "@/lib/community";
import {
  deleteCommunityGroup,
  deleteGroupMessage,
  getCommunityGroup,
  joinCommunityGroup,
  leaveCommunityGroup,
  listGroupMessages,
  sendGroupMessage,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ChatMessage, GroupDetail } from "@/lib/types";

/** Pesan optimistis: `id` lokal sampai server mengonfirmasi lewat respons/Realtime. */
type LocalMessage = ChatMessage & { status?: "sending" | "failed" };

type ChatRoomProps = {
  groupId: string;
  accessToken: string;
  currentUserId: string;
  isAdmin: boolean;
  onBack: () => void;
};

const PAGE_LIMIT = 30;

function keepPending(current: LocalMessage[] | null): LocalMessage[] {
  return (current ?? []).filter((item) => item.id.startsWith("local-"));
}

function mergeById(base: LocalMessage[], incoming: LocalMessage[]): LocalMessage[] {
  const map = new Map<string, LocalMessage>();
  for (const item of base) map.set(item.id, item);
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values()).sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return "Hari ini";
  if (same(date, yesterday)) return "Kemarin";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatRoom({
  groupId,
  accessToken,
  currentUserId,
  isAdmin,
  onBack,
}: ChatRoomProps) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [groupError, setGroupError] = useState("");
  const [groupKey, setGroupKey] = useState(0);
  const [messages, setMessages] = useState<LocalMessage[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "leave" | "delete-group">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // --- Detail grup ---
  useEffect(() => {
    stickToBottom.current = true;
    let active = true;
    getCommunityGroup(groupId, accessToken)
      .then((detail) => {
        if (active) setGroup(detail);
      })
      .catch((cause) => {
        if (active) setGroupError(cause instanceof Error ? cause.message : "Grup gagal dimuat.");
      });
    return () => {
      active = false;
    };
  }, [groupId, accessToken, groupKey]);

  const loadingGroup = !group && !groupError;
  const canRead = !!group && (group.is_member || isAdmin);

  // --- Riwayat pesan ---
  const loadLatest = useCallback(async () => {
    try {
      const page = await listGroupMessages(groupId, { limit: PAGE_LIMIT }, accessToken);
      setMessages((current) => mergeById(keepPending(current), page.items));
      setCursor(page.next_cursor);
      setMessageError("");
    } catch (cause) {
      setMessageError(cause instanceof Error ? cause.message : "Riwayat pesan gagal dimuat.");
    }
  }, [groupId, accessToken]);

  useEffect(() => {
    if (!canRead) return;
    let active = true;
    listGroupMessages(groupId, { limit: PAGE_LIMIT }, accessToken)
      .then((page) => {
        if (!active) return;
        setMessages((current) => mergeById(keepPending(current), page.items));
        setCursor(page.next_cursor);
        setMessageError("");
      })
      .catch((cause) => {
        if (active) setMessageError(cause instanceof Error ? cause.message : "Riwayat pesan gagal dimuat.");
      });
    return () => {
      active = false;
    };
  }, [groupId, canRead, accessToken, loadKey]);

  const rows = messages ?? [];
  const loadingMessages = canRead && messages === null && !messageError;

  // --- Auto-scroll ---
  useEffect(() => {
    if (stickToBottom.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [rows.length, loadingMessages]);

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
  };

  // --- Realtime ---
  const realtimeStatus = useGroupRealtime({
    groupId,
    accessToken,
    enabled: canRead,
    onInsert: (incoming) => {
      setMessages((current) => {
        const list = current ?? [];
        if (list.some((item) => item.id === incoming.id)) return list;
        const index = incoming.client_message_id
          ? list.findIndex(
              (item) => item.id.startsWith("local-") && item.client_message_id === incoming.client_message_id,
            )
          : -1;
        if (index >= 0) {
          const next = [...list];
          next[index] = { ...next[index], id: incoming.id, created_at: incoming.created_at, status: undefined };
          return next;
        }
        return [...list, incoming];
      });
    },
    onDelete: (messageId) => {
      setMessages((current) => (current ?? []).filter((item) => item.id !== messageId));
    },
    onResync: () => void loadLatest(),
  });

  const deliver = async (
    payload: { content?: string; bookId?: string; clientMessageId: string },
    localId?: string,
  ) => {
    setSending(true);
    try {
      const saved = await sendGroupMessage(
        groupId,
        payload.bookId
          ? { message_type: "book", book_id: payload.bookId, client_message_id: payload.clientMessageId }
          : { message_type: "text", content: payload.content ?? "", client_message_id: payload.clientMessageId },
        accessToken,
      );
      setMessages((current) => {
        const base = current ?? [];
        return mergeById(localId ? base.filter((item) => item.id !== localId) : base, [saved]);
      });
      return true;
    } catch (cause) {
      if (localId) {
        setMessages((current) =>
          (current ?? []).map((item) => (item.id === localId ? { ...item, status: "failed" } : item)),
        );
      }
      toast.error(cause instanceof Error ? cause.message : "Pesan gagal terkirim.");
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleSendText = async () => {
    const content = draft.trim();
    if (!content || !group?.can_send || sending) return;
    const clientMessageId = newClientId();
    const localId = `local-${clientMessageId}`;
    const optimistic: LocalMessage = {
      id: localId,
      group_id: groupId,
      message_type: "text",
      content,
      sender: { id: currentUserId, username: null, full_name: null, avatar_url: null },
      book: null,
      client_message_id: clientMessageId,
      created_at: new Date().toISOString(),
      status: "sending",
    };
    setMessages((current) => [...(current ?? []), optimistic]);
    setDraft("");
    stickToBottom.current = true;
    await deliver({ content, clientMessageId }, localId);
  };

  const retry = async (message: LocalMessage) => {
    if (!message.client_message_id) return;
    setMessages((current) =>
      (current ?? []).map((item) => (item.id === message.id ? { ...item, status: "sending" } : item)),
    );
    await deliver(
      { content: message.content, bookId: message.book?.id, clientMessageId: message.client_message_id },
      message.id,
    );
  };

  const handleLoadOlder = async () => {
    if (!cursor || loadingOlder) return;
    const node = scrollRef.current;
    const previousHeight = node?.scrollHeight ?? 0;
    stickToBottom.current = false;
    setLoadingOlder(true);
    try {
      const page = await listGroupMessages(groupId, { cursor, limit: PAGE_LIMIT }, accessToken);
      setMessages((current) => mergeById(current ?? [], page.items));
      setCursor(page.next_cursor);
      requestAnimationFrame(() => {
        if (node) node.scrollTop = node.scrollHeight - previousHeight;
      });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Pesan lama gagal dimuat.");
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleDeleteMessage = async (message: LocalMessage) => {
    if (message.status === "failed") {
      setMessages((current) => (current ?? []).filter((item) => item.id !== message.id));
      return;
    }
    setDeletingId(message.id);
    try {
      await deleteGroupMessage(groupId, message.id, accessToken);
      setMessages((current) => (current ?? []).filter((item) => item.id !== message.id));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Pesan gagal dihapus.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleJoin = async () => {
    try {
      const detail = await joinCommunityGroup(groupId, accessToken);
      setGroup(detail);
      toast.success(`Bergabung ke ${detail.name}.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal bergabung ke grup.");
    }
  };

  const handleLeave = async () => {
    try {
      await leaveCommunityGroup(groupId, accessToken);
      toast.success("Anda keluar dari grup.");
      onBack();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal keluar dari grup.");
      throw cause;
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await deleteCommunityGroup(groupId, accessToken);
      toast.success("Grup dihapus.");
      onBack();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Grup gagal dihapus.");
      throw cause;
    }
  };

  const canDeleteOthers = useMemo(
    () => isAdmin || group?.my_role === "owner" || group?.my_role === "moderator",
    [isAdmin, group?.my_role],
  );

  if (loadingGroup) {
    return (
      <div className="flex h-full flex-col gap-3 p-4" aria-label="Memuat grup">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-24 w-2/3 rounded-xl" />
        <Skeleton className="h-16 w-1/2 self-end rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Lock className="w-8 h-8 text-gray-300" aria-hidden />
        <p className="text-sm text-gray-700">{groupError || "Grup tidak ditemukan."}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            Kembali
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setGroup(null);
              setGroupError("");
              setGroupKey((key) => key + 1);
            }}
          >
            Coba lagi
          </Button>
        </div>
      </div>
    );
  }

  const meta = categoryMeta(group.category);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      {/* Header Chat */}
      <div className="flex items-center gap-3 border-b border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
          aria-label="Kembali ke daftar grup"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden />
        </button>
        <GroupAvatar name={group.name} avatarUrl={group.avatar_url} category={group.category} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{group.name}</p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {meta.label} · {VISIBILITY_LABELS[group.visibility]} · {group.member_count} anggota
            {realtimeStatus === "error" ? " · real-time terputus" : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMembersOpen(true)}
          aria-label="Lihat anggota grup"
          title="Anggota"
          className="text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Users className="w-5 h-5" aria-hidden />
        </Button>
        {group.can_manage_group ? (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Ubah
          </Button>
        ) : null}
      </div>

      {!canRead ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center bg-[#efeae2] dark:bg-zinc-950">
          <GroupAvatar name={group.name} avatarUrl={group.avatar_url} category={group.category} size="lg" />
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{group.name}</p>
            <p className="mt-1 max-w-sm text-xs text-zinc-600 dark:text-zinc-400">
              {group.description || "Grup publik untuk berdiskusi tentang buku."}
            </p>
          </div>
          {group.visibility === "public" ? (
            <Button size="sm" onClick={handleJoin} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              Bergabung untuk mulai berdiskusi
            </Button>
          ) : (
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <Lock className="w-3.5 h-3.5" aria-hidden />
              Grup privat — minta owner atau moderator menambahkan Anda.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Area Diskusi Chat */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="min-h-0 flex-1 overflow-y-auto bg-[#efeae2] dark:bg-zinc-950 px-3 py-4 sm:px-6 space-y-2"
          >
            {loadingMessages ? (
              <div className="space-y-3" aria-label="Memuat pesan">
                <Skeleton className="h-12 w-2/3 rounded-xl" />
                <Skeleton className="ml-auto h-12 w-1/2 rounded-xl" />
                <Skeleton className="h-16 w-3/5 rounded-xl" />
              </div>
            ) : messageError ? (
              <div className="mx-auto mt-6 max-w-sm rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 p-3 text-center text-xs text-red-600">
                <p>{messageError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setMessages(null);
                    setMessageError("");
                    setLoadKey((key) => key + 1);
                  }}
                >
                  Coba lagi
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <BookOpen className="w-8 h-8 text-zinc-400" aria-hidden />
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Belum ada pesan</p>
                <p className="text-xs text-zinc-500">Sapa anggota lain atau bagikan buku favoritmu.</p>
              </div>
            ) : (
              <>
                {cursor ? (
                  <div className="mb-4 flex justify-center">
                    <Button variant="outline" size="sm" onClick={handleLoadOlder} disabled={loadingOlder} className="bg-white/80 dark:bg-zinc-900/80 shadow-xs">
                      {loadingOlder ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : null}
                      Muat pesan lama
                    </Button>
                  </div>
                ) : null}

                {rows.map((message, index) => {
                  const own = message.sender.id === currentUserId;
                  const previous = rows[index - 1];
                  const showDay =
                    !previous || dayLabel(previous.created_at) !== dayLabel(message.created_at);
                  const grouped = !!previous && previous.sender.id === message.sender.id && !showDay;
                  const canDelete = own || canDeleteOthers;

                  return (
                    <div key={message.id} className="flex flex-col">
                      {showDay ? (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-lg bg-white/90 dark:bg-zinc-800/90 px-3 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 shadow-xs">
                            {dayLabel(message.created_at)}
                          </span>
                        </div>
                      ) : null}

                      <div
                        className={cn(
                          "group/message flex items-end gap-1.5 w-full",
                          own ? "justify-end" : "justify-start"
                        )}
                      >
                        {/* Tombol Hapus di sebelah kiri (pesan kita) */}
                        {own && canDelete && message.status !== "failed" && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteMessage(message)}
                            disabled={deletingId === message.id}
                            aria-label="Hapus pesan"
                            className="mb-1 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:text-red-600 group-hover/message:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden />
                          </button>
                        )}

                        {/* Bubble Pesan */}
                        <div
                          className={cn(
                            "relative max-w-[80%] sm:max-w-[65%] px-3.5 py-2 shadow-xs text-sm transition-all flex flex-col min-w-[100px]",
                            own
                              ? "rounded-2xl rounded-tr-xs bg-[#d9fdd3] dark:bg-[#005c4b] text-zinc-900 dark:text-zinc-100"
                              : "rounded-2xl rounded-tl-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-100 dark:border-zinc-700/50",
                            message.status === "sending" && "opacity-70"
                          )}
                        >
                          {/* Nama Pengirim */}
                          {!own && !grouped && (
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">
                              {memberDisplayName(message.sender)}
                            </span>
                          )}

                          {/* Isi Pesan / Rekomendasi Buku */}
                          {message.message_type === "book" ? (
                            <div className="pb-3">
                              <BookMessageCard book={message.book} />
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words leading-relaxed pb-3">
                              {message.content}
                            </p>
                          )}

                          {/* Time Stamp (Pojok Kanan Bawah) */}
                          <span
                            className={cn(
                              "absolute right-2.5 bottom-1 text-[10px] select-none",
                              own ? "text-zinc-500 dark:text-emerald-200/70" : "text-zinc-400"
                            )}
                          >
                            {timeLabel(message.created_at)}
                            {message.status === "sending" ? " · mengirim…" : ""}
                          </span>
                        </div>

                        {/* Tombol Hapus di sebelah kanan (pesan orang lain) */}
                        {!own && canDelete && message.status !== "failed" && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteMessage(message)}
                            disabled={deletingId === message.id}
                            aria-label="Hapus pesan"
                            className="mb-1 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:text-red-600 group-hover/message:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden />
                          </button>
                        )}
                      </div>

                      {/* Notifikasi Gagal Terkirim */}
                      {message.status === "failed" && (
                        <div className="mt-1 flex items-center gap-2 self-end text-[11px] text-red-600">
                          <span>Gagal terkirim</span>
                          <button type="button" className="font-semibold underline" onClick={() => void retry(message)}>
                            Kirim ulang
                          </button>
                          <button
                            type="button"
                            className="underline"
                            onClick={() =>
                              setMessages((current) => (current ?? []).filter((item) => item.id !== message.id))
                            }
                          >
                            Buang
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Form Input Bar Bawah (Style WA Web) */}
          <div className="bg-[#f0f2f5] dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-3 py-2.5">
            {group.can_send ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Bagikan buku"
                  title="Bagikan buku"
                  onClick={() => setShareOpen(true)}
                  className="shrink-0 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-full"
                >
                  <BookOpen className="w-5 h-5" aria-hidden />
                </Button>

                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.slice(0, 2000))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendText();
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder="Ketik pesan... (Shift+Enter baris baru)"
                  aria-label="Tulis pesan"
                  className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl bg-white dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-none border border-transparent focus:border-emerald-500/50 transition-all"
                />

                <button
                  type="button"
                  onClick={() => void handleSendText()}
                  disabled={!draft.trim() || sending}
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4 translate-x-0.5" aria-hidden />
                </button>
              </div>
            ) : (
              <p className="py-1 text-center text-xs text-zinc-500">
                {isAdmin && !group.is_member
                  ? "Admin hanya dapat membaca grup tanpa menjadi anggota."
                  : "Anda tidak dapat mengirim pesan di grup ini."}
              </p>
            )}
          </div>

          {/* Keluar & Hapus Grup Footer */}
          {group.is_member ? (
            <div className="flex items-center justify-end gap-3 bg-[#f0f2f5] dark:bg-zinc-900 border-t border-zinc-200/50 dark:border-zinc-800/50 px-3 py-1.5">
              {group.my_role !== "owner" ? (
                <button
                  type="button"
                  onClick={() => setConfirm("leave")}
                  className="text-[11px] text-zinc-500 hover:text-red-600 transition-colors"
                >
                  Keluar grup
                </button>
              ) : (
                <span className="text-[11px] text-zinc-400">
                  Pemilik tidak dapat keluar; pindahkan kepemilikan dulu.
                </span>
              )}
              {group.can_manage_group ? (
                <button
                  type="button"
                  onClick={() => setConfirm("delete-group")}
                  className="text-[11px] text-zinc-500 hover:text-red-600 transition-colors"
                >
                  Hapus grup
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {/* Dialogs */}
      <MemberPanel
        open={membersOpen}
        onOpenChange={setMembersOpen}
        group={group}
        accessToken={accessToken}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onGroupUpdated={setGroup}
      />

      <BookShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        onPick={async (bookId) => {
          await deliver({ bookId, clientMessageId: newClientId() });
        }}
      />

      <EditGroupDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        accessToken={accessToken}
        group={group}
        onUpdated={setGroup}
      />

      <ConfirmDialog
        open={confirm === "leave"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Keluar dari grup?"
        description={`Anda tidak akan menerima pesan dari ${group.name} lagi.`}
        confirmLabel="Keluar"
        destructive
        onConfirm={handleLeave}
      />

      <ConfirmDialog
        open={confirm === "delete-group"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Hapus grup?"
        description="Seluruh pesan dan keanggotaan grup akan hilang permanen."
        confirmLabel="Hapus grup"
        destructive
        onConfirm={handleDeleteGroup}
      />
    </div>
  );
}