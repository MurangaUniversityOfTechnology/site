import { apiFetch } from "./core";

export type Submission = {
  id: string;
  challenge_slug: string;
  github_url: string;
  demo_url: string | null;
  created_at: string;
  total_shipped: number;
};

export type RecentSubmission = { name: string; when: string };

export const challengeApi = {
  submit: (slug: string, payload: { github_url: string; demo_url: string | null; learned: string | null }) =>
    apiFetch<Submission>(`/challenges/${slug}/submit`, { method: "POST", body: JSON.stringify(payload) }),
  mySubmission: (slug: string) => apiFetch<Submission | null>(`/challenges/${slug}/my-submission`),
  recentSubmissions: (slug: string) => apiFetch<RecentSubmission[]>(`/challenges/${slug}/submissions`),
};
