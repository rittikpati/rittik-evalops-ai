"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { DashboardLayout, PageContainer, Section } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { applyTheme, getStoredTheme, type ThemePreference } from "@/frontend/lib/theme";
import { User, Key, Users, AlertCircle } from "@/components/layout/Icons";
import type { EvaluationRun } from "@/lib/evaluations/types";

export interface EditableUser {
  id?: string;
  name: string;
  email: string;
  role: string;
}

function ProfileForm({ user, onSaved }: { user: EditableUser | null; onSaved: (u: EditableUser) => void }) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const handleSave = async () => {
    const next: { name?: string; email?: string } = {};
    if (!name.trim()) next.name = "Name is required";
    else if (name.trim().length > 80) next.name = "Name must be 80 characters or fewer";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Invalid email format";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        error?: string;
        code?: string;
        user?: EditableUser;
      };
      if (res.ok && data.status === "success" && data.user) {
        setName(data.user.name);
        setEmail(data.user.email);
        setErrors({});
        success("Profile updated", "Your name and email have been saved.");
        onSaved(data.user);
      } else if (res.status === 409) {
        toastError("Email already in use", "This email belongs to another account. Try a different one.");
        setErrors({ email: "Email is already registered" });
      } else {
        toastError("Update failed", data.error || "Something went wrong. Please try again.");
      }
    } catch {
      toastError("Update failed", "Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setErrors({});
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Your name" />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} placeholder="you@example.com" autoComplete="email" />
        <Input label="Role" defaultValue={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Member"} disabled />
        <Input label="Workspace" defaultValue="RittikEvalOpsAI" disabled />
      </div>
      <div className="flex gap-3">
        <Button variant="primary" onClick={handleSave} isLoading={saving}>Save Changes</Button>
        <Button variant="ghost" onClick={handleCancel} disabled={saving}>Cancel</Button>
      </div>
    </>
  );
}

interface SystemInfo {
  openRouterConfigured: boolean;
  aiProvider: string;
  defaultJudgeModel: string;
  hasSupabase: boolean;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [user, setUser] = useState<EditableUser | null>(null);
  const [themePref, setThemePref] = useState<ThemePreference>(getStoredTheme);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json().catch(() => ({}))),
      fetch("/api/settings/system").then((r) => r.json().catch(() => ({}))),
      fetch("/api/evaluations").then((r) => r.json().catch(() => ({}))),
    ]).then(([session, info, evals]) => {
      if (cancelled) return;
      if (session.status === "success" && session.user) setUser(session.user);
      if (info.status === "success" && info.system) setSystem(info.system);
      if (evals.status === "success" && Array.isArray(evals.runs)) setRuns(evals.runs);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const usage = useMemo(() => {
    const totalTokens = runs.reduce(
      (n, r) => n + r.results.reduce((m, res) => m + (res.totalTokens || 0), 0),
      0
    );
    const totalCost = runs.reduce(
      (n, r) => n + r.results.reduce((m, res) => m + (res.estimatedCost ?? 0), 0),
      0
    );
    const completed = runs.filter((r) => r.status === "completed" || r.status === "partial").length;
    const failed = runs.filter((r) => r.status === "failed").length;
    const executions = runs.reduce((n, r) => n + (r.total || 0), 0);
    return { totalTokens, totalCost, completed, failed, executions };
  }, [runs]);

  const profileName = user?.name || "Your Name";
  const profileEmail = user?.email || "you@example.com";
  const profileInitials = profileName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "ME";

  const providerLabel = system
    ? system.aiProvider && system.aiProvider !== "auto"
      ? system.aiProvider
      : system.openRouterConfigured
        ? "OpenRouter (auto)"
        : "Mock provider (no key configured)"
    : "…";

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "providers", label: "Providers", icon: Key },
    { id: "workspace", label: "Workspace", icon: Users },
  ];

  return (
    <DashboardLayout>
      <PageContainer
        title="Settings"
        description="Manage your account, provider configuration, and workspace"
      >
        <div className="flex flex-col lg:flex-row gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-64 flex-shrink-0"
          >
            <Card variant="elevated" className="p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-[#C8A96E]/10 text-[#C8A96E] border border-[#C8A96E]/20"
                        : "text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.04]"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </Card>
          </motion.div>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 space-y-6"
          >
            {activeTab === "profile" && (
              <div className="space-y-6">
                <Section title="Profile" description="Manage your personal information and preferences">
                  <Card
                    variant="elevated"
                    className="p-6 relative overflow-hidden bg-[linear-gradient(135deg,#26262C_0%,#1E1E23_55%,#19191D_100%)] border-[#3A3A40]"
                  >
                    <div className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-[#C8A96E] to-[#8B6A43]/40" aria-hidden="true" />
                    <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(200,169,110,0.12),transparent_70%)] pointer-events-none" aria-hidden="true" />
                    <div className="relative flex flex-col sm:flex-row items-start gap-6">
                      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#D9BC82] to-[#8B6A43] shadow-[0_8px_24px_rgba(200,169,110,0.4)] ring-4 ring-[#C8A96E]/15 flex items-center justify-center text-2xl font-bold text-[#0F0F0F] flex-shrink-0">
                        {profileInitials}
                      </div>
                      <div className="flex-1 space-y-4 min-w-0">
                        <div>
                          <p className="text-lg font-semibold tracking-tight text-[#F5F1EB]">{profileName}</p>
                          <p className="text-sm text-stone-400 mt-0.5">{profileEmail} &middot; {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Member"}</p>
                        </div>
                        <ProfileForm key={user?.id || "loading"} user={user} onSaved={setUser} />
                      </div>
                    </div>
                  </Card>
                </Section>

                <Section title="Preferences" description="Customize your experience">
                  <Card variant="elevated" className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Theme</p>
                        <p className="text-sm text-stone-400">Choose your preferred theme</p>
                      </div>
                      <select
                        className="input w-auto py-2 px-3"
                        value={themePref}
                        onChange={(e) => {
                          const v = e.target.value as ThemePreference;
                          setThemePref(v);
                          applyTheme(v);
                        }}
                        aria-label="Theme"
                      >
                        <option value="dark">Dark (Default)</option>
                        <option value="light">Light</option>
                        <option value="system">System</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Language</p>
                        <p className="text-sm text-stone-400">English only</p>
                      </div>
                      <select className="input w-auto py-2 px-3" value="en" disabled aria-label="Language">
                        <option value="en">English</option>
                      </select>
                    </div>
                  </Card>
                </Section>
              </div>
            )}

            {activeTab === "providers" && (
              <div className="space-y-6">
                <Section
                  title="LLM Provider"
                  description="Provider credentials come from server environment variables — keys are never exposed in the UI"
                  action={
                    <Badge variant={system?.openRouterConfigured ? "success" : "neutral"} dot>
                      {system ? (system.openRouterConfigured ? "Configured" : "Not configured") : "Checking…"}
                    </Badge>
                  }
                >
                  <Card variant="elevated" className="p-6 space-y-4">
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-stone-400">
                        <p className="font-medium text-amber-400">Security first</p>
                        <p className="mt-1">API keys are read from the server&apos;s environment and never sent to or stored in the browser. To swap providers, update these variables and restart the server.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-[#2A2A28]"><p className="text-xs text-stone-400">Provider</p><p className="font-medium">{providerLabel}</p></div>
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-[#2A2A28]"><p className="text-xs text-stone-400">Default Judge Model</p><p className="font-medium">{system?.defaultJudgeModel ?? "…"}</p></div>
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-[#2A2A28]"><p className="text-xs text-stone-400">Supabase Sync</p><p className="font-medium">{system?.hasSupabase ? "Enabled" : "Disabled"}</p></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-[#2A2A28]">
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-[#2A2A28]"><p className="text-xs text-stone-400">Evaluations</p><p className="font-medium">{usage.completed} complete &middot; {usage.failed} failed</p></div>
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-[#2A2A28]"><p className="text-xs text-stone-400">Model Executions</p><p className="font-medium">{usage.executions.toLocaleString()}</p></div>
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-[#2A2A28]"><p className="text-xs text-stone-400">Tokens Used</p><p className="font-medium">{usage.totalTokens.toLocaleString()}</p></div>
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-[#2A2A28]"><p className="text-xs text-stone-400">Estimated Cost</p><p className="font-medium">${usage.totalCost.toFixed(2)}</p></div>
                    </div>
                    <p className="text-xs text-stone-500 pt-2 border-t border-[#2A2A28]">Usage reflects evaluation runs started from this workspace. Numbers update on reload.</p>
                  </Card>
                </Section>

                <Section title="Environment Variables" description="The variables this deployment reads on startup">
                  <Card variant="elevated" className="p-6 space-y-2">
                    <div className="flex items-center justify-between py-3 border-b border-[#2A2A28] last:border-0">
                      <div><p className="font-medium font-mono text-sm">OPENROUTER_API_KEY</p><p className="text-xs text-stone-400">Enables real-model runs via OpenRouter (200+ models)</p></div>
                      <Badge variant={system?.openRouterConfigured ? "success" : "neutral"}>{system?.openRouterConfigured ? "Set" : "Missing"}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-[#2A2A28] last:border-0">
                      <div><p className="font-medium font-mono text-sm">AI_PROVIDER</p><p className="text-xs text-stone-400">Force a specific provider, or leave unset for auto-detection</p></div>
                      <Badge variant="info">{system ? (system.aiProvider && system.aiProvider !== "auto" ? system.aiProvider : "auto") : "…"}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-[#2A2A28] last:border-0">
                      <div><p className="font-medium font-mono text-sm">JUDGE_MODEL_ID</p><p className="text-xs text-stone-400">Default LLM used for evaluation scoring</p></div>
                      <Badge variant="info">{system?.defaultJudgeModel ?? "…"}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-3 last:border-0">
                      <div><p className="font-medium font-mono text-sm">NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY</p><p className="text-xs text-stone-400">Optional: sync runs and datasets to Supabase</p></div>
                      <Badge variant={system?.hasSupabase ? "success" : "neutral"}>{system?.hasSupabase ? "Set" : "Unset"}</Badge>
                    </div>
                    <p className="text-xs text-stone-500 pt-3">Values shown here are status flags only — key material is never revealed.</p>
                  </Card>
                </Section>
              </div>
            )}

            {activeTab === "workspace" && (
              <div className="space-y-6">
                <Section title="Workspace" description="Workspace details">
                  <Card variant="elevated" className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Workspace Name" defaultValue="RittikEvalOpsAI" />
                      <Input label="Slug" defaultValue="evalops-ai" />
                      <div>
                        <label className="label">Plan</label>
                        <div className="flex items-center gap-2">
                          <Badge variant="neutral">Single workspace</Badge>
                          <span className="text-sm text-stone-400">Local deployment &mdash; no billing</span>
                        </div>
                      </div>
                      <div>
                        <label className="label">Deployment</label>
                        <div className="flex items-center gap-2 h-10">
                          <Badge variant="info" dot>Self-hosted</Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Section>

                <Section title="Team Members" description="Who has access to this workspace">
                  <Card variant="elevated" className="p-6">
                    {user ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-[#2A2A28]">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-sm font-bold text-[#F5F1EB]">{profileInitials}</div>
                            <div><p className="font-medium text-foreground">{profileName}</p><p className="text-xs text-stone-400">{profileEmail}</p></div>
                          </div>
                          <Badge variant={user.role === "admin" ? "brand" : "info"}>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</Badge>
                        </div>
                        <p className="text-xs text-stone-500">This deployment runs as a single-account workspace.</p>
                      </div>
                    ) : (
                      <p className="text-sm text-stone-400">Loading…</p>
                    )}
                  </Card>
                </Section>
              </div>
            )}
          </motion.div>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}