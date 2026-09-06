"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PipelineProgress } from "@/lib/ai/evaluator";
import type { EvaluationRunResponse } from "@/backend/api/evaluation/run";

export interface LiveProgress extends PipelineProgress {
  successful?: number;
  failed?: number;
}

export interface LiveRunFinal extends EvaluationRunResponse {
  runId: string;
  httpStatus: number;
}

export type LiveRunPhase = "idle" | "connecting" | "running" | "done" | "error";

export interface LiveRunState {
  phase: LiveRunPhase;
  runId?: string;
  experimentId?: string;
  progress: LiveProgress | null;
  final?: LiveRunFinal;
  error?: string;
  code?: string;
  elapsedMs: number;
}

interface ParsedEvent {
  event: string;
  data: string | null;
}

const initialState: LiveRunState = {
  phase: "idle",
  progress: null,
  elapsedMs: 0,
};

function parseSseChunk(chunk: string): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  const blocks = chunk.split(/\r?\n\s*\r?\n/);
  for (const block of blocks) {
    if (!block.trim()) continue;
    let event = "message";
    let data: string | null = null;
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data = line.slice(5).trim();
    }
    if (data !== null) out.push({ event, data });
  }
  return out;
}

/**
 * Runs a live evaluation over SSE and exposes real progress (current model,
 * test case, completed/total, successful/failed) plus the final outcome.
 */
export function useLiveRun() {
  const [state, setState] = useState<LiveRunState>(initialState);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  const start = useCallback(
    async (body: Record<string, unknown>) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      startedAtRef.current = Date.now();
      stopTimer();

      setState({
        phase: "connecting",
        runId: state.runId,
        experimentId: undefined,
        progress: null,
        final: undefined,
        elapsedMs: 0,
      });
      timerRef.current = window.setInterval(() => {
        setState((s) => (s.phase === "running" || s.phase === "connecting" ? { ...s, elapsedMs: Date.now() - startedAtRef.current } : s));
      }, 250);

      try {
        const res = await fetch("/api/evaluation/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, stream: true }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          let message = `Request failed (${res.status})`;
          let code = `HTTP_${res.status}`;
          try {
            const payload = (await res.json()) as { error?: string; code?: string };
            if (payload.error) message = payload.error;
            if (payload.code) code = payload.code;
          } catch {
            /* non-JSON error body */
          }
          stopTimer();
          setState((s) => ({ ...s, phase: "error", error: message.slice(0, 500), code }));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            for (const { event, data } of parseSseChunk(block)) {
              if (!data) continue;
              let payload: unknown;
              try {
                payload = JSON.parse(data);
              } catch {
                continue;
              }
              if (event === "started") {
                const d = payload as { runId?: string };
                setState((s) => ({ ...s, phase: "running", runId: d.runId ?? s.runId, elapsedMs: Date.now() - startedAtRef.current }));
              } else if (event === "progress") {
                const p = payload as LiveProgress;
                setState((s) => ({ ...s, phase: "running", progress: p, elapsedMs: Date.now() - startedAtRef.current }));
              } else if (event === "done") {
                const d = payload as LiveRunFinal;
                stopTimer();
                setState((s) => ({
                  ...s,
                  phase: "done",
                  runId: d.runId ?? s.runId,
                  experimentId: d.experimentId,
                  progress: null,
                  final: d,
                  elapsedMs: Date.now() - startedAtRef.current,
                }));
              } else if (event === "error") {
                const d = payload as { error?: string; code?: string };
                stopTimer();
                setState((s) => ({ ...s, phase: "error", error: (d.error ?? "Run failed").slice(0, 500), code: d.code ?? "INTERNAL" }));
              }
            }
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Unknown error";
        stopTimer();
        setState((s) => ({ ...s, phase: "error", error: message.slice(0, 500), code: "STREAM_ERROR" }));
      }
    },
    [state.runId, stopTimer]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    stopTimer();
    setState(initialState);
  }, [stopTimer]);

  return { state, start, reset };
}