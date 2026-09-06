"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { cn } from "@/frontend/lib/utils";

const CommandPalette = dynamic(() => import("@/components/ui/CommandPalette").then((m) => m.CommandPalette), {
  ssr: false,
  loading: () => null,
});

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

export function DashboardLayout({ children, className = "" }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className={cn("min-h-screen bg-[#0F0F0F] relative", className)}>
      <ScrollProgress />
      <CommandPalette />
      <div className="pointer-events-none fixed inset-0 gradient-mesh opacity-60" aria-hidden="true" />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          className="relative pt-[64px] lg:pl-72 min-h-screen"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
            {children}
          </div>
        </motion.main>
      </AnimatePresence>

      {sidebarOpen && (
        <motion.div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

interface PageContainerProps {
  children: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageContainer({ children, title, description, action, className = "" }: PageContainerProps) {
  return (
    <motion.div
      className={cn("space-y-8", className)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {(title || action) && (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 mb-2">
          <div>
            {title && (
              <h1 className="font-serif text-4xl tracking-[-0.02em] text-[#F5F1EB] leading-none">{title}</h1>
            )}
            {description && (
              <p className="mt-2.5 text-[15px] leading-relaxed text-stone-400 max-w-2xl">{description}</p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </motion.div>
  );
}

interface SectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function Section({ children, title, description, action, className = "" }: SectionProps) {
  return (
    <motion.div
      className={cn("space-y-5", className)}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {(title || action) && (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            {title && <h2 className="font-serif text-[22px] tracking-tight text-[#F5F1EB]">{title}</h2>}
            {description && <p className="text-sm text-stone-500 mt-1">{description}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </motion.div>
  );
}

interface GridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: number;
  className?: string;
}

export function Grid({ children, columns = 3, gap = 6, className = "" }: GridProps) {
  return (
    <div
      className={cn(
        "grid gap-6",
        {
          "grid-cols-1": columns === 1,
          "sm:grid-cols-2": columns >= 2,
          "lg:grid-cols-3": columns >= 3,
          "xl:grid-cols-4": columns === 4,
        },
        className
      )}
      style={{ gap: `${gap * 4}px` }}
    >
      {children}
    </div>
  );
}