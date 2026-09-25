"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, CircleAlert, LoaderCircle, ScanLine, WifiOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { createScanAttempt, isImmediateDuplicate, type ScanAttempt } from "@/rules/scanner.rules";
import { cn } from "@/lib/utils";

export type ScannerFeedbackKind = "success" | "duplicate" | "unknown" | "error" | "offline";

export interface ScannerFeedback {
  kind: ScannerFeedbackKind;
  title: string;
  message?: string;
}

export interface ScannerInputProps {
  onScan: (attempt: ScanAttempt) => Promise<ScannerFeedback>;
  placeholder?: string;
  duplicateWindowMs?: number;
  soundEnabled?: boolean;
  disabled?: boolean;
  className?: string;
  inputLabel?: string;
}

const FEEDBACK_STYLES: Record<ScannerFeedbackKind, string> = {
  success: "border-[#8ad9ca] bg-[#e9fbf5] text-[#08725f]",
  duplicate: "border-[#f3ce77] bg-[#fff8e5] text-[#8a5a00]",
  unknown: "border-[#f0a7a2] bg-[#fff1f0] text-[#a53831]",
  error: "border-[#f0a7a2] bg-[#fff1f0] text-[#a53831]",
  offline: "border-[#9ec6ed] bg-[#eef7ff] text-[#225f99]",
};

function FeedbackIcon({ kind }: { kind: ScannerFeedbackKind }) {
  if (kind === "success") return <BadgeCheck className="size-7" />;
  if (kind === "offline") return <WifiOff className="size-7" />;
  return <CircleAlert className="size-7" />;
}

function playFeedbackSound(kind: ScannerFeedbackKind): void {
  if (typeof window === "undefined") return;
  const browserWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  const AudioConstructor = window.AudioContext ?? browserWindow.webkitAudioContext;
  if (!AudioConstructor) return;
  try {
    const context = new AudioConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = kind === "success" ? 880 : kind === "offline" ? 560 : 240;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.13, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    oscillator.addEventListener("ended", () => void context.close(), { once: true });
  } catch {
    // Visual feedback remains available when audio is blocked by the browser.
  }
}

export function ScannerInput({
  onScan,
  placeholder = "Escanea o escribe el identificador",
  duplicateWindowMs = 1_500,
  soundEnabled = true,
  disabled = false,
  className,
  inputLabel = "Identificador del gafete",
}: ScannerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const lastScanRef = useRef<{ identifier: string; timestamp: number } | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [value, setValue] = useState("");
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<ScannerFeedback | null>(null);

  const recoverFocus = useCallback(() => {
    if (!disabled) window.setTimeout(() => inputRef.current?.focus(), 40);
  }, [disabled]);

  useEffect(() => {
    recoverFocus();
    const refocus = () => recoverFocus();
    window.addEventListener("focus", refocus);
    return () => {
      window.removeEventListener("focus", refocus);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [recoverFocus]);

  const showFeedback = useCallback((next: ScannerFeedback) => {
    setFeedback(next);
    if (soundEnabled) playFeedbackSound(next.kind);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setFeedback(null), 4_500);
  }, [soundEnabled]);

  const submit = useCallback(async () => {
    const attempt = createScanAttempt(value);
    setValue("");
    recoverFocus();
    if (!attempt.identifier || processingRef.current || disabled) return;
    const now = Date.now();
    if (isImmediateDuplicate(lastScanRef.current, attempt.identifier, now, duplicateWindowMs)) {
      showFeedback({ kind: "duplicate", title: "Escaneo repetido", message: "El lector envió el mismo código dos veces. No se creó otro registro." });
      return;
    }
    lastScanRef.current = { identifier: attempt.identifier, timestamp: now };
    processingRef.current = true;
    setProcessing(true);
    setFeedback(null);
    try {
      showFeedback(await onScan(attempt));
    } catch (error) {
      showFeedback({ kind: "error", title: "No se pudo procesar", message: error instanceof Error ? error.message : "Intenta nuevamente." });
    } finally {
      processingRef.current = false;
      setProcessing(false);
      recoverFocus();
    }
  }, [disabled, duplicateWindowMs, onScan, recoverFocus, showFeedback, value]);

  return (
    <div className={cn("w-full space-y-4", className)}>
      <div className="relative">
        <ScanLine className="pointer-events-none absolute left-5 top-1/2 size-7 -translate-y-1/2 text-[#249aaf]" aria-hidden="true" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          onBlur={recoverFocus}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label={inputLabel}
          placeholder={placeholder}
          className="h-18 rounded-2xl border-2 border-[#b8d9e8] bg-white pl-16 pr-14 font-mono text-lg font-bold tracking-wide shadow-[0_12px_35px_rgba(19,67,92,.08)] focus-visible:border-[#18aaa6] focus-visible:ring-[#bfeeea]"
        />
        {processing && <LoaderCircle className="absolute right-5 top-1/2 size-6 -translate-y-1/2 animate-spin text-[#1769e0]" aria-label="Procesando" />}
      </div>
      <div aria-live="polite" aria-atomic="true" className="min-h-24">
        {feedback && <div className={`flex items-start gap-4 rounded-2xl border p-5 ${FEEDBACK_STYLES[feedback.kind]}`}><FeedbackIcon kind={feedback.kind} /><div><p className="text-lg font-extrabold">{feedback.title}</p>{feedback.message && <p className="mt-1 text-sm leading-5 opacity-85">{feedback.message}</p>}</div></div>}
      </div>
    </div>
  );
}
