"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  ApiError,
  eventApi,
  eventManagerApi,
  type AdminRegistrationRow,
  type EventDetail,
  type EventManagerRow,
} from "@/lib/api";
import { EventCheckinPanel } from "@/components/EventCheckinPanel";
import { useMe } from "@/lib/useMe";
import { signInHref } from "@/lib/nextParam";
import { formatEventMeta } from "@/lib/eventFormat";

const STATUS_COLOR: Record<string, string> = {
  pending: "text-warn border-[#f0dfb8]",
  approved: "text-navy border-accent-dim",
  waitlisted: "text-warn border-[#f0dfb8]",
  attended: "text-navy border-accent-dim",
  rejected: "text-danger border-[#f6d9d6]",
  cancelled: "text-muted border-border-strong",
};

export default function ManageEventPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [rows, setRows] = useState<AdminRegistrationRow[] | null>(null);
  const [managers, setManagers] = useState<EventManagerRow[] | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [walkInName, setWalkInName] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInPayment, setWalkInPayment] = useState<"free" | "stk_push" | "manual_receipt">("free");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInReceipt, setWalkInReceipt] = useState("");
  const [walkInBusy, setWalkInBusy] = useState(false);
  const [walkInError, setWalkInError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const loadRegistrations = useCallback(() => {
    eventManagerApi
      .registrations(slug)
      .then(setRows)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) setAccessDenied(true);
      });
  }, [slug]);

  const loadManagers = useCallback(() => {
    eventManagerApi.managers(slug).then(setManagers).catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (meLoading) return;
    if (!me) {
      router.push(signInHref(pathname));
      return;
    }
    eventApi.get(slug).then(setEvent);
    loadRegistrations();
    loadManagers();
  }, [meLoading, me, pathname, router, slug, loadRegistrations, loadManagers]);

  async function act(id: string, action: "approve" | "reject" | "waitlist" | "attend") {
    setBusy(id);
    setError(null);
    try {
      await {
        approve: eventManagerApi.approve,
        reject: eventManagerApi.reject,
        waitlist: eventManagerApi.waitlist,
        attend: eventManagerApi.attend,
      }[action](slug, id);
      loadRegistrations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That action failed — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function checkIn(row: AdminRegistrationRow) {
    await eventManagerApi.attend(slug, row.id);
    setRows((r) => r?.map((x) => (x.id === row.id ? { ...x, status: "attended" } : x)) ?? null);
  }

  async function addWalkIn(e: React.FormEvent) {
    e.preventDefault();
    if (!walkInName.trim() || !walkInEmail.trim()) return;
    setWalkInBusy(true);
    setWalkInError(null);
    try {
      await eventManagerApi.addWalkIn(slug, {
        name: walkInName.trim(),
        email: walkInEmail.trim(),
        payment: walkInPayment,
        phone: walkInPhone.trim() || null,
        mpesa_receipt: walkInReceipt.trim() || null,
      });
      setWalkInName("");
      setWalkInEmail("");
      setWalkInPhone("");
      setWalkInReceipt("");
      setWalkInPayment("free");
      loadRegistrations();
    } catch (err) {
      setWalkInError(err instanceof ApiError ? err.message : "Couldn't add that attendee.");
    } finally {
      setWalkInBusy(false);
    }
  }

  async function inviteManager(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    setInviteError(null);
    try {
      await eventManagerApi.inviteManager(slug, inviteEmail.trim());
      setInviteEmail("");
      loadManagers();
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Couldn't send that invite.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function revokeManager(managerId: string) {
    await eventManagerApi.revokeManager(slug, managerId);
    loadManagers();
  }

  if (meLoading || !me) return null;

  if (accessDenied) {
    return (
      <main className="mx-auto max-w-140 px-5 py-16 text-center sm:px-10">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">not authorized</div>
        <h1 className="mt-3.5 text-[clamp(22px,3.2vw,32px)] tracking-[-0.03em]">You don&apos;t manage this event</h1>
        <p className="mt-3 text-[14.5px] text-muted">
          Ask whoever runs this event to invite you, or head back to the dashboard.
        </p>
        <Link href="/dashboard" className="mt-6 inline-block rounded-md bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#1a2744]">
          Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-160 px-5 py-10 sm:px-10 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">manage event</div>
      <h1 className="mt-3.5 text-[clamp(24px,3.4vw,36px)] tracking-[-0.035em]">{event?.title ?? slug}</h1>
      {event && <p className="mt-2 font-mono text-[11px] text-faint">{formatEventMeta(event)}</p>}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {/* registrations */}
      <div className="mt-7 rounded-xl border border-border bg-surface p-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">registrations</div>
        <div className="mt-4 flex flex-col">
          {rows?.length === 0 && <p className="py-3 text-sm text-muted">No registrations yet.</p>}
          {rows?.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-[#e8e1d2] py-3.5 last:border-0">
              <div className="min-w-32 flex-1">
                <div className="text-[15px] font-medium">{r.name}</div>
                <div className="mt-0.5 font-mono text-[10.5px] text-faint">{r.detail}</div>
              </div>
              <span
                className={`rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${STATUS_COLOR[r.status] ?? "text-muted border-border-strong"}`}
              >
                {r.status}
              </span>
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
      </div>

      {/* walk-in */}
      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">add a walk-in</div>
        <form onSubmit={addWalkIn} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <input
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              placeholder="Name"
              className="min-w-40 flex-1 rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
            <input
              value={walkInEmail}
              onChange={(e) => setWalkInEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="min-w-40 flex-1 rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>
          {event && event.fee_kes > 0 && (
            <>
              <div className="flex flex-wrap gap-2 font-mono text-[10.5px] uppercase tracking-[0.08em]">
                {(["free", "manual_receipt", "stk_push"] as const).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => setWalkInPayment(mode)}
                    className={`rounded-md px-3 py-1.5 ${walkInPayment === mode ? "bg-accent text-[#1a2744]" : "border border-border-strong text-muted"}`}
                  >
                    {mode === "free" ? "comp / free" : mode === "manual_receipt" ? "paid cash" : "send M-Pesa request"}
                  </button>
                ))}
              </div>
              {(walkInPayment === "stk_push" || walkInPayment === "manual_receipt") && (
                <input
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  placeholder="Phone (07xxxxxxxx)"
                  className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              )}
              {walkInPayment === "manual_receipt" && (
                <input
                  value={walkInReceipt}
                  onChange={(e) => setWalkInReceipt(e.target.value)}
                  placeholder="M-Pesa receipt code"
                  className="w-full rounded-md border border-border-strong bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              )}
            </>
          )}
          {walkInError && <p className="text-sm text-danger">{walkInError}</p>}
          <button
            type="submit"
            disabled={walkInBusy}
            className="w-fit rounded-md bg-accent px-4.5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#1a2744] disabled:opacity-50"
          >
            {walkInBusy ? "adding…" : "+ add attendee"}
          </button>
        </form>
      </div>

      {/* check-in */}
      <div className="mt-7">
        <div className="mb-3.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">check people in</div>
        <EventCheckinPanel registrations={rows ?? []} onCheckIn={checkIn} />
      </div>

      {/* managers */}
      <div className="mt-7 rounded-xl border border-border bg-surface p-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">event managers</div>
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
    </main>
  );
}
