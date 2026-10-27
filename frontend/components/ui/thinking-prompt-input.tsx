"use client";

import * as React from "react";
import { ArrowUp, Check, ChevronRight, Sparkles, Square } from "lucide-react";

export type ThinkingStatus = "idle" | "thinking" | "answering" | "done";
export type ThinkingStep = { id: string; text: string; status?: "active" | "complete" };
export type ThinkingSubmitOptions = { think: boolean };
export type ThinkingPromptInputProps = {
  status?: ThinkingStatus;
  prompt?: string;
  steps?: ThinkingStep[];
  answer?: string;
  elapsedSeconds?: number;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  think?: boolean;
  defaultThink?: boolean;
  onThinkChange?: (think: boolean) => void;
  onSubmit?: (value: string, options: ThinkingSubmitOptions) => void;
  onStop?: () => void;
  placeholder?: string;
  followUpPlaceholder?: string;
  answerNote?: string;
  disabled?: boolean;
  className?: string;
  history?: React.ReactNode;
  children?: React.ReactNode;
  composerExtra?: React.ReactNode;
};

const EMPTY_STEPS: ThinkingStep[] = [];
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Controlled conversation UI. Supply public progress summaries and your own response stream. */
export function ThinkingPromptInput({
  status = "idle",
  prompt = "",
  steps = EMPTY_STEPS,
  answer = "",
  elapsedSeconds = 0,
  value,
  defaultValue = "",
  onValueChange,
  think,
  defaultThink = true,
  onThinkChange,
  onSubmit,
  onStop,
  placeholder = "Ask anything",
  followUpPlaceholder = "Ask a follow-up",
  answerNote,
  disabled = false,
  className = "",
  history,
  children,
  composerExtra,
}: ThinkingPromptInputProps) {
  const [draft, setDraft] = React.useState(defaultValue);
  const [localThink, setLocalThink] = React.useState(defaultThink);
  const [expanded, setExpanded] = React.useState(false);
  const [reduced, setReduced] = React.useState(true);
  const transcript = React.useRef(null as HTMLDivElement | null);
  const transcriptBody = React.useRef(null as HTMLDivElement | null);
  const textarea = React.useRef(null as HTMLTextAreaElement | null);
  const question = React.useRef(null as HTMLDivElement | null);
  const shimmer = React.useRef(null as HTMLSpanElement | null);
  const inputRect = React.useRef(null as DOMRect | null);
  const previousTurn = React.useRef({ status, prompt });
  const regionId = React.useId();
  const inputValue = value ?? draft;
  const thinkingEnabled = think ?? localThink;
  const busy = status === "thinking" || status === "answering";
  const open = status === "thinking" || expanded;
  const seconds = Number.isFinite(elapsedSeconds) ? Math.max(0, Math.round(elapsedSeconds)) : 0;
  const inputPlaceholder = status === "idle" ? placeholder : followUpPlaceholder;
  const paragraphs = answer.split("\n").filter(Boolean);
  const lastBoundary = [...answer.matchAll(/[.!?。！？](?=\s|$)|[\n]/g)].at(-1);
  const completeAnswer = status === "done" ? answer : answer.slice(0, lastBoundary ? lastBoundary.index + 1 : 0).trim();

  function scrollToLatest() {
    const panel = transcript.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Deps sengaja tetap `[status]`: hanya transisi status yang menutup panel,
  // bukan setiap render ulang.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (status === "thinking" || status === "idle") setExpanded(false);
  }, [status]);

  // Capture the previous input rectangle before resizing the now-empty composer.
  React.useLayoutEffect(() => {
    const previous = previousTurn.current;
    previousTurn.current = { status, prompt };
    const newTurn = status !== "idle" && (previous.status === "idle" || previous.prompt !== prompt || (previous.status === "done" && busy));
    const from = inputRect.current;
    const bubble = question.current;
    const panel = transcript.current;
    if (!newTurn || !from || !bubble || !panel || reduced) return;
    let disposed = false;
    let animation = null as Animation | null;
    queueMicrotask(() => {
      if (disposed || typeof bubble.animate !== "function") return;
      const to = bubble.getBoundingClientRect();
      if (!to.width || !to.height) return;
      // Let the bubble cross the gap from the composer, then restore scrolling.
      panel.style.overflow = "visible";
      animation = bubble.animate([
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` },
        { transform: "translate(0px, 0px) scale(1, 1)" },
      ], { duration: 560, easing: EASE });
      animation.onfinish = () => { panel.style.overflow = ""; scrollToLatest(); };
    });
    return () => { disposed = true; animation?.cancel(); panel.style.overflow = ""; };
  }, [status, prompt, busy, reduced]);

  // Only the composer grows for multiline drafts; the transcript remains above it.
  React.useLayoutEffect(() => {
    const input = textarea.current;
    if (!input) return;
    let disposed = false;
    let animation = null as Animation | null;
    queueMicrotask(() => {
      if (disposed) return;
      const before = input.getBoundingClientRect().height;
      input.style.height = "auto";
      const height = Math.max(64, Math.min(input.scrollHeight, 120));
      input.style.height = `${height}px`;
      if (!reduced && Math.abs(before - height) > 1 && typeof input.animate === "function") {
        animation = input.animate([{ height: `${before}px` }, { height: `${height}px` }], { duration: 200, easing: EASE });
      }
      const rect = input.getBoundingClientRect();
      const style = getComputedStyle(input);
      const left = Number.parseFloat(style.paddingLeft);
      const top = Number.parseFloat(style.paddingTop);
      inputRect.current = new DOMRect(rect.left + left, rect.top + top, rect.width - left - Number.parseFloat(style.paddingRight), height - top - Number.parseFloat(style.paddingBottom));
    });
    return () => { disposed = true; animation?.cancel(); };
  }, [inputValue, reduced]);

  React.useLayoutEffect(() => {
    const panel = transcript.current;
    const body = transcriptBody.current;
    if (!panel || !body) return;
    let disposed = false;
    const scrollToBottom = () => {
      if (!disposed) scrollToLatest();
    };
    queueMicrotask(scrollToBottom);
    const observer = new ResizeObserver(scrollToBottom);
    observer.observe(body);
    observer.observe(panel);
    return () => { disposed = true; observer.disconnect(); };
  }, [status, prompt, steps, answer, answerNote, open, history, children]);

  React.useEffect(() => {
    const element = shimmer.current;
    if (status !== "thinking" || reduced || !element) return;
    let disposed = false;
    let animation = null as Animation | null;
    queueMicrotask(() => {
      if (disposed || typeof element.animate !== "function") return;
      animation = element.animate([
        { backgroundPosition: "100% 0" },
        { backgroundPosition: "0% 0" },
      ], { duration: 1800, iterations: Infinity, easing: "linear" });
    });
    return () => { disposed = true; animation?.cancel(); };
  }, [status, reduced]);

  React.useLayoutEffect(() => {
    const body = transcriptBody.current;
    if (!body || !open || reduced) return;
    let disposed = false;
    const animations: Animation[] = [];
    queueMicrotask(() => {
      if (disposed) return;
      body.querySelectorAll("[data-step]").forEach((row, index) => {
        if (!(row instanceof HTMLElement) || row.dataset.entered || typeof row.animate !== "function") return;
        row.dataset.entered = "true";
        animations.push(row.animate([
          { opacity: 0, transform: "translateY(10px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ], { duration: 420, delay: index * 45, easing: EASE, fill: "backwards" }));
      });
    });
    return () => { disposed = true; animations.forEach((animation) => animation.cancel()); };
  }, [status, steps, open, reduced]);

  function changeValue(next: string) {
    if (value === undefined) setDraft(next);
    onValueChange?.(next);
  }

  function submit() {
    const message = inputValue.trim();
    if (!message || busy || disabled || !onSubmit) return;
    onSubmit(message, { think: thinkingEnabled });
    changeValue("");
  }

  const showTranscript = status !== "idle" || Boolean(history);

  return (
    <div data-slot="thinking-prompt-input" data-state={status} className={`flex h-full min-h-0 w-full flex-col text-foreground ${className}`}>
      {showTranscript && (
        <div ref={transcript} data-transcript role="region" aria-label="Conversation" tabIndex={0} className="mb-3 min-h-0 flex-1 overflow-y-auto px-1 outline-none [overflow-anchor:none] focus-visible:ring-2 focus-visible:ring-chat-success/50 focus-visible:ring-inset">
          <div ref={transcriptBody} className="space-y-4 py-2">
            {history}
            {status !== "idle" && (
              <>
                <div ref={question} data-question className="ml-auto w-fit max-w-[92%] origin-top-left rounded-2xl rounded-br-md bg-bubble-sent px-3.5 py-2.5 text-xs sm:text-[13px] leading-5 text-bubble-sent-foreground shadow-xs">
                  <p className="break-words font-medium">{prompt}</p>
                </div>
                <div data-assistant className="min-w-0">
                  {(steps.length > 0 || status === "thinking") && (
                    <>
                      <button
                        type="button"
                        data-thought-toggle
                        aria-expanded={open}
                        aria-controls={regionId}
                        disabled={status === "thinking"}
                        onClick={() => setExpanded(!expanded)}
                        className={`flex h-7 max-w-full items-center gap-2 rounded-full text-xs outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-chat-success/50 ${status === "thinking" ? "w-full text-muted-foreground" : "border border-border/80 bg-surface-muted px-2.5 text-muted-foreground hover:bg-chat-success-soft hover:text-chat-success-ink"}`}
                      >
                        <Sparkles className="size-3.5 shrink-0 text-chat-success" aria-hidden="true" />
                        {status === "thinking" ? (
                          <span ref={shimmer} data-shimmer className={reduced ? "text-muted-foreground" : "bg-[linear-gradient(90deg,var(--color-muted-foreground)_0%,var(--color-muted-foreground)_42%,var(--color-foreground)_50%,var(--color-muted-foreground)_58%,var(--color-muted-foreground)_100%)] bg-[length:250%_100%] bg-clip-text text-transparent font-medium"}>
                            Menganalisis katalog...
                          </span>
                        ) : <span>Dianalisis dalam {seconds}s</span>}
                        {status === "thinking" ? (
                          <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">{seconds}s</span>
                        ) : (
                          <ChevronRight className={`size-3.5 transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`} aria-hidden="true" />
                        )}
                      </button>
                      <div id={regionId} data-reasoning hidden={!open} className="pt-3">
                        <ol className="relative ml-[7px] space-y-1 border-l border-border/80 pl-5">
                          {steps.map((step) => (
                            <li key={step.id} data-step={step.id} className="relative flex min-h-8 items-center gap-3 py-1.5 text-xs leading-5">
                              <span className="absolute -left-[26px] flex size-[11px] items-center justify-center rounded-full bg-background ring-4 ring-background">
                                {step.status === "complete" ? (
                                  <Check className="size-3 text-chat-success" aria-label="Complete" />
                                ) : (
                                  <span className="size-1.5 rounded-full bg-chat-success motion-safe:animate-pulse" aria-label="In progress" />
                                )}
                              </span>
                              <span className={step.status === "active" ? "text-foreground font-medium" : "text-muted-foreground"}>{step.text}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </>
                  )}
                  {(status === "answering" || status === "done") && (
                    <div data-answer role="region" aria-label="Response" aria-live="off" className="mt-3 space-y-2.5 text-[13px] leading-6 break-words text-foreground">
                      {paragraphs.map((paragraph, index) => (
                        <p key={index}>
                          {paragraph}
                          {status === "answering" && index === paragraphs.length - 1 && (
                            <span data-cursor aria-hidden="true" className="ml-1 inline-block h-3.5 w-1 translate-y-0.5 rounded-full bg-chat-success motion-safe:animate-pulse" />
                          )}
                        </p>
                      ))}
                      {status === "answering" && paragraphs.length === 0 && (
                        <span data-cursor aria-hidden="true" className="inline-block h-3.5 w-1 rounded-full bg-chat-success motion-safe:animate-pulse" />
                      )}
                      {children}
                      {answerNote && status === "done" && <p className="text-[11px] leading-4 text-muted-foreground mt-2">{answerNote}</p>}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {composerExtra && <div className="shrink-0 mb-2">{composerExtra}</div>}

      <form
        data-composer
        className="relative mt-auto shrink-0 rounded-2xl border border-border/80 bg-card p-2.5 shadow-[0_1px_2px_rgba(16,24,20,0.04),0_12px_28px_-20px_rgba(16,24,20,0.4)] transition-[border-color,box-shadow] duration-200 focus-within:border-chat-success/55 focus-within:shadow-[0_1px_2px_rgba(16,24,20,0.04),0_16px_32px_-22px_rgba(16,185,129,0.55)] motion-reduce:transition-none"
        onSubmit={(event) => { event.preventDefault(); submit(); }}
      >
        <textarea
          ref={textarea}
          aria-label={inputPlaceholder}
          placeholder={inputPlaceholder}
          value={inputValue}
          disabled={disabled}
          rows={2}
          onChange={(event) => changeValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          className="block h-14 min-h-14 w-full resize-none rounded-xl bg-transparent px-1.5 py-1 text-[13px] leading-5 tracking-tight text-foreground outline-none placeholder:text-muted-foreground/80 focus-visible:ring-0 disabled:opacity-50"
        />
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
          <button
            type="button"
            aria-pressed={thinkingEnabled}
            disabled={disabled || busy}
            onClick={() => {
              if (think === undefined) setLocalThink(!thinkingEnabled);
              onThinkChange?.(!thinkingEnabled);
            }}
            className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-chat-success/50 focus-visible:outline-none disabled:opacity-50 ${thinkingEnabled ? "border-chat-success/35 bg-chat-success-soft font-semibold text-chat-success-ink" : "border-border bg-card text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}
          >
            <Sparkles className="size-3" aria-hidden="true" />
            Think Mode
            {thinkingEnabled && <Check className="size-2.5" aria-hidden="true" />}
          </button>
          <button
            type={busy ? "button" : "submit"}
            data-stop={busy ? "" : undefined}
            aria-label={busy ? "Stop" : "Send prompt"}
            onClick={busy ? (event) => { event.preventDefault(); onStop?.(); } : undefined}
            disabled={disabled || (busy ? !onStop : !inputValue.trim() || !onSubmit)}
            className="relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-chat-success text-white outline-none transition-[background-color,box-shadow,scale] duration-200 hover:bg-chat-success-ink focus-visible:ring-2 focus-visible:ring-chat-success/50 focus-visible:ring-offset-1 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100 motion-reduce:transition-none dark:text-chat-success-soft"
          >
            <span data-action-icon="send" aria-hidden="true" className={`absolute inset-0 flex items-center justify-center transition-[opacity,scale] duration-200 motion-reduce:transition-none ${busy ? "scale-75 opacity-0" : "scale-100 opacity-100"}`}>
              <ArrowUp className="size-4" strokeWidth={2.2} />
            </span>
            <span data-action-icon="stop" aria-hidden="true" className={`absolute inset-0 flex items-center justify-center transition-[opacity,scale] duration-200 motion-reduce:transition-none ${busy ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}>
              <Square className="size-3 fill-current" />
            </span>
          </button>
        </div>
      </form>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-announcement>
        {status === "thinking" ? `Thinking. ${steps.at(-1)?.text ?? ""}` : completeAnswer}
      </div>
    </div>
  );
}
