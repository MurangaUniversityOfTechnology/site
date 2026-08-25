"use client";

import { useEffect, useState } from "react";
import { adminExtraApi, type AdminContentRow } from "@/lib/api";

export default function AdminContentPage() {
  const [rows, setRows] = useState<AdminContentRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminExtraApi.contentQueue().then((result) => {
      if (active) setRows(result);
    });
    return () => {
      active = false;
    };
  }, []);

  async function act(id: string, action: "publish" | "reject" | "request") {
    setBusy(id);
    try {
      await {
        publish: adminExtraApi.publishContent,
        reject: adminExtraApi.rejectContent,
        request: adminExtraApi.requestContentChanges,
      }[action](id);
      setRows((r) => r?.filter((x) => x.id !== id) ?? null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-190">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">content</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Awaiting review</h1>

      <div className="mt-6 flex flex-col gap-3.5">
        {rows?.length === 0 && (
          <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center text-sm text-muted">
            Nothing waiting on you.
          </div>
        )}
        {rows?.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-warn">article</span>
              <span className="text-[18px] font-semibold tracking-[-0.01em]">{r.title}</span>
            </div>
            <div className="mt-1.5 font-mono text-[11px] text-faint">{r.author}</div>
            <p className="mt-3.5 line-clamp-3 text-[14.5px] leading-[1.55] text-muted">{r.body}</p>
            <div className="mt-4.5 flex flex-wrap gap-2">
              <button
                onClick={() => act(r.id, "publish")}
                disabled={busy === r.id}
                className="rounded-md border border-accent-dim px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-accent disabled:opacity-50"
              >
                publish
              </button>
              <button
                onClick={() => act(r.id, "request")}
                disabled={busy === r.id}
                className="rounded-md border border-border-strong px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted disabled:opacity-50"
              >
                request changes
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
