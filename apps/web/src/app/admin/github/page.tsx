"use client";

import { useEffect, useState } from "react";
import { adminApi, type RosterRow } from "@/lib/api";

const STATE: Record<string, { label: string; fg: string; bd: string }> = {
  none: { label: "no github linked", fg: "text-faint", bd: "border-border-strong" },
  invited: { label: "invite sent", fg: "text-warn", bd: "border-[#3a3226]" },
  accepted: { label: "in org", fg: "text-accent", bd: "border-accent-dim" },
  expired: { label: "expired", fg: "text-danger", bd: "border-[#5a3330]" },
};

export default function AdminGithubPage() {
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminApi.roster().then((result) => {
      if (active) setRows(result);
    });
    return () => {
      active = false;
    };
  }, []);

  async function refresh(userId: string) {
    setBusy(userId);
    try {
      const row = await adminApi.refreshRosterRow(userId);
      setRows((r) => r?.map((x) => (x.user_id === userId ? row : x)) ?? null);
    } finally {
      setBusy(null);
    }
  }

  async function resend(userId: string) {
    setBusy(userId);
    try {
      await adminApi.resendInvite(userId);
      await refresh(userId);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-160">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">projects</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">GitHub sync</h1>
      <p className="mt-3.5 text-[14.5px] leading-[1.55] text-muted">
        Active members with GitHub linked get an org invite automatically. This is the roster of who&apos;s in,
        pending, or needs a nudge.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        {rows?.map((r) => {
          const s = STATE[r.invite_status] ?? STATE.none;
          return (
            <div key={r.user_id} className="flex flex-wrap items-center gap-3.5 border-b border-[#14191b] px-5 py-3.5 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium">{r.name}</div>
                <div className="mt-0.5 font-mono text-[10.5px] text-faint">
                  {r.github_login ? `github.com/${r.github_login}` : r.email}
                </div>
              </div>
              <span className={`rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${s.fg} ${s.bd}`}>
                {s.label}
              </span>
              <button
                onClick={() => refresh(r.user_id)}
                disabled={busy === r.user_id}
                className="rounded-md border border-border-strong px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted disabled:opacity-50"
              >
                refresh
              </button>
              {(r.invite_status === "expired" || r.invite_status === "none") && r.github_login && (
                <button
                  onClick={() => resend(r.user_id)}
                  disabled={busy === r.user_id}
                  className="rounded-md border border-accent-dim px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-accent disabled:opacity-50"
                >
                  {r.invite_status === "none" ? "invite" : "re-send"}
                </button>
              )}
            </div>
          );
        })}
        {rows?.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-muted">No active members yet.</div>
        )}
      </div>
    </div>
  );
}
