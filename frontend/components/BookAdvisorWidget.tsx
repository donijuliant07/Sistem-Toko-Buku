"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Bot,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  Conversation,
  ConversationBubble,
  ConversationContent,
} from "@/components/ui/conversation";
import { SoundToggle } from "@/components/ui/sound";
import { useAuth } from "@/components/AuthProvider";
import { ApiError, getAdvisorPricing, sendAdvisorChat, sendAdvisorFeedback } from "@/lib/api";
import type {
  AdvisorPricing,
  Recommendation,
  BookPreferences,
  ConversationState,
} from "@/lib/types";
import { formatRupiah } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sentAt: string;
  recommendations?: Recommendation[];
  followUpQuestion?: string | null;
  state?: ConversationState;
  /** Poin yang benar-benar dipotong backend untuk pesan ini (0 bila gratis). */
  charged?: number;
  /** Poin yang dikembalikan karena provider AI gagal. */
  refunded?: number;
  /** Balasan bukan dari AI (fallback aturan) — pengguna harus tahu. */
  ruleBased?: boolean;
}

/** ID pesan klien; dipakai backend sebagai kunci idempotensi tagihan poin. */
function newMessageId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const SUGGESTED_PROMPTS = [
  "Belajar bisnis & startup untuk pemula, budget max 150rb",
  "Rekomendasi novel fiksi bestseller yang seru",
  "Buku self-improvement tentang disiplin dan fokus",
  "Buku pengembangan diri dengan gaya praktis",
];

const INITIAL_GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content:
    "Halo! Saya AI Penasihat Buku toko ini. Ceritakan buku seperti apa yang sedang kamu cari — topik, minat, level pembaca (pemula/lanjutan), atau batas anggaranmu. Saya carikan rekomendasi terbaik langsung dari katalog toko!",
  sentAt: "Baru saja",
  followUpQuestion: "Apa topik atau genre buku yang paling menarik buatmu hari ini?",
};

export default function BookAdvisorWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<BookPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, "liked" | "not_relevant">>({});

  // Biaya per pesan & saldo: hanya diisi dari respons backend, tidak pernah
  // dihitung di klien. `null` = belum diketahui.
  const [pricing, setPricing] = useState<AdvisorPricing | null>(null);
  // Pesan terakhir yang gagal terkirim; disimpan agar "Coba lagi" mengirim
  // ulang dengan `message_id` yang sama (tidak memotong poin dua kali).
  const [pendingRetry, setPendingRetry] = useState<{
    text: string;
    messageId: string;
  } | null>(null);

  const { session } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Penghitung id pesan klien; `Date.now()` di badan komponen tidak murni bagi React Compiler.
  const messageSeqRef = useRef(0);

  const accessToken = session?.access_token ?? null;

  // Muat biaya & saldo saat widget dibuka atau akun berganti. Membuka/riwayat
  // tidak memotong poin — endpoint ini hanya membaca.
  useEffect(() => {
    if (!isOpen || !accessToken) return;
    let cancelled = false;
    getAdvisorPricing(accessToken)
      .then((data) => {
        if (!cancelled) setPricing(data);
      })
      .catch(() => {
        // Biaya tidak tampil (mis. akun admin) — pesan akan ditolak backend
        // dengan alasan yang jelas, jadi jangan menebak angka di sini.
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, accessToken]);

  const cost = pricing?.points_cost ?? 0;
  const balance = pricing?.points_balance ?? null;
  const insufficient = balance !== null && cost > 0 && balance < cost;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, messages, isLoading]);

  const sendMessage = async (text: string, messageId: string) => {
    if (!accessToken) return;
    setIsLoading(true);

    try {
      const response = await sendAdvisorChat(
        text,
        sessionId,
        accessToken,
        messageId
      );
      setSessionId(response.session_id);
      setPreferences(response.preferences);
      // Saldo hanya diperbarui dari respons yang sah — bukan dari hitungan klien.
      setPricing({
        points_cost: response.points_cost,
        points_balance: response.points_balance,
      });
      setPendingRetry(null);

      const assistantMessage: ChatMessage = {
        id: `assistant-${++messageSeqRef.current}`,
        role: "assistant",
        content: response.assistant_message,
        sentAt: new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
        recommendations: response.recommendations,
        followUpQuestion: response.follow_up_question,
        state: response.conversation_state,
        charged: response.points_charged,
        refunded: response.points_refunded,
        ruleBased: response.outcome === "provider_failed",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        // Hanya kegagalan jaringan/timeout yang boleh diulang otomatis; tolak
        // dari backend (422/403/…) tidak, karena tidak akan berubah hasilnya.
        setPendingRetry({ text, messageId });
      }
      if (err instanceof ApiError && err.code === "INSUFFICIENT_POINTS") {
        setError(
          "Poinmu tidak cukup untuk mengirim pesan. Kumpulkan poin dulu lewat pembelian, ulasan, atau aktivitas komunitas."
        );
        try {
          setPricing(await getAdvisorPricing(accessToken));
        } catch {
          // Biarkan angka lama; backend tetap yang memutuskan.
        }
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Gagal memproses pesan percakapan. Pastikan backend aktif."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    if (!session?.access_token) {
      setError("Silakan masuk (login) akun terlebih dahulu agar dapat berkonsultasi dengan AI Book Advisor.");
      return;
    }

    // Saldo kurang: jangan kirim ke backend/provider sama sekali.
    if (insufficient) {
      setError(
        `Poinmu tidak cukup. Biaya ${cost} poin per pesan, saldo ${balance ?? 0} poin. Kumpulkan poin dulu lewat pembelian, ulasan, atau aktivitas komunitas.`
      );
      return;
    }

    const timeStr = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    const userMessage: ChatMessage = {
      id: `user-${++messageSeqRef.current}`,
      role: "user",
      content: text,
      sentAt: timeStr,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    await sendMessage(text, newMessageId());
  };

  const handleRetry = async () => {
    if (!pendingRetry || isLoading) return;
    setError(null);
    // `message_id` sama dengan percobaan pertama → idempoten, tidak ditagih ulang.
    await sendMessage(pendingRetry.text, pendingRetry.messageId);
  };

  const handleReset = () => {
    setSessionId(null);
    setPreferences(null);
    setReactions({});
    setError(null);
    setMessages([
      {
        ...INITIAL_GREETING,
        id: `greeting-${++messageSeqRef.current}`,
        sentAt: new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      },
    ]);
  };

  const handleFeedback = async (
    bookId: string,
    feedbackType: "liked" | "not_relevant"
  ) => {
    if (!sessionId || !session?.access_token) return;

    setReactions((prev) => ({ ...prev, [bookId]: feedbackType }));

    try {
      await sendAdvisorFeedback(
        {
          session_id: sessionId,
          book_id: bookId,
          feedback: feedbackType,
        },
        session.access_token
      );
    } catch {
      // Revert if error
      setReactions((prev) => {
        const copy = { ...prev };
        delete copy[bookId];
        return copy;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <aside aria-label="AI Book Advisor" className="fixed bottom-20 right-5 z-40">
          <button
            type="button"
            data-slot="button"
            data-sound="select"
            onClick={() => setIsOpen(true)}
            aria-label="Buka AI Book Advisor"
            className="group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 px-4 py-3 text-white shadow-xl shadow-emerald-900/20 ring-1 ring-white/20 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-900/30 active:scale-95 cursor-pointer"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white shadow-inner backdrop-blur-xs">
              <Sparkles className="h-4 w-4 animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                AI Advisor
              </span>
              <span className="text-xs font-black tracking-tight text-white">
                Cari Buku Pintar
              </span>
            </div>
          </button>
        </aside>
      )}

      {/* Chat Window Dialog */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="advisor-title"
          className="fixed inset-0 z-50 flex items-end justify-end p-0 sm:p-5 pointer-events-none"
        >
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs sm:hidden pointer-events-auto"
            onClick={() => setIsOpen(false)}
          />

          {/* Main chat widget frame */}
          <div className="pointer-events-auto flex flex-col w-full sm:w-[460px] h-[90vh] sm:h-[620px] max-h-[92vh] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#141f1a] border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden transition-all duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/90 dark:bg-[#182620]/90 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-sm">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      id="advisor-title"
                      className="text-sm font-black text-gray-900 dark:text-gray-100 tracking-tight truncate"
                    >
                      AI Penasihat Buku
                    </h3>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Katalog Toko
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    Rekomendasi dari stok & harga katalog kami
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <SoundToggle
                  title="Suara antarmuka"
                  className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-800"
                />

                <button
                  type="button"
                  data-slot="button"
                  data-sound="chirp"
                  onClick={handleReset}
                  title="Mulai sesi baru"
                  className="flex size-7 cursor-pointer items-center justify-center rounded text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-800 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  data-slot="button-close"
                  data-sound="close"
                  onClick={() => setIsOpen(false)}
                  title="Tutup dialog"
                  className="flex size-7 cursor-pointer items-center justify-center rounded text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Active Preferences Chip Bar */}
            {preferences && (preferences.interests.length > 0 || preferences.max_budget || preferences.reading_level) && (
              <div className="px-3.5 py-2 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 shrink-0">
                  Preferensi:
                </span>
                {preferences.interests.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white dark:bg-[#141f1a] border border-emerald-200 dark:border-emerald-800 text-gray-800 dark:text-gray-200 shrink-0 shadow-2xs">
                    {preferences.interests.join(", ")}
                  </span>
                )}
                {preferences.max_budget && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white dark:bg-[#141f1a] border border-emerald-200 dark:border-emerald-800 text-gray-800 dark:text-gray-200 shrink-0 shadow-2xs font-semibold">
                    ≤ {formatRupiah(Number(preferences.max_budget))}
                  </span>
                )}
                {preferences.reading_level && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white dark:bg-[#141f1a] border border-emerald-200 dark:border-emerald-800 text-gray-800 dark:text-gray-200 shrink-0 shadow-2xs capitalize">
                    {preferences.reading_level}
                  </span>
                )}
              </div>
            )}

            {/* Message Feed Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/40 dark:bg-[#0e1613]/40">
              <Conversation className="gap-3">
                {messages.map((msg) => {
                  const isUser = msg.role === "user";
                  const hasRecommendations = Boolean(msg.recommendations && msg.recommendations.length > 0);

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"} w-full`}
                    >
                      <ConversationBubble
                        variant={isUser ? "default" : "muted"}
                        align={isUser ? "end" : "start"}
                        sentAt={msg.sentAt}
                        className={isUser ? "max-w-[85%]" : hasRecommendations ? "max-w-[96%] w-full" : "max-w-[85%]"}
                      >
                        <ConversationContent className="leading-relaxed">
                          <p className="whitespace-pre-wrap">{msg.content}</p>

                          {/* Follow-up question callout */}
                          {msg.ruleBased && (
                            <p className="mt-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                              Balasan dari panduan aturan, bukan AI. Poin untuk pesan ini dikembalikan.
                            </p>
                          )}
                          {typeof msg.refunded === "number" && msg.refunded > 0 && !msg.ruleBased && (
                            <p className="mt-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                              {msg.refunded} poin dikembalikan.
                            </p>
                          )}
                          {typeof msg.charged === "number" && msg.charged > 0 && (
                            <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                              {msg.charged} poin terpotong
                            </p>
                          )}
                          {msg.followUpQuestion && (
                            <div className="mt-2.5 pt-2 border-t border-black/10 dark:border-white/10 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                              <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                              <span>{msg.followUpQuestion}</span>
                            </div>
                          )}

                          {/* Book recommendations rendered cleanly */}
                          {hasRecommendations && (
                            <div className="mt-3.5 space-y-2.5">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Rekomendasi Terbaik Dari Katalog ({msg.recommendations!.length})</span>
                              </div>

                              <div className="space-y-2">
                                {msg.recommendations!.map((rec) => {
                                  const { book, reason, score } = rec;
                                  const isLiked = reactions[book.id] === "liked";
                                  const isDisliked = reactions[book.id] === "not_relevant";

                                  return (
                                    <div
                                      key={book.id}
                                      className="p-3 rounded-xl bg-white dark:bg-[#182620] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 shadow-xs hover:border-emerald-500/50 transition-colors"
                                    >
                                      <div className="flex gap-3">
                                        {book.cover_url ? (
                                          // eslint-disable-next-line @next/next/no-img-element -- cover dari host katalog dinamis; tidak terdaftar di next.config
                                          <img
                                            src={book.cover_url}
                                            alt={book.title}
                                            className="h-18 w-13 object-cover rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0 shadow-2xs"
                                          />
                                        ) : (
                                          <div className="h-18 w-13 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 text-gray-400">
                                            <BookOpen className="h-6 w-6" />
                                          </div>
                                        )}

                                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                                          <div>
                                            <div className="flex items-start justify-between gap-1">
                                              <h4 className="text-xs font-bold leading-snug line-clamp-2 text-gray-900 dark:text-gray-100">
                                                {book.title}
                                              </h4>
                                              <span className="shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                                {Math.round(score * 100)}% Cocok
                                              </span>
                                            </div>

                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                              {book.author} {book.category ? `• ${book.category}` : ""}
                                            </p>
                                          </div>

                                          <div className="flex items-center justify-between mt-2 pt-1">
                                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                              {formatRupiah(Number(book.price))}
                                            </span>
                                            <span
                                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                                book.stock > 0
                                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300"
                                              }`}
                                            >
                                              {book.stock > 0 ? `Stok: ${book.stock}` : "Stok habis"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Reason box */}
                                      <div className="mt-2 text-[11px] text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-black/20 p-2 rounded-lg border border-gray-100 dark:border-gray-800/60">
                                        <span className="font-bold text-gray-900 dark:text-gray-100">Alasan: </span>
                                        {reason}
                                      </div>

                                      {/* Footer actions */}
                                      <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                                        <Link
                                          href={`/books/${book.id}`}
                                          data-slot="button"
                                          data-sound="select"
                                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                                        >
                                          Lihat Detail Buku <ChevronRight className="h-3 w-3" />
                                        </Link>

                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            data-slot="button"
                                            data-sound="tap"
                                            onClick={() => handleFeedback(book.id, "liked")}
                                            title="Rekomendasi ini cocok"
                                            className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                                              isLiked
                                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 font-bold"
                                                : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
                                            }`}
                                          >
                                            <ThumbsUp className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            data-slot="button"
                                            data-sound="destructive"
                                            onClick={() => handleFeedback(book.id, "not_relevant")}
                                            title="Kurang relevan bagi saya"
                                            className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                                              isDisliked
                                                ? "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 font-bold"
                                                : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
                                            }`}
                                          >
                                            <ThumbsDown className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </ConversationContent>
                      </ConversationBubble>
                    </div>
                  );
                })}

                {/* Loading state indicator */}
                {isLoading && (
                  <div className="flex flex-col items-start w-full">
                    <ConversationBubble variant="muted" align="start">
                      <ConversationContent>
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 py-1 font-medium">
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                          <span>AI sedang memindai katalog & menganalisis kecocokan...</span>
                        </div>
                      </ConversationContent>
                    </ConversationBubble>
                  </div>
                )}
              </Conversation>

              <div ref={messagesEndRef} />
            </div>

            {/* Error Notification */}
            {error && (
              <div className="mx-4 my-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span className="truncate">{error}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {pendingRetry && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold hover:bg-rose-100 dark:hover:bg-rose-900 disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Coba lagi
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded cursor-pointer shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Status poin: biaya per pesan & saldo, hanya dari backend */}
            {session?.access_token && (pricing || isLoading) && (
              <div
                className={`mx-4 mb-1 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-[11px] ${
                  insufficient
                    ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : "bg-gray-50 text-gray-600 dark:bg-[#182620] dark:text-gray-400"
                }`}
              >
                <span>
                  {isLoading
                    ? "Memproses pesan..."
                    : insufficient
                      ? `Poin kurang — biaya ${cost} poin/pesan, saldo ${balance ?? 0} poin`
                      : cost > 0
                        ? `${cost} poin per pesan`
                        : "Pesan gratis (AI belum aktif)"}
                </span>
                {balance !== null && (
                  <span className="font-semibold shrink-0">
                    Saldo: {balance} poin
                    {" · "}
                    <Link href="/poin" className="underline">
                      Kumpulkan poin
                    </Link>
                  </span>
                )}
              </div>
            )}

            {/* Suggested Prompts Pills */}
            {messages.length <= 2 && (
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-[#182620]/40">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Contoh pertanyaan:
                </p>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      data-slot="button"
                      data-sound="select"
                      onClick={() => handleSend(prompt)}
                      className="px-2.5 py-1 rounded-full text-[11px] bg-white dark:bg-[#141f1a] border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0 shadow-2xs cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Form Bar */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141f1a]">
              <div className="relative flex items-center">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    !session?.access_token
                      ? "Masuk/login dulu untuk berkonsultasi..."
                      : insufficient
                        ? "Poinmu tidak cukup untuk mengirim pesan..."
                        : "Ketik topik, judul, minat, atau anggaran (Enter)..."
                  }
                  rows={1}
                  disabled={isLoading}
                  className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20 px-3.5 py-2.5 pr-12 text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all disabled:opacity-50 min-h-[42px] max-h-[100px]"
                />
                <button
                  type="button"
                  data-slot="button"
                  data-sound="tap"
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim() || insufficient}
                  aria-label="Kirim pesan"
                  className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white transition-all duration-150 hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95 shadow-xs"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              {!session?.access_token && (
                <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 text-center">
                  💡 <Link href="/login" className="text-emerald-600 dark:text-emerald-400 underline font-semibold">Masuk akun</Link> untuk berkonsultasi dengan AI Book Advisor.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
