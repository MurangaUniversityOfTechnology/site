"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiError, eventApi, type Registration } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { signInHref } from "@/lib/nextParam";

const STATUS_COPY: Record<string, { label: string; color: string }> = {
  pending: { label: "Registered · pending approval", color: "text-warn" },
  approved: { label: "You're registered ✓", color: "text-navy" },
  waitlisted: { label: "You're on the waitlist", color: "text-warn" },
  attended: { label: "Attended ✓", color: "text-navy" },
  rejected: { label: "Registration not approved", color: "text-danger" },
  cancelled: { label: "Registration cancelled", color: "text-muted" },
};

const POLL_INTERVAL_MS = 3000;

export function EventRegisterPanel({
  slug,
  audience,
  cta,
  feeKes,
}: {
  slug: string;
  audience: "open to all" | "members only";
  cta: string;
  feeKes: number;
}) {
  const { me, loading } = useMe();
  const [registration, setRegistration] = useState<Registration | null | undefined>(undefined);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const paymentPending = registration?.payment?.status === "pending" || registration?.payment?.status === "initiated";

  const pollPayment = useCallback(() => {
    if (!registration) return;
    eventApi
      .registrationStatus(registration.id)
      .then((updated) => setRegistration(updated))
      .catch(() => {
        // transient network error — next poll tick will retry
      });
  }, [registration]);

  useEffect(() => {
    if (!paymentPending) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(pollPayment, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [paymentPending, pollPayment]);

  if (loading || registration === undefined) return null;

  if (registration) {
    if (paymentPending) {
      return (
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="font-mono text-[13px] text-[#8f8368]">
            Check your phone to approve KSh {registration.payment?.amount}…
          </span>
        </div>
      );
    }

    const paymentDidNotGoThrough =
      registration.status === "cancelled" &&
      registration.payment &&
      registration.payment.status !== "completed";

    if (paymentDidNotGoThrough) {
      return (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[13px] font-semibold text-danger">
            Payment didn&apos;t go through — your seat was released.
          </span>
          <button
            onClick={() => setRegistration(null)}
            className="self-start rounded-md border border-border-strong px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted hover:border-accent-dim"
          >
            Try again
          </button>
        </div>
      );
    }

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

  const digits = phone.replace(/\D/g, "");
  const phoneValid = feeKes === 0 || digits.length === 9;

  async function registerAsMember() {
    setSubmitting(true);
    setError(null);
    try {
      const reg = await eventApi.register(slug, feeKes > 0 ? { phone: `254${digits}` } : undefined);
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
      const reg = await eventApi.register(slug, {
        guest_name: guestName,
        guest_email: guestEmail,
        ...(feeKes > 0 ? { phone: `254${digits}` } : {}),
      });
      setRegistration(reg);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't register — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const phoneField = (
    <div className="flex gap-2">
      <div className="grid place-items-center rounded-md border border-border-strong bg-background px-3 font-mono text-[13px] text-muted">
        +254
      </div>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="712 345 678"
        className="flex-1 rounded-md border border-border-strong bg-background px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
      />
    </div>
  );

  // Signed in — register directly (backend re-checks membership for members-only events).
  if (me) {
    if (feeKes > 0) {
      return (
        <div className="flex max-w-sm flex-col gap-3 rounded-lg border border-border-strong bg-surface p-4.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            pay KSh {feeKes} to register
          </div>
          {phoneField}
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            onClick={registerAsMember}
            disabled={submitting || !phoneValid}
            className="rounded-md bg-accent py-2.5 text-sm font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Sending…" : `Pay & register`}
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={registerAsMember}
          disabled={submitting}
          className="rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
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
        href={signInHref(`/events/${slug}`)}
        className="rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
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
          className="rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
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
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
        register as guest{feeKes > 0 ? ` · KSh ${feeKes}` : ""}
      </div>
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
      {feeKes > 0 && phoneField}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        onClick={registerAsGuest}
        disabled={submitting || !guestName || !guestEmail || !phoneValid}
        className="rounded-md bg-accent py-2.5 text-sm font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Registering…" : feeKes > 0 ? "Pay & register" : "Confirm registration"}
      </button>
    </div>
  );
}
