import Link from "next/link";
import { notFound } from "next/navigation";
import { projects } from "@/lib/data";

const dotColor = { green: "bg-accent", amber: "bg-warn", muted: "bg-faint" } as const;

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export default async function ProjectDetailPage(props: PageProps<"/projects/[slug]">) {
  const { slug } = await props.params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) notFound();

  const d = project.detail;

  return (
    <main>
      <div className="border-b border-[#161c1e] bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[length:56px_56px] px-5 py-12 sm:px-10 sm:py-16">
        <Link href="/projects" className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground">
          ← projects
        </Link>
        <h1 className="mt-5.5 text-[clamp(36px,7vw,78px)] uppercase leading-[0.94] tracking-[-0.04em]">
          {project.name}
        </h1>
        <p className="mt-5 max-w-[480px] text-[17px] leading-[1.55] text-[#9aa6a0]">{project.blurb}</p>

        <div className="mt-8 flex flex-wrap gap-7 font-mono">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-accent">
            <span className="h-1.5 w-1.5 animate-[pulse_1.8s_infinite] rounded-full bg-accent" />
            {project.state}
          </div>
          {d && (
            <>
              <div className="text-[11px] text-[#7f8d87]">
                {d.contributors} <span className="text-faint">contributors</span>
              </div>
              <div className="text-[11px] text-[#7f8d87]">
                {d.openIssues} <span className="text-faint">open issues</span>
              </div>
              <div className="text-[11px] text-[#7f8d87]">
                {d.commitsThisMonth} <span className="text-faint">commits this month</span>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button className="rounded-lg bg-accent px-6 py-3 text-[15px] font-semibold text-[#04140b] hover:opacity-90">
            Join Project
          </button>
          {d && (
            <a
              href={`https://github.com/${d.repo}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border-strong px-6 py-3 text-[15px] hover:border-accent-dim"
            >
              View on GitHub
            </a>
          )}
        </div>
      </div>

      {d ? (
        <div className="grid gap-px bg-[#161c1e] md:grid-cols-2">
          <div className="bg-background p-6 sm:p-10">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">about</div>
            {d.about.map((p, i) => (
              <p key={i} className="mt-4 text-[16.5px] leading-[1.65] text-[#c8d2cc] text-pretty">
                {p}
              </p>
            ))}

            <div className="mt-10 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">roadmap</div>
            <div className="mt-4 flex flex-col">
              {d.roadmap.map((r) => (
                <div key={r.title} className="flex gap-4 border-b border-[#14191b] py-3.5">
                  <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${dotColor[r.color]}`} />
                  <div>
                    <div className="text-[15.5px] font-medium">{r.title}</div>
                    <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">{r.state}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface p-6 sm:p-10">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">tech stack</div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {project.stack.map((t) => (
                <span key={t} className="rounded border border-border-strong px-2.5 py-1.5 font-mono text-[11.5px] text-muted">
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-9 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">open roles</div>
            <div className="mt-3.5 rounded-lg border border-dashed border-accent-dim bg-accent/[0.03] p-4">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-accent">3 spots available</div>
              <div className="mt-2 text-[15px] text-[#c8d2cc]">{d.openRoles}</div>
            </div>

            <div className="mt-9 flex items-baseline gap-3">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">from github</div>
              <span className="font-mono text-[10.5px] text-accent">synced 2 min ago</span>
            </div>
            <div className="mt-3.5 break-all rounded-lg border border-border bg-background px-4 py-3.5 font-mono text-[11.5px] text-muted">
              {d.repo}
            </div>
            <div className="mt-3.5 flex flex-col gap-3 font-mono text-[11.5px] leading-[1.5] text-[#7f8d87]">
              {d.ghActivity.map((g, i) => (
                <div key={i}>
                  <span className={g.color === "green" ? "text-accent" : g.color === "amber" ? "text-warn" : "text-faint"}>
                    ●
                  </span>{" "}
                  {g.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 py-12 sm:px-10">
          <p className="max-w-lg text-[15.5px] leading-[1.6] text-muted">
            Full project details are still being written up. Reach out in the club to get involved.
          </p>
        </div>
      )}
    </main>
  );
}
