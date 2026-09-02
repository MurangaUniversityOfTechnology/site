"use client";

import { useEffect, useState } from "react";
import { adminApi, type DonationsOverview } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  completed: "text-navy",
  pending: "text-warn",
  initiated: "text-warn",
  failed: "text-danger",
  cancelled: "text-danger",
};

export default function DonationsPage() {
  const [data, setData] = useState<DonationsOverview | null>(null);

  useEffect(() => {
    adminApi.donations().then(setData);
  }, []);

  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">donations</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Giving</h1>

      {data && (
        <div className="mt-6.5 grid grid-cols-1 gap-px overflow-hidden rounded-[11px] border border-border bg-border sm:grid-cols-3">
          {data.totals.map((t) => (
            <div key={t.label} className="bg-surface p-5">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">{t.label}</div>
              <div className={`mt-2.5 font-mono text-[clamp(19px,2.4vw,25px)] font-bold ${STATUS_COLOR[t.label] ?? "text-foreground"}`}>
                KSh {t.amount_kes.toLocaleString()}
              </div>
              <div className="mt-1.5 font-mono text-[10.5px] text-faint">{t.count} donations</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-[11px] border border-border bg-surface">
        <div className="grid grid-cols-[1fr_1.2fr_1fr_0.8fr_0.8fr] gap-3.5 border-b border-[#ddd6c4] bg-[#f5f0e3] px-4.5 py-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
          <span>receipt</span>
          <span>donor</span>
          <span>reason</span>
          <span>amount</span>
          <span>status</span>
        </div>
        {data?.rows.length === 0 && (
          <div className="px-4.5 py-8 text-center text-sm text-muted">No donations yet.</div>
        )}
        {data?.rows.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_1.2fr_1fr_0.8fr_0.8fr] items-center gap-3.5 border-b border-[#e8e1d2] px-4.5 py-3.5 font-mono text-[11.5px] last:border-0"
          >
            <span className="truncate text-[#33302b]">{r.receipt ?? "—"}</span>
            <span className="truncate text-muted">{r.donor}</span>
            <span className="truncate text-muted">{r.reason}</span>
            <span className="text-foreground">KSh {r.amount.toFixed(0)}</span>
            <span className={`uppercase ${STATUS_COLOR[r.status] ?? "text-muted"}`}>{r.status}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 max-w-160 rounded-lg border border-dashed border-[#f0dfb8] bg-warn/[0.04] p-4.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-warn">no manual overrides</div>
        <p className="mt-2.5 text-[14.5px] leading-[1.55] text-muted">
          Donation status comes only from the M-Pesa transaction callback. If a donor says they paid and the row
          says otherwise, query the transaction — don&apos;t mark it paid.
        </p>
      </div>
    </div>
  );
}
