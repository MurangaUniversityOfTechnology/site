import Link from "next/link";
import { notFound } from "next/navigation";
import { EventRegisterPanel } from "@/components/EventRegisterPanel";
import { events } from "@/lib/data";

export function generateStaticParams() {
  return events.map((e) => ({ slug: e.slug }));
}

export default async function EventDetailPage(props: PageProps<"/events/[slug]">) {
  const { slug } = await props.params;
  const event = events.find((e) => e.slug === slug);
  if (!event) notFound();

  const d = event.detail;

  return (
    <main>
      <div className="relative overflow-hidden bg-[repeating-linear-gradient(115deg,rgba(255,255,255,.028)_0_2px,transparent_2px_12px)] px-5 py-14 sm:px-10 sm:py-20">
        <div className="pointer-events-none absolute -right-24 -top-36 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(255,184,97,.08),transparent_66%)]" />
        <Link href="/events" className="relative font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground">
          ← events
        </Link>
        <div className="relative mt-6 inline-flex items-center gap-2 rounded border border-[#3a3226] px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-warn">
          <span className="h-1.5 w-1.5 animate-[pulse_1.6s_infinite] rounded-full bg-warn" />
          {event.capacity.includes("full") ? "waitlist open" : "registration open"} · {event.capacity}
        </div>
        <h1 className="relative mt-5.5 text-[clamp(40px,8vw,96px)] uppercase leading-[0.9] tracking-[-0.045em]">
          {event.title}
        </h1>
        {d && <p className="relative mt-5 max-w-[460px] text-[17px] leading-[1.55] text-[#9aa6a0]">{d.description}</p>}

        {d && (
          <div className="relative mt-9 flex max-w-[640px] flex-wrap gap-px overflow-hidden rounded-[10px] border border-border bg-border">
            <div className="min-w-32 flex-1 bg-surface px-5.5 py-4">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">date</div>
              <div className="mt-1.5 text-[17px] font-semibold">{d.date}</div>
            </div>
            <div className="min-w-32 flex-1 bg-surface px-5.5 py-4">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">time</div>
              <div className="mt-1.5 text-[17px] font-semibold">{d.time}</div>
            </div>
            <div className="min-w-38 flex-1 bg-surface px-5.5 py-4">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">venue</div>
              <div className="mt-1.5 text-[17px] font-semibold">{d.venue}</div>
            </div>
          </div>
        )}

        <div className="relative mt-7 flex flex-wrap items-center gap-3">
          <EventRegisterPanel slug={event.slug} audience={event.audience} cta={event.cta} />
          <span className="font-mono text-[11px] text-faint">{event.meta}</span>
        </div>
      </div>

      {d ? (
        <div className="grid gap-px border-t border-[#161c1e] bg-[#161c1e] md:grid-cols-2">
          <div className="bg-background p-6 sm:p-10">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">what you&apos;ll build</div>
            <p className="mt-4 text-[16.5px] leading-[1.65] text-[#c8d2cc] text-pretty">{d.whatYoullBuild}</p>

            <div className="mt-9 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">schedule</div>
            <div className="mt-4">
              {d.schedule.map((s) => (
                <div key={s.time} className="flex gap-5 border-b border-[#14191b] py-3">
                  <span className="min-w-14 font-mono text-xs text-accent">{s.time}</span>
                  <span className="text-[15.5px] text-[#c8d2cc]">{s.what}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface p-6 sm:p-10">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">speaker</div>
            <div className="mt-4 flex items-center gap-3.5">
              <div className="grid h-13 w-13 place-items-center rounded-full border border-[#2b3a33] bg-[linear-gradient(150deg,#1b2b22,#0f1614)] font-mono text-base text-accent">
                {d.speaker.name[0]}
              </div>
              <div>
                <div className="text-[16.5px] font-semibold">{d.speaker.name}</div>
                <div className="mt-1 font-mono text-[11px] text-faint">{d.speaker.meta}</div>
              </div>
            </div>

            <div className="mt-9 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">requirements</div>
            <div className="mt-4 flex flex-col gap-2.5 text-[15.5px] text-[#c8d2cc]">
              {d.requirements.map((r) => (
                <div key={r} className="flex gap-2.5">
                  <span className="font-mono text-accent">✓</span>
                  {r}
                </div>
              ))}
            </div>

            <div className="mt-9 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">who should attend</div>
            <p className="mt-3.5 text-[15.5px] leading-[1.6] text-[#9aa6a0]">{d.whoShouldAttend}</p>
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
