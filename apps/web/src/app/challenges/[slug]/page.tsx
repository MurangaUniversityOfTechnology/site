import { notFound } from "next/navigation";
import { challenges } from "@/lib/data";

export function generateStaticParams() {
  return challenges.map((c) => ({ slug: c.slug }));
}

export default async function ChallengeDetailPage(props: PageProps<"/challenges/[slug]">) {
  const { slug } = await props.params;
  const challenge = challenges.find((c) => c.slug === slug);
  if (!challenge) notFound();

  const d = challenge.detail;

  return (
    <main>
      <div className="relative overflow-hidden border-b border-[#161c1e] bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[length:56px_56px] px-5 py-12 sm:px-10 sm:py-18">
        <div className="pointer-events-none absolute -right-16 -top-30 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(61,250,138,.08),transparent_65%)]" />
        <div className="relative font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent">{challenge.meta}</div>
        <h1 className="relative mt-5.5 text-[clamp(36px,7vw,78px)] uppercase leading-[0.92] tracking-[-0.045em]">
          {challenge.title}
        </h1>

        {d && (
          <>
            <p className="relative mt-5 max-w-[470px] text-[17px] leading-[1.55] text-[#9aa6a0]">{d.description}</p>
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
          <button className="rounded-lg bg-accent px-7 py-3.5 text-[15.5px] font-semibold text-[#04140b] hover:opacity-90">
            Start Challenge
          </button>
        </div>
      </div>

      {d ? (
        <div className="grid gap-px bg-[#161c1e] md:grid-cols-2">
          <div className="bg-background p-6 sm:p-10">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">requirements</div>
            <div className="mt-4.5 flex flex-col gap-3 text-base text-[#c8d2cc]">
              {d.requirements.map((r, i) => (
                <div key={r} className="flex gap-3">
                  <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
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
            <div className="mt-4.5 flex flex-col">
              {d.submissions.map((s) => (
                <div key={s.name} className="flex items-center gap-3 border-b border-[#14191b] py-3.5 last:border-0">
                  <div className="grid h-7.5 w-7.5 flex-none place-items-center rounded-full border border-border-strong bg-[#111617] font-mono text-[10.5px] text-muted">
                    {s.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px]">{s.name}</div>
                    <div className="mt-1 font-mono text-[10.5px] text-faint">{s.stack}</div>
                  </div>
                  <span className="font-mono text-[10.5px] text-accent">{s.when}</span>
                </div>
              ))}
            </div>
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
