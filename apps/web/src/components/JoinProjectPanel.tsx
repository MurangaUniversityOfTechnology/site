"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiError, projectApi } from "@/lib/api";
import { useMe } from "@/lib/useMe";

const AREAS = ["Backend", "Frontend", "Design", "DevOps", "Documentation", "Testing"];

const STATUS_COPY: Record<string, { label: string; color: string }> = {
  pending: { label: "Request sent · pending review", color: "text-warn" },
  approved: { label: "You're a contributor ✓", color: "text-navy" },
  rejected: { label: "Request not approved", color: "text-danger" },
};

export function JoinProjectPanel({
  slug,
  isMember,
  requestStatus,
}: {
  slug: string;
  isMember: boolean;
  requestStatus: string | null;
}) {
  const { me, loading } = useMe();
  const [open, setOpen] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(requestStatus);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return null;

  if (isMember) {
    return <span className="font-mono text-[13px] font-semibold text-navy">Contributor ✓</span>;
  }

  if (status) {
    const copy = STATUS_COPY[status];
    return <span className={`font-mono text-[13px] font-semibold ${copy.color}`}>{copy.label}</span>;
  }

  if (!me) {
    return (
      <Link
        href="/sign-in"
        className="rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
      >
        Sign in to join
      </Link>
    );
  }

  if (!me.is_admin && me.membership_status !== "active") {
    return (
      <Link
        href="/membership/activate"
        className="rounded-lg border border-accent-dim px-6.5 py-3.5 text-[15px] font-semibold text-navy hover:bg-accent/5"
      >
        Activate membership to join
      </Link>
    );
  }

  function toggleArea(area: string) {
    setAreas((a) => (a.includes(area) ? a.filter((x) => x !== area) : [...a, area]));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const req = await projectApi.join(slug, { contribution_areas: areas, message: message || null });
      setStatus(req.status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the request — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#1a2744] hover:opacity-90"
      >
        Join Project
      </button>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-3.5 rounded-lg border border-border-strong bg-surface p-4.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">what would you like to contribute?</div>
      <div className="flex flex-wrap gap-2">
        {AREAS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => toggleArea(a)}
            className={`rounded-full border px-3 py-1.5 text-[13px] ${
              areas.includes(a) ? "border-accent-dim bg-accent/[0.08] text-navy" : "border-border-strong text-muted"
            }`}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">why are you interested?</div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="resize-y rounded-md border border-border-strong bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting}
        className="rounded-md bg-accent py-2.5 text-sm font-semibold text-[#1a2744] hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send Request"}
      </button>
    </div>
  );
}
