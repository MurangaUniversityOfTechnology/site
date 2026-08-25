"use client";

import { useEffect, useState } from "react";
import { adminApi, type AuditEntry } from "@/lib/api";

const KIND_COLOR: Record<string, string> = {
  membership: "text-accent",
  payment: "text-warn",
  event: "text-muted",
  content: "text-danger",
  settings: "text-muted",
  import: "text-warn",
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    adminApi.audit().then(setEntries);
  }, []);

  return (
    <div className="max-w-180">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">audit log</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Every admin action</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-muted">
        Immutable. Useful the moment a second admin exists.
      </p>

      <div className="mt-6.5 overflow-hidden rounded-[11px] border border-border bg-surface">
        {entries?.length === 0 && <div className="px-4.5 py-8 text-center text-sm text-muted">No actions yet.</div>}
        {entries?.map((e, i) => (
          <div
            key={i}
            className="grid grid-cols-[110px_1fr_auto] items-baseline gap-4 border-b border-[#14191b] px-4.5 py-3.5 font-mono text-[11.5px] last:border-0"
          >
            <span className="whitespace-nowrap text-faint">
              {new Date(e.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            <div className="min-w-0">
              <div className="text-[#c8d2cc]">{e.what}</div>
              <div className="mt-1 text-faint">{e.who}</div>
            </div>
            <span className={`justify-self-end whitespace-nowrap text-[10px] uppercase tracking-[0.08em] ${KIND_COLOR[e.kind] ?? "text-muted"}`}>
              {e.kind}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
