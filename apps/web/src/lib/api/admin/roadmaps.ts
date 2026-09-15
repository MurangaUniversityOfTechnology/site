import { apiFetch } from "../core";
import type { Arm } from "../shared";
import type { MilestoneStatus } from "../roadmaps";

export type AdminRoadmapRow = {
  id: string;
  title: string;
  goal_summary: string | null;
  position: number;
  published_at: string | null;
  arm: Arm;
  milestone_count: number;
  created_by: string;
};

export type AdminMilestoneRow = {
  id: string;
  roadmap_id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  position: number;
};

export const adminRoadmapsApi = {
  listRoadmaps: () => apiFetch<AdminRoadmapRow[]>("/admin/roadmaps"),
  createRoadmap: (payload: { arm_id: string; title: string; goal_summary: string | null }) =>
    apiFetch<AdminRoadmapRow>("/admin/roadmaps", { method: "POST", body: JSON.stringify(payload) }),
  updateRoadmap: (roadmapId: string, payload: Partial<{ title: string; goal_summary: string | null }>) =>
    apiFetch<AdminRoadmapRow>(`/admin/roadmaps/${roadmapId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteRoadmap: (roadmapId: string) => apiFetch<void>(`/admin/roadmaps/${roadmapId}`, { method: "DELETE" }),
  publishRoadmap: (roadmapId: string) => apiFetch<AdminRoadmapRow>(`/admin/roadmaps/${roadmapId}/publish`, { method: "POST" }),
  unpublishRoadmap: (roadmapId: string) =>
    apiFetch<AdminRoadmapRow>(`/admin/roadmaps/${roadmapId}/unpublish`, { method: "POST" }),
  reorderRoadmap: (roadmapId: string, direction: "up" | "down") =>
    apiFetch<AdminRoadmapRow>(`/admin/roadmaps/${roadmapId}/reorder`, { method: "POST", body: JSON.stringify({ direction }) }),
  listMilestones: (roadmapId: string) => apiFetch<AdminMilestoneRow[]>(`/admin/roadmaps/${roadmapId}/milestones`),
  createMilestone: (roadmapId: string, payload: { title: string; description: string | null }) =>
    apiFetch<AdminMilestoneRow>(`/admin/roadmaps/${roadmapId}/milestones`, { method: "POST", body: JSON.stringify(payload) }),
  updateMilestone: (milestoneId: string, payload: Partial<{ title: string; description: string | null }>) =>
    apiFetch<AdminMilestoneRow>(`/admin/roadmaps/milestones/${milestoneId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  setMilestoneStatus: (milestoneId: string, status: MilestoneStatus) =>
    apiFetch<AdminMilestoneRow>(`/admin/roadmaps/milestones/${milestoneId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  deleteMilestone: (milestoneId: string) => apiFetch<void>(`/admin/roadmaps/milestones/${milestoneId}`, { method: "DELETE" }),
  reorderMilestone: (milestoneId: string, direction: "up" | "down") =>
    apiFetch<AdminMilestoneRow>(`/admin/roadmaps/milestones/${milestoneId}/reorder`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    }),
};
