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
  charged?: number;
  refunded?: number;
  ruleBased?: boolean;
}

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

export default function BookAdvisorWidget({ onClose }: { onClose?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<BookPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, "liked" | "not_relevant">>({});
  const [pricing, setPricing] = useState<AdvisorPricing | null>(null);
  const [pendingRetry, setPendingRetry] = useState<{ text: string; messageId: string } | null>(null);

  const { session } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageSeqRef = useRef(0);

  const accessToken = session?.access_token ?? null;

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getAdvisorPricing(accessToken)
      .then((data) => {
        if (!cancelled) setPricing(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const cost = pricing?.points_cost ?? 0;
  const balance = pricing?.points_balance ?? null;
  const insufficient = balance !== null && cost > 0 && balance < cost;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string, messageId: string) => {
    if (!accessToken) return;
    setIsLoading(true);

    try {
      const response = await sendAdvisorChat(text, sessionId, accessToken, messageId);
      setSessionId(response.session_id);
      setPreferences(response.preferences);
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
        setPendingRetry({ text, messageId });
      }
      if (err instanceof ApiError && err.code === "INSUFFICIENT_POINTS") {
        setError("Poinmu tidak cukup untuk mengirim pesan.");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Gagal memproses pesan. Pastikan backend aktif.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    if (!session?.access_token) {
      setError("Silakan masuk (login) akun terlebih dahulu.");
      return;
    }

    if (insufficient) {
      setError(`Poinmu tidak cukup. Biaya ${cost} poin per pesan, saldo ${balance ?? 0} poin.`);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-[#141f1a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/90 dark:bg-[#182620]/90">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 tracking-tight truncate">
                AI Penasihat Buku
              </h3>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              Rekomendasi dari stok & harga katalog kami
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            title="Mulai sesi baru"
            className="flex size-7 items-center justify-center rounded text-gray-500 hover:text-gray-900 dark:text-gray-400 hover:bg-gray-200/50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded text-gray-500 hover:text-gray-900 dark:text-gray-400 hover:bg-gray-200/50"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/40 dark:bg-[#0e1613]/40">
        <Conversation className="gap-3">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const hasRecommendations = Boolean(msg.recommendations && msg.recommendations.length > 0);

            return (
              <div key={msg.id} className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"} w-full`}>
                <ConversationBubble
                  variant={isUser ? "default" : "muted"}
                  align={isUser ? "end" : "start"}
                  sentAt={msg.sentAt}
                  className={isUser ? "max-w-[85%]" : hasRecommendations ? "max-w-[96%] w-full" : "max-w-[85%]"}
                >
                  <ConversationContent className="leading-relaxed">
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {hasRecommendations && (
                      <div className="mt-3.5 space-y-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase">
                          <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Rekomendasi ({msg.recommendations!.length})</span>
                        </div>

                        <div className="space-y-2">
                          {msg.recommendations!.map((rec) => (
                            <div key={rec.book.id} className="p-3 rounded-xl bg-white dark:bg-[#182620] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 shadow-xs">
                              <div className="flex gap-3">
                                {rec.book.cover_url && (
                                  <img src={rec.book.cover_url} alt={rec.book.title} className="h-16 w-12 object-cover rounded-lg" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-bold truncate">{rec.book.title}</h4>
                                  <p className="text-[11px] text-gray-500 truncate">{rec.book.author}</p>
                                  <span className="text-sm font-black text-emerald-600">{formatRupiah(Number(rec.book.price))}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </ConversationContent>
                </ConversationBubble>
              </div>
            );
          })}

          {isLoading && (
            <div className="text-xs text-gray-500 py-1 font-medium">AI sedang berpikir...</div>
          )}
        </Conversation>
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-[#182620]/40">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(prompt)}
                className="px-2.5 py-1 rounded-full text-[11px] bg-white border border-gray-200 text-gray-800 hover:border-emerald-500 transition-colors whitespace-nowrap shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141f1a]">
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#182620] rounded-xl px-3 py-1.5">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik topik, judul, atau anggaran..."
            className="flex-1 bg-transparent text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none resize-none"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}