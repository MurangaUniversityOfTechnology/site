import { apiFetch } from "./core";

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

export const announcementApi = {
  live: () => apiFetch<Announcement[]>("/announcements"),
};
