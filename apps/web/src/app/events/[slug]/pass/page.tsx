"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { eventApi, type Registration } from "@/lib/api";
import { events } from "@/lib/data";
import { useMe } from "@/lib/useMe";

export default function EventPassPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { me, loading } = useMe();
  const [registration, setRegistration] = useState<Registration | null | undefined>(undefined);

  const event = events.find((e) => e.slug === slug);

  useEffect(() => {
    if (!loading && !me) router.push("/sign-in");
  }, [loading, me, router]);

  useEffect(() => {
    if (!me) return;
    eventApi.myRegistration(slug).then(setRegistration);
  }, [me, slug]);

  if (loading || !me || registration === undefined || !event) return null;

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

  return (
    <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 py-14">
      <div className="w-full max-w-90 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border p-6 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
            {registration.status === "attended" ? "✓ attended" : "event pass"}
          </div>
          <div className="mt-3 text-xl font-semibold">{me.email.split("@")[0]}</div>
        </div>

        <div className="p-6 text-center">
          <div className="mx-auto grid h-40 w-40 place-items-center rounded-lg border border-dashed border-border-strong bg-background">
            <span className="px-3 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
              qr code
              <br />
              <span className="text-foreground">{reference}</span>
            </span>
          </div>
          <div className="mt-5 text-[17px] font-semibold">{event.title}</div>
          <div className="mt-2 font-mono text-[11px] text-faint">
            {event.dow} {event.day} {event.mon} · {event.meta}
          </div>
        </div>
      </div>
    </main>
  );
}
