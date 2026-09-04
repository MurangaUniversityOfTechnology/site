"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { eventApi, type EventSummary, type Registration } from "@/lib/api";
import { formatEventDay, formatEventMeta } from "@/lib/eventFormat";
import { useMe } from "@/lib/useMe";
import { signInHref } from "@/lib/nextParam";

// Prefixed so the door scanner can reject an unrelated QR code (wifi, a
// random URL) instead of trying to look it up as a registration id.
export const TICKET_QR_PREFIX = "mut-ticket:";

export default function EventPassPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { me, loading } = useMe();
  const [registration, setRegistration] = useState<Registration | null | undefined>(undefined);
  const [event, setEvent] = useState<EventSummary | null | undefined>(undefined);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !me) router.push(signInHref(`/events/${slug}/pass`));
  }, [loading, me, router, slug]);

  useEffect(() => {
    if (!me) return;
    eventApi.myRegistration(slug).then(setRegistration);
    eventApi
      .get(slug)
      .then(setEvent)
      .catch(() => setEvent(null));
  }, [me, slug]);

  useEffect(() => {
    if (!registration) return;
    QRCode.toDataURL(`${TICKET_QR_PREFIX}${registration.id}`, {
      width: 320,
      margin: 1,
      color: { dark: "#1a2744", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [registration]);

  if (loading || !me || registration === undefined || event === undefined || !event) return null;

  if (!registration || (registration.status !== "approved" && registration.status !== "attended")) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">No pass yet</h1>
          <p className="mt-3 text-muted">Your registration needs to be approved before your pass is ready.</p>
        </div>
      </main>
    );
  }

  const reference = registration.id.slice(0, 8).toUpperCase();
  const { dow, day, mon } = formatEventDay(event.starts_at);

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14">
      <div className="w-full max-w-90 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border p-6 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-navy">
            {registration.status === "attended" ? "✓ attended" : "event pass"}
          </div>
          <div className="mt-3 text-xl font-semibold">{me.email.split("@")[0]}</div>
        </div>

        <div className="p-6 text-center">
          <div className="mx-auto grid h-40 w-40 place-items-center overflow-hidden rounded-lg border border-border-strong bg-background">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a data: URL, next/image can't optimize it anyway
              <img src={qrDataUrl} alt={`Ticket QR code — reference ${reference}`} className="h-full w-full" />
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">generating…</span>
            )}
          </div>
          <div className="mt-3 font-mono text-[11px] tracking-[0.08em] text-faint">{reference}</div>
          <div className="mt-5 text-[17px] font-semibold">{event.title}</div>
          <div className="mt-2 font-mono text-[11px] text-faint">
            {dow} {day} {mon} · {formatEventMeta(event)}
          </div>
        </div>
      </div>
    </main>
  );
}
