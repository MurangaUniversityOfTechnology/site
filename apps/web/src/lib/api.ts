const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type Me = {
  id: string;
  email: string;
  email_verified: boolean;
  is_admin: boolean;
  membership_status: string;
};

export const authApi = {
  signup: (email: string, password: string) =>
    apiFetch<Me>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    apiFetch<Me>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  me: () => apiFetch<Me>("/auth/me"),
  googleStartUrl: () => `${API_URL}/auth/google/start`,
};

export type ExperienceLevel = "starting" | "some_projects" | "independent" | "advanced";

export type Profile = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  registration_number: string | null;
  course: string | null;
  year_of_study: number | null;
  interests: string[];
  experience_level: ExperienceLevel | null;
  goals: string[];
  bio: string | null;
  photo_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
};

export type OnboardingPayload = {
  first_name: string;
  last_name: string;
  display_name: string;
  registration_number: string | null;
  course: string | null;
  year_of_study: number | null;
  interests: string[];
  experience_level: ExperienceLevel | null;
  goals: string[];
  bio: string | null;
  github_url: string | null;
  linkedin_url: string | null;
};

export const profileApi = {
  me: () => apiFetch<Profile>("/profile/me"),
  update: (payload: OnboardingPayload) =>
    apiFetch<Profile>("/profile/me", { method: "PATCH", body: JSON.stringify(payload) }),
};

export type PaymentStatus = "initiated" | "pending" | "completed" | "failed" | "cancelled" | "unknown";

export type Payment = {
  id: string;
  status: PaymentStatus;
  amount: number;
  phone: string;
  mpesa_receipt: string | null;
  created_at: string;
};

export type MembershipStatusResponse = {
  membership_status: string;
  latest_payment: Payment | null;
};

export const membershipApi = {
  activate: (phone: string) =>
    apiFetch<Payment>("/membership/activate", { method: "POST", body: JSON.stringify({ phone }) }),
  status: () => apiFetch<MembershipStatusResponse>("/membership/status"),
};
