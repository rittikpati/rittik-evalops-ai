"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, ArrowRight, Command } from "lucide-react";
import { useRouter } from "next/navigation";

const commands = [
  { label: "Go to Dashboard", href: "/dashboard", desc: "Overview & metrics" },
  { label: "Go to Datasets", href: "/datasets", desc: "Manage datasets" },
  { label: "Go to Models", href: "/models", desc: "Model registry" },
  { label: "Create Experiment", href: "/experiments/new", desc: "New evaluation" },
  { label: "View Experiments", href: "/experiments", desc: "All experiments" },
  { label: "Compare Models", href: "/comparison", desc: "Side-by-side" },
  { label: "View Evaluations", href: "/evaluations", desc: "Detailed results" },
  { label: "Open Settings", href: "/settings", desc: "Workspace & API keys" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()) || c.desc.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-start justify-center pt-[20vh] p-4 bg-[#0F0F0F]/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="w-full max-w-xl bg-[#1A1A1E] border border-[#2A2A28] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.4)] overflow-hidden"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 h-14 border-b border-[#2A2A28]">
                <Search className="h-4 w-4 text-stone-500" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search commands, datasets, models..."
                  className="flex-1 bg-transparent outline-none text-sm text-[#F5F1EB] placeholder:text-stone-500"
                />
                <kbd className="px-1.5 py-0.5 text-xs bg-[#0F0F0F] border border-[#2A2A28] rounded text-stone-500">ESC</kbd>
              </div>
              <div className="max-h-80 overflow-auto p-2">
                {filtered.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-stone-500">No results for “{query}”</p>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.href}
                      onClick={() => {
                        setOpen(false);
                        router.push(c.href);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.06] text-left group"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#F5F1EB] group-hover:text-white">{c.label}</p>
                        <p className="text-xs text-stone-500">{c.desc}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-stone-600 group-hover:text-[#C8A96E] group-hover:translate-x-0.5 transition" />
                    </button>
                  ))
                )}
              </div>
              <div className="px-4 py-2.5 bg-[#0F0F0F] border-t border-[#1A1A1E] flex items-center justify-between text-xs text-stone-500">
                <span className="flex items-center gap-1.5"><Command className="h-3 w-3" /> + K to open</span>
                <span>↑↓ navigate • Enter select</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
