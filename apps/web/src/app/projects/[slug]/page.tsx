"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { JoinProjectPanel } from "@/components/JoinProjectPanel";
import { projectApi, type ProjectDetail } from "@/lib/api";

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const [project, setProject] = useState<ProjectDetail | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    projectApi
      .get(params.slug)
      .then((result) => {
        if (active) setProject(result);
      })
      .catch(() => {
        if (active) setProject(null);
      });
    return () => {
      active = false;
    };
  }, [params.slug]);

  if (project === undefined) return null;

  if (!project) {
    return (
      <main className="grid min-h-[calc(100vh-64px)] place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl tracking-[-0.02em]">Project not found</h1>
          <Link href="/projects" className="mt-3 inline-block text-accent hover:underline">
            Back to projects
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="border-b border-[#161c1e] bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[length:56px_56px] px-5 py-12 sm:px-10 sm:py-16">
        <Link href="/projects" className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint hover:text-foreground">
          ← projects
        </Link>
        <h1 className="mt-5.5 text-[clamp(36px,7vw,78px)] uppercase leading-[0.94] tracking-[-0.04em]">
          {project.name}
        </h1>
        <p className="mt-5 max-w-[480px] text-[17px] leading-[1.55] text-[#9aa6a0]">
          {project.description || "No description on GitHub yet."}
        </p>

        <div className="mt-8 flex flex-wrap gap-7 font-mono">
          <div className="text-[11px] text-[#7f8d87]">
            {project.member_count} <span className="text-faint">contributors</span>
          </div>
          <div className="text-[11px] text-[#7f8d87]">
            {project.open_issues_count} <span className="text-faint">open issues</span>
          </div>
          {project.language && (
            <div className="text-[11px] text-[#7f8d87]">
              <span className="text-foreground">{project.language}</span> <span className="text-faint">primary language</span>
            </div>
          )}
          <div className="text-[11px] text-[#7f8d87]">
            ★ {project.stars} <span className="text-faint">stars</span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <JoinProjectPanel slug={project.slug} isMember={project.is_member} requestStatus={project.my_request_status} />
          <a
            href={project.github_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border-strong px-6 py-3 text-[15px] hover:border-accent-dim"
          >
            View on GitHub
          </a>
        </div>
      </div>

      <div className="grid gap-px bg-[#161c1e] md:grid-cols-2">
        <div className="bg-background p-6 sm:p-10">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">contributors</div>
          {project.members.length === 0 ? (
            <p className="mt-4 text-[14.5px] text-muted">Nobody&apos;s joined yet — be the first.</p>
          ) : (
            <div className="mt-4 flex flex-col">
              {project.members.map((name) => (
                <div key={name} className="border-b border-[#14191b] py-3 text-[15px] last:border-0">
                  {name}
                </div>
              ))}
            </div>
          )}

          {project.topics.length > 0 && (
            <>
              <div className="mt-10 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">topics</div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {project.topics.map((t) => (
                  <span key={t} className="rounded border border-border-strong px-2.5 py-1.5 font-mono text-[11.5px] text-muted">
                    {t}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-surface p-6 sm:p-10">
          <div className="flex items-baseline gap-3">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">good first issues</div>
            {project.synced_at ? (
              <span className="font-mono text-[10.5px] text-accent">synced {timeAgo(project.synced_at)}</span>
            ) : (
              <span className="font-mono text-[10.5px] text-warn">not synced yet</span>
            )}
          </div>

          {project.issues.length === 0 ? (
            <p className="mt-4 text-[14.5px] text-muted">No open &ldquo;good first issue&rdquo;s right now — check back soon.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-2.5">
              {project.issues.map((issue) => (
                <a
                  key={issue.id}
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-border bg-background p-4 hover:border-accent-dim"
                >
                  <div className="text-[14.5px] text-foreground">{issue.title}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {issue.labels.map((l) => (
                      <span key={l} className="rounded border border-accent-dim px-2 py-0.5 font-mono text-[10px] text-accent">
                        {l}
                      </span>
                    ))}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
