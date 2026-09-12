"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, adminApi, type AdminRoadmapRow, type Arm } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";

export default function AdminRoadmapsPage() {
  const [arms, setArms] = useState<Arm[] | null>(null);
  const [roadmaps, setRoadmaps] = useState<AdminRoadmapRow[] | null>(null);
  const [armId, setArmId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();

  const loadRoadmaps = useCallback(() => {
    adminApi.listRoadmaps().then(setRoadmaps);
  }, []);

  useEffect(() => {
    adminApi.listArms().then((result) => {
      setArms(result);
      setArmId((prev) => prev || result[0]?.id || "");
    });
    loadRoadmaps();
  }, [loadRoadmaps]);

  async function createRoadmap(e: React.FormEvent) {
    e.preventDefault();
    if (!armId || !title.trim()) return;
    setError(null);
    try {
      await adminApi.createRoadmap({ arm_id: armId, title: title.trim(), goal_summary: null });
      setTitle("");
      loadRoadmaps();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create roadmap.");
    }
  }

  async function remove(id: string, title: string) {
    const ok = await confirm({ title: "Delete roadmap?", message: `"${title}" and its milestones will be permanently deleted.` });
    if (!ok) return;
    setBusy(id);
    setError(null);
    try {
      await adminApi.deleteRoadmap(id);
      loadRoadmaps();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete roadmap.");
    } finally {
      setBusy(null);
    }
  }

  const groups = new Map<string, { arm: Arm; rows: AdminRoadmapRow[] }>();
  for (const r of roadmaps ?? []) {
    const existing = groups.get(r.arm.id);
    if (existing) existing.rows.push(r);
    else groups.set(r.arm.id, { arm: r.arm, rows: [r] });
  }
  const orderedGroups = [...groups.values()].sort((a, b) => a.arm.position - b.arm.position);

  return (
    <div className="max-w-220">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">programs</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Roadmaps</h1>
      <p className="mt-2.5 max-w-140 text-[14px] leading-[1.55] text-muted">
        One roadmap per semester, per arm — the goal for that stretch plus the milestones toward it. Publish when
        it&apos;s ready for students to see; unpublished roadmaps stay admin-only.
      </p>

      <form onSubmit={createRoadmap} className="mt-6.5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-5.5">
        <label className="block">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Arm</div>
          <select
            value={armId}
            onChange={(e) => setArmId(e.target.value)}
            className="mt-1.5 rounded-md border border-border-strong bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            {arms?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block flex-1 min-w-50">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Title</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Semester 1, 2026"
            className="mt-1.5 w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={!arms || arms.length === 0}
          className="rounded-md bg-accent px-4.5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744] hover:opacity-90 disabled:opacity-50"
        >
          + new roadmap
        </button>
      </form>
      {arms?.length === 0 && (
        <p className="mt-2.5 text-[13px] text-muted">
          Create an arm first under <Link href="/admin/arms" className="text-accent-dim hover:underline">Arms</Link>.
        </p>
      )}
      {error && <p className="mt-2.5 text-sm text-danger">{error}</p>}

      <div className="mt-8 flex flex-col gap-8">
        {orderedGroups.map(({ arm, rows }) => (
          <div key={arm.id}>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{arm.name}</div>
            <div className="mt-3 flex flex-col gap-2.5">
              {rows
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border-strong bg-surface px-4.5 py-3.5">
                    <div className="min-w-40 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-medium">{r.title}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] ${
                            r.published_at ? "bg-accent/[0.12] text-navy" : "border border-border-strong text-muted"
                          }`}
                        >
                          {r.published_at ? "published" : "draft"}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-faint">
                        {r.milestone_count} milestone{r.milestone_count === 1 ? "" : "s"} · by {r.created_by}
                      </div>
                    </div>
                    <Link
                      href={`/admin/roadmaps/${r.id}`}
                      className="rounded-md border border-border-strong px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted"
                    >
                      manage
                    </Link>
                    <button
                      onClick={() => remove(r.id, r.title)}
                      disabled={busy === r.id}
                      className="rounded-md border border-[#f6d9d6] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-danger disabled:opacity-50"
                    >
                      delete
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))}
        {roadmaps?.length === 0 && (
          <div className="rounded-[11px] border border-border bg-surface px-4.5 py-8 text-center text-sm text-muted">
            No roadmaps yet.
          </div>
        )}
      </div>
    </div>
  );
}
