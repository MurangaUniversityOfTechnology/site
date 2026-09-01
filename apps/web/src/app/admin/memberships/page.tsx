"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, adminApi, type MembershipApplication } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";

const FILTERS = [
  { value: "active", label: "Active" },
  { value: "all", label: "All" },
];

export default function MembershipsPage() {
  const [filter, setFilter] = useState("active");
  const [apps, setApps] = useState<MembershipApplication[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  const load = useCallback(() => {
    adminApi.memberships(filter).then(setApps);
  }, [filter]);

  useEffect(() => {
    let active = true;
    adminApi.memberships(filter).then((result) => {
      if (active) setApps(result);
    });
    return () => {
      active = false;
    };
  }, [filter]);

  async function toggleAdmin(a: MembershipApplication) {
    if (a.is_admin) {
      const ok = await confirm({
        title: "Remove admin access?",
        message: `${a.name} will lose access to the admin panel. They'll keep their membership.`,
      });
      if (!ok) return;
    }
    setError(null);
    setBusyId(a.user_id);
    try {
      if (a.is_admin) await adminApi.removeAdmin(a.user_id);
      else await adminApi.makeAdmin(a.user_id);
      setApps((prev) => prev?.map((row) => (row.user_id === a.user_id ? { ...row, is_admin: !row.is_admin } : row)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update role.");
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">membership</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Members</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.08em] ${
              filter === f.value ? "border-[#f0dfb8] bg-warn/[0.07] text-warn" : "border-border-strong text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-5.5 overflow-hidden rounded-[11px] border border-border bg-surface">
        <div className="grid grid-cols-[1.5fr_0.9fr_0.8fr_0.9fr] gap-3.5 border-b border-[#ddd6c4] bg-[#f5f0e3] px-4.5 py-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
          <span>member</span>
          <span>payment</span>
          <span>status</span>
          <span>role</span>
        </div>

        {apps?.length === 0 && <div className="px-4.5 py-8 text-center text-sm text-muted">No members here.</div>}

        {apps?.map((a) => (
          <div key={a.user_id} className="border-b border-[#e8e1d2] px-4.5 py-4 last:border-0">
            <div className="grid grid-cols-[1.5fr_0.9fr_0.8fr_0.9fr] items-center gap-3.5">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-medium">{a.name}</div>
                <div className="mt-1 truncate font-mono text-[10.5px] text-faint">
                  {a.course ?? a.email}
                  {a.year_of_study ? ` · year ${a.year_of_study}` : ""}
                </div>
              </div>
              <div
                className={`font-mono text-[11.5px] ${
                  a.payment_status === "completed" ? "text-navy" : "text-warn"
                }`}
              >
                {a.payment_status ?? "none"}
                {a.payment_receipt ? ` · ${a.payment_receipt}` : ""}
              </div>
              <div>
                <span className="justify-self-start rounded-md border border-border-strong px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                  {a.membership_status}
                </span>
              </div>
              <div>
                <button
                  onClick={() => toggleAdmin(a)}
                  disabled={busyId === a.user_id}
                  className={`justify-self-start rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] disabled:opacity-50 ${
                    a.is_admin ? "border-[#f0dfb8] text-warn" : "border-border-strong text-muted hover:border-accent-dim"
                  }`}
                >
                  {a.is_admin ? "admin ✓" : "make admin"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
