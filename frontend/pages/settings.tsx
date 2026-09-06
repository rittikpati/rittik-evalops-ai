"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { DashboardLayout, PageContainer, Section } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { applyTheme, getStoredTheme, type ThemePreference } from "@/frontend/lib/theme";
import { mockSettings, mockModels } from "@/data/mockData";
import {
  User,
  Shield,
  Bell,
  Key,
  Database,
  Cpu,
  Globe,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Plus,
  Check,
  AlertCircle,
  Settings as SettingsIcon,
  CreditCard,
  Users,
} from "@/components/layout/Icons";

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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState(mockSettings.notifications);
  const [evaluation, setEvaluation] = useState(mockSettings.evaluation);
  const [security, setSecurity] = useState(mockSettings.security);
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [user, setUser] = useState<EditableUser | null>(null);
  const [themePref, setThemePref] = useState<ThemePreference>(getStoredTheme);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then(async (res) => {
        if (cancelled || res.status !== 200) return;
        const data = (await res.json().catch(() => ({}))) as { status?: string; user?: EditableUser };
        if (data.status === "success" && data.user) setUser(data.user);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const profileName = user?.name || "Your Name";
  const profileEmail = user?.email || "you@example.com";
  const profileInitials = profileName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "ME";

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "workspace", label: "Workspace", icon: Users },
    { id: "api", label: "API Keys", icon: Key },
    { id: "models", label: "Models", icon: Cpu },
    { id: "evaluation", label: "Evaluation", icon: SettingsIcon },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
  ];

  return (
    <DashboardLayout>
      <PageContainer
        title="Settings"
        description="Manage your workspace, API keys, and evaluation preferences"
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
                          <p className="text-sm text-stone-400 mt-0.5">{profileEmail} Â· {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Member"}</p>
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

            {activeTab === "workspace" && (
              <div className="space-y-6">
                <Section title="Workspace" description="Manage your team and billing">
                  <Card variant="elevated" className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Workspace Name" defaultValue={mockSettings.workspace.name} />
                      <Input label="Slug" defaultValue={mockSettings.workspace.slug} />
                      <div>
                        <label className="label">Plan</label>
                        <div className="flex items-center gap-2">
                          <Badge variant="brand">Enterprise</Badge>
                          <span className="text-sm text-stone-400">{mockSettings.workspace.members} members</span>
                        </div>
                      </div>
                      <div>
                        <label className="label">Billing</label>
                        <Button variant="outline" size="sm" leftIcon={<CreditCard className="h-4 w-4" />}>Manage Billing</Button>
                      </div>
                    </div>
                  </Card>

                  <Card variant="elevated" className="p-6">
                    <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Users className="h-4 w-4" /> Team Members (12)</h3>
                    <div className="space-y-3">
                      {[
                        { name: profileName, email: profileEmail, role: user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Member", avatar: profileInitials },
                        { name: "Alex Chen", email: "alex@rittikevalops.ai", role: "Member", avatar: "AC" },
                        { name: "Sarah Miller", email: "sarah@rittikevalops.ai", role: "Viewer", avatar: "SM" },
                      ].map((member) => (
                        <div key={member.email} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-[#2A2A28]">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#C8A96E] to-[#8B6A43] flex items-center justify-center text-sm font-bold text-[#F5F1EB]">{member.avatar}</div>
                            <div><p className="font-medium text-foreground">{member.name}</p><p className="text-xs text-stone-400">{member.email}</p></div>
                          </div>
                          <Badge variant={member.role === "Admin" ? "brand" : member.role === "Member" ? "info" : "neutral"}>{member.role}</Badge>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" className="w-full mt-4" leftIcon={<Plus className="h-4 w-4" />}>Invite Member</Button>
                  </Card>
                </Section>
              </div>
            )}

            {activeTab === "api" && (
              <div className="space-y-6">
                <Section title="OpenRouter Configuration" description="Connect your LLM providers via OpenRouter (never expose real keys)" action={<Badge variant="success" dot>Connected</Badge>}>
                  <Card variant="elevated" className="p-6 space-y-4">
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div><p className="text-sm font-medium text-amber-400">Security Notice</p><p className="text-xs text-stone-400 mt-1">API keys are masked and never exposed in the UI. Use environment variables in production.</p></div>
                    </div>
                    <div>
                      <label className="label">OpenRouter API Key</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input type={showOpenRouterKey ? "text" : "password"} placeholder="sk-or-v1-â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" value={openRouterKey} onChange={(e) => setOpenRouterKey(e.target.value)} className="pr-10" />
                          <button type="button" onClick={() => setShowOpenRouterKey(!showOpenRouterKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#F5F1EB]">
                            {showOpenRouterKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <Button variant="primary">Save</Button>
                      </div>
                      <p className="text-xs text-stone-400 mt-2">Get your key from <a href="#" className="text-[#C8A96E] hover:underline">openrouter.ai/keys</a> â€¢ Enables GPT, Claude, Llama, Qwen and 200+ models</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#2A2A28]">
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-[#2A2A28]"><p className="text-xs text-stone-400">Provider</p><p className="font-medium">OpenRouter</p><p className="text-xs text-success-400">â— Active</p></div>
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-[#2A2A28]"><p className="text-xs text-stone-400">Models Available</p><p className="font-medium">200+</p><p className="text-xs text-stone-400">via OpenRouter</p></div>
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-[#2A2A28]"><p className="text-xs text-stone-400">Usage This Month</p><p className="font-medium">$1,247</p><p className="text-xs text-stone-400">1.2M tokens</p></div>
                    </div>
                  </Card>
                </Section>

                <Section title="API Keys" description="Manage provider API keys for direct access">
                  <Card variant="elevated" className="p-6">
                    <div className="space-y-3">
                      {mockSettings.apiKeys.map((key) => (
                        <div key={key.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.04] border border-[#2A2A28]">
                          <div className="h-10 w-10 rounded-xl bg-[#C8A96E]/10 flex items-center justify-center"><Key className="h-5 w-5 text-[#C8A96E]" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">{key.name}</p>
                            <p className="text-xs text-stone-400 flex items-center gap-2"><span className="px-1.5 py-0.5 bg-white/[0.04] rounded text-[10px]">{key.provider}</span> {showKeys[key.id] ? key.key : key.key.replace(/./g, "â€¢")} â€¢ Last used {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : "Never"}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setShowKeys(s => ({ ...s, [key.id]: !s[key.id] }))}>{showKeys[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                            <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(key.key)}><Copy className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-danger-400 hover:bg-danger-500/10"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" className="w-full mt-4" leftIcon={<Plus className="h-4 w-4" />}>Add API Key</Button>
                  </Card>
                </Section>
              </div>
            )}

            {activeTab === "models" && (
              <div className="space-y-6">
                <Section title="Default Models" description="Configure default models for new experiments">
                  <Card variant="elevated" className="p-6 space-y-4">
                    <div><label className="label">Default Evaluation Model</label><select className="input"><option>GPT-4o (OpenAI)</option><option>Claude 3.5 Sonnet</option><option>Llama 3.1 405B</option></select><p className="text-xs text-stone-400 mt-1">Used when no model is specified</p></div>
                    <div><label className="label">Default Judge Model</label><select className="input" value={evaluation.defaultJudgeModel} onChange={(e) => setEvaluation({ ...evaluation, defaultJudgeModel: e.target.value })}><option value="free-router">Free Router ($0)</option><option value="gpt-4o">GPT-4o (Recommended)</option><option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option><option value="gpt-4o-mini">GPT-4o Mini (Faster)</option></select><p className="text-xs text-stone-400 mt-1">LLM used as judge for evaluation scoring</p></div>
                    <div><label className="label">Fallback Model</label><select className="input"><option>Claude 3 Haiku (Fast)</option><option>GPT-4o Mini</option></select></div>
                  </Card>
                </Section>
              </div>
            )}

            {activeTab === "evaluation" && (
              <div className="space-y-6">
                <Section title="Evaluation Preferences" description="Customize how evaluations are run">
                  <Card variant="elevated" className="p-6 space-y-6">
                    <div>
                      <label className="label">Enabled Dimensions</label>
                      <div className="flex flex-wrap gap-2">
                        {evaluation.evaluationDimensions.map((dim) => (
                          <label key={dim} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-[#C8A96E]/10 text-[#C8A96E] border border-[#C8A96E]/20 cursor-pointer">
                            <input type="checkbox" checked className="h-3 w-3" readOnly /> {dim}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between"><div><p className="font-medium">Auto-run evaluations</p><p className="text-sm text-stone-400">Automatically start evaluation after experiment creation</p></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={evaluation.autoRunEvaluations} onChange={(e) => setEvaluation({ ...evaluation, autoRunEvaluations: e.target.checked })} className="sr-only peer" /><div className="w-11 h-6 bg-white/[0.06] rounded-full peer peer-checked:bg-[#C8A96E] transition peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#1A1A1E] after:rounded-full after:h-5 after:w-5 after:transition" /></label></div>
                    <div><label className="label">Confidence Threshold: {evaluation.confidenceThreshold}</label><input type="range" min="0" max="1" step="0.05" value={evaluation.confidenceThreshold} onChange={(e) => setEvaluation({ ...evaluation, confidenceThreshold: parseFloat(e.target.value) })} className="w-full" /></div>
                  </Card>
                </Section>
              </div>
            )}

            {activeTab === "notifications" && (
              <Card variant="elevated" className="p-6 space-y-4">
                <h3 className="font-semibold">Notification Preferences</h3>
                {Object.entries(notifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b border-[#2A2A28] last:border-0">
                    <div><p className="font-medium capitalize">{key.replace(/([A-Z])/g, " $1")}</p><p className="text-sm text-stone-400">Receive notifications for {key.toLowerCase()}</p></div>
                    <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={value as boolean} onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })} className="sr-only peer" /><div className="w-11 h-6 bg-white/[0.06] rounded-full peer peer-checked:bg-[#C8A96E] transition peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#1A1A1E] after:rounded-full after:h-5 after:w-5 after:transition" /></label>
                  </div>
                ))}
              </Card>
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                <Card variant="elevated" className="p-6 space-y-4">
                  <h3 className="font-semibold">Security</h3>
                  <div className="flex items-center justify-between"><div><p className="font-medium">Two-Factor Authentication</p><p className="text-sm text-stone-400">Add an extra layer of security</p></div><Badge variant={security.twoFactorEnabled ? "success" : "neutral"}>{security.twoFactorEnabled ? "Enabled" : "Disabled"}</Badge></div>
                  <div className="flex items-center justify-between"><div><p className="font-medium">Session Timeout</p><p className="text-sm text-stone-400">Auto logout after inactivity</p></div><select value={security.sessionTimeout} onChange={(e) => setSecurity({ ...security, sessionTimeout: Number(e.target.value) })} className="input w-auto py-2 px-3"><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={480}>8 hours</option></select></div>
                  <div className="p-4 rounded-xl bg-danger-500/5 border border-danger-500/20"><p className="font-medium text-danger-400">Danger Zone</p><p className="text-sm text-stone-400 mt-1">Permanently delete your workspace and all data</p><Button variant="ghost" className="mt-3 text-danger-400 border-danger-500/30 hover:bg-danger-500/10" size="sm">Delete Workspace</Button></div>
                </Card>
              </div>
            )}
          </motion.div>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
