"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, eventApi, type Registration } from "@/lib/api";
import { useMe } from "@/lib/useMe";

const STATUS_COPY: Record<string, { label: string; color: string }> = {
  pending: { label: "Registered · pending approval", color: "text-warn" },
  approved: { label: "You're registered ✓", color: "text-accent" },
  waitlisted: { label: "You're on the waitlist", color: "text-warn" },
  attended: { label: "Attended ✓", color: "text-accent" },
  rejected: { label: "Registration not approved", color: "text-danger" },
  cancelled: { label: "Registration cancelled", color: "text-muted" },
};

export function EventRegisterPanel({
  slug,
  audience,
  cta,
}: {
  slug: string;
  audience: "open to all" | "members only";
  cta: string;
}) {
  const { me, loading } = useMe();
  const [registration, setRegistration] = useState<Registration | null | undefined>(undefined);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    let active = true;
    (me ? eventApi.myRegistration(slug) : Promise.resolve(null)).then((result) => {
      if (active) setRegistration(result);
    });
    return () => {
      active = false;
    };
  }, [slug, me, loading]);

  if (loading || registration === undefined) return null;

  if (registration) {
    const copy = STATUS_COPY[registration.status];
    const canViewPass = registration.status === "approved" || registration.status === "attended";
    return canViewPass ? (
      <Link href={`/events/${slug}/pass`} className={`font-mono text-[13px] font-semibold ${copy.color} hover:underline`}>
        {copy.label} · view pass
      </Link>
    ) : (
      <span className={`font-mono text-[13px] font-semibold ${copy.color}`}>{copy.label}</span>
    );
  }

  async function registerAsMember() {
    setSubmitting(true);
    setError(null);
    try {
      const reg = await eventApi.register(slug);
      setRegistration(reg);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't register — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function registerAsGuest() {
    setSubmitting(true);
    setError(null);
    try {
      const reg = await eventApi.register(slug, { guest_name: guestName, guest_email: guestEmail });
      setRegistration(reg);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't register — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Signed in — register directly (backend re-checks membership for members-only events).
  if (me) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={registerAsMember}
          disabled={submitting}
          className="rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#04140b] hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Registering…" : cta}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  // Members-only and logged out — send to sign in.
  if (audience === "members only") {
    return (
      <Link
        href="/sign-in"
        className="rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#04140b] hover:opacity-90"
      >
        Sign in to register
      </Link>
    );
  }

  // Open to all and logged out — guest registration, no account required.
  if (!showGuestForm) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowGuestForm(true)}
          className="rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#04140b] hover:opacity-90"
        >
          {cta}
        </button>
        <Link href="/sign-up" className="font-mono text-[11px] text-faint hover:text-foreground">
          or join the club
        </Link>
      </div>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-3 rounded-lg border border-border-strong bg-surface p-4.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">register as guest</div>
      <input
        value={guestName}
        onChange={(e) => setGuestName(e.target.value)}
        placeholder="Full name"
        className="rounded-md border border-border-strong bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
      />
      <input
        value={guestEmail}
        onChange={(e) => setGuestEmail(e.target.value)}
        placeholder="Email"
        type="email"
        className="rounded-md border border-border-strong bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        onClick={registerAsGuest}
        disabled={submitting || !guestName || !guestEmail}
        className="rounded-md bg-accent py-2.5 text-sm font-semibold text-[#04140b] hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Registering…" : "Confirm registration"}
      </button>
    </div>
  );
}
