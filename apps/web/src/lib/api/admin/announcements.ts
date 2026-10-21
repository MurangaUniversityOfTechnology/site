import { apiFetch } from "../core";
import type { Announcement } from "../announcements";

export type AnnouncementState = "live" | "scheduled" | "ended" | "off";

export type AdminAnnouncementRow = Announcement & {
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  state: AnnouncementState;
  created_at: string;
};

export type AnnouncementPayload = {
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export const adminAnnouncementsApi = {
  listAnnouncements: () => apiFetch<AdminAnnouncementRow[]>("/admin/announcements"),
  createAnnouncement: (payload: AnnouncementPayload) =>
    apiFetch<AdminAnnouncementRow>("/admin/announcements", { method: "POST", body: JSON.stringify(payload) }),
  updateAnnouncement: (id: string, payload: AnnouncementPayload) =>
    apiFetch<AdminAnnouncementRow>(`/admin/announcements/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteAnnouncement: (id: string) => apiFetch<void>(`/admin/announcements/${id}`, { method: "DELETE" }),
};
