"use client";

import { useEffect, useState } from "react";
import { courseApi, roadmapApi, type Arm, type MilestoneStatus, type RoadmapSummary } from "@/lib/api";
import { Markdown } from "@/components/Markdown";

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
};

const NODE_STYLE: Record<MilestoneStatus, string> = {
  planned: "border-border-strong bg-surface text-faint",
  in_progress: "border-warn bg-warn/15 text-warn",
  done: "border-accent-dim bg-accent text-navy",
};

const BADGE_STYLE: Record<MilestoneStatus, string> = {
  planned: "border-border-strong text-faint",
  in_progress: "border-warn/40 bg-warn/10 text-warn",
  done: "border-accent-dim/40 bg-accent/[0.12] text-navy",
};

const BAR_STYLE: Record<MilestoneStatus, string> = {
  planned: "bg-border-strong",
  in_progress: "bg-warn",
  done: "bg-accent-dim",
};

function StatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] ${BADGE_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function RoadmapCard({ roadmap }: { roadmap: RoadmapSummary }) {
  const milestones = roadmap.milestones;
  const doneCount = milestones.filter((m) => m.status === "done").length;

  return (
    <div className="rounded-xl border border-border bg-surface p-5.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold tracking-[-0.01em]">{roadmap.title}</h3>
        {milestones.length > 0 && (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
            {doneCount}/{milestones.length} done
          </span>
        )}
      </div>
      {roadmap.goal_summary && (
        <div className="mt-1.5 text-[14px] leading-[1.55] text-muted">
          <Markdown>{roadmap.goal_summary}</Markdown>
        </div>
      )}

      {milestones.length === 0 ? (
        <p className="mt-4 text-[13.5px] text-faint">Milestones for this semester haven&apos;t been added yet.</p>
      ) : (
        <>
          <div className="mt-4.5 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-border">
            {milestones.map((m) => (
              <span key={m.id} className={`flex-1 ${BAR_STYLE[m.status]}`} />
            ))}
          </div>

          <ol className="mt-5 flex flex-col">
            {milestones.map((m, i) => (
              <li key={m.id} className="relative pb-5 pl-11 last:pb-0">
                {i < milestones.length - 1 && (
                  <span
                    className={`absolute left-[15px] top-8 bottom-0 w-px ${
                      m.status === "done" ? "bg-accent-dim" : "bg-border-strong"
                    }`}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full border-2 font-mono text-[11px] ${NODE_STYLE[m.status]} ${
                    m.status === "in_progress" ? "shadow-[0_0_0_3px_rgba(138,90,18,0.15)]" : ""
                  }`}
                >
                  {m.status === "done" ? "✓" : m.position}
                </span>

                {m.description ? (
                  <details className="group">
                    <summary className="m-0 flex cursor-pointer list-none items-center justify-between gap-2 pt-0.5">
                      <span className="text-[13.5px] font-medium">{m.title}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={m.status} />
                        <span className="font-mono text-accent-dim transition-transform group-open:rotate-45">+</span>
                      </span>
                    </summary>
                    <div className="mt-1.5 text-[13px] leading-[1.5] text-muted">
                      <Markdown>{m.description}</Markdown>
                    </div>
                  </details>
                ) : (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[13.5px] font-medium">{m.title}</span>
                    <StatusBadge status={m.status} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

export default function RoadmapsPage() {
  const [arms, setArms] = useState<Arm[] | null>(null);
  const [selectedArm, setSelectedArm] = useState<string | null>(null);
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[] | null>(null);

  useEffect(() => {
    let active = true;
    courseApi.arms().then((result) => {
      if (active) setArms(result);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    roadmapApi.list(selectedArm ?? undefined).then((result) => {
      if (active) setRoadmaps(result);
    });
    return () => {
      active = false;
    };
  }, [selectedArm]);

  const groups = new Map<string, { arm: Arm; roadmaps: RoadmapSummary[] }>();
  for (const r of roadmaps ?? []) {
    const existing = groups.get(r.arm.id);
    if (existing) existing.roadmaps.push(r);
    else groups.set(r.arm.id, { arm: r.arm, roadmaps: [r] });
  }
  const orderedGroups = [...groups.values()].sort((a, b) => a.arm.position - b.arm.position);

  return (
    <main className="px-5 py-12 sm:px-10 sm:py-14">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">plan ahead</div>
      <h1 className="mt-3.5 text-[clamp(30px,5vw,54px)] leading-none tracking-[-0.04em]">ROADMAPS</h1>
      <p className="mt-3.5 max-w-140 text-[15.5px] text-muted">
        What each arm is working toward this semester — the goal, and the milestones along the way. Filled in by the
        team running that arm, updated as the semester moves. Tap a milestone for the details.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border-2 border-border-strong bg-surface" /> Planned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border-2 border-warn bg-warn/15" /> In progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border-2 border-accent-dim bg-accent" /> Done
        </span>
      </div>

      {arms && arms.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedArm(null)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
              selectedArm === null ? "border-accent-dim bg-accent/[0.08] text-navy" : "border-border-strong text-muted"
            }`}
          >
            All arms
          </button>
          {arms.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedArm(a.slug)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] ${
                selectedArm === a.slug ? "border-accent-dim bg-accent/[0.08] text-navy" : "border-border-strong text-muted"
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {roadmaps?.length === 0 && (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">coming soon</div>
          <p className="mt-3 text-[15.5px] text-muted">
            {selectedArm ? "No roadmap published for this arm yet — check back soon." : "No roadmaps published yet — check back soon."}
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-9">
        {orderedGroups.map(({ arm, roadmaps: armRoadmaps }) => (
          <div key={arm.id}>
            {selectedArm === null && (
              <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{arm.name}</div>
            )}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {armRoadmaps
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((r) => (
                  <RoadmapCard key={r.id} roadmap={r} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
