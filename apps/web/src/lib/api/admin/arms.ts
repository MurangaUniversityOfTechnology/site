import { apiFetch } from "../core";
import type { Arm } from "../shared";
import type { AdminCourseRow } from "./courses";

export const adminArmsApi = {
  listArms: () => apiFetch<Arm[]>("/admin/arms"),
  createArm: (name: string) => apiFetch<Arm>("/admin/arms", { method: "POST", body: JSON.stringify({ name }) }),
  renameArm: (armId: string, name: string) =>
    apiFetch<Arm>(`/admin/arms/${armId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteArm: (armId: string) => apiFetch<void>(`/admin/arms/${armId}`, { method: "DELETE" }),
  reorderArm: (armId: string, direction: "up" | "down") =>
    apiFetch<Arm>(`/admin/arms/${armId}/reorder`, { method: "POST", body: JSON.stringify({ direction }) }),
  assignArm: (slug: string, armId: string) =>
    apiFetch<AdminCourseRow>(`/admin/courses/${slug}/arms`, { method: "POST", body: JSON.stringify({ arm_id: armId }) }),
  unassignArm: (slug: string, armId: string) =>
    apiFetch<AdminCourseRow>(`/admin/courses/${slug}/arms/${armId}`, { method: "DELETE" }),
};
