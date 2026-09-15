import { apiFetch } from "../core";

export type AdminJoinRequestRow = {
  id: string;
  project_slug: string;
  project_name: string;
  user_email: string;
  user_name: string;
  contribution_areas: string[];
  message: string | null;
  created_at: string;
};

export type AdminProjectRow = {
  slug: string;
  name: string;
  repo_name: string;
  github_url: string;
  language: string | null;
  stars: number;
  member_count: number;
  synced_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
};

export const adminProjectsApi = {
  joinRequests: () => apiFetch<AdminJoinRequestRow[]>("/admin/projects/join-requests"),
  approveJoinRequest: (id: string) => apiFetch<void>(`/admin/projects/join-requests/${id}/approve`, { method: "POST" }),
  rejectJoinRequest: (id: string) => apiFetch<void>(`/admin/projects/join-requests/${id}/reject`, { method: "POST" }),
  syncProjects: () => apiFetch<void>("/admin/projects/sync", { method: "POST" }),
  listTrackedProjects: (archived = false) => apiFetch<AdminProjectRow[]>(`/admin/projects?archived=${archived}`),
  addProject: (payload: { repo_name: string; display_name: string | null }) =>
    apiFetch<AdminProjectRow>("/admin/projects", { method: "POST", body: JSON.stringify(payload) }),
  removeProject: (slug: string) => apiFetch<void>(`/admin/projects/${slug}`, { method: "DELETE" }),
  completeProject: (slug: string) => apiFetch<AdminProjectRow>(`/admin/projects/${slug}/complete`, { method: "POST" }),
  activateProject: (slug: string) => apiFetch<AdminProjectRow>(`/admin/projects/${slug}/activate`, { method: "POST" }),
  archiveProject: (slug: string) => apiFetch<AdminProjectRow>(`/admin/projects/${slug}/archive`, { method: "POST" }),
  unarchiveProject: (slug: string) =>
    apiFetch<AdminProjectRow>(`/admin/projects/${slug}/unarchive`, { method: "POST" }),
};
