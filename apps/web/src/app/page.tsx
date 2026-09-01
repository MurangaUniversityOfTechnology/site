import Image from "next/image";
import Link from "next/link";
import { FeaturedProject } from "@/components/FeaturedProject";
import { eventApi } from "@/lib/api";
import { formatEventDay, formatEventMeta } from "@/lib/eventFormat";
import {
  challenges,
  communityMilestones,
  faqs,
  galleryPhotos,
  joinSteps,
  leadership,
  liveTicker,
  pastEvents,
  semesterSummary,
  stats,
  whyMutTech,
} from "@/lib/data";

export default async function Home() {
  const events = await eventApi.list().catch(() => []);
  const upcoming = events.slice(0, 3);
  const challengeOfWeek = challenges[0];

  return (
    <main>
      {/* Hero — full-bleed campus photo, blended into the navy band */}
      <section className="relative overflow-hidden bg-[linear-gradient(150deg,var(--navy-3)_0%,var(--navy)_50%,var(--navy-2)_100%)] px-5 py-16 text-white sm:px-10 sm:py-24 md:py-28">
        <div
          className="absolute inset-0"
          style={{
            maskImage: "radial-gradient(ellipse 75% 70% at 50% 38%, black 30%, transparent 90%)",
            WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 38%, black 30%, transparent 90%)",
          }}
        >
          <Image
            src="/images/students-campus.jpg"
            alt="MUT Tech Community members laughing together outside the university library"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-[linear-gradient(150deg,var(--navy-3)_0%,var(--navy)_50%,var(--navy-2)_100%)] opacity-70 mix-blend-multiply" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[length:64px_64px]" />
        <div className="pointer-events-none absolute -left-20 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(201,168,76,.12),transparent_68%)]" />
        <div className="relative mx-auto max-w-[720px] text-center">
          <div className="mb-6 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
            <span className="h-1.5 w-1.5 animate-[pulse_1.8s_ease-in-out_infinite] rounded-full bg-accent" />
            system online · murang&apos;a university of technology
          </div>
          <h1 className="m-0 text-[clamp(46px,8vw,108px)] leading-[0.9] font-bold tracking-[-0.045em] text-balance text-white">
            BUILD.
            <br />
            <span className="text-accent">LEARN.</span>
            <br />
            SHIP.
          </h1>
          <p className="mx-auto mt-7 max-w-[430px] text-[clamp(15px,2vw,18px)] leading-[1.55] text-white/65 text-pretty">
            A community of students at MUT building real things with technology — in public, together, every week.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-up"
              className="animate-[glow_3.4s_ease-in-out_infinite] rounded-lg bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-navy hover:opacity-90"
            >
              Join the Club
            </Link>
            <Link
              href="/projects"
              className="rounded-lg border border-white/25 px-6.5 py-3.5 text-[15px] font-medium text-white hover:border-accent"
            >
              Explore Projects
            </Link>
          </div>
        </div>
        <div className="relative mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-navy-2 bg-navy-2 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface px-4.5 py-5">
              <div className="font-mono text-[clamp(24px,3.4vw,34px)] font-bold tracking-[-0.02em] text-navy">{s.value}</div>
              <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Live ticker — stays in the navy zone, contiguous with the hero */}
      <div className="overflow-hidden border-y border-white/10 bg-navy-3 py-2.5">
        <div className="flex w-max animate-[marq_34s_linear_infinite] gap-11 font-mono text-[11.5px] tracking-wide text-white/45">
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

      {/* Trusted by — credibility beat right after the fold */}
      <div className="border-b border-border bg-surface px-5 py-7 text-center sm:px-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          speakers from, last semester
        </div>
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {semesterSummary.speakerOrgs.map((p) => (
            <span key={p} className="font-mono text-[15px] font-semibold uppercase tracking-[0.08em] text-navy/70">
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Cumulative, multi-year totals — distinct from (and above) the single-semester
          report block below, which stays scoped to what that report actually covers. */}
      <section className="border-b border-border bg-navy px-5 py-16 text-center sm:px-10 sm:py-20">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent">two years running</div>
        <h2 className="mt-2.5 text-[clamp(28px,4.4vw,44px)] leading-[1.05] tracking-[-0.03em] text-white">
          Not a one-semester thing.
        </h2>
        <div className="mx-auto mt-8 grid max-w-[720px] grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-white/10 bg-white/10 sm:grid-cols-4">
          {communityMilestones.map((m) => (
            <div key={m.label} className="bg-navy-2 px-4.5 py-6">
              <div className="font-mono text-[clamp(24px,3.4vw,34px)] font-bold tracking-[-0.02em] text-accent">
                {m.value}
              </div>
              <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Last semester, in numbers — see semesterSummary in lib/data.ts for what's
          covered by the official report vs. board-level activity alongside it */}
      <section className="px-5 py-16 sm:px-10 sm:py-20">
        <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">{semesterSummary.period}</div>
        <h2 className="m-0 text-[clamp(28px,4.4vw,44px)] leading-[1.05] tracking-[-0.03em] text-navy">
          Last semester, in numbers.
        </h2>
        <p className="mt-3 max-w-[560px] text-[15.5px] leading-[1.55] text-muted">
          Real industry access, real turnout — including events, guest speakers, and partnerships the board ran
          alongside our official activity report to the Dean of Students.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-4">
          {[
            { value: semesterSummary.eventsHeld, label: "events held" },
            { value: semesterSummary.totalAttendance, label: "total attendance" },
            { value: semesterSummary.guestSpeakers, label: "guest speakers" },
            { value: semesterSummary.partnerOrgCount, label: "partner orgs" },
          ].map((s) => (
            <div key={s.label} className="bg-surface px-4.5 py-5">
              <div className="font-mono text-[clamp(22px,3vw,30px)] font-bold tracking-[-0.02em] text-navy">
                {s.value}
              </div>
              <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {pastEvents.map((e) => (
            <div
              key={e.title}
              className="overflow-hidden rounded-[10px] border border-border bg-surface shadow-[0_4px_24px_rgba(26,39,68,0.08)]"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-[linear-gradient(150deg,var(--navy-3),var(--navy))]">
                {e.image ? (
                  <Image src={e.image} alt={e.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" />
                ) : (
                  <>
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[length:28px_28px]" />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(201,168,76,.18),transparent_60%)]" />
                    <div className="absolute inset-0 grid place-items-center font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                      photo coming soon
                    </div>
                  </>
                )}
              </div>
              <div className="p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="m-0 text-[20px] font-semibold text-navy">{e.title}</h3>
                  <span className="whitespace-nowrap font-mono text-[11px] text-faint">{e.date}</span>
                </div>
                <div className="mt-1.5 font-mono text-[11px] text-muted">
                  {e.category} · {e.venue} · {e.attendees} attendees
                </div>
                <p className="mt-4 text-[15px] leading-[1.5] text-foreground/85">{e.outcome}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {[...new Set(e.speakers.map((s) => s.org))].map((org) => (
                    <span
                      key={org}
                      className="rounded border border-border-strong px-2.5 py-1 font-mono text-[10.5px] text-muted"
                    >
                      {org}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <FeaturedProject />

      {/* Why MUT Tech Community */}
      <section className="border-y border-border bg-surface-raised px-5 py-16 sm:px-10 sm:py-20">
        <div className="mb-8 text-center">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">why mut tech community</div>
          <h2 className="mt-2 m-0 text-[clamp(28px,4.4vw,44px)] leading-[1.05] tracking-[-0.03em] text-navy">
            Not another WhatsApp group.
          </h2>
        </div>
        <div className="mx-auto grid max-w-[960px] gap-5 sm:grid-cols-2">
          {whyMutTech.map((w) => (
            <div key={w.title} className="rounded-[10px] border border-border bg-surface p-6">
              <h3 className="m-0 text-[17px] font-semibold text-navy">{w.title}</h3>
              <p className="mt-2 text-[14.5px] leading-[1.55] text-muted">{w.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Life at the club — photo gallery */}
      <section className="px-5 py-16 sm:px-10 sm:py-20">
        <div className="mb-8 text-center">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">life at the club</div>
          <h2 className="mt-2 m-0 text-[clamp(28px,4.4vw,44px)] leading-[1.05] tracking-[-0.03em] text-navy">
            More than a WhatsApp group.
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {galleryPhotos.map((g) => (
            <div key={g.caption} className="overflow-hidden rounded-[10px] border border-border bg-surface">
              <div className="relative aspect-square w-full overflow-hidden bg-[linear-gradient(150deg,var(--navy-3),var(--navy))]">
                <Image src={g.image} alt={g.caption} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-contain" />
              </div>
              <div className="bg-navy px-3 py-2 text-center font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/90">
                {g.caption}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Upcoming events + challenge of the week */}
      <section className="grid gap-8 px-5 pb-16 sm:px-10 sm:pb-20 md:grid-cols-2">
        <div>
          <div className="mb-5 flex items-baseline gap-3.5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">upcoming events</div>
            <span className="font-mono text-[11px] text-faint">{String(upcoming.length).padStart(2, "0")}</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {upcoming.length === 0 && (
              <div className="rounded-[10px] border border-border bg-surface p-5 text-center text-sm text-muted">
                No events scheduled right now — check back soon.
              </div>
            )}
            {upcoming.map((e) => {
              const { dow, day, mon } = formatEventDay(e.starts_at);
              return (
                <Link
                  key={e.slug}
                  href={`/events/${e.slug}`}
                  className="flex items-center gap-4.5 rounded-[10px] border border-border bg-surface p-4 shadow-[0_4px_24px_rgba(26,39,68,0.08)] hover:border-accent-dim"
                >
                  <div className="min-w-11 text-center font-mono">
                    <div className="text-[9.5px] tracking-[0.14em] text-faint">{dow}</div>
                    <div className="text-[22px] font-bold leading-[1.1] text-navy">{day}</div>
                    <div className="text-[9.5px] tracking-[0.14em] text-faint">{mon}</div>
                  </div>
                  <div className="w-px self-stretch bg-border" />
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold tracking-[-0.01em]">{e.title}</div>
                    <div className="mt-1.5 font-mono text-[11px] text-muted">{formatEventMeta(e)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">this week&apos;s build</div>
          <div className="relative overflow-hidden rounded-[10px] border border-border bg-surface p-6 shadow-[0_4px_24px_rgba(26,39,68,0.08)]">
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(201,168,76,.06)_0_1px,transparent_1px_22px)]" />
            <h3 className="relative m-0 text-[26px] leading-[1.1] tracking-[-0.02em] text-navy">{challengeOfWeek.title}</h3>
            <div className="relative mt-5 flex gap-6 font-mono text-[11px]">
              <div>
                <div className="text-[9.5px] uppercase tracking-[0.1em] text-faint">difficulty</div>
                <div className="mt-1.5 flex gap-0.5">
                  {[1, 1, 1, 0].map((on, i) => (
                    <span key={i} className={`h-1 w-3.5 rounded-sm ${on ? "bg-accent" : "bg-border"}`} />
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
              className="relative mt-6 block w-full rounded-lg border border-accent-dim py-3 text-center text-[14.5px] font-semibold text-navy hover:bg-navy/5"
            >
              Take Challenge
            </Link>
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="px-5 pb-8 sm:px-10">
        <div className="mb-5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">led by</div>
        <div className="flex flex-wrap gap-4">
          {leadership.map((p) => (
            <div
              key={p.name}
              className="flex min-w-60 flex-1 items-center gap-4 rounded-[10px] border border-border bg-surface p-5"
            >
              {p.image ? (
                <div className="relative h-13 w-13 flex-none overflow-hidden rounded-full border border-accent-dim">
                  <Image src={p.image} alt={p.name} fill sizes="52px" className="object-cover" />
                </div>
              ) : (
                <div className="grid h-13 w-13 flex-none place-items-center rounded-full border border-accent-dim bg-[linear-gradient(150deg,var(--navy-3),var(--navy))] font-mono text-base text-accent">
                  {p.name
                    .split(" ")
                    .filter((n) => !n.endsWith("."))
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-navy">{p.name}</div>
                <div className="mt-0.5 font-mono text-[11px] text-muted">
                  {p.role} · {p.meta}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Member spotlight */}
      <section className="px-5 pb-16 sm:px-10 sm:pb-20">
        <div className="mb-5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">member spotlight</div>
        <div className="flex flex-wrap items-center gap-7 rounded-xl border border-border bg-surface p-6 shadow-[0_4px_24px_rgba(26,39,68,0.08)] sm:p-9">
          <div className="grid h-19 w-19 place-items-center rounded-full border border-accent-dim bg-[linear-gradient(150deg,var(--navy-3),var(--navy))] font-mono text-[22px] text-accent">
            A
          </div>
          <div className="min-w-60 flex-1">
            <div className="text-xl font-semibold text-navy">Amina Wanjiku</div>
            <div className="mt-1 font-mono text-[11px] text-faint">Backend · Python · Rust · 3rd year CS</div>
            <p className="mt-4 max-w-[520px] text-[17px] leading-[1.5] text-foreground/85 text-pretty">
              &ldquo;I joined to learn backend development. Six months later I&apos;m maintaining our API.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-surface-raised px-5 py-16 sm:px-10 sm:py-20">
        <div className="mb-8 text-center">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">how it works</div>
          <h2 className="mt-2 m-0 text-[clamp(28px,4.4vw,44px)] leading-[1.05] tracking-[-0.03em] text-navy">
            Three steps. No gatekeeping.
          </h2>
        </div>
        <div className="mx-auto grid max-w-[960px] gap-5 sm:grid-cols-3">
          {joinSteps.map((s) => (
            <div key={s.step} className="rounded-[10px] border border-border bg-surface p-6">
              <div className="font-mono text-[13px] font-bold text-accent">{s.step}</div>
              <h3 className="mt-3 m-0 text-[17px] font-semibold text-navy">{s.title}</h3>
              <p className="mt-2 text-[14.5px] leading-[1.55] text-muted">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 py-16 sm:px-10 sm:py-20">
        <div className="mb-8 text-center">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">questions</div>
          <h2 className="mt-2 m-0 text-[clamp(28px,4.4vw,44px)] leading-[1.05] tracking-[-0.03em] text-navy">
            Before you join.
          </h2>
        </div>
        <div className="mx-auto flex max-w-[720px] flex-col gap-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-[10px] border border-border bg-surface p-5">
              <summary className="m-0 flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-navy">
                {f.q}
                <span className="font-mono text-accent-dim transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[14.5px] leading-[1.55] text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA — bookend navy band, closing the page the way it opened */}
      <section className="relative overflow-hidden bg-[linear-gradient(150deg,var(--navy)_0%,var(--navy-3)_100%)] px-5 py-20 text-center text-white sm:py-28">
        <div className="pointer-events-none absolute -bottom-52 left-1/2 h-[400px] w-[700px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(201,168,76,.14),transparent_65%)]" />
        <h2 className="relative m-0 text-[clamp(34px,7vw,80px)] leading-[0.95] tracking-[-0.04em] text-white">
          DON&apos;T JUST WATCH.
          <br />
          <span className="text-accent">BUILD WITH US.</span>
        </h2>
        <Link
          href="/sign-up"
          className="relative mt-8 inline-block rounded-lg bg-accent px-8 py-4 text-base font-semibold text-navy hover:opacity-90"
        >
          Join the Club
        </Link>
        <div className="relative mt-14 font-mono text-[10.5px] uppercase leading-loose tracking-[0.14em] text-white/45">
          don&apos;t just join a club · build something · with people
        </div>
      </section>
    </main>
  );
}
