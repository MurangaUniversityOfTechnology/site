"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { projectApi, type ProjectSummary } from "@/lib/api";

export function FeaturedProject() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);

  useEffect(() => {
    let active = true;
    projectApi.list().then((result) => {
      if (active) setProjects(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!projects) return null;
  const featured = [...projects].sort((a, b) => b.stars - a.stars)[0];
  if (!featured) return null;

  return (
    <section className="px-5 py-16 sm:px-10 sm:py-20">
      <div className="mb-5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">featured project</div>
      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col bg-surface p-6 sm:p-10">
          <h2 className="m-0 text-[clamp(30px,4.4vw,48px)] leading-none tracking-[-0.03em]">{featured.name}</h2>
          <p className="mt-4 max-w-[420px] text-base leading-[1.55] text-[#9aa6a0] text-pretty">
            {featured.description || "No description on GitHub yet."}
          </p>
          <div className="my-6 flex flex-wrap gap-1.5">
            {[featured.language, ...featured.topics].filter(Boolean).map((t) => (
              <span key={t} className="rounded border border-border-strong px-2.5 py-1 font-mono text-[11px] text-muted">
                {t}
              </span>
            ))}
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-4">
            <span className="font-mono text-[11px] text-faint">{featured.open_issues_count} open issues</span>
            <Link
              href={`/projects/${featured.slug}`}
              className="ml-auto rounded-lg border border-border-strong px-5 py-2.5 text-sm font-medium text-foreground hover:border-accent-dim"
            >
              Explore Project →
            </Link>
          </div>
        </div>
        <div className="relative grid min-h-[220px] place-items-center bg-surface bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.035)_0_2px,transparent_2px_9px)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,rgba(61,250,138,.07),transparent_60%)]" />
          <div className="px-5 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#5d6a64]">
            {featured.language || "project"}
            <br />
            <span className="normal-case tracking-[0.06em] text-faint">a repo in the club org, maintained by students</span>
          </div>
        </div>
      </div>
    </section>
  );
}
