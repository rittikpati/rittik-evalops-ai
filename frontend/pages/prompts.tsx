"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { DashboardLayout, PageContainer, Section } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { Table, type Column } from "@/components/ui/Table";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatRelativeTime } from "@/frontend/lib/utils";
import {
  MessageSquare,
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  Check,
  Loader2,
  FileText,
} from "@/components/layout/Icons";
import type { Prompt } from "@/types";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant. Answer concisely and accurately.";
const DEFAULT_USER_PROMPT = "Answer the following question based on the context:\n\nContext: {{context}}\nQuestion: {{question}}";

export default function PromptsPage() {
  const { success, error: toastError } = useToast();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSystemPrompt, setCreateSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [createUserPrompt, setCreateUserPrompt] = useState(DEFAULT_USER_PROMPT);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editTarget, setEditTarget] = useState<Prompt | null>(null);
  const [editName, setEditName] = useState("");
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const [editUserPrompt, setEditUserPrompt] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPrompts = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoadError(null);
    try {
      const res = await fetch("/api/prompts");
      const j = await res.json();
      if (j.status === "success" && Array.isArray(j.prompts)) setPrompts(j.prompts);
      else setLoadError(j.error || "Failed to load prompts.");
    } catch {
      setLoadError("Could not reach the server. Check your connection.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/prompts");
        const j = await res.json();
        if (!cancelled && j.status === "success" && Array.isArray(j.prompts)) setPrompts(j.prompts);
        else if (!cancelled) setLoadError(j.error || "Failed to load prompts.");
      } catch {
        if (!cancelled) setLoadError("Could not reach the server. Check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = () => {
    setCreateName("");
    setCreateSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setCreateUserPrompt(DEFAULT_USER_PROMPT);
    setIsCreateOpen(true);
  };

  const handleCreate = async () => {
    if (creating) return;
    const name = createName.trim();
    if (!name) {
      toastError("Name required", "Prompt name is required.");
      return;
    }
    if (!createUserPrompt.trim()) {
      toastError("Prompt required", "User prompt cannot be empty.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          systemPrompt: createSystemPrompt.trim() || undefined,
          userPrompt: createUserPrompt,
        }),
      });
      const j = await res.json();
      if (j.status !== "success" || !j.prompt) {
        throw new Error(j.error || "Failed to create prompt");
      }
      success("Prompt saved", `${j.prompt.name} is ready to use in experiments.`);
      setIsCreateOpen(false);
      loadPrompts({ silent: true });
    } catch (e) {
      toastError("Create failed", e instanceof Error ? e.message : "Unknown");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (prompt: Prompt) => {
    setEditTarget(prompt);
    setEditName(prompt.name);
    setEditSystemPrompt(prompt.systemPrompt || "");
    setEditUserPrompt(prompt.userPrompt);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!editName.trim()) {
      toastError("Name required", "Prompt name cannot be empty.");
      return;
    }
    if (!editUserPrompt.trim()) {
      toastError("Prompt required", "User prompt cannot be empty.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/prompts/${encodeURIComponent(editTarget.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          systemPrompt: editSystemPrompt.trim() || "",
          userPrompt: editUserPrompt,
        }),
      });
      const j = await res.json();
      if (j.status === "success" && j.prompt) {
        success("Prompt updated", `${j.prompt.name} saved.`);
        setEditTarget(null);
        loadPrompts({ silent: true });
      } else {
        toastError("Update failed", j.error || "Unknown");
      }
    } catch (e) {
      toastError("Update failed", e instanceof Error ? e.message : "Unknown");
    } finally {
      setSavingEdit(false);
    }
  };

  const deletePrompt = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/prompts/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
      const j = await res.json();
      if (j.status === "success") {
        setPrompts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        success("Prompt deleted", `${deleteTarget.name} was removed.`);
        setDeleteTarget(null);
      } else {
        toastError("Delete failed", j.error || "Unknown");
      }
    } catch (e) {
      toastError("Delete failed", e instanceof Error ? e.message : "Unknown");
    } finally {
      setDeleting(false);
    }
  };

  const copyPrompt = (prompt: Prompt) => {
    const payload = JSON.stringify({ name: prompt.name, systemPrompt: prompt.systemPrompt ?? "", userPrompt: prompt.userPrompt });
    navigator.clipboard.writeText(payload).catch(() => {});
    setCopiedId(prompt.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredPrompts = prompts.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const columns: Column<Prompt>[] = [
    {
      key: "name",
      header: "Prompt",
      width: "260px",
      render: (_, row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-stone-500 mt-0.5 line-clamp-1 font-mono">{row.userPrompt.split("\n")[0]}</p>
        </div>
      ),
    },
    {
      key: "system",
      header: "System",
      width: "260px",
      render: (_, row) =>
        row.systemPrompt ? (
          <p className="text-sm text-stone-400 line-clamp-1">{row.systemPrompt}</p>
        ) : (
          <span className="text-sm text-stone-600">â€”</span>
        ),
    },
    {
      key: "hasPlaceholder",
      header: "Placeholder",
      width: "120px",
      render: (_, row) =>
        /{{\s*(question|input)\s*}}/.test(row.userPrompt) ? (
          <Badge variant="success" size="sm">{"{{question}}"}</Badge>
        ) : (
          <Badge variant="warning" size="sm">None</Badge>
        ),
    },
    {
      key: "updatedAt",
      header: "Updated",
      width: "130px",
      render: (_, row) => (
        <span className="text-sm text-stone-400">{formatRelativeTime(row.updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "120px",
      align: "right" as const,
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyPrompt(row)}
            title="Copy to use in an experiment"
            leftIcon={copiedId === row.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          >
            {copiedId === row.id ? "Copied" : "Use"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)} title="Edit prompt" leftIcon={<Edit className="h-4 w-4" />} />
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(row)} title="Delete prompt" leftIcon={<Trash2 className="h-4 w-4 text-red-400" />} />
        </div>
      ),
    },
  ];

  const stats = [
    { label: "Total Prompts", value: prompts.length, icon: MessageSquare, bg: "bg-[#C8A96E]/15", text: "text-[#C8A96E]" },
    { label: "With Placeholder", value: prompts.filter((p) => /{{\s*(question|input)\s*}}/.test(p.userPrompt)).length, icon: FileText, bg: "bg-sky-500/15", text: "text-sky-400" },
    { label: "With System Prompt", value: prompts.filter((p) => p.systemPrompt).length, icon: Edit, bg: "bg-emerald-500/15", text: "text-emerald-400" },
    { label: "Has {{question}}", value: prompts.filter((p) => p.userPrompt.includes("{{question}}")).length, icon: Check, bg: "bg-[#8B6A43]/15", text: "text-[#C8A96E]" },
  ];

  return (
    <DashboardLayout>
      <PageContainer
        title="Prompts"
        description="Save and reuse prompt templates across your experiments"
        action={
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Create Prompt
          </Button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <Card variant="elevated" className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-stone-400">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                  </div>
                  <div className={`h-12 w-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`h-6 w-6 ${stat.text}`} />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <Section>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input
                placeholder="Search prompts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
          </div>

          {loadError && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{loadError}</p>
              <Button variant="outline" size="sm" onClick={() => loadPrompts()}>Retry</Button>
            </div>
          )}

          <Table
            columns={columns}
            data={filteredPrompts}
            keyExtractor={(row) => row.id}
            hoverable={true}
            loading={loading}
            emptyMessage={searchQuery ? "No prompts match your search." : "No prompts yet. Create your first prompt to reuse it in experiments."}
          />

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#2A2A28] bg-[#121214] px-4 py-3">
            <Loader2 className="h-4 w-4 text-[#C8A96E]" />
            <p className="text-sm text-stone-400">
              Tip: use the <span className="font-medium text-foreground">Use</span> action to copy a prompt as JSON, then paste it into a new experiment&apos;s Prompt Configuration. Prompts are stored per-workspace.
            </p>
          </div>
        </Section>
      </PageContainer>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Prompt"
        description="Save a reusable prompt template"
        size="lg"
      >
        <div className="space-y-5">
          <Input label="Prompt Name *" placeholder="e.g., Customer Support Agent" value={createName} onChange={(e) => setCreateName(e.target.value)} />
          <Textarea
            label="System Prompt (optional)"
            value={createSystemPrompt}
            onChange={(e) => setCreateSystemPrompt(e.target.value)}
            rows={3}
            placeholder="You are a helpful AI assistant..."
          />
          <Textarea
            label="User Prompt *"
            value={createUserPrompt}
            onChange={(e) => setCreateUserPrompt(e.target.value)}
            rows={5}
            className="font-mono text-xs"
            hint="Include the {{question}} placeholder to make it reusable across datasets."
          />
          {!createUserPrompt.includes("{{question}}") && (
            <p className="text-xs text-red-400 -mt-2">Consider adding the {"{{question}}"} placeholder.</p>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#2A2A28]">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} isLoading={creating} leftIcon={<Plus className="h-4 w-4" />}>
              Save Prompt
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Prompt"
        description={`Update ${editTarget?.name || "this prompt"}`}
        size="lg"
      >
        <div className="space-y-5">
          <Input label="Prompt Name *" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Textarea
            label="System Prompt (optional)"
            value={editSystemPrompt}
            onChange={(e) => setEditSystemPrompt(e.target.value)}
            rows={3}
            placeholder="You are a helpful AI assistant..."
          />
          <Textarea
            label="User Prompt *"
            value={editUserPrompt}
            onChange={(e) => setEditUserPrompt(e.target.value)}
            rows={5}
            className="font-mono text-xs"
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-[#2A2A28]">
            <Button variant="ghost" type="button" onClick={() => setEditTarget(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveEdit} isLoading={savingEdit}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deletePrompt}
        title="Delete prompt?"
        message={`Delete â€œ${deleteTarget?.name || "this prompt"}â€? Experiments that used it keep their own copy. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </DashboardLayout>
  );
}