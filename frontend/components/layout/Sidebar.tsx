"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Database,
  Cpu,
  FlaskConical,
  GitCompare,
  BarChart2,
  Activity,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogoIcon,
} from "./Icons";
import { cn } from "@/frontend/lib/utils";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Datasets", href: "/datasets", icon: Database, badge: 6 },
  { label: "Models", href: "/models", icon: Cpu, badge: 24 },
  { label: "Experiments", href: "/experiments", icon: FlaskConical, badge: 3 },
  { label: "Comparison", href: "/comparison", icon: GitCompare },
  { label: "Evaluations", href: "/evaluations", icon: BarChart2, badge: 1247 },
  { label: "Analytics", href: "/analytics", icon: Activity },
  { label: "Prompts", href: "/prompts", icon: MessageSquare },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ className = "", children, open = true, onClose }: { className?: string; children?: ReactNode; open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then(async (res) => {
        if (cancelled || res.status !== 200) return;
        const data = (await res.json().catch(() => ({}))) as { status?: string; user?: { id: string; name: string; email: string; role: string } };
        if (data.status === "success" && data.user) {
          setUser({ name: data.user.name, email: data.user.email });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const initials = user?.name
    ? user.name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "ME";

  return (
    <motion.aside
      className={cn(
        "fixed left-0 top-0 z-40 h-full bg-[#0F0F0F] border-r border-[#1A1A1E] backdrop-blur-xl transition-all duration-300 ease-out flex flex-col",
        collapsed ? "w-20" : "w-72",
        !open && "-translate-x-full lg:translate-x-0",
        className
      )}
      animate={{ width: collapsed ? 80 : 288 }}
      initial={false}
    >
      <div className="flex h-[64px] items-center justify-between px-4 border-b border-[#1A1A1E] bg-[#0F0F0F]">
        <motion.div
          className="flex items-center gap-3"
          animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : "auto" }}
          transition={{ duration: 0.2 }}
          style={{ overflow: "hidden", whiteSpace: "nowrap" }}
        >
          <LogoIcon className="h-8 w-8 flex-shrink-0" />
          <span className="font-serif text-[18px] tracking-tight text-[#F5F1EB]">
            Rittik<span className="font-light text-[#C8A96E]">EvalOpsAI</span>
          </span>
        </motion.div>
        <motion.button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-xl text-stone-500 hover:text-[#F5F1EB] hover:bg-white/[0.06] transition-colors flex-shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          whileTap={{ scale: 0.9 }}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </motion.button>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin" role="navigation" aria-label="Main navigation">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              key="nav-items"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {navigation.map((item, index) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-[450] transition-all duration-300",
                        isActive
                          ? "bg-[#C8A96E] text-[#0F0F0F] font-medium shadow-[0_2px_8px_rgba(200,169,110,0.25)]"
                          : "text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.06]"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="flex h-9 w-9 items-center justify-center shrink-0 rounded-lg"
                        style={{ background: isActive ? "rgba(15,15,15,0.12)" : "transparent" }}>
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <span className="truncate tracking-tight">{item.label}</span>
                      {item.badge && (
                        <span className={cn("ml-auto text-xs px-2 py-0.5 rounded-full font-medium", isActive ? "bg-[#0F0F0F]/15 text-[#0F0F0F]" : "bg-[#1A1A1E] text-stone-400 border border-[#2A2A28]")}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {collapsed && (
          <div className="space-y-1.5" role="navigation" aria-label="Main navigation (collapsed)">
            {navigation.map((item, index) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300",
                    "text-stone-500 hover:text-[#F5F1EB] hover:bg-white/[0.06]",
                    isActive && "text-[#0F0F0F] bg-[#C8A96E] shadow-md"
                  )}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[11px] font-medium rounded-full bg-[#1A1A1E] text-stone-300 border border-[#2A2A28] flex items-center justify-center">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-[#1A1A1E]">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              key="user-section"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1A1A1E] border border-[#2A2A28] hover:border-[#3A3A38] transition-colors group">
                <div className="h-10 w-10 rounded-full bg-[#C8A96E] flex items-center justify-center font-serif font-medium text-[#0F0F0F]">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#F5F1EB] truncate">{user?.name || "Account"}</p>
                  <p className="text-xs text-stone-500 truncate">{user?.email || "Signed in"}</p>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
