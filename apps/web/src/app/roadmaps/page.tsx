"use client";

import { useEffect, useState } from "react";
import { courseApi, roadmapApi, type Arm, type MilestoneStatus, type RoadmapSummary } from "@/lib/api";

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
};

function StatusBadge({ status }: { status: MilestoneStatus }) {
  const styles: Record<MilestoneStatus, string> = {
    planned: "border-border-strong text-faint",
    in_progress: "border-warn/40 bg-warn/10 text-warn",
    done: "border-accent-dim/40 bg-accent/[0.12] text-navy",
  };
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] ${styles[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function RoadmapCard({ roadmap }: { roadmap: RoadmapSummary }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold tracking-[-0.01em]">{roadmap.title}</h3>
      </div>
      {roadmap.goal_summary && <p className="mt-2 text-[14px] leading-[1.55] text-muted">{roadmap.goal_summary}</p>}

      {roadmap.milestones.length === 0 ? (
        <p className="mt-4 text-[13.5px] text-faint">Milestones for this semester haven&apos;t been added yet.</p>
      ) : (
        <ul className="mt-4.5 flex flex-col gap-2.5">
          {roadmap.milestones.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-border-strong bg-background px-3.5 py-3">
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium">{m.title}</div>
                {m.description && <p className="mt-1 text-[13px] leading-[1.5] text-muted">{m.description}</p>}
              </div>
              <StatusBadge status={m.status} />
            </li>
          ))}
        </ul>
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
        team running that arm, updated as the semester moves.
      </p>

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
