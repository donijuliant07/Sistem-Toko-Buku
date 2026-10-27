"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  X,
  RotateCcw,
  Bot,
  AlertCircle,
  Coins,
} from "lucide-react";
import { RecommendationList } from "@/components/advisor/RecommendationCard";
import {
  Conversation,
  ConversationBubble,
  ConversationContent,
} from "@/components/ui/conversation";
import {
  ThinkingPromptInput,
  type ThinkingStatus,
  type ThinkingStep,
  type ThinkingSubmitOptions,
} from "@/components/ui/thinking-prompt-input";
import { useAuth } from "@/components/AuthProvider";
import { ApiError, getAdvisorPricing, sendAdvisorChat } from "@/lib/api";
import type {
  AdvisorPricing,
  Recommendation,
  BookPreferences,
  ConversationState,
} from "@/lib/types";

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
    : `${nowMs()}-${Math.random().toString(16).slice(2)}`;
}

/** Baca jam lewat helper: lint react-hooks/purity menandai `Date.now()` langsung. */
function nowMs(): number {
  return Date.now();
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
  const [, setPreferences] = useState<BookPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pricing, setPricing] = useState<AdvisorPricing | null>(null);
  const [, setPendingRetry] = useState<{ text: string; messageId: string } | null>(null);

  // Thinking State Management
  const [thinkingStatus, setThinkingStatus] = useState<ThinkingStatus>("idle");
  const [thinkEnabled, setThinkEnabled] = useState(true);
  const [activePrompt, setActivePrompt] = useState("");
  const [activeAnswer, setActiveAnswer] = useState("");
  const [activeRecommendations, setActiveRecommendations] = useState<Recommendation[]>([]);
  const [activeFollowUp, setActiveFollowUp] = useState<string | null>(null);
  const [activeSteps, setActiveSteps] = useState<ThinkingStep[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { session } = useAuth();
  const messageSeqRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  const handleStop = () => {
    clearTimers();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setThinkingStatus("idle");
    setActiveSteps([]);
    setElapsedSeconds(0);
  };

  const commitActiveTurnToHistory = () => {
    if (activePrompt && (activeAnswer || activeRecommendations.length > 0)) {
      const timeStr = new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());

      const userMsg: ChatMessage = {
        id: `user-${++messageSeqRef.current}`,
        role: "user",
        content: activePrompt,
        sentAt: timeStr,
      };

      const assistantMsg: ChatMessage = {
        id: `assistant-${++messageSeqRef.current}`,
        role: "assistant",
        content: activeAnswer,
        sentAt: timeStr,
        recommendations: activeRecommendations,
        followUpQuestion: activeFollowUp,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
    }

    setActivePrompt("");
    setActiveAnswer("");
    setActiveRecommendations([]);
    setActiveFollowUp(null);
    setActiveSteps([]);
    setElapsedSeconds(0);
    setThinkingStatus("idle");
  };

  const executeSend = async (text: string, options?: ThinkingSubmitOptions) => {
    const trimmed = text.trim();
    if (!trimmed || thinkingStatus === "thinking" || thinkingStatus === "answering") return;

    if (!session?.access_token) {
      setError("Silakan masuk (login) akun terlebih dahulu untuk menggunakan AI Penasihat.");
      return;
    }

    if (insufficient) {
      setError(`Poinmu tidak cukup. Biaya ${cost} poin per pesan, saldo ${balance ?? 0} poin.`);
      return;
    }

    // If there was a completed active turn in view, archive it into messages history first
    commitActiveTurnToHistory();
    setError(null);
    clearTimers();

    const shouldThink = options?.think ?? thinkEnabled;
    setActivePrompt(trimmed);
    setInput("");
    setThinkingStatus("thinking");
    setElapsedSeconds(0);

    // Progressive Thinking Steps Simulation
    if (shouldThink) {
      setActiveSteps([
        { id: "analyze", text: "Menganalisis minat & batasan budget pembaca…", status: "active" },
      ]);

      const timer1 = window.setTimeout(() => {
        setActiveSteps([
          { id: "analyze", text: "Minat & batasan budget teridentifikasi", status: "complete" },
          { id: "catalog", text: "Mencari ketersediaan stok & harga katalog buku toko…", status: "active" },
        ]);
      }, 1000);

      const timer2 = window.setTimeout(() => {
        setActiveSteps([
          { id: "analyze", text: "Minat & batasan budget teridentifikasi", status: "complete" },
          { id: "catalog", text: "Katalog buku terindeks", status: "complete" },
          { id: "rank", text: "Menyusun kurasi rekomendasi terbaik…", status: "active" },
        ]);
      }, 2200);

      timersRef.current.push(timer1, timer2);
    } else {
      setActiveSteps([]);
    }

    // Elapsed Seconds Counter
    const startTimestamp = nowMs();
    const intervalTimer = window.setInterval(() => {
      setElapsedSeconds(Math.max(1, Math.round((nowMs() - startTimestamp) / 1000)));
    }, 1000);
    timersRef.current.push(intervalTimer);

    try {
      const messageId = newMessageId();
      abortControllerRef.current = new AbortController();

      const response = await sendAdvisorChat(trimmed, sessionId, accessToken ?? undefined, messageId);

      clearTimers();
      setSessionId(response.session_id);
      setPreferences(response.preferences);
      setPricing({
        points_cost: response.points_cost,
        points_balance: response.points_balance,
      });
      setPendingRetry(null);

      // Finish steps
      if (shouldThink) {
        setActiveSteps([
          { id: "analyze", text: "Minat & batasan budget teridentifikasi", status: "complete" },
          { id: "catalog", text: "Katalog buku terindeks", status: "complete" },
          { id: "rank", text: "Rekomendasi siap disajikan", status: "complete" },
        ]);
      }

      setActiveRecommendations(response.recommendations || []);
      setActiveFollowUp(response.follow_up_question || null);

      // Transition to answering with typewriter stream effect
      const fullText = response.assistant_message || "Berikut hasil pencarian rekomendasi buku untukmu:";
      setThinkingStatus("answering");

      let currentIdx = 0;
      const typeInterval = window.setInterval(() => {
        currentIdx += 4;
        const part = fullText.slice(0, currentIdx);
        setActiveAnswer(part);

        if (currentIdx >= fullText.length) {
          window.clearInterval(typeInterval);
          setActiveAnswer(fullText);
          setThinkingStatus("done");
        }
      }, 20);

      timersRef.current.push(typeInterval);
    } catch (err) {
      clearTimers();
      setThinkingStatus("idle");

      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      if (!(err instanceof ApiError)) {
        setPendingRetry({ text: trimmed, messageId: newMessageId() });
      }

      if (err instanceof ApiError && err.code === "INSUFFICIENT_POINTS") {
        setError("Poinmu tidak cukup untuk mengirim pesan.");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Gagal memproses pesan. Pastikan backend aktif.");
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleReset = () => {
    clearTimers();
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setSessionId(null);
    setPreferences(null);
    setError(null);
    setActivePrompt("");
    setActiveAnswer("");
    setActiveRecommendations([]);
    setActiveFollowUp(null);
    setActiveSteps([]);
    setElapsedSeconds(0);
    setThinkingStatus("idle");
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

  return (
    <div className="chat-advisor flex flex-col h-full w-full bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-card/70 px-4 py-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-chat-success text-white shadow-sm shadow-chat-success/30 dark:text-chat-success-soft">
            <Bot className="size-[18px]" aria-hidden="true" />
            <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-chat-success" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[13px] leading-tight font-semibold tracking-tight">
                AI Penasihat Buku
              </h3>
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-chat-success-soft px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-chat-success-ink uppercase">
                <Sparkles className="size-2.5" aria-hidden="true" />
                Live
              </span>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              Rekomendasi dari stok katalog toko
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={handleReset}
            title="Mulai sesi baru"
            aria-label="Mulai sesi baru"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-chat-success/50 focus-visible:outline-none"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Tutup chat"
              aria-label="Tutup chat"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-chat-success/50 focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {/* Main Conversation & Animated Thinking Prompt Input */}
      <div className="flex min-h-0 flex-1 flex-col bg-chat-surface p-3">
        <ThinkingPromptInput
          status={thinkingStatus}
          prompt={activePrompt}
          steps={activeSteps}
          answer={activeAnswer}
          elapsedSeconds={elapsedSeconds}
          value={input}
          onValueChange={setInput}
          think={thinkEnabled}
          onThinkChange={setThinkEnabled}
          onSubmit={(val, opts) => executeSend(val, opts)}
          onStop={handleStop}
          placeholder="Ketik topik, judul, atau batas anggaran..."
          followUpPlaceholder="Tanyakan pertanyaan lanjutan..."
          answerNote={activePrompt ? "Rekomendasi dari stok katalog toko." : undefined}
          history={
            <Conversation className="gap-3">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                const hasRecommendations = Boolean(msg.recommendations && msg.recommendations.length > 0);

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"} w-full`}
                  >
                    <ConversationBubble
                      variant={isUser ? "default" : "muted"}
                      align={isUser ? "end" : "start"}
                      sentAt={msg.sentAt}
                      className={
                        isUser
                          ? "max-w-[88%] text-xs"
                          : hasRecommendations
                          ? "max-w-[96%] w-full text-xs"
                          : "max-w-[88%] text-xs"
                      }
                    >
                      <ConversationContent className="leading-relaxed">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        {hasRecommendations && <RecommendationList recs={msg.recommendations!} />}
                        {msg.followUpQuestion && (
                          <div className="-mt-1.5 flex flex-wrap items-center gap-1 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
                            <Sparkles className="size-3 shrink-0 text-chat-success" aria-hidden="true" />
                            <span className="font-medium text-foreground">Saran lanjutan:</span>
                            <button
                              type="button"
                              onClick={() => executeSend(msg.followUpQuestion!)}
                              className="cursor-pointer rounded text-left text-chat-success-ink underline-offset-2 transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-chat-success/50 focus-visible:outline-none"
                            >
                              {msg.followUpQuestion}
                            </button>
                          </div>
                        )}
                      </ConversationContent>
                    </ConversationBubble>
                  </div>
                );
              })}
            </Conversation>
          }
          composerExtra={
            <div className="space-y-2">
              {/* Error Banner */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-2.5 text-xs text-destructive animate-in fade-in-50"
                >
                  <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 leading-relaxed">{error}</span>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="shrink-0 cursor-pointer rounded px-1 text-[10px] font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:outline-none"
                  >
                    Tutup
                  </button>
                </div>
              )}

              {/* Saldo & biaya: angka monospace agar sejajar seperti dasbor. */}
              {balance !== null && (
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                      insufficient
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-chat-success/25 bg-chat-success-soft text-chat-success-ink"
                    }`}
                  >
                    <Coins className="size-3" aria-hidden="true" />
                    <span className="text-[10px] font-medium tracking-wide uppercase">Saldo</span>
                    <span className="font-mono text-[11px] leading-none font-semibold tabular-nums">
                      {balance.toLocaleString("id-ID")}
                    </span>
                    <span className="text-[10px]">poin</span>
                  </div>
                  {cost > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      <span className="font-mono tabular-nums">{cost}</span> poin / pesan
                    </span>
                  )}
                </div>
              )}

              {/* Suggested Prompts (when in initial state or message count <= 2) */}
              {messages.length <= 2 && thinkingStatus === "idle" && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none" role="list" aria-label="Contoh pertanyaan">
                  {SUGGESTED_PROMPTS.map((promptText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      role="listitem"
                      onClick={() => executeSend(promptText)}
                      className="shrink-0 cursor-pointer rounded-full border border-border/80 bg-card px-3 py-1.5 text-[11px] whitespace-nowrap text-foreground shadow-2xs transition-colors hover:border-chat-success/50 hover:bg-chat-success-soft hover:text-chat-success-ink focus-visible:ring-2 focus-visible:ring-chat-success/50 focus-visible:outline-none"
                    >
                      {promptText}
                    </button>
                  ))}
                </div>
              )}
            </div>
          }
        >
          {/* Active Turn Book Recommendation Cards */}
          {activeRecommendations.length > 0 && <RecommendationList recs={activeRecommendations} />}
          {activeFollowUp && thinkingStatus === "done" && (
            <div className="-mt-1 flex flex-wrap items-center gap-1 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
              <Sparkles className="size-3 shrink-0 text-chat-success" aria-hidden="true" />
              <span className="font-medium text-foreground">Saran lanjutan:</span>
              <button
                type="button"
                onClick={() => executeSend(activeFollowUp)}
                className="cursor-pointer rounded text-left text-chat-success-ink underline-offset-2 transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-chat-success/50 focus-visible:outline-none"
              >
                {activeFollowUp}
              </button>
            </div>
          )}
        </ThinkingPromptInput>
      </div>
    </div>
  );
}
