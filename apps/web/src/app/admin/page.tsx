"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, type AdminOverview } from "@/lib/api";
import { challenges, events, projects } from "@/lib/data";

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);

  useEffect(() => {
    adminApi.overview().then(setData);
  }, []);

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">club overview</div>
      <h1 className="mt-3.5 text-[clamp(26px,4vw,42px)] tracking-[-0.035em]">{today}</h1>

      {data && (
        <div className="mt-7.5 grid grid-cols-2 gap-px overflow-hidden rounded-[11px] border border-border bg-border sm:grid-cols-4">
          <Stat value={data.total_members} label="total members" />
          <Stat value={data.new_this_week} label="new this week" color="text-accent" />
          <Stat value={events.length} label="upcoming events" />
          <Stat value={projects.length} label="active projects" />
        </div>
      )}

      <div className="mt-6.5 grid gap-5 sm:grid-cols-2">
        <div className="rounded-[11px] border border-border bg-surface p-5.5">
          <div className="flex items-baseline gap-2.5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">needs you</div>
            <span className="font-mono text-[10.5px] text-warn">action required</span>
          </div>
          <div className="mt-4 flex flex-col">
            <Link
              href="/admin/memberships"
              className="flex justify-between border-b border-[#14191b] py-3.5 text-[15px] text-foreground"
            >
              Pending membership applications
              <span className="font-mono text-xs text-warn">{data?.pending_approval ?? "…"}</span>
            </Link>
            <Link href="/admin/payments" className="flex justify-between py-3.5 text-[15px] text-foreground">
              Unmatched payments
              <span className="font-mono text-xs text-danger">{data?.unmatched_payments ?? "…"}</span>
            </Link>
          </div>
        </div>

        <div className="rounded-[11px] border border-border bg-surface p-5.5">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">this build</div>
          <div className="mt-4 flex flex-col gap-3.5 font-mono text-[12.5px] text-[#c8d2cc]">
            <Row label="projects (seed)" value={String(projects.length)} />
            <Row label="events (seed)" value={String(events.length)} />
            <Row label="challenges (seed)" value={String(challenges.length)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="bg-surface p-5">
      <div className={`font-mono text-[clamp(24px,3vw,32px)] font-bold ${color ?? "text-foreground"}`}>{value}</div>
      <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-faint">{label}</span>
      <span className="text-accent">{value}</span>
    </div>
  );
}
