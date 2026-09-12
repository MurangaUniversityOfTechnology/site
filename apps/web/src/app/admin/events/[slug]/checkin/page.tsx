"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { adminApi, type AdminEventRow, type AdminRegistrationRow } from "@/lib/api";
import { EventCheckinPanel } from "@/components/EventCheckinPanel";

export default function CheckinPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [event, setEvent] = useState<AdminEventRow | null>(null);
  const [rows, setRows] = useState<AdminRegistrationRow[] | null>(null);

  const load = useCallback(() => {
    adminApi.eventRegistrations(slug).then(setRows);
    adminApi.listEvents().then((events) => setEvent(events.find((e) => e.slug === slug) ?? null));
  }, [slug]);

  useEffect(load, [load]);

  async function checkIn(row: AdminRegistrationRow) {
    await adminApi.attendRegistration(row.id);
    setRows((r) => r?.map((x) => (x.id === row.id ? { ...x, status: "attended" } : x)) ?? null);
  }

  return (
    <div className="max-w-160">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">check-in</div>
          <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">{event?.title ?? slug}</h1>
        </div>
        <Link
          href={`/admin/events/${slug}`}
          className="rounded-md border border-border-strong px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted hover:border-accent-dim"
        >
          Full roster →
        </Link>
      </div>

      <div className="mt-6">
        <EventCheckinPanel registrations={rows ?? []} onCheckIn={checkIn} />
      </div>
    </div>
  );
}
