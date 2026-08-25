import Link from "next/link";
import { learningPath } from "@/lib/data";

const dot = { done: "bg-accent", active: "bg-warn", locked: "bg-[#0b0f10]" } as const;
const ring = { done: "border-accent", active: "border-warn", locked: "border-border-strong" } as const;
const titleColor = { done: "text-foreground", active: "text-foreground", locked: "text-muted" } as const;
const tagColor = { done: "text-accent", active: "text-warn", locked: "text-faint" } as const;

export default function LearnPage() {
  const done = learningPath.steps.filter((s) => s.state === "done").length;
  const pct = Math.round((done / learningPath.steps.length) * 100);

  return (
    <main className="px-5 py-12 sm:px-10 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">learning path</div>
      <h1 className="mt-3.5 text-[clamp(30px,5vw,52px)] leading-none uppercase tracking-[-0.04em]">
        {learningPath.title}
      </h1>
      <p className="mt-4.5 max-w-[460px] text-[16.5px] leading-[1.55] text-[#9aa6a0]">{learningPath.description}</p>

      <div className="mt-9 grid items-start gap-8 md:grid-cols-[1.6fr_1fr]">
        <div>
          {learningPath.steps.map((s, i) => (
            <div key={s.title} className="flex gap-4">
              <div className="flex w-5.5 flex-none flex-col items-center">
                <span
                  className={`h-2.5 w-2.5 rounded-full border ${ring[s.state]} ${dot[s.state]} ${
                    s.state === "active" ? "animate-[pulse_1.8s_infinite]" : ""
                  }`}
                />
                {i < learningPath.steps.length - 1 && <span className="min-h-4.5 w-px flex-1 bg-[#1f2729]" />}
              </div>
              <div className="flex-1 pb-5">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <div className={`text-[17px] font-semibold ${titleColor[s.state]}`}>{s.title}</div>
                  <span className={`font-mono text-[10px] uppercase tracking-[0.1em] ${tagColor[s.state]}`}>{s.tag}</span>
                </div>
                <div className="mt-1.5 text-[14.5px] leading-[1.5] text-muted">{s.detail}</div>
              </div>
            </div>
          ))}

          <div className="ml-9.5 rounded-[11px] border border-accent-dim bg-[linear-gradient(150deg,rgba(61,250,138,.06),transparent_60%)] p-5.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">final project</div>
            <div className="mt-2.5 text-xl font-semibold">Build a production API</div>
            <p className="mt-2.5 text-[15px] leading-[1.55] text-[#9aa6a0]">
              Ship it, then bring it to a club review session. Two members read your code.
            </p>
            <Link
              href="/projects"
              className="mt-4.5 inline-block rounded-lg bg-accent px-5.5 py-3 text-[14.5px] font-semibold text-[#04140b] hover:opacity-90"
            >
              Find a project to join
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-border bg-surface p-5.5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">your progress</div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-[15px]">
                {done} of {learningPath.steps.length} steps
              </span>
              <span className="font-mono text-xs text-accent">{pct}%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#161c1e]">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5.5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">other paths</div>
            <div className="mt-3.5 flex flex-col">
              {learningPath.otherPaths.map((p, i) => (
                <div
                  key={p}
                  className={`py-2.5 text-[15px] ${i < learningPath.otherPaths.length - 1 ? "border-b border-[#14191b]" : ""}`}
                >
                  {p}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
