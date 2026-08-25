import { communityFeed, lookingForContributors } from "@/lib/data";

const fg = { green: "text-accent", amber: "text-warn", muted: "text-muted" } as const;

export default function CommunityPage() {
  return (
    <main className="px-5 py-12 sm:px-10 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">community</div>
      <h1 className="mt-3.5 text-[clamp(30px,5vw,54px)] leading-none uppercase tracking-[-0.04em]">
        What&apos;s being
        <br />
        built right now
      </h1>

      <div className="mt-9 grid items-start gap-6 md:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {communityFeed.map((a, i) => (
            <div key={i} className="flex gap-3.5 border-b border-[#14191b] p-5 last:border-0">
              <div
                className={`grid h-8.5 w-8.5 flex-none place-items-center rounded-full border border-border-strong bg-[#111617] font-mono text-[11px] ${fg[a.color as keyof typeof fg]}`}
              >
                {a.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15.5px] leading-[1.45]">{a.text}</div>
                <div className="mt-2 flex gap-3.5 font-mono text-[10.5px] text-faint">
                  <span className={`uppercase tracking-[0.1em] ${fg[a.color as keyof typeof fg]}`}>{a.kind}</span>
                  <span>{a.when}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-surface p-5.5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">shipped this month</div>
            <div className="mt-3 font-mono text-[34px] font-bold">07</div>
            <div className="mt-1.5 font-mono text-[10.5px] text-muted">projects reached v1</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5.5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">looking for contributors</div>
            <div className="mt-4 flex flex-col">
              {lookingForContributors.map((p, i) => (
                <div
                  key={p.name}
                  className={`py-3 ${i < lookingForContributors.length - 1 ? "border-b border-[#14191b]" : ""}`}
                >
                  <div className="text-[15px]">{p.name}</div>
                  <div className="mt-1 font-mono text-[10.5px] text-accent">{p.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
