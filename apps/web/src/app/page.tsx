import Link from "next/link";
import { FeaturedProject } from "@/components/FeaturedProject";
import { challenges, events, liveTicker, stats } from "@/lib/data";

export default function Home() {
  const upcoming = events.slice(0, 3);
  const challengeOfWeek = challenges[0];

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[linear-gradient(rgba(255,255,255,.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.022)_1px,transparent_1px)] bg-[length:64px_64px] px-5 py-16 sm:px-10 sm:py-24 md:py-28">
        <div className="pointer-events-none absolute -left-20 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(61,250,138,.09),transparent_68%)]" />
        <div className="relative mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
          <span className="h-1.5 w-1.5 animate-[pulse_1.8s_ease-in-out_infinite] rounded-full bg-accent" />
          system online · murang&apos;a university of technology
        </div>
        <h1 className="relative m-0 text-[clamp(46px,10vw,124px)] leading-[0.9] font-bold tracking-[-0.045em] text-balance">
          BUILD.
          <br />
          <span className="text-accent">LEARN.</span>
          <br />
          SHIP.
        </h1>
        <p className="relative mt-7 max-w-[430px] text-[clamp(15px,2vw,18px)] leading-[1.55] text-[#9aa6a0] text-pretty">
          A community of students at MUT building real things with technology — in public, together, every week.
        </p>
        <div className="relative mt-8 flex flex-wrap gap-3">
          <Link
            href="/sign-up"
            className="animate-[glow_3.4s_ease-in-out_infinite] rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-[#04140b] hover:opacity-90"
          >
            Join the Club
          </Link>
          <Link
            href="/projects"
            className="rounded-lg border border-border-strong px-6.5 py-3.5 text-[15px] font-medium hover:border-accent-dim"
          >
            Explore Projects
          </Link>
        </div>
        <div className="relative mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-[#171e20] bg-[#171e20] sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface px-4.5 py-5">
              <div className="font-mono text-[clamp(24px,3.4vw,34px)] font-bold tracking-[-0.02em]">{s.value}</div>
              <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Live ticker */}
      <div className="overflow-hidden border-y border-[#161c1e] bg-[#090c0d] py-2.5">
        <div className="flex w-max animate-[marq_34s_linear_infinite] gap-11 font-mono text-[11.5px] tracking-wide text-[#7f8d87]">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex gap-11" aria-hidden={rep === 1}>
              {liveTicker.map((t, i) => (
                <span key={i}>
                  <span className={t.color === "amber" ? "text-warn" : "text-accent"}>●</span> {t.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <FeaturedProject />

      {/* Upcoming events + challenge of the week */}
      <section className="grid gap-8 px-5 pb-16 sm:px-10 sm:pb-20 md:grid-cols-2">
        <div>
          <div className="mb-5 flex items-baseline gap-3.5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">upcoming events</div>
            <span className="font-mono text-[11px] text-faint">{String(upcoming.length).padStart(2, "0")}</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {upcoming.map((e) => (
              <Link
                key={e.slug}
                href={`/events/${e.slug}`}
                className="flex items-center gap-4.5 rounded-[10px] border border-border bg-surface p-4 hover:border-accent-dim"
              >
                <div className="min-w-11 text-center font-mono">
                  <div className="text-[9.5px] tracking-[0.14em] text-faint">{e.dow}</div>
                  <div className="text-[22px] font-bold leading-[1.1]">{e.day}</div>
                  <div className="text-[9.5px] tracking-[0.14em] text-faint">{e.mon}</div>
                </div>
                <div className="w-px self-stretch bg-border" />
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold tracking-[-0.01em]">{e.title}</div>
                  <div className="mt-1.5 font-mono text-[11px] text-[#7f8d87]">{e.meta}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">this week&apos;s build</div>
          <div className="relative overflow-hidden rounded-[10px] border border-border bg-surface p-6">
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(61,250,138,.04)_0_1px,transparent_1px_22px)]" />
            <h3 className="relative m-0 text-[26px] leading-[1.1] tracking-[-0.02em]">{challengeOfWeek.title}</h3>
            <div className="relative mt-5 flex gap-6 font-mono text-[11px]">
              <div>
                <div className="text-[9.5px] uppercase tracking-[0.1em] text-faint">difficulty</div>
                <div className="mt-1.5 flex gap-0.5">
                  {[1, 1, 1, 0].map((on, i) => (
                    <span key={i} className={`h-1 w-3.5 rounded-sm ${on ? "bg-accent" : "bg-[#1f2729]"}`} />
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[9.5px] uppercase tracking-[0.1em] text-faint">est. time</div>
                <div className="mt-1.5">{challengeOfWeek.detail?.estTime}</div>
              </div>
              <div>
                <div className="text-[9.5px] uppercase tracking-[0.1em] text-faint">building</div>
                <div className="mt-1.5">{challengeOfWeek.detail?.building}</div>
              </div>
            </div>
            <Link
              href={`/challenges/${challengeOfWeek.slug}`}
              className="relative mt-6 block w-full rounded-lg border border-accent-dim py-3 text-center text-[14.5px] font-semibold text-accent hover:bg-accent/5"
            >
              Take Challenge
            </Link>
          </div>
        </div>
      </section>

      {/* Member spotlight */}
      <section className="px-5 pb-16 sm:px-10 sm:pb-20">
        <div className="mb-5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">member spotlight</div>
        <div className="flex flex-wrap items-center gap-7 rounded-xl border border-border bg-surface p-6 sm:p-9">
          <div className="grid h-19 w-19 place-items-center rounded-full border border-[#2b3a33] bg-[linear-gradient(150deg,#1b2b22,#0f1614)] font-mono text-[22px] text-accent">
            A
          </div>
          <div className="min-w-60 flex-1">
            <div className="text-xl font-semibold">Amina Wanjiku</div>
            <div className="mt-1 font-mono text-[11px] text-faint">Backend · Python · Rust · 3rd year CS</div>
            <p className="mt-4 max-w-[520px] text-[17px] leading-[1.5] text-[#c8d2cc] text-pretty">
              &ldquo;I joined to learn backend development. Six months later I&apos;m maintaining our API.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-[#161c1e] px-5 py-20 text-center sm:py-28">
        <div className="pointer-events-none absolute -bottom-52 left-1/2 h-[400px] w-[700px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(61,250,138,.08),transparent_65%)]" />
        <h2 className="relative m-0 text-[clamp(34px,7vw,80px)] leading-[0.95] tracking-[-0.04em]">
          DON&apos;T JUST WATCH.
          <br />
          <span className="text-accent">BUILD WITH US.</span>
        </h2>
        <Link
          href="/sign-up"
          className="relative mt-8 inline-block rounded-lg bg-accent px-8 py-4 text-base font-semibold text-[#04140b] hover:opacity-90"
        >
          Join the Club
        </Link>
        <div className="relative mt-14 font-mono text-[10.5px] uppercase leading-loose tracking-[0.14em] text-[#7f8d87]">
          don&apos;t just join a club · build something · with people
        </div>
      </section>
    </main>
  );
}
