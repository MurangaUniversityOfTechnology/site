import Link from "next/link";
import { events, pastEvents } from "@/lib/data";

export default function EventsPage() {
  return (
    <main className="px-5 py-12 sm:px-10 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
        {events.length} upcoming · engineering block
      </div>
      <h1 className="mt-3.5 text-[clamp(30px,5vw,54px)] leading-none tracking-[-0.04em]">WHAT&apos;S ON</h1>

      <div className="mt-8 flex flex-col gap-3">
        {events.map((e) => (
          <Link
            key={e.slug}
            href={`/events/${e.slug}`}
            className="flex flex-wrap items-center gap-5 rounded-xl border border-border bg-surface p-5 hover:border-accent-dim"
          >
            <div className="min-w-13 flex-none text-center font-mono">
              <div className="text-[9.5px] tracking-[0.14em] text-faint">{e.dow}</div>
              <div className="text-[26px] font-bold leading-[1.1]">{e.day}</div>
              <div className="text-[9.5px] tracking-[0.14em] text-faint">{e.mon}</div>
            </div>
            <div className="w-px flex-none self-stretch bg-border" />
            <div className="min-w-45 flex-1">
              <div className="text-lg font-semibold leading-[1.3] tracking-[-0.01em]">{e.title}</div>
              <div className="mt-1.5 font-mono text-[11px] text-muted">{e.meta}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${
                    e.audience === "open to all" ? "border-accent-dim text-accent" : "border-[#3a3226] text-warn"
                  }`}
                >
                  {e.audience}
                </span>
                <span className="rounded border border-border-strong px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                  {e.fee}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2.5">
              <span className="whitespace-nowrap font-mono text-[10.5px] text-muted">{e.capacity}</span>
              <span className="whitespace-nowrap rounded-lg border border-accent-dim px-4.5 py-2.5 text-sm text-accent">
                {e.cta}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 max-w-[620px] rounded-xl border border-border bg-surface p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">past events</div>
        <div className="mt-3.5 flex flex-col gap-2.5 font-mono text-[11.5px] text-muted">
          {pastEvents.map((e) => (
            <div key={e.title} className="flex justify-between gap-3">
              <span>{e.title}</span>
              <span className="text-faint">{e.meta}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
