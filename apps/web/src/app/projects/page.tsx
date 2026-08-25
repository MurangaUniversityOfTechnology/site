"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { projectApi, type ProjectSummary } from "@/lib/api";

export default function ProjectsPage() {
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

  return (
    <main className="px-5 py-12 sm:px-10 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
        {projects ? `${projects.length} projects · synced from github` : "loading…"}
      </div>
      <h1 className="mt-3.5 text-[clamp(30px,5vw,54px)] leading-none tracking-[-0.04em]">BUILD WITH US</h1>
      <p className="mt-4 max-w-[480px] text-[16.5px] leading-[1.55] text-[#9aa6a0]">
        Every project is a repo in the club org, maintained by students.
      </p>

      {projects?.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          No projects synced yet.
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((p) => (
          <Link
            key={p.slug}
            href={`/projects/${p.slug}`}
            className="flex flex-col rounded-xl border border-border bg-surface p-5.5 hover:border-accent-dim"
          >
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" />
              {p.language || "unspecified"}
            </div>
            <div className="mt-3.5 text-xl font-semibold tracking-[-0.02em]">{p.name}</div>
            <p className="mt-2.5 flex-1 text-[14.5px] leading-[1.55] text-muted">
              {p.description || "No description on GitHub yet."}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.topics.slice(0, 4).map((t) => (
                <span key={t} className="rounded border border-border-strong px-2.5 py-1 font-mono text-[10.5px] text-muted">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-4 flex justify-between font-mono text-[10.5px] text-faint">
              <span>★ {p.stars}</span>
              <span>{p.open_issues_count} open issues</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
