"use client";

import { useEffect, useState } from "react";
import { adminProjectApi, type AdminJoinRequestRow } from "@/lib/api";

export default function AdminProjectsPage() {
  const [rows, setRows] = useState<AdminJoinRequestRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    adminProjectApi.joinRequests().then((result) => {
      if (active) setRows(result);
    });
    return () => {
      active = false;
    };
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      await (action === "approve" ? adminProjectApi.approveJoinRequest : adminProjectApi.rejectJoinRequest)(id);
      setRows((r) => r?.filter((x) => x.id !== id) ?? null);
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      await adminProjectApi.syncProjects();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="max-w-190">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">projects</div>
          <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Join requests</h1>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="rounded-md border border-border-strong px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted hover:border-accent-dim disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync from GitHub"}
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3.5">
        {rows?.length === 0 && (
          <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center text-sm text-muted">
            Nothing waiting on you.
          </div>
        )}
        {rows?.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">{r.project_name}</span>
              <span className="text-[15px] font-semibold">{r.user_name}</span>
              <span className="font-mono text-[10.5px] text-faint">{r.user_email}</span>
            </div>
            {r.contribution_areas.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {r.contribution_areas.map((a) => (
                  <span key={a} className="rounded border border-border-strong px-2 py-0.5 font-mono text-[10px] text-muted">
                    {a}
                  </span>
                ))}
              </div>
            )}
            {r.message && <p className="mt-3.5 text-[14.5px] leading-[1.55] text-muted">{r.message}</p>}
            <div className="mt-4.5 flex flex-wrap gap-2">
              <button
                onClick={() => act(r.id, "approve")}
                disabled={busy === r.id}
                className="rounded-md border border-accent-dim px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-accent disabled:opacity-50"
              >
                approve
              </button>
              <button
                onClick={() => act(r.id, "reject")}
                disabled={busy === r.id}
                className="rounded-md border border-[#5a3330] px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-danger disabled:opacity-50"
              >
                reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
