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

export type GithubStatus = { linked: boolean; login: string | null; invite_status: string };

export const githubApi = {
  status: () => apiFetch<GithubStatus>("/auth/github/status"),
  revoke: () => apiFetch<void>("/auth/github/revoke", { method: "POST" }),
  startUrl: () => `${API_URL}/auth/github/start`,
};

export type ExperienceLevel = "starting" | "some_projects" | "independent" | "advanced";

export type ProfileVisibility = "public" | "members" | "private";

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
  visibility: ProfileVisibility;
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
  visibility: ProfileVisibility;
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

export type AdminOverview = {
  total_members: number;
  pending_approval: number;
  new_this_week: number;
  unmatched_payments: number;
};

export type MembershipApplication = {
  user_id: string;
  name: string;
  email: string;
  course: string | null;
  year_of_study: number | null;
  registration_number: string | null;
  payment_amount: number | null;
  payment_receipt: string | null;
  payment_status: string | null;
  membership_status: string;
};

export type PaymentTotal = { label: string; amount_kes: number; count: number };
export type PaymentRow = { receipt: string | null; member: string; amount: number; status: string };
export type PaymentsOverview = { totals: PaymentTotal[]; rows: PaymentRow[] };
export type AuditEntry = { at: string; who: string; what: string; kind: string };

export type RegistrationStatus = "pending" | "approved" | "rejected" | "waitlisted" | "attended" | "cancelled";

export type Registration = {
  id: string;
  status: RegistrationStatus;
  created_at: string;
};

export type AdminRegistrationRow = {
  id: string;
  name: string;
  detail: string;
  member: boolean;
  status: RegistrationStatus;
};

export const eventApi = {
  register: (slug: string, guest?: { guest_name: string; guest_email: string }) =>
    apiFetch<Registration>(`/events/${slug}/register`, { method: "POST", body: JSON.stringify(guest ?? {}) }),
  myRegistration: (slug: string) => apiFetch<Registration | null>(`/events/${slug}/registration`),
};

export const adminApi = {
  overview: () => apiFetch<AdminOverview>("/admin/overview"),
  memberships: (statusFilter: string) =>
    apiFetch<MembershipApplication[]>(`/admin/memberships?status_filter=${statusFilter}`),
  approve: (userId: string) => apiFetch<void>(`/admin/memberships/${userId}/approve`, { method: "POST" }),
  reject: (userId: string) => apiFetch<void>(`/admin/memberships/${userId}/reject`, { method: "POST" }),
  payments: () => apiFetch<PaymentsOverview>("/admin/payments"),
  audit: () => apiFetch<AuditEntry[]>("/admin/audit"),
  eventRegistrations: (slug: string) => apiFetch<AdminRegistrationRow[]>(`/admin/events/${slug}/registrations`),
  approveRegistration: (id: string) => apiFetch<void>(`/admin/registrations/${id}/approve`, { method: "POST" }),
  rejectRegistration: (id: string) => apiFetch<void>(`/admin/registrations/${id}/reject`, { method: "POST" }),
  waitlistRegistration: (id: string) => apiFetch<void>(`/admin/registrations/${id}/waitlist`, { method: "POST" }),
  attendRegistration: (id: string) => apiFetch<void>(`/admin/registrations/${id}/attend`, { method: "POST" }),
  contentQueue: () => apiFetch<AdminContentRow[]>("/admin/content"),
  publishContent: (id: string) => apiFetch<void>(`/admin/content/${id}/publish`, { method: "POST" }),
  rejectContent: (id: string) => apiFetch<void>(`/admin/content/${id}/reject`, { method: "POST" }),
  requestContentChanges: (id: string) => apiFetch<void>(`/admin/content/${id}/request-changes`, { method: "POST" }),
  listAdmins: () => apiFetch<AdminRow[]>("/admin/admins"),
  searchUser: (email: string) => apiFetch<AdminRow | null>(`/admin/users/search?email=${encodeURIComponent(email)}`),
  makeAdmin: (userId: string) => apiFetch<void>(`/admin/users/${userId}/make-admin`, { method: "POST" }),
  removeAdmin: (userId: string) => apiFetch<void>(`/admin/users/${userId}/remove-admin`, { method: "POST" }),
  addMember: (payload: {
    email: string;
    display_name: string;
    registration_number: string | null;
    github_handle: string | null;
    reason: string;
  }) => apiFetch<AddMemberResponse>("/admin/members/add", { method: "POST", body: JSON.stringify(payload) }),
  joinRequests: () => apiFetch<AdminJoinRequestRow[]>("/admin/projects/join-requests"),
  approveJoinRequest: (id: string) => apiFetch<void>(`/admin/projects/join-requests/${id}/approve`, { method: "POST" }),
  rejectJoinRequest: (id: string) => apiFetch<void>(`/admin/projects/join-requests/${id}/reject`, { method: "POST" }),
  syncProjects: () => apiFetch<void>("/admin/projects/sync", { method: "POST" }),
  roster: () => apiFetch<RosterRow[]>("/admin/github/roster"),
  refreshRosterRow: (userId: string) => apiFetch<RosterRow>(`/admin/github/roster/${userId}/refresh`, { method: "POST" }),
  resendInvite: (userId: string) => apiFetch<void>(`/admin/github/roster/${userId}/resend-invite`, { method: "POST" }),
};

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

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

export const notificationApi = {
  list: () => apiFetch<Notification[]>("/notifications"),
  unreadCount: () => apiFetch<{ count: number }>("/notifications/unread-count"),
  markRead: (id: string) => apiFetch<void>(`/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => apiFetch<void>("/notifications/read-all", { method: "POST" }),
};

export type MemberSummary = {
  user_id: string;
  display_name: string;
  interests: string[];
  experience_level: ExperienceLevel | null;
};

export type MemberProfile = {
  user_id: string;
  display_name: string;
  bio: string | null;
  interests: string[];
  experience_level: ExperienceLevel | null;
  goals: string[];
  github_url: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
};

export const memberApi = {
  directory: () => apiFetch<MemberSummary[]>("/members"),
  get: (userId: string) => apiFetch<MemberProfile>(`/members/${userId}`),
};

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

export type ProjectIssue = { id: number; title: string; url: string; labels: string[]; created_at: string };

export type ProjectSummary = {
  slug: string;
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  open_issues_count: number;
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
  get: (slug: string) => apiFetch<ProjectDetail>(`/projects/${slug}`),
  join: (slug: string, payload: { contribution_areas: string[]; message: string | null }) =>
    apiFetch<{ id: string; status: string; created_at: string }>(`/projects/${slug}/join`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export type AdminContentRow = { id: string; title: string; body: string; author: string; when: string };

export type AdminRow = { user_id: string; name: string; email: string; is_admin: boolean };

export type AddMemberResponse = { user_id: string; email: string; temp_password: string | null };

export type AdminJoinRequestRow = {
  id: string;
  project_slug: string;
  project_name: string;
  user_email: string;
  user_name: string;
  contribution_areas: string[];
  message: string | null;
  created_at: string;
};

export type RosterRow = {
  user_id: string;
  name: string;
  email: string;
  github_login: string | null;
  invite_status: string;
};

