import Link from "next/link";
import { challenges } from "@/lib/data";

export default function ChallengesPage() {
  const [current, ...past] = challenges;

  return (
    <main className="px-5 py-12 sm:px-10 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">one new build every monday</div>
      <h1 className="mt-3.5 text-[clamp(30px,5vw,54px)] leading-none tracking-[-0.04em]">CHALLENGES</h1>

      {!current && (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">nothing to show yet</div>
          <p className="mt-3 text-[15.5px] text-muted">Your first challenge is coming.</p>
          <Link
            href="/learn"
            className="mt-5 inline-block rounded-lg border border-accent-dim px-5 py-2.5 text-sm text-navy hover:bg-accent/5"
          >
            Explore Learning Paths
          </Link>
        </div>
      )}

      {current && (
        <Link
          href={`/challenges/${current.slug}`}
          className="relative mt-7 block overflow-hidden rounded-2xl border border-accent-dim bg-[linear-gradient(150deg,rgba(201,168,76,.06),transparent_58%)] p-6 hover:brightness-110 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(201,168,76,.04)_0_1px,transparent_1px_24px)]" />
          <div className="relative flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-navy">
            <span className="h-1.5 w-1.5 animate-[pulse_1.8s_infinite] rounded-full bg-accent" />
            {current.meta}
          </div>
          <h2 className="relative mt-4 text-[clamp(26px,4vw,40px)] leading-[1.05] tracking-[-0.03em]">{current.title}</h2>
          {current.detail && (
            <div className="relative mt-5 flex flex-wrap gap-6 font-mono text-[11.5px] text-muted">
              <span>{current.detail.difficulty}</span>
              <span>{current.detail.estTime}</span>
              <span className="text-foreground">{current.detail.building} building</span>
              <span className="text-warn">{current.detail.deadline}</span>
            </div>
          )}
        </Link>
      )}

      {past.length > 0 && (
        <>
          <div className="mt-9 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">past challenges</div>
          <div className="mt-3.5 overflow-hidden rounded-xl border border-border bg-surface">
            {past.map((c) => (
              <div key={c.slug} className="flex flex-wrap items-center gap-4 border-b border-[#e8e1d2] px-5 py-4.5 last:border-0">
                <span className="min-w-8.5 flex-none font-mono text-[11px] text-faint">#{c.num}</span>
                <div className="min-w-42 flex-1">
                  <div className="text-base font-medium">{c.title}</div>
                  <div className="mt-1 font-mono text-[10.5px] text-faint">{c.meta}</div>
                </div>
                <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.08em] text-navy">{c.state}</span>
                <span className="whitespace-nowrap font-mono text-[10.5px] text-muted">{c.subs}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
