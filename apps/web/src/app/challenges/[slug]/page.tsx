import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecentSubmissions } from "@/components/RecentSubmissions";
import { challenges } from "@/lib/data";
import { ogImageUrl } from "@/lib/og";

export function generateStaticParams() {
  return challenges.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: PageProps<"/challenges/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const challenge = challenges.find((c) => c.slug === slug);
  if (!challenge) return {};

  const description = challenge.detail?.description;
  const eyebrow = challenge.detail ? `Challenge · ${challenge.detail.difficulty}` : "Challenge";
  const image = ogImageUrl({ eyebrow, title: challenge.title });

  return {
    title: challenge.title,
    description,
    openGraph: { title: challenge.title, description, images: [image] },
    twitter: { title: challenge.title, description, images: [image] },
  };
}

export default async function ChallengeDetailPage(props: PageProps<"/challenges/[slug]">) {
  const { slug } = await props.params;
  const challenge = challenges.find((c) => c.slug === slug);
  if (!challenge) notFound();

  const d = challenge.detail;

  return (
    <main>
      <div className="relative overflow-hidden border-b border-[#ddd6c4] bg-[linear-gradient(rgba(26,39,68,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(26,39,68,.02)_1px,transparent_1px)] bg-[length:56px_56px] px-5 py-12 sm:px-10 sm:py-18">
        <div className="pointer-events-none absolute -right-16 -top-30 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(201,168,76,.08),transparent_65%)]" />
        <div className="relative font-mono text-[10.5px] uppercase tracking-[0.18em] text-navy">{challenge.meta}</div>
        <h1 className="relative mt-5.5 text-[clamp(36px,7vw,78px)] uppercase leading-[0.92] tracking-[-0.045em]">
          {challenge.title}
        </h1>

        {d && (
          <>
            <p className="relative mt-5 max-w-[470px] text-[17px] leading-[1.55] text-[#7a7060]">{d.description}</p>
            <div className="relative mt-8 flex max-w-[680px] flex-wrap gap-px overflow-hidden rounded-[10px] border border-border bg-border">
              <div className="min-w-30 flex-1 bg-surface px-5 py-4">
                <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">difficulty</div>
                <div className="mt-1.5 font-mono text-[11px] text-muted">{d.difficulty}</div>
              </div>
              <div className="min-w-30 flex-1 bg-surface px-5 py-4">
                <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">est. time</div>
                <div className="mt-1.5 font-mono text-[19px]">{d.estTime}</div>
              </div>
              <div className="min-w-30 flex-1 bg-surface px-5 py-4">
                <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">building</div>
                <div className="mt-1.5 font-mono text-[19px]">{d.building}</div>
              </div>
              <div className="min-w-30 flex-1 bg-surface px-5 py-4">
                <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">deadline</div>
                <div className="mt-1.5 font-mono text-[19px] text-warn">{d.deadline}</div>
              </div>
            </div>
          </>
        )}

        <div className="relative mt-7 flex flex-wrap gap-3">
          <Link
            href={`/challenges/${challenge.slug}/submit`}
            className="rounded-lg bg-accent px-7 py-3.5 text-[15.5px] font-semibold text-[#1a2744] hover:opacity-90"
          >
            Start Challenge
          </Link>
        </div>
      </div>

      {d ? (
        <div className="grid gap-px bg-[#ddd6c4] md:grid-cols-2">
          <div className="bg-background p-6 sm:p-10">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">requirements</div>
            <div className="mt-4.5 flex flex-col gap-3 text-base text-[#33302b]">
              {d.requirements.map((r, i) => (
                <div key={r} className="flex gap-3">
                  <span className="font-mono text-xs text-navy">{String(i + 1).padStart(2, "0")}</span>
                  {r}
                </div>
              ))}
            </div>
            <div className="mt-9 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">any language</div>
            <p className="mt-3.5 text-[15.5px] leading-[1.6] text-muted">
              We care about the redirect working, not the stack. Python, Go, Rust, JS, PHP — ship it.
            </p>
          </div>
          <div className="bg-surface p-6 sm:p-10">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">recent submissions</div>
            <RecentSubmissions slug={challenge.slug} fallback={d.submissions} />
          </div>
        </div>
      ) : (
        <div className="px-5 py-12 sm:px-10">
          <p className="max-w-lg text-[15.5px] leading-[1.6] text-muted">{challenge.meta} · {challenge.subs}</p>
        </div>
      )}
    </main>
  );
}
