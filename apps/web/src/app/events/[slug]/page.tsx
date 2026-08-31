"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EventRegisterPanel } from "@/components/EventRegisterPanel";
import { eventApi, type EventDetail } from "@/lib/api";
import {
  audienceLabel,
  capacityLabel,
  formatEventDateLong,
  formatEventMeta,
  formatEventTime,
  registerCta,
} from "@/lib/eventFormat";

export default function EventDetailPage() {
  const params = useParams<{ slug: string }>();
  const [event, setEvent] = useState<EventDetail | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    eventApi
      .get(params.slug)
      .then((result) => {
        if (active) setEvent(result);
      })
      .catch(() => {
        if (active) setEvent(null);
      });
    return () => {
      active = false;
    };
  }, [params.slug]);

  if (event === undefined) return null;

  if (!event) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">Event not found</h1>
          <Link href="/events" className="mt-3 inline-block text-navy hover:underline">
            Back to events
          </Link>
        </div>
      </main>
    );
  }

  const hasFullDetail =
    event.what_youll_build || event.schedule.length > 0 || event.speaker_name || event.requirements.length > 0;

  return (
    <main>
      <div className="relative overflow-hidden bg-[repeating-linear-gradient(115deg,rgba(26,39,68,.028)_0_2px,transparent_2px_12px)] px-5 py-14 sm:px-10 sm:py-20">
        <div className="pointer-events-none absolute -right-24 -top-36 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(255,184,97,.08),transparent_66%)]" />
        <Link href="/events" className="relative font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground">
          ← events
        </Link>
        <div className="relative mt-6 inline-flex items-center gap-2 rounded border border-[#f0dfb8] px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-warn">
          <span className="h-1.5 w-1.5 animate-[pulse_1.6s_infinite] rounded-full bg-warn" />
          {registerCta(event.capacity, event.seats_left) === "Join waitlist" ? "waitlist open" : "registration open"} ·{" "}
          {capacityLabel(event.capacity, event.seats_left)}
        </div>
        <h1 className="relative mt-5.5 text-[clamp(40px,8vw,96px)] uppercase leading-[0.9] tracking-[-0.045em]">
          {event.title}
        </h1>
        <p className="relative mt-5 max-w-[460px] text-[17px] leading-[1.55] text-[#7a7060]">{event.description}</p>

        <div className="relative mt-9 flex max-w-[640px] flex-wrap gap-px overflow-hidden rounded-[10px] border border-border bg-border">
          <div className="min-w-32 flex-1 bg-surface px-5.5 py-4">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">date</div>
            <div className="mt-1.5 text-[17px] font-semibold">{formatEventDateLong(event.starts_at)}</div>
          </div>
          <div className="min-w-32 flex-1 bg-surface px-5.5 py-4">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">time</div>
            <div className="mt-1.5 text-[17px] font-semibold">{formatEventTime(event.starts_at)}</div>
          </div>
          <div className="min-w-38 flex-1 bg-surface px-5.5 py-4">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">venue</div>
            <div className="mt-1.5 text-[17px] font-semibold">{event.venue}</div>
          </div>
        </div>

        <div className="relative mt-7 flex flex-wrap items-center gap-3">
          <EventRegisterPanel
            slug={event.slug}
            audience={audienceLabel(event.audience)}
            cta={registerCta(event.capacity, event.seats_left)}
          />
          <span className="font-mono text-[11px] text-faint">{formatEventMeta(event)}</span>
        </div>
      </div>

      {hasFullDetail ? (
        <div className="grid gap-px border-t border-[#ddd6c4] bg-[#ddd6c4] md:grid-cols-2">
          <div className="bg-background p-6 sm:p-10">
            {event.what_youll_build && (
              <>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">what you&apos;ll build</div>
                <p className="mt-4 text-[16.5px] leading-[1.65] text-[#33302b] text-pretty">{event.what_youll_build}</p>
              </>
            )}

            {event.schedule.length > 0 && (
              <>
                <div className="mt-9 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">schedule</div>
                <div className="mt-4">
                  {event.schedule.map((s) => (
                    <div key={s.time} className="flex gap-5 border-b border-[#e8e1d2] py-3">
                      <span className="min-w-14 font-mono text-xs text-navy">{s.time}</span>
                      <span className="text-[15.5px] text-[#33302b]">{s.what}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="bg-surface p-6 sm:p-10">
            {event.speaker_name && (
              <>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">speaker</div>
                <div className="mt-4 flex items-center gap-3.5">
                  <div className="grid h-13 w-13 place-items-center rounded-full border border-[#e8d9ad] bg-[linear-gradient(150deg,#fbf3df,#f5e6bf)] font-mono text-base text-navy">
                    {event.speaker_name[0]}
                  </div>
                  <div>
                    <div className="text-[16.5px] font-semibold">{event.speaker_name}</div>
                    {event.speaker_meta && <div className="mt-1 font-mono text-[11px] text-faint">{event.speaker_meta}</div>}
                  </div>
                </div>
              </>
            )}

            {event.requirements.length > 0 && (
              <>
                <div className="mt-9 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">requirements</div>
                <div className="mt-4 flex flex-col gap-2.5 text-[15.5px] text-[#33302b]">
                  {event.requirements.map((r) => (
                    <div key={r} className="flex gap-2.5">
                      <span className="font-mono text-navy">✓</span>
                      {r}
                    </div>
                  ))}
                </div>
              </>
            )}

            {event.who_should_attend && (
              <>
                <div className="mt-9 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">who should attend</div>
                <p className="mt-3.5 text-[15.5px] leading-[1.6] text-[#7a7060]">{event.who_should_attend}</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="px-5 py-12 sm:px-10">
          <p className="max-w-lg text-[15.5px] leading-[1.6] text-muted">
            Full event details are still being written up — check back closer to the date, or register to be notified.
          </p>
        </div>
      )}
    </main>
  );
}
