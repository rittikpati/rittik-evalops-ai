"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DashboardLayout, PageContainer, Section } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Search, Plus, Eye, Trash2, Power, PowerOff, Cpu, Shield, Clock, DollarSign } from "@/components/layout/Icons";
import { formatPercent } from "@/frontend/lib/utils";
import type { ModelConfig } from "@/lib/ai/models";

type UIModel = ModelConfig & { enabled: boolean; custom?: boolean; costPer1kTokens: number; accuracy: number; latency: number; contextWindow: number; version: string; capabilities: string[]; description?: string };

export default function ModelsPage() {
  const { success, error: toastError } = useToast();
  const [models, setModels] = useState<UIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  // Single source of truth â€” GET /api/models â†’ backend/lib/ai/models.ts
  const loadModels = () => {
    setLoading(true);
    setLoadError(null);
    fetch("/api/models")
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "success" && Array.isArray(j.models)) {
          setModels(
            j.models.map((m: ModelConfig & { enabled?: boolean; custom?: boolean }) => ({
              ...m,
              enabled: m.enabled ?? true,
              costPer1kTokens: m.pricing.completion,
              accuracy: 0.9,
              latency: 1.2,
              contextWindow: m.contextLength,
              version: m.version,
              capabilities: m.capabilities,
            }))
          );
        } else {
          setLoadError(j.error || "Failed to load models.");
        }
      })
      .catch(() => setLoadError("Could not reach the server. Check your connection."))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadModels(); }, []);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState<UIModel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UIModel | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const providers = useMemo(() => [...new Set(models.map((m) => m.provider))], [models]);

  const filtered = useMemo(() => {
    return models.filter((m) => {
      const q = query.toLowerCase();
      const matchesQuery = !q || m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q);
      const matchesProvider = provider === "all" || m.provider === provider;
      const matchesStatus = status === "all" || m.status === status;
      return matchesQuery && matchesProvider && matchesStatus;
    });
  }, [models, query, provider, status]);

  const toggleEnabled = async (id: string) => {
    if (toggling[id]) return;
    const target = models.find((m) => m.id === id);
    if (!target) return;
    const next = !target.enabled;
    setToggling((t) => ({ ...t, [id]: true }));
    // Optimistic â€” revert on error so the UI never guesses.
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: next } : m)));
    setDetail((d) => (d && d.id === id ? { ...d, enabled: next } : d));
    try {
      const res = await fetch(`/api/models/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (res.ok && data.status === "success") {
        success(next ? `${target.name} enabled` : `${target.name} disabled`, next ? "Model will be available for selection." : "Model will be skipped in new experiments.");
        return;
      }
      throw new Error(data.error || "Update failed");
    } catch {
      setModels((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: !next } : m)));
      setDetail((d) => (d && d.id === id ? { ...d, enabled: !next } : d));
      toastError("Update failed", "Could not save the model state. Please try again.");
    } finally {
      setToggling((t) => ({ ...t, [id]: false }));
    }
  };

  const [addForm, setAddForm] = useState({
    name: "",
    provider: "",
    description: "",
    contextLength: "128000",
    maxOutputTokens: "8192",
    pricingPrompt: "0",
    pricingCompletion: "0",
    openRouterId: "",
  });
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  const handleAddModel = async () => {
    const errs: Record<string, string> = {};
    const name = addForm.name.trim();
    const provider = addForm.provider.trim();
    if (!name) errs.name = "Model name is required.";
    if (!provider) errs.provider = "Provider is required.";
    if (addForm.contextLength.trim() && (Number(addForm.contextLength) < 1 || Number(addForm.contextLength) > 4_000_000)) {
      errs.contextLength = "Must be between 1 and 4,000,000.";
    }
    if (addForm.maxOutputTokens.trim() && (Number(addForm.maxOutputTokens) < 1 || Number(addForm.maxOutputTokens) > 1_000_000)) {
      errs.maxOutputTokens = "Must be between 1 and 1,000,000.";
    }
    setAddErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setAdding(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          provider,
          description: addForm.description.trim() || undefined,
          contextLength: addForm.contextLength.trim() ? Number(addForm.contextLength) : undefined,
          maxOutputTokens: addForm.maxOutputTokens.trim() ? Number(addForm.maxOutputTokens) : undefined,
          pricingPrompt: addForm.pricingPrompt.trim() ? Number(addForm.pricingPrompt) : undefined,
          pricingCompletion: addForm.pricingCompletion.trim() ? Number(addForm.pricingCompletion) : undefined,
          openRouterId: addForm.openRouterId.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string; code?: string; model?: ModelConfig & { enabled?: boolean; custom?: boolean } };
      if (res.ok && data.status === "success" && data.model) {
        const created = data.model;
        setModels((prev) => [
          ...prev,
          {
            ...created,
            enabled: created.enabled ?? true,
            custom: created.custom ?? true,
            costPer1kTokens: created.pricing.completion,
            accuracy: 0.9,
            latency: 1.2,
            contextWindow: created.contextLength,
            version: created.version,
            capabilities: created.capabilities,
          },
        ]);
        success("Model added", `${created.name} is ready to use in experiments.`);
        setShowAdd(false);
        setAddForm({ name: "", provider: "", description: "", contextLength: "128000", maxOutputTokens: "8192", pricingPrompt: "0", pricingCompletion: "0", openRouterId: "" });
        setAddErrors({});
      } else if (res.status === 409) {
        setAddErrors({ name: data.error || "This model already exists." });
        toastError("Model already exists", data.error || "This model is already in your list.");
      } else {
        toastError("Add failed", data.error || "Something went wrong. Please try again.");
      }
    } catch {
      toastError("Add failed", "Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const deleteCustomModel = async (target: UIModel) => {
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/models/${encodeURIComponent(target.id)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (res.ok && data.status === "success") {
        setModels((prev) => prev.filter((m) => m.id !== target.id));
        success("Model removed", `${target.name} deleted.`);
      } else {
        toastError("Delete failed", data.error || "Could not remove the model.");
      }
    } catch {
      toastError("Delete failed", "Network error. Please try again.");
    }
  };

  return (
    <DashboardLayout>
      <PageContainer
        title="Models"
        description="Enable, inspect, and manage models â€” search, filter, and toggle availability."
        action={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>Add Model</Button>}
      >
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500" />
            <Input placeholder="Search models..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10 h-10" />
          </div>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="h-10 rounded-xl bg-[#1A1A1E] border border-[#2A2A28] px-3 text-sm text-[#F5F1EB]">
            <option value="all">All Providers</option>
            {providers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl bg-[#1A1A1E] border border-[#2A2A28] px-3 text-sm text-[#F5F1EB]">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="beta">Beta</option>
            <option value="deprecated">Deprecated</option>
          </select>
        </div>

        <AnimatePresence mode="popLayout">
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((m) => (
              <motion.div key={m.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} className={!m.enabled ? "opacity-70" : ""}>
                <Card
                  className="p-5 h-full flex flex-col cursor-pointer transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:border-[#3A3A40] group"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${m.name} details`}
                  onClick={() => setDetail(m)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDetail(m);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[#C8A96E] flex items-center justify-center text-sm font-bold text-[#0F0F0F]">{m.name[0]}</div>
                      <div><p className="font-medium leading-tight text-[#F5F1EB]">{m.name}</p><p className="text-xs text-stone-500">{m.provider} â€¢ {m.version}</p></div>
                    </div>
                    <Badge variant={m.enabled ? "success" : "neutral"} dot>{m.enabled ? "Enabled" : "Disabled"}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-[#0F0F0F] border border-[#2A2A28] text-center"><p className="text-stone-500">Accuracy</p><p className="font-mono font-medium text-[#F5F1EB]">{formatPercent(m.accuracy)}</p></div>
                    <div className="p-2 rounded-lg bg-[#0F0F0F] border border-[#2A2A28] text-center"><p className="text-stone-500">Latency</p><p className="font-mono font-medium">{m.latency}s</p></div>
                    <div className="p-2 rounded-lg bg-[#0F0F0F] border border-[#2A2A28] text-center"><p className="text-stone-500">Cost</p><p className="font-mono font-medium">${m.costPer1kTokens}</p></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.capabilities.slice(0, 3).map((c) => <Badge key={c} variant="neutral" size="sm">{c}</Badge>)}
                    {m.capabilities.length > 3 && <Badge variant="info" size="sm">+{m.capabilities.length - 3}</Badge>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); setDetail(m); }} leftIcon={<Eye className="h-3.5 w-3.5" />}>Details</Button>
                    <Button
                      variant={m.enabled ? "secondary" : "primary"}
                      size="sm"
                      className="flex-1"
                      disabled={!!toggling[m.id]}
                      isLoading={!!toggling[m.id]}
                      onClick={(e) => { e.stopPropagation(); toggleEnabled(m.id); }}
                      leftIcon={m.enabled ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                    >{m.enabled ? "Disable" : "Enable"}</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-red-400" onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {loadError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">{loadError}</p>
            <Button variant="outline" size="sm" onClick={loadModels}>Retry</Button>
          </div>
        )}

        {filtered.length === 0 && !loadError && (
          <Card className="p-10 text-center mt-6">
            <Cpu className="h-8 w-8 mx-auto text-stone-500" />
            <p className="font-medium mt-3">No models found</p>
            <p className="text-sm text-stone-500">Try adjusting search or filters.</p>
          </Card>
        )}
      </PageContainer>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail?.name} description={`${detail?.provider} â€¢ ${detail?.version}`} size="lg">
        {detail && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-stone-300">{detail.description}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-[#0F0F0F] border border-[#2A2A28]"><p className="text-xs text-stone-500">Context Window</p><p className="font-mono font-medium">{detail.contextWindow.toLocaleString()} tokens</p></div>
              <div className="p-3 rounded-xl bg-[#0F0F0F] border border-[#2A2A28]"><p className="text-xs text-stone-500">Status</p><Badge variant={detail.enabled ? "success" : "neutral"}>{detail.enabled ? "Enabled" : "Disabled"}</Badge></div>
              <div className="p-3 rounded-xl bg-[#0F0F0F] border border-[#2A2A28] col-span-2"><p className="text-xs text-stone-500">Capabilities</p><div className="flex flex-wrap gap-1.5 mt-1">{detail.capabilities.map((c) => <Badge key={c} variant="neutral" size="sm">{c}</Badge>)}</div></div>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" disabled={!!toggling[detail.id]} isLoading={!!toggling[detail.id]} onClick={() => toggleEnabled(detail.id)}>{detail.enabled ? "Disable" : "Enable"} Model</Button>
              <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.custom) {
            deleteCustomModel(deleteTarget);
          } else {
            setModels((prev) => prev.filter((m) => m.id !== deleteTarget!.id));
            success("Model removed", `${deleteTarget.name} deleted.`);
            setDeleteTarget(null);
          }
        }}
        title="Remove model?"
        message={`Remove ${deleteTarget?.name}? This ${deleteTarget?.custom ? "permanently deletes your custom model." : "will hide it from future experiments."}`}
        confirmLabel="Remove"
        variant="danger"
      />

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Model" description="Register a new model for your experiments â€” it is stored in your workspace." size="lg">
        <div className="space-y-3 text-sm text-stone-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Model Name" placeholder="e.g., Titan Turbo" value={addForm.name} error={addErrors.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
            <Input label="Provider" placeholder="e.g., Amazon" value={addForm.provider} error={addErrors.provider} onChange={(e) => setAddForm((f) => ({ ...f, provider: e.target.value }))} />
          </div>
          <Input label="Description" placeholder="Short description (optional)" value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Context Length" type="number" placeholder="128000" value={addForm.contextLength} error={addErrors.contextLength} onChange={(e) => setAddForm((f) => ({ ...f, contextLength: e.target.value }))} hint="Tokens" />
            <Input label="Max Output Tokens" type="number" placeholder="8192" value={addForm.maxOutputTokens} error={addErrors.maxOutputTokens} onChange={(e) => setAddForm((f) => ({ ...f, maxOutputTokens: e.target.value }))} />
            <Input label="Prompt Price" type="number" step="0.01" placeholder="0" value={addForm.pricingPrompt} onChange={(e) => setAddForm((f) => ({ ...f, pricingPrompt: e.target.value }))} hint="USD per 1M tokens (optional)" />
            <Input label="Completion Price" type="number" step="0.01" placeholder="0" value={addForm.pricingCompletion} onChange={(e) => setAddForm((f) => ({ ...f, pricingCompletion: e.target.value }))} hint="USD per 1M tokens (optional)" />
          </div>
          <Input label="OpenRouter ID" placeholder="Optional â€” used for live inference, e.g. openai/gpt-5" value={addForm.openRouterId} onChange={(e) => setAddForm((f) => ({ ...f, openRouterId: e.target.value }))} />
          <div className="flex gap-2 pt-2">
            <Button variant="primary" className="flex-1" isLoading={adding} onClick={handleAddModel}>Add Model</Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

