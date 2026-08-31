"use client";

import { useEffect, useState } from "react";
import { challengeApi, type RecentSubmission } from "@/lib/api";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RecentSubmissions({
  slug,
  fallback,
}: {
  slug: string;
  fallback: { name: string; stack: string; when: string }[];
}) {
  const [live, setLive] = useState<RecentSubmission[] | null>(null);

  useEffect(() => {
    let active = true;
    challengeApi.recentSubmissions(slug).then((result) => {
      if (active) setLive(result);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  const rows =
    live && live.length > 0
      ? live.map((s) => ({ name: s.name, stack: null as string | null, when: timeAgo(s.when) }))
      : fallback.map((s) => ({ name: s.name, stack: s.stack as string | null, when: s.when }));

  return (
    <div className="mt-4.5 flex flex-col">
      {rows.map((s, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-[#e8e1d2] py-3.5 last:border-0">
          <div className="grid h-7.5 w-7.5 flex-none place-items-center rounded-full border border-border-strong bg-[#f0ece0] font-mono text-[10.5px] text-muted">
            {s.name
              .split(" ")
              .map((w) => w[0])
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px]">{s.name}</div>
            {s.stack && <div className="mt-1 font-mono text-[10.5px] text-faint">{s.stack}</div>}
          </div>
          <span className="font-mono text-[10.5px] text-navy">{s.when}</span>
        </div>
      ))}
    </div>
  );
}
