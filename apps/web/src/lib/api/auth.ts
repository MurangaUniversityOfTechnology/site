import { apiFetch, API_URL } from "./core";

export type Me = {
  id: string;
  email: string;
  email_verified: boolean;
  is_admin: boolean;
  is_staff: boolean;
  is_chairperson: boolean;
  photo_url: string | null;
  membership_status: string;
  onboarded: boolean;
};

export const authApi = {
  signup: (email: string, password: string) =>
    apiFetch<Me>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    apiFetch<Me>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  me: () => apiFetch<Me>("/auth/me"),
  googleStartUrl: (next?: string | null) =>
    next ? `${API_URL}/auth/google/start?next=${encodeURIComponent(next)}` : `${API_URL}/auth/google/start`,
  // Dev-only — the backend 404s this outside ENVIRONMENT=development.
  devLogin: () => apiFetch<Me>("/auth/dev-login", { method: "POST" }),
  sendVerificationEmail: () => apiFetch<void>("/auth/send-verification-email", { method: "POST" }),
  changePassword: (payload: { current_password: string | null; new_password: string }) =>
    apiFetch<void>("/auth/change-password", { method: "POST", body: JSON.stringify(payload) }),
  forgotPassword: (email: string) =>
    apiFetch<void>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (payload: { token: string; new_password: string }) =>
    apiFetch<void>("/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }),
};

export type GithubStatus = { linked: boolean; login: string | null; invite_status: string };

export const githubApi = {
  status: () => apiFetch<GithubStatus>("/auth/github/status"),
  revoke: () => apiFetch<void>("/auth/github/revoke", { method: "POST" }),
  startUrl: () => `${API_URL}/auth/github/start`,
};
