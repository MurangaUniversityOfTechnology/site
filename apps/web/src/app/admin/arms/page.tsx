"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, adminApi, type Arm } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";

export default function AdminArmsPage() {
  const [arms, setArms] = useState<Arm[] | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const confirm = useConfirm();

  const loadArms = useCallback(() => {
    adminApi.listArms().then(setArms);
  }, []);

  useEffect(() => {
    loadArms();
  }, [loadArms]);

  async function createArm() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      await adminApi.createArm(name);
      setNewName("");
      loadArms();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create arm.");
    }
  }

  async function saveRename(armId: string) {
    const name = renameValue.trim();
    if (!name) return;
    setError(null);
    try {
      await adminApi.renameArm(armId, name);
      setRenamingId(null);
      loadArms();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't rename arm.");
    }
  }

  async function removeArm(armId: string, name: string) {
    const ok = await confirm({
      title: "Delete arm?",
      message: `"${name}" will be removed from every course currently in it.`,
    });
    if (!ok) return;
    setError(null);
    try {
      await adminApi.deleteArm(armId);
      loadArms();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete arm.");
    }
  }

  async function reorder(armId: string, direction: "up" | "down") {
    setError(null);
    try {
      await adminApi.reorderArm(armId, direction);
      loadArms();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reorder arm.");
    }
  }

  return (
    <div className="max-w-160">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">courses</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Arms</h1>
      <p className="mt-2.5 max-w-120 text-[14px] leading-[1.55] text-muted">
        The tracks courses can be organized under (Web Development, AI &amp; Robotics, ...) — a course can belong to
        more than one. Order here is the order shown to members.
      </p>

      <div className="mt-6.5 rounded-xl border border-border bg-surface p-5.5">
        <div className="space-y-2">
          {arms?.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2 rounded-md border border-border-strong px-3.5 py-2.5">
              {renamingId === a.id ? (
                <>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                    className="flex-1 rounded-md border border-border-strong bg-background px-2.5 py-1.5 font-mono text-sm outline-none focus:border-accent"
                  />
                  <button onClick={() => saveRename(a.id)} className="text-sm text-accent-dim hover:underline">
                    Save
                  </button>
                  <button onClick={() => setRenamingId(null)} className="text-sm text-faint hover:underline">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div className="flex gap-1">
                    <button
                      onClick={() => reorder(a.id, "up")}
                      disabled={i === 0}
                      className="rounded-md border border-border-strong px-1.5 py-0.5 text-xs text-muted disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => reorder(a.id, "down")}
                      disabled={arms && i === arms.length - 1}
                      className="rounded-md border border-border-strong px-1.5 py-0.5 text-xs text-muted disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                  <span className="flex-1 text-sm">{a.name}</span>
                  <button
                    onClick={() => {
                      setRenamingId(a.id);
                      setRenameValue(a.name);
                    }}
                    className="text-sm text-muted hover:underline"
                  >
                    Rename
                  </button>
                  <button onClick={() => removeArm(a.id, a.name)} className="text-sm text-danger hover:underline">
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
          {arms?.length === 0 && <p className="text-sm text-faint">No arms yet.</p>}
        </div>

        <div className="mt-3.5 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Data Science, Game Development"
            className="flex-1 rounded-md border border-border-strong bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-accent"
          />
          <button
            onClick={createArm}
            className="rounded-md border border-border-strong px-4 py-2.5 text-sm hover:border-accent-dim"
          >
            Create arm
          </button>
        </div>
        {error && <p className="mt-3.5 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
