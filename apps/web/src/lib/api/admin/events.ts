import { apiFetch } from "../core";
import type { AdminRegistrationRow, EventDetail, EventManagerRow, EventWritePayload } from "../events";

export type AdminEventRow = EventDetail & {
  id: string;
  registration_count: number;
  archived_at: string | null;
};

export const adminEventsApi = {
  eventRegistrations: (slug: string) => apiFetch<AdminRegistrationRow[]>(`/admin/events/${slug}/registrations`),
  approveRegistration: (id: string) => apiFetch<void>(`/admin/registrations/${id}/approve`, { method: "POST" }),
  rejectRegistration: (id: string) => apiFetch<void>(`/admin/registrations/${id}/reject`, { method: "POST" }),
  waitlistRegistration: (id: string) => apiFetch<void>(`/admin/registrations/${id}/waitlist`, { method: "POST" }),
  attendRegistration: (id: string) => apiFetch<void>(`/admin/registrations/${id}/attend`, { method: "POST" }),
  listEvents: (archived = false) => apiFetch<AdminEventRow[]>(`/admin/events?archived=${archived}`),
  createEvent: (payload: EventWritePayload) =>
    apiFetch<AdminEventRow>("/admin/events", { method: "POST", body: JSON.stringify(payload) }),
  updateEvent: (slug: string, payload: Partial<EventWritePayload>) =>
    apiFetch<AdminEventRow>(`/admin/events/${slug}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteEvent: (slug: string) => apiFetch<void>(`/admin/events/${slug}`, { method: "DELETE" }),
  archiveEvent: (slug: string) => apiFetch<AdminEventRow>(`/admin/events/${slug}/archive`, { method: "POST" }),
  unarchiveEvent: (slug: string) => apiFetch<AdminEventRow>(`/admin/events/${slug}/unarchive`, { method: "POST" }),
  listEventManagers: (slug: string) => apiFetch<EventManagerRow[]>(`/admin/events/${slug}/managers`),
  inviteEventManager: (slug: string, email: string) =>
    apiFetch<EventManagerRow>(`/admin/events/${slug}/managers/invite`, { method: "POST", body: JSON.stringify({ email }) }),
  revokeEventManager: (managerId: string) => apiFetch<void>(`/admin/events/managers/${managerId}/revoke`, { method: "POST" }),
};
