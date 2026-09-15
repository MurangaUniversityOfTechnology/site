import { apiFetch } from "./core";

export type ProjectIssue = { id: number; title: string; url: string; labels: string[]; created_at: string };

export type ProjectSummary = {
  slug: string;
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  open_issues_count: number;
  completed_at: string | null;
};

export type ProjectDetail = ProjectSummary & {
  github_url: string;
  synced_at: string | null;
  issues: ProjectIssue[];
  members: string[];
  member_count: number;
  is_member: boolean;
  my_request_status: string | null;
};

export const projectApi = {
  list: () => apiFetch<ProjectSummary[]>("/projects"),
  archived: () => apiFetch<ProjectSummary[]>("/projects/archived"),
  get: (slug: string) => apiFetch<ProjectDetail>(`/projects/${slug}`),
  join: (slug: string, payload: { contribution_areas: string[]; message: string | null }) =>
    apiFetch<{ id: string; status: string; created_at: string }>(`/projects/${slug}/join`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
