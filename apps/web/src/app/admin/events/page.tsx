"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, adminApi, type AdminEventRow } from "@/lib/api";
import { formatEventDateLong, formatEventMeta } from "@/lib/eventFormat";

export default function AdminEventsPage() {
  const [rows, setRows] = useState<AdminEventRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    adminApi.listEvents().then(setRows);
  }

  useEffect(load, []);

  async function remove(slug: string) {
    setBusy(slug);
    setError(null);
    try {
      await adminApi.deleteEvent(slug);
      setRows((r) => r?.filter((e) => e.slug !== slug) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete event.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">events</div>
          <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">Manage events</h1>
        </div>
        <Link
          href="/admin/events/new"
          className="rounded-md bg-accent px-4.5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744] hover:opacity-90"
        >
          New event
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-6.5 overflow-hidden rounded-[11px] border border-border bg-surface">
        {rows?.length === 0 && <div className="px-4.5 py-8 text-center text-sm text-muted">No events yet.</div>}
        {rows?.map((e) => (
          <div key={e.slug} className="flex flex-wrap items-center gap-4 border-b border-[#e8e1d2] px-4.5 py-4 last:border-0">
            <div className="min-w-45 flex-1">
              <div className="text-[15px] font-medium">{e.title}</div>
              <div className="mt-1 font-mono text-[10.5px] text-faint">
                {formatEventDateLong(e.starts_at)} · {formatEventMeta(e)}
              </div>
            </div>
            <span className="font-mono text-[10.5px] text-muted">{e.registration_count} registered</span>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/events/${e.slug}/checkin`}
                className="rounded-md bg-accent px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#1a2744]"
              >
                check-in
              </Link>
              <Link
                href={`/admin/events/${e.slug}`}
                className="rounded-md border border-accent-dim px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-navy"
              >
                registrations
              </Link>
              <Link
                href={`/admin/events/${e.slug}/edit`}
                className="rounded-md border border-border-strong px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted"
              >
                edit
              </Link>
              <button
                onClick={() => remove(e.slug)}
                disabled={busy === e.slug}
                className="rounded-md border border-[#f6d9d6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-danger disabled:opacity-50"
              >
                delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
