"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiError, courseApi, type CourseEnrollment } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { signInHref } from "@/lib/nextParam";

const POLL_INTERVAL_MS = 3000;

export function CourseEnrollPanel({
  slug,
  priceKes,
  onEnrolled,
}: {
  slug: string;
  priceKes: number;
  onEnrolled?: () => void;
}) {
  const { me, loading } = useMe();
  const [enrollment, setEnrollment] = useState<CourseEnrollment | null | undefined>(undefined);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loading) return;
    let active = true;
    (me ? courseApi.myEnrollment(slug) : Promise.resolve(null)).then((result) => {
      if (active) setEnrollment(result);
    });
    return () => {
      active = false;
    };
  }, [slug, me, loading]);

  const paymentPending = enrollment?.payment?.status === "pending" || enrollment?.payment?.status === "initiated";

  const pollPayment = useCallback(() => {
    courseApi
      .myEnrollment(slug)
      .then((updated) => setEnrollment(updated))
      .catch(() => {
        // transient network error — next poll tick will retry
      });
  }, [slug]);

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

  if (loading || enrollment === undefined) return null;

  if (enrollment) {
    if (paymentPending) {
      return (
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="font-mono text-[13px] text-[#8f8368]">
            Check your phone to approve KSh {enrollment.payment?.amount}…
          </span>
        </div>
      );
    }

    const paymentFailed = enrollment.payment && enrollment.payment.status !== "completed" && !paymentPending;
    if (paymentFailed) {
      return (
        <span className="font-mono text-[13px] font-semibold text-danger">
          Payment didn&apos;t go through — contact an admin to retry.
        </span>
      );
    }

    return <span className="font-mono text-[13px] font-semibold text-navy">You&apos;re enrolled ✓</span>;
  }

  if (!me) {
    return (
      <Link href={signInHref(`/courses/${slug}`)} className="rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90">
        Sign in to enroll
      </Link>
    );
  }

  const digits = phone.replace(/\D/g, "");
  const isActiveMember = me.membership_status === "active" || me.is_admin;
  const requiresPayment = priceKes > 0 && !isActiveMember;
  const phoneValid = !requiresPayment || digits.length === 9;

  async function enroll() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await courseApi.enroll(slug, requiresPayment ? `254${digits}` : undefined);
      setEnrollment(result);
      onEnrolled?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't enroll — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (requiresPayment) {
    return (
      <div className="flex max-w-sm flex-col gap-3 rounded-lg border border-border-strong bg-surface p-4.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">pay KSh {priceKes} to enroll</div>
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
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          onClick={enroll}
          disabled={submitting || !phoneValid}
          className="rounded-md bg-accent py-2.5 text-sm font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Pay & enroll"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={enroll}
        disabled={submitting}
        className="rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Enrolling…" : "Enroll for free"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
