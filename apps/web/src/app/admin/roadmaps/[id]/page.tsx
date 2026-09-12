"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError, adminApi, type AdminMilestoneRow, type AdminRoadmapRow, type MilestoneStatus } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";

const STATUS_CYCLE: Record<MilestoneStatus, MilestoneStatus> = {
  planned: "in_progress",
  in_progress: "done",
  done: "planned",
};

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
};

export default function EditRoadmapPage() {
  const { id } = useParams<{ id: string }>();
  const [roadmap, setRoadmap] = useState<AdminRoadmapRow | null>(null);
  const [title, setTitle] = useState("");
  const [goalSummary, setGoalSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const [milestones, setMilestones] = useState<AdminMilestoneRow[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [milestoneError, setMilestoneError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const confirm = useConfirm();

  async function loadRoadmap() {
    const rows = await adminApi.listRoadmaps();
    const found = rows.find((r) => r.id === id) ?? null;
    setRoadmap(found);
    if (found) {
      setTitle(found.title);
      setGoalSummary(found.goal_summary ?? "");
    }
  }

  async function loadMilestones() {
    setMilestones(await adminApi.listMilestones(id));
  }

  useEffect(() => {
    let active = true;
    adminApi.listRoadmaps().then((rows) => {
      if (!active) return;
      const found = rows.find((r) => r.id === id) ?? null;
      setRoadmap(found);
      if (found) {
        setTitle(found.title);
        setGoalSummary(found.goal_summary ?? "");
      }
    });
    adminApi.listMilestones(id).then((result) => {
      if (active) setMilestones(result);
    });
    return () => {
      active = false;
    };
  }, [id]);

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await adminApi.updateRoadmap(id, { title: title.trim(), goal_summary: goalSummary.trim() || null });
      setSaved(true);
      await loadRoadmap();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save roadmap.");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishError(null);
    try {
      setRoadmap(await adminApi.publishRoadmap(id));
    } catch (err) {
      setPublishError(err instanceof ApiError ? err.message : "Couldn't publish roadmap.");
    }
  }

  async function unpublish() {
    setPublishError(null);
    try {
      setRoadmap(await adminApi.unpublishRoadmap(id));
    } catch (err) {
      setPublishError(err instanceof ApiError ? err.message : "Couldn't unpublish roadmap.");
    }
  }

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setMilestoneError(null);
    try {
      await adminApi.createMilestone(id, { title: newTitle.trim(), description: newDescription.trim() || null });
      setNewTitle("");
      setNewDescription("");
      await loadMilestones();
      await loadRoadmap();
    } catch (err) {
      setMilestoneError(err instanceof ApiError ? err.message : "Couldn't add milestone.");
    }
  }

  function startEdit(m: AdminMilestoneRow) {
    setEditingId(m.id);
    setEditTitle(m.title);
    setEditDescription(m.description ?? "");
  }

  async function saveEdit(milestoneId: string) {
    if (!editTitle.trim()) return;
    setMilestoneError(null);
    try {
      await adminApi.updateMilestone(milestoneId, { title: editTitle.trim(), description: editDescription.trim() || null });
      setEditingId(null);
      await loadMilestones();
    } catch (err) {
      setMilestoneError(err instanceof ApiError ? err.message : "Couldn't update milestone.");
    }
  }

  async function cycleStatus(m: AdminMilestoneRow) {
    setMilestoneError(null);
    try {
      await adminApi.setMilestoneStatus(m.id, STATUS_CYCLE[m.status]);
      await loadMilestones();
    } catch (err) {
      setMilestoneError(err instanceof ApiError ? err.message : "Couldn't update status.");
    }
  }

  async function reorder(milestoneId: string, direction: "up" | "down") {
    await adminApi.reorderMilestone(milestoneId, direction);
    await loadMilestones();
  }

  async function removeMilestone(milestoneId: string, title: string) {
    const ok = await confirm({ title: "Delete milestone?", message: `"${title}" will be permanently deleted.` });
    if (!ok) return;
    setMilestoneError(null);
    try {
      await adminApi.deleteMilestone(milestoneId);
      await loadMilestones();
      await loadRoadmap();
    } catch (err) {
      setMilestoneError(err instanceof ApiError ? err.message : "Couldn't delete milestone.");
    }
  }

  if (!roadmap || milestones === null) return null;

  return (
    <div className="max-w-160">
      <Link href="/admin/roadmaps" className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint hover:text-muted">
        ← roadmaps
      </Link>
      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <h1 className="text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">{roadmap.title}</h1>
        <span
          className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.08em] ${
            roadmap.published_at ? "bg-accent/[0.12] text-navy" : "border border-border-strong text-muted"
          }`}
        >
          {roadmap.published_at ? "published" : "draft"}
        </span>
      </div>
      <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">{roadmap.arm.name}</div>

      <div className="mt-6.5 rounded-xl border border-border bg-surface p-6">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">details</div>
        <form onSubmit={saveDetails} className="mt-4.5 flex flex-col gap-3.5">
          <label className="block">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Goal for this semester</div>
            <textarea
              value={goalSummary}
              onChange={(e) => setGoalSummary(e.target.value)}
              rows={3}
              placeholder="What is this arm trying to get done this semester?"
              className="mt-1.5 w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>
          {saveError && <p className="text-sm text-danger">{saveError}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-fit rounded-lg bg-accent px-6 py-3 text-[14.5px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save details"}
          </button>
        </form>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">milestones</div>
          {roadmap.published_at ? (
            <button
              onClick={unpublish}
              className="rounded-md border border-border-strong px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted"
            >
              unpublish
            </button>
          ) : (
            <button
              onClick={publish}
              className="rounded-md bg-accent px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744]"
            >
              publish
            </button>
          )}
        </div>
        {publishError && <p className="mt-3 text-sm text-danger">{publishError}</p>}

        <div className="mt-4.5 flex flex-col gap-2">
          {milestones.length === 0 && <p className="text-sm text-muted">No milestones yet.</p>}
          {milestones.map((m, i) => (
            <div key={m.id} className="rounded-lg border border-border-strong bg-background px-4 py-3">
              {editingId === m.id ? (
                <div className="flex flex-col gap-2.5">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    placeholder="Description (optional)"
                    className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(m.id)} className="text-sm text-accent-dim hover:underline">
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-sm text-faint hover:underline">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => reorder(m.id, "up")}
                      disabled={i === 0}
                      className="rounded-md border border-border-strong px-2 py-1 text-xs text-muted disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => reorder(m.id, "down")}
                      disabled={i === milestones.length - 1}
                      className="rounded-md border border-border-strong px-2 py-1 text-xs text-muted disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                  <div className="min-w-40 flex-1">
                    <div className="text-sm font-medium">{m.title}</div>
                    {m.description && <p className="mt-0.5 text-[12.5px] text-muted">{m.description}</p>}
                  </div>
                  <button
                    onClick={() => cycleStatus(m)}
                    title="Click to advance status"
                    className={`rounded-full border px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.08em] ${
                      m.status === "done"
                        ? "border-accent-dim/40 bg-accent/[0.12] text-navy"
                        : m.status === "in_progress"
                          ? "border-warn/40 bg-warn/10 text-warn"
                          : "border-border-strong text-muted"
                    }`}
                  >
                    {STATUS_LABEL[m.status]}
                  </button>
                  <button onClick={() => startEdit(m)} className="text-sm text-muted hover:underline">
                    Edit
                  </button>
                  <button onClick={() => removeMilestone(m.id, m.title)} className="text-sm text-danger hover:underline">
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {milestoneError && <p className="mt-3 text-sm text-danger">{milestoneError}</p>}

        <form onSubmit={addMilestone} className="mt-4 flex flex-col gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New milestone title"
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={2}
            placeholder="Description (optional)"
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="w-fit rounded-md border border-border-strong px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted"
          >
            + add milestone
          </button>
        </form>
      </div>
    </div>
  );
}
