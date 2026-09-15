import { apiFetch } from "./core";
import type { Arm } from "./shared";

export type MilestoneStatus = "planned" | "in_progress" | "done";

export type MilestonePublic = {
  id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  position: number;
};

export type RoadmapSummary = {
  id: string;
  title: string;
  goal_summary: string | null;
  position: number;
  arm: Arm;
  milestones: MilestonePublic[];
};

export const roadmapApi = {
  list: (armSlug?: string) => apiFetch<RoadmapSummary[]>(`/roadmaps${armSlug ? `?arm=${armSlug}` : ""}`),
};
