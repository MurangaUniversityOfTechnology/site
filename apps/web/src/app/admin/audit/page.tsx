"use client";

import { useEffect, useState } from "react";
import { adminApi, type AuditEntry } from "@/lib/api";

const KINDS = [
  "form",
  "course",
  "event",
  "arms",
  "project",
  "tags",
  "roles",
  "import",
  "content",
  "settings",
  "payment",
  "membership",
];

const KIND_COLOR: Record<string, string> = {
  membership: "text-navy",
  payment: "text-warn",
  event: "text-muted",
  content: "text-danger",
  settings: "text-muted",
  import: "text-warn",
  form: "text-navy",
  course: "text-navy",
  arms: "text-muted",
  project: "text-muted",
  tags: "text-muted",
  roles: "text-warn",
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      adminApi
        .audit({
          kind: kind || undefined,
          q: q.trim() || undefined,
          since: since || undefined,
          until: until ? `${until}T23:59:59` : undefined,
        })
        .then(setEntries);
    }, 250);
    return () => clearTimeout(timeout);
  }, [kind, q, since, until]);

  const hasFilters = kind || q || since || until;

  return (
    <div className="max-w-180">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">audit log</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Every admin action</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-muted">
        Immutable. Useful the moment a second admin exists.
      </p>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded-md border border-border-strong bg-background px-3 py-2 font-mono text-[12.5px] outline-none focus:border-accent"
        >
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search actor or action…"
          className="min-w-0 flex-1 rounded-md border border-border-strong bg-background px-3.5 py-2 font-mono text-[12.5px] outline-none focus:border-accent"
        />
        <input
          type="date"
          value={since}
          onChange={(e) => setSince(e.target.value)}
          aria-label="From date"
          className="rounded-md border border-border-strong bg-background px-3 py-2 font-mono text-[12.5px] outline-none focus:border-accent"
        />
        <input
          type="date"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
          aria-label="To date"
          className="rounded-md border border-border-strong bg-background px-3 py-2 font-mono text-[12.5px] outline-none focus:border-accent"
        />
        {hasFilters && (
          <button
            onClick={() => {
              setKind("");
              setQ("");
              setSince("");
              setUntil("");
            }}
            className="rounded-md border border-border-strong px-3 py-2 font-mono text-[12.5px] text-muted hover:border-accent-dim"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-4.5 overflow-hidden rounded-[11px] border border-border bg-surface">
        {entries?.length === 0 && (
          <div className="px-4.5 py-8 text-center text-sm text-muted">
            {hasFilters ? "No actions match those filters." : "No actions yet."}
          </div>
        )}
        {entries?.map((e, i) => (
          <div
            key={i}
            className="grid grid-cols-[110px_1fr_auto] items-baseline gap-4 border-b border-[#e8e1d2] px-4.5 py-3.5 font-mono text-[11.5px] last:border-0"
          >
            <span className="whitespace-nowrap text-faint">
              {new Date(e.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            <div className="min-w-0">
              <div className="text-[#33302b]">{e.what}</div>
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
