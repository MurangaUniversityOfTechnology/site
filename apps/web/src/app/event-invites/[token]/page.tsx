"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ApiError, eventInviteApi, type InvitePreview } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { signInHref, signUpHref } from "@/lib/nextParam";
import { useSignOut } from "@/lib/useSignOut";

export default function EventInviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const signOut = useSignOut();

  const [preview, setPreview] = useState<InvitePreview | null | "not-found">(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    eventInviteApi
      .preview(token)
      .then(setPreview)
      .catch(() => setPreview("not-found"));
  }, [token]);

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      const { event_slug } = await eventInviteApi.accept(token);
      router.push(`/events/${event_slug}/manage`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't accept this invite — try again.");
    } finally {
      setAccepting(false);
    }
  }

  if (preview === null || meLoading) return null;

  if (preview === "not-found" || preview.status !== "invited") {
    return (
      <main className="mx-auto max-w-140 px-5 py-16 text-center sm:px-10">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">invite</div>
        <h1 className="mt-3.5 text-[clamp(22px,3.2vw,32px)] tracking-[-0.03em]">This invite link isn&apos;t valid</h1>
        <p className="mt-3 text-[14.5px] text-muted">
          It may have already been used, revoked, or mistyped. Ask whoever sent it to send a fresh one.
        </p>
      </main>
    );
  }

  const wrongAccount = me && me.email.toLowerCase() !== preview.invited_email.toLowerCase();

  return (
    <main className="mx-auto max-w-140 px-5 py-16 text-center sm:px-10">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">event manager invite</div>
      <h1 className="mt-3.5 text-[clamp(22px,3.2vw,32px)] tracking-[-0.03em]">Manage {preview.event_title}</h1>
      <p className="mt-3 text-[14.5px] text-muted">
        <strong>{preview.invited_by}</strong> invited <strong>{preview.invited_email}</strong> to help run this event —
        approving registrations, adding walk-ins, and scanning tickets at the door.
      </p>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {!me ? (
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href={signInHref(pathname)} className="rounded-md bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#1a2744]">
            Sign in as {preview.invited_email}
          </Link>
          <Link href={signUpHref(pathname)} className="rounded-md border border-border-strong px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
            Create an account
          </Link>
        </div>
      ) : wrongAccount ? (
        <div className="mt-7">
          <p className="text-sm text-danger">
            You&apos;re signed in as {me.email}, but this invite was sent to {preview.invited_email}.
          </p>
          <button onClick={signOut} className="mt-4 rounded-md border border-border-strong px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
            Sign out and try again
          </button>
        </div>
      ) : (
        <button
          onClick={accept}
          disabled={accepting}
          className="mt-7 rounded-md bg-accent px-6 py-3 font-mono text-[12px] uppercase tracking-[0.1em] text-[#1a2744] disabled:opacity-50"
        >
          {accepting ? "Accepting…" : "Accept invite"}
        </button>
      )}
    </main>
  );
}
