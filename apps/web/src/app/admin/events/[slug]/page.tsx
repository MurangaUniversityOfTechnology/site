"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adminApi, type AdminRegistrationRow } from "@/lib/api";
import { events } from "@/lib/data";

const STATUS_COLOR: Record<string, string> = {
  pending: "text-warn border-[#3a3226]",
  approved: "text-accent border-accent-dim",
  waitlisted: "text-warn border-[#3a3226]",
  attended: "text-accent border-accent-dim",
  rejected: "text-danger border-[#5a3330]",
  cancelled: "text-muted border-border-strong",
};

export default function AdminEventRegistrationsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const event = events.find((e) => e.slug === slug);
  const [rows, setRows] = useState<AdminRegistrationRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi.eventRegistrations(slug).then(setRows);
  }, [slug]);

  useEffect(() => {
    let active = true;
    adminApi.eventRegistrations(slug).then((result) => {
      if (active) setRows(result);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  async function act(id: string, action: "approve" | "reject" | "waitlist" | "attend") {
    setBusy(id);
    try {
      await {
        approve: adminApi.approveRegistration,
        reject: adminApi.rejectRegistration,
        waitlist: adminApi.waitlistRegistration,
        attend: adminApi.attendRegistration,
      }[action](id);
      load();
    } finally {
      setBusy(null);
    }
  }

  const approved = rows?.filter((r) => r.status === "approved" || r.status === "attended").length ?? 0;
  const pending = rows?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">registrations</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">{event?.title ?? slug}</h1>
      <div className="mt-4 flex flex-wrap gap-5.5 font-mono text-[11px] text-[#7f8d87]">
        {event && <span>{event.meta}</span>}
        <span>
          approved <span className="text-accent">{approved}</span>
        </span>
        <span>
          pending <span className="text-warn">{pending}</span>
        </span>
      </div>

      <div className="mt-6 overflow-hidden rounded-[11px] border border-border bg-surface">
        {rows?.length === 0 && <div className="px-4.5 py-8 text-center text-sm text-muted">No registrations yet.</div>}
        {rows?.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3.5 border-b border-[#14191b] px-4.5 py-3.5 last:border-0">
            <div className="grid h-8 w-8 flex-none place-items-center rounded-full border border-border-strong bg-[#111617] font-mono text-[11px] text-muted">
              {r.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="min-w-32 flex-1">
              <div className="text-[15px] font-medium">{r.name}</div>
              <div className="mt-1 font-mono text-[10.5px] text-faint">{r.detail}</div>
            </div>
            <span
              className={`rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${STATUS_COLOR[r.status] ?? "text-muted border-border-strong"}`}
            >
              {r.member ? "member" : "guest"}
            </span>
            <div className="flex gap-1.5">
              {(r.status === "pending" || r.status === "waitlisted") && (
                <>
                  <button
                    onClick={() => act(r.id, "approve")}
                    disabled={busy === r.id}
                    className="rounded-md border border-accent-dim px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-accent disabled:opacity-50"
                  >
                    approve
                  </button>
                  {r.status === "pending" && (
                    <button
                      onClick={() => act(r.id, "waitlist")}
                      disabled={busy === r.id}
                      className="rounded-md border border-border-strong px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted disabled:opacity-50"
                    >
                      waitlist
                    </button>
                  )}
                  <button
                    onClick={() => act(r.id, "reject")}
                    disabled={busy === r.id}
                    className="rounded-md border border-border-strong px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted disabled:opacity-50"
                  >
                    reject
                  </button>
                </>
              )}
              {r.status === "approved" && (
                <button
                  onClick={() => act(r.id, "attend")}
                  disabled={busy === r.id}
                  className="rounded-md border border-accent-dim px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-accent disabled:opacity-50"
                >
                  mark attended
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
