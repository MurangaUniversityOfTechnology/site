import { apiFetch } from "../core";

export type AdminContentRow = { id: string; title: string; body: string; author: string; when: string };

export const adminContentApi = {
  contentQueue: () => apiFetch<AdminContentRow[]>("/admin/content"),
  publishContent: (id: string) => apiFetch<void>(`/admin/content/${id}/publish`, { method: "POST" }),
  rejectContent: (id: string) => apiFetch<void>(`/admin/content/${id}/reject`, { method: "POST" }),
  requestContentChanges: (id: string) => apiFetch<void>(`/admin/content/${id}/request-changes`, { method: "POST" }),
};
