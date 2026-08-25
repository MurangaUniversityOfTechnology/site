import Link from "next/link";
import { projects } from "@/lib/data";

const stateColor = { green: "text-accent", amber: "text-warn", muted: "text-muted" } as const;
const dotColor = { green: "bg-accent", amber: "bg-warn", muted: "bg-faint" } as const;
const borderColor = { green: "border-accent-dim", amber: "border-[#3a3226]", muted: "border-border" } as const;

export default function ProjectsPage() {
  return (
    <main className="px-5 py-12 sm:px-10 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
        {projects.length} projects · synced 2 min ago
      </div>
      <h1 className="mt-3.5 text-[clamp(30px,5vw,54px)] leading-none tracking-[-0.04em]">BUILD WITH US</h1>
      <p className="mt-4 max-w-[480px] text-[16.5px] leading-[1.55] text-[#9aa6a0]">
        Every project is a repo in the club org, maintained by students. Six are looking for contributors right now.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Link
            key={p.slug}
            href={`/projects/${p.slug}`}
            className={`flex flex-col rounded-xl border bg-surface p-5.5 hover:border-accent-dim ${borderColor[p.stateColor]}`}
          >
            <div className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] ${stateColor[p.stateColor]}`}>
              <span className={`h-1.5 w-1.5 flex-none rounded-full ${dotColor[p.stateColor]}`} />
              {p.state}
            </div>
            <div className="mt-3.5 text-xl font-semibold tracking-[-0.02em]">{p.name}</div>
            <p className="mt-2.5 flex-1 text-[14.5px] leading-[1.55] text-muted">{p.blurb}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.stack.map((t) => (
                <span key={t} className="rounded border border-border-strong px-2.5 py-1 font-mono text-[10.5px] text-muted">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-4 flex justify-between font-mono text-[10.5px] text-faint">
              <span>{p.people}</span>
              <span>{p.activity}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
