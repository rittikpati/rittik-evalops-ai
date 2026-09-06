"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, X, AlertTriangle, Info } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id">) => void;
  success: (title: string, desc?: string) => void;
  error: (title: string, desc?: string) => void;
  warning: (title: string, desc?: string) => void;
  info: (title: string, desc?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3200);
  }, []);

  const ctx: ToastContextValue = {
    toast: add,
    success: (title, description) => add({ type: "success", title, description }),
    error: (title, description) => add({ type: "error", title, description }),
    warning: (title, description) => add({ type: "warning", title, description }),
    info: (title, description) => add({ type: "info", title, description }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="pointer-events-auto min-w-[320px] max-w-[420px] rounded-xl bg-[#1A1A1E] border border-[#2A2A28] shadow-[0_16px_48px_rgba(0,0,0,0.32)] p-4 flex gap-3"
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${t.type === "success" ? "bg-emerald-500/15 text-emerald-400" : t.type === "error" ? "bg-red-500/15 text-red-400" : t.type === "warning" ? "bg-[#C8A96E]/15 text-[#C8A96E]" : "bg-white/[0.06] text-stone-300"}`}>
                {t.type === "success" ? <Check className="h-4 w-4" /> : t.type === "error" ? <X className="h-4 w-4" /> : t.type === "warning" ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#F5F1EB] leading-tight">{t.title}</p>
                {t.description && <p className="text-xs text-stone-400 mt-1 leading-relaxed">{t.description}</p>}
              </div>
              <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="h-7 w-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-stone-500 hover:text-stone-300 shrink-0">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
