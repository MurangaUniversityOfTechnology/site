"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { adminApi, ApiError, type AdminEventRow, type AdminRegistrationRow, type EventManagerRow } from "@/lib/api";
import { formatEventMeta } from "@/lib/eventFormat";

const STATUS_COLOR: Record<string, string> = {
  pending: "text-warn border-[#f0dfb8]",
  approved: "text-navy border-accent-dim",
  waitlisted: "text-warn border-[#f0dfb8]",
  attended: "text-navy border-accent-dim",
  rejected: "text-danger border-[#f6d9d6]",
  cancelled: "text-muted border-border-strong",
};

const PAYMENT_COLOR: Record<string, string> = {
  completed: "text-navy border-accent-dim",
  pending: "text-warn border-[#f0dfb8]",
  initiated: "text-warn border-[#f0dfb8]",
  failed: "text-danger border-[#f6d9d6]",
  cancelled: "text-danger border-[#f6d9d6]",
};

export default function AdminEventRegistrationsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [event, setEvent] = useState<AdminEventRow | null>(null);
  const [rows, setRows] = useState<AdminRegistrationRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [managers, setManagers] = useState<EventManagerRow[] | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi.eventRegistrations(slug).then(setRows);
  }, [slug]);

  const loadManagers = useCallback(() => {
    adminApi.listEventManagers(slug).then(setManagers);
  }, [slug]);

  useEffect(() => {
    let active = true;
    adminApi.eventRegistrations(slug).then((result) => {
      if (active) setRows(result);
    });
    adminApi.listEvents().then((events) => {
      if (active) setEvent(events.find((e) => e.slug === slug) ?? null);
    });
    adminApi.listEventManagers(slug).then((result) => {
      if (active) setManagers(result);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  async function inviteManager(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    setInviteError(null);
    try {
      await adminApi.inviteEventManager(slug, inviteEmail.trim());
      setInviteEmail("");
      loadManagers();
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Couldn't send that invite.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function revokeManager(managerId: string) {
    await adminApi.revokeEventManager(managerId);
    loadManagers();
  }

  async function act(id: string, action: "approve" | "reject" | "waitlist" | "attend") {
    setBusy(id);
    setError(null);
    try {
      await {
        approve: adminApi.approveRegistration,
        reject: adminApi.rejectRegistration,
        waitlist: adminApi.waitlistRegistration,
        attend: adminApi.attendRegistration,
      }[action](id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That action failed — try again.");
    } finally {
      setBusy(null);
    }
  }

  const approved = rows?.filter((r) => r.status === "approved" || r.status === "attended").length ?? 0;
  const pending = rows?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">registrations</div>
          <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">{event?.title ?? slug}</h1>
        </div>
        <Link
          href={`/admin/events/${slug}/checkin`}
          className="rounded-md bg-accent px-4.5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744] hover:opacity-90"
        >
          Open check-in
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-5.5 font-mono text-[11px] text-[#8f8368]">
        {event && <span>{formatEventMeta(event)}</span>}
        <span>
          approved <span className="text-navy">{approved}</span>
        </span>
        <span>
          pending <span className="text-warn">{pending}</span>
        </span>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-[11px] border border-border bg-surface">
        {rows?.length === 0 && <div className="px-4.5 py-8 text-center text-sm text-muted">No registrations yet.</div>}
        {rows?.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3.5 border-b border-[#e8e1d2] px-4.5 py-3.5 last:border-0">
            <div className="grid h-8 w-8 flex-none place-items-center rounded-full border border-border-strong bg-[#f0ece0] font-mono text-[11px] text-muted">
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
            {r.payment_status && (
              <span
                className={`rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${PAYMENT_COLOR[r.payment_status] ?? "text-muted border-border-strong"}`}
              >
                {r.payment_status === "completed" ? "paid" : r.payment_status}
              </span>
            )}
            <div className="flex gap-1.5">
              {(r.status === "pending" || r.status === "waitlisted") && (
                <>
                  <button
                    onClick={() => act(r.id, "approve")}
                    disabled={busy === r.id}
                    className="rounded-md border border-accent-dim px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-navy disabled:opacity-50"
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
                  className="rounded-md border border-accent-dim px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-navy disabled:opacity-50"
                >
                  mark attended
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[11px] border border-border bg-surface p-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">event managers</div>
        <p className="mt-1.5 text-[13px] text-muted">
          Scoped to just this event — they can approve/reject registrations, add walk-ins, and check people in, but
          nothing else in admin.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {managers?.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border-strong px-3.5 py-2.5">
              <div className="min-w-40 flex-1">
                <div className="text-sm">{m.invited_email}</div>
                <div className="mt-0.5 font-mono text-[10px] text-faint">invited by {m.invited_by}</div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] ${
                  m.status === "active"
                    ? "border border-accent-dim/40 bg-accent/[0.12] text-navy"
                    : m.status === "invited"
                      ? "border border-[#f0dfb8] bg-warn/[0.06] text-warn"
                      : "border border-border-strong text-muted"
                }`}
              >
                {m.status}
              </span>
              {m.status !== "revoked" && (
                <button onClick={() => revokeManager(m.id)} className="text-sm text-danger hover:underline">
                  revoke
                </button>
              )}
            </div>
          ))}
          {managers?.length === 0 && <p className="text-sm text-muted">No one else manages this event yet.</p>}
        </div>
        <form onSubmit={inviteManager} className="mt-4 flex flex-wrap gap-2">
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Invite by email"
            type="email"
            className="min-w-48 flex-1 rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={inviteBusy}
            className="rounded-md border border-border-strong px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted disabled:opacity-50"
          >
            {inviteBusy ? "sending…" : "+ invite manager"}
          </button>
        </form>
        {inviteError && <p className="mt-2 text-sm text-danger">{inviteError}</p>}
      </div>
    </div>
  );
}
