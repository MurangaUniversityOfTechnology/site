import { apiFetch } from "./core";

export type ContentItem = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  status: string;
  created_at: string;
};

export type ContentSummary = { id: string; title: string; excerpt: string; author: string; created_at: string };

export const contentApi = {
  submit: (payload: { title: string; body: string; tags: string[] }) =>
    apiFetch<ContentItem>("/content", { method: "POST", body: JSON.stringify(payload) }),
  published: () => apiFetch<ContentSummary[]>("/content/published"),
  getPublished: (id: string) => apiFetch<ContentItem>(`/content/published/${id}`),
};
