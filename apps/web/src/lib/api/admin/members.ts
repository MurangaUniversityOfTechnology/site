import { apiFetch } from "../core";

export type AddMemberResponse = {
  user_id: string;
  email: string;
  temp_password: string | null;
  membership_status: string;
};

export type ImportMemberRow = {
  email: string;
  display_name: string;
  registration_number?: string | null;
};

export type ImportMemberResult = {
  email: string;
  status: "created" | "error";
  error: string | null;
};

export type ImportMembersResponse = {
  results: ImportMemberResult[];
};

export type RosterRow = {
  user_id: string;
  name: string;
  email: string;
  github_login: string | null;
  invite_status: string;
};

export const adminMembersApi = {
  addMember: (payload: {
    email: string;
    display_name: string;
    registration_number: string | null;
    github_handle: string | null;
    reason: string;
    password: string | null;
    activation: "active" | "expired" | "stk_push" | "manual_receipt";
    phone: string | null;
    mpesa_receipt?: string | null;
    amount_kes?: number | null;
  }) => apiFetch<AddMemberResponse>("/admin/members/add", { method: "POST", body: JSON.stringify(payload) }),
  importMembers: (rows: ImportMemberRow[], status: "active" | "expired" = "active") =>
    apiFetch<ImportMembersResponse>("/admin/members/import", { method: "POST", body: JSON.stringify({ rows, status }) }),
  roster: () => apiFetch<RosterRow[]>("/admin/github/roster"),
  refreshRosterRow: (userId: string) => apiFetch<RosterRow>(`/admin/github/roster/${userId}/refresh`, { method: "POST" }),
  resendInvite: (userId: string) => apiFetch<void>(`/admin/github/roster/${userId}/resend-invite`, { method: "POST" }),
};
