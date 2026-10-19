"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { ChatMessage } from "@/lib/types";

export type RealtimeStatus = "idle" | "connecting" | "subscribed" | "error";

type Options = {
  groupId: string | null;
  accessToken: string | null;
  /** `false` saat pengguna bukan anggota — jangan berlangganan tanpa izin baca. */
  enabled: boolean;
  onInsert: (message: ChatMessage) => void;
  onDelete: (messageId: string) => void;
  /** Dipanggil setelah tersambung ulang, untuk menambal event yang terlewat. */
  onResync?: () => void;
};

type RealtimeRow = Omit<ChatMessage, "sender" | "book"> & {
  sender_id: string;
};

/**
 * Berlangganan `postgres_changes` INSERT/DELETE pada `chat_messages` satu grup.
 *
 * - RLS Supabase mengevaluasi JWT pengguna, jadi pesan grup privat tidak pernah
 *   sampai ke non-anggota walau mereka tahu `group_id`.
 * - Payload INSERT tidak membawa profil pengirim (profil tidak dapat dibaca
 *   publik), sehingga pesan dari realtime ditandai `sender` minimal dan UI
 *   memuat ulang halaman terakhir saat ada event tak dikenal. Pesan sendiri
 *   tetap akurat karena datang dari respons API.
 * - DELETE butuh `REPLICA IDENTITY FULL` pada `chat_messages` (lihat migrasi).
 */
export function useGroupRealtime({
  groupId,
  accessToken,
  enabled,
  onInsert,
  onDelete,
  onResync,
}: Options): RealtimeStatus {
  const key = groupId && accessToken && enabled ? `${groupId}|${accessToken}` : null;
  // Status langganan terikat pada kunci saluran: kunci berbeda = masih menyambung.
  const [connection, setConnection] = useState<{ key: string; status: RealtimeStatus } | null>(null);

  // Callback disimpan di ref lewat effect agar subscribe tidak diulang setiap
  // render induk (handler inline berubah setiap render).
  const handlers = useRef({ onInsert, onDelete, onResync });
  useEffect(() => {
    handlers.current = { onInsert, onDelete, onResync };
  }, [onInsert, onDelete, onResync]);

  useEffect(() => {
    if (!key) return;

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    // Token bisa berubah setelah refresh; pasang yang terbaru sebelum subscribe.
    supabase.realtime.setAuth(accessToken);

    channel = supabase
      .channel(`group:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const row = payload.new as RealtimeRow;
          if (!row?.id) return;
          handlers.current.onInsert({
            id: row.id,
            group_id: row.group_id,
            message_type: row.message_type,
            content: row.content ?? "",
            sender: {
              id: row.sender_id,
              username: null,
              full_name: null,
              avatar_url: null,
            },
            book: null,
            client_message_id: row.client_message_id ?? null,
            created_at: row.created_at,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_messages",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const row = payload.old as Partial<RealtimeRow>;
          if (row?.id) handlers.current.onDelete(row.id);
        },
      )
      .subscribe((nextStatus) => {
        if (cancelled) return;
        if (nextStatus === "SUBSCRIBED") {
          setConnection({ key, status: "subscribed" });
          // Sambungan ulang bisa kehilangan event selama putus; ambil ulang
          // halaman terbaru (idempoten karena penggabungan berbasis id).
          handlers.current.onResync?.();
        } else if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT") {
          setConnection({ key, status: "error" });
        }
      });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [key, groupId, accessToken, enabled]);
  // `key` adalah gabungan groupId/accessToken/enabled; daftar ketiganya tetap
  // diminta oleh rule agar efek jelas bergantung pada ketiga prop tersebut.

  if (!key) return "idle";
  return connection?.key === key ? connection.status : "connecting";
}
