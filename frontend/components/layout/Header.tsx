"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Search, Menu } from "./Icons";
import { Input } from "@/components/ui/Input";
import { UserMenu } from "@/components/ui/Dropdown";
import { cn } from "@/frontend/lib/utils";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
}

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { status?: string; user?: SessionUser };
        if (data.status === "success" && data.user) {
          setUser({ name: data.user.name, email: data.user.email });
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Local sign-out still proceeds even if the network call fails.
    }
    router.replace("/login");
  };

  const pageTitles: Record<string, { title: string; description: string }> = {
    "/dashboard": { title: "Dashboard", description: "Overview of your evaluation pipeline" },
    "/datasets": { title: "Datasets", description: "Manage and upload evaluation datasets" },
    "/models": { title: "Models", description: "Browse and configure LLM models" },
    "/experiments": { title: "Experiments", description: "Run and monitor evaluation experiments" },
    "/experiments/new": { title: "New Experiment", description: "Create a new evaluation experiment" },
    "/comparison": { title: "Model Comparison", description: "Compare model performance side-by-side" },
    "/evaluations": { title: "Evaluations", description: "Detailed evaluation results and analysis" },
    "/analytics": { title: "Analytics", description: "Trends and metrics across all evaluation runs" },
    "/settings": { title: "Settings", description: "Configure your workspace and preferences" },
  };

  const currentPage = pageTitles[pathname] || { title: "Dashboard", description: "Overview of your evaluation pipeline" };

  return (
    <motion.header
      className={cn(
        "fixed top-0 right-0 z-30 h-[64px] bg-[#0F0F0F]/80 backdrop-blur-xl border-b border-[#1A1A1E]",
        "transition-all duration-300 ease-out lg:left-72 left-0"
      )}
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex h-full items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <motion.button
            onClick={onMenuClick}
            className="lg:hidden p-2.5 rounded-xl text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.06] border border-transparent hover:border-[#2A2A28] transition-colors"
            aria-label="Toggle menu"
            whileTap={{ scale: 0.96 }}
          >
            <Menu className="h-5 w-5" />
          </motion.button>

          <AnimatePresence mode="wait">
            {showSearch ? (
              <motion.div
                key="search"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 320 }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="relative hidden sm:block"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" aria-hidden="true" />
                <Input
                  type="search"
                  placeholder="Search experiments, models, datasets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#1A1A1E] border-[#2A2A28] focus:border-[#C8A96E] w-full h-9"
                  aria-label="Search"
                />
              </motion.div>
            ) : (
              <motion.button
                key="search-trigger"
                onClick={() => setShowSearch(true)}
                className="hidden sm:flex items-center gap-2.5 px-4 h-9 rounded-xl bg-[#1A1A1E] border border-[#2A2A28] text-stone-400 hover:text-[#F5F1EB] hover:bg-[#232326] hover:border-[#3A3A38] transition-colors"
                aria-label="Open search"
                whileTap={{ scale: 0.98 }}
                whileHover={{ y: -1 }}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="text-sm font-[450]">Search...</span>
                <kbd className="ml-2 px-1.5 py-0.5 text-xs text-stone-500 bg-[#0F0F0F] border border-[#2A2A28] rounded">âŒ˜K</kbd>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 max-w-xl hidden md:block">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="text-right"
            >
              <h1 className="text-[15px] font-semibold tracking-tight text-[#F5F1EB] truncate">{currentPage.title}</h1>
              <p className="text-xs text-stone-500 truncate">{currentPage.description}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
          {user && <UserMenu
                user={user}
                onProfileClick={() => router.push("/settings")}
                onSettingsClick={() => router.push("/settings")}
                onSignOut={handleSignOut}
              />}
        </div>
      </div>
    </motion.header>
  );
}
