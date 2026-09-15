import { apiFetch } from "./core";
import type { PaymentStatus } from "./shared";

export type RegistrationStatus = "pending" | "approved" | "rejected" | "waitlisted" | "attended" | "cancelled";

export type EventPaymentStatus = {
  id: string;
  status: PaymentStatus;
  amount: number;
  mpesa_receipt: string | null;
  created_at: string;
};

export type Registration = {
  id: string;
  status: RegistrationStatus;
  created_at: string;
  payment: EventPaymentStatus | null;
};

export type AdminRegistrationRow = {
  id: string;
  name: string;
  detail: string;
  member: boolean;
  status: RegistrationStatus;
  payment_status: string | null;
};

export type EventAudience = "open_to_all" | "members_only";

export type ScheduleItem = { time: string; what: string };

export type EventSummary = {
  slug: string;
  title: string;
  starts_at: string;
  venue: string;
  description: string;
  audience: EventAudience;
  fee_kes: number;
  capacity: number | null;
  seats_left: number | null;
};

export type EventDetail = EventSummary & {
  what_youll_build: string | null;
  schedule: ScheduleItem[];
  speaker_name: string | null;
  speaker_meta: string | null;
  requirements: string[];
  who_should_attend: string | null;
};

export type EventWritePayload = {
  slug: string;
  title: string;
  starts_at: string;
  venue: string;
  description: string;
  audience: EventAudience;
  fee_kes: number;
  capacity: number | null;
  what_youll_build: string | null;
  schedule: ScheduleItem[];
  speaker_name: string | null;
  speaker_meta: string | null;
  requirements: string[];
  who_should_attend: string | null;
};

export const eventApi = {
  list: () => apiFetch<EventSummary[]>("/events"),
  archived: () => apiFetch<EventSummary[]>("/events/archived"),
  get: (slug: string) => apiFetch<EventDetail>(`/events/${slug}`),
  register: (slug: string, payload?: { guest_name?: string; guest_email?: string; phone?: string }) =>
    apiFetch<Registration>(`/events/${slug}/register`, { method: "POST", body: JSON.stringify(payload ?? {}) }),
  myRegistration: (slug: string) => apiFetch<Registration | null>(`/events/${slug}/registration`),
  registrationStatus: (id: string) => apiFetch<Registration>(`/events/registrations/${id}`),
};

// ── event managers (per-event scoped access) ──────────────────────────────

export type EventManagerStatus = "invited" | "active" | "revoked";

export type EventManagerRow = {
  id: string;
  invited_email: string;
  status: EventManagerStatus;
  invited_by: string;
  created_at: string;
  accepted_at: string | null;
};

export type InvitePreview = {
  event_title: string;
  event_slug: string;
  invited_email: string;
  invited_by: string;
  status: EventManagerStatus;
};

export type WalkInPayload = {
  name: string;
  email: string;
  payment?: "free" | "stk_push" | "manual_receipt";
  phone?: string | null;
  mpesa_receipt?: string | null;
  amount_kes?: number | null;
};

export const eventManagerApi = {
  registrations: (slug: string) => apiFetch<AdminRegistrationRow[]>(`/events/${slug}/manage/registrations`),
  addWalkIn: (slug: string, payload: WalkInPayload) =>
    apiFetch<AdminRegistrationRow>(`/events/${slug}/manage/registrations`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  approve: (slug: string, id: string) =>
    apiFetch<void>(`/events/${slug}/manage/registrations/${id}/approve`, { method: "POST" }),
  reject: (slug: string, id: string) =>
    apiFetch<void>(`/events/${slug}/manage/registrations/${id}/reject`, { method: "POST" }),
  waitlist: (slug: string, id: string) =>
    apiFetch<void>(`/events/${slug}/manage/registrations/${id}/waitlist`, { method: "POST" }),
  attend: (slug: string, id: string) =>
    apiFetch<void>(`/events/${slug}/manage/registrations/${id}/attend`, { method: "POST" }),
  managers: (slug: string) => apiFetch<EventManagerRow[]>(`/events/${slug}/manage/managers`),
  inviteManager: (slug: string, email: string) =>
    apiFetch<EventManagerRow>(`/events/${slug}/manage/managers/invite`, { method: "POST", body: JSON.stringify({ email }) }),
  revokeManager: (slug: string, managerId: string) =>
    apiFetch<void>(`/events/${slug}/manage/managers/${managerId}/revoke`, { method: "POST" }),
  myManaged: () => apiFetch<string[]>("/events/my-managed"),
};

export const eventInviteApi = {
  preview: (token: string) => apiFetch<InvitePreview>(`/event-invites/${token}`),
  accept: (token: string) => apiFetch<{ event_slug: string }>(`/event-invites/${token}/accept`, { method: "POST" }),
};
