"use client";

import { useEffect, useState } from "react";
import { ApiError, adminApi, type Arm } from "@/lib/api";

export function CourseArmsPanel({
  slug,
  assignedArms,
  onChange,
}: {
  slug: string;
  assignedArms: Arm[];
  onChange: (arms: Arm[]) => void;
}) {
  const [allArms, setAllArms] = useState<Arm[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.listArms().then(setAllArms);
  }, []);

  async function toggle(arm: Arm, assigned: boolean) {
    setBusyId(arm.id);
    setError(null);
    try {
      const updated = assigned ? await adminApi.unassignArm(slug, arm.id) : await adminApi.assignArm(slug, arm.id);
      onChange(updated.arms);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update arms.");
    } finally {
      setBusyId(null);
    }
  }

  if (!allArms) return null;

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-6">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">arms</div>
      <p className="mt-2 text-[13.5px] text-muted">
        Which tracks this course belongs to — a course can sit in more than one.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {allArms.map((arm) => {
          const assigned = assignedArms.some((a) => a.id === arm.id);
          return (
            <button
              key={arm.id}
              type="button"
              onClick={() => toggle(arm, assigned)}
              disabled={busyId === arm.id}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] disabled:opacity-50 ${
                assigned ? "border-accent-dim bg-accent/[0.08] text-navy" : "border-border-strong text-muted"
              }`}
            >
              {arm.name}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
