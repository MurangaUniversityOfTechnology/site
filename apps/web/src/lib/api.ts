// Explicit NEXT_PUBLIC_API_URL wins (production). Otherwise, in the browser,
// talk to whatever host served this page — so the same build works from
// localhost:3000 and from a LAN IP (phone testing) without hardcoding an IP
// that changes on every DHCP renewal. Server-side rendering has no window,
// so it always hits the API on this same machine directly.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://localhost:8000");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    // FastAPI's own validation errors (422) shape `detail` as an array of
    // {msg, loc, ...} objects rather than a string — render that as text
    // instead of handing React a non-string child that blows up the page.
    const detail = Array.isArray(body.detail)
      ? body.detail.map((e: { msg?: string }) => e.msg).join(", ")
      : body.detail;
    throw new ApiError(res.status, detail || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
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
  return handleResponse<T>(res);
}

// No Content-Type header here — the browser sets its own
// multipart/form-data boundary for a FormData body, and forcing
// application/json (like apiFetch does) would break the upload.
async function apiUpload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}${path}`, { method: "POST", credentials: "include", body: formData });
  return handleResponse<T>(res);
}

export type Me = {
  id: string;
  email: string;
  email_verified: boolean;
  is_admin: boolean;
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
  googleStartUrl: () => `${API_URL}/auth/google/start`,
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

export type ExperienceLevel = "starting" | "some_projects" | "independent" | "advanced";

export type ProfileVisibility = "public" | "members" | "private";

export type Profile = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  registration_number: string | null;
  phone: string | null;
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
  onboarded: boolean;
};

export type OnboardingPayload = {
  first_name: string;
  last_name: string;
  display_name: string;
  registration_number: string | null;
  phone: string | null;
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

export type DonationReason = "alumni" | "general" | "sponsorship" | "scholarship" | "other";

export type Donation = {
  id: string;
  status: PaymentStatus;
  amount: number;
  mpesa_receipt: string | null;
  reason: DonationReason;
  donor_name: string | null;
  message: string | null;
  created_at: string;
};

export type DonationWallEntry = {
  donor_name: string | null;
  reason: DonationReason;
  message: string | null;
  amount: number;
  created_at: string;
};

export const donationApi = {
  create: (payload: {
    amount: number;
    phone: string;
    reason: DonationReason;
    donor_name: string | null;
    is_anonymous: boolean;
    message: string | null;
  }) => apiFetch<Donation>("/donations", { method: "POST", body: JSON.stringify(payload) }),
  status: (id: string) => apiFetch<Donation>(`/donations/${id}`),
  wall: () => apiFetch<DonationWallEntry[]>("/donations/wall"),
};

export type AdminOverview = {
  total_members: number;
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
  is_admin: boolean;
  goals: string[];
  experience_level: ExperienceLevel | null;
};

export type PaymentTotal = { label: string; amount_kes: number; count: number };
export type PaymentSource = "membership" | "donation" | "event";
export type PaymentRow = {
  receipt: string | null;
  source: PaymentSource;
  who: string;
  amount: number;
  status: string;
  created_at: string;
};
export type PaymentsOverview = { totals: PaymentTotal[]; rows: PaymentRow[] };
export type DonationRow = {
  receipt: string | null;
  donor: string;
  reason: string;
  amount: number;
  status: string;
  created_at: string;
};
export type DonationsOverview = { totals: PaymentTotal[]; rows: DonationRow[] };
export type AuditEntry = { at: string; who: string; what: string; kind: string };

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

export type AdminEventRow = EventDetail & {
  id: string;
  registration_count: number;
  archived_at: string | null;
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

// ── courses ──────────────────────────────────────────────────────────────

export type QuizKind = "module_quiz" | "final_exam";

export type ChoiceItem = { id: string; text: string };

export type Arm = { id: string; slug: string; name: string; position: number };

export type CourseSummary = {
  slug: string;
  title: string;
  short_description: string;
  cover_image_url: string | null;
  price_kes: number;
  module_count: number;
  arms: Arm[];
};

export type CourseModuleOutline = {
  id: string;
  title: string;
  summary: string | null;
  position: number;
  lesson_count: number;
};

export type CourseDetail = CourseSummary & {
  description: string;
  enrolled: boolean;
  completed: boolean;
  modules: CourseModuleOutline[];
};

export type CoursePaymentStatus = {
  id: string;
  status: string;
  amount: number;
  mpesa_receipt: string | null;
  created_at: string;
};

export type CourseEnrollment = {
  id: string;
  access: "free_member" | "paid";
  enrolled_at: string;
  completed_at: string | null;
  payment: CoursePaymentStatus | null;
};

export type LessonPublic = {
  id: string;
  title: string;
  position: number;
  locked: boolean;
  completed: boolean;
};

export type ModulePublic = {
  id: string;
  title: string;
  summary: string | null;
  position: number;
  locked: boolean;
  quiz_passed: boolean;
  lessons: LessonPublic[];
};

export type LessonDetail = {
  id: string;
  title: string;
  body: string;
  video_url: string | null;
  completed: boolean;
};

export type QuizQuestionPublic = { id: string; prompt: string; choices: ChoiceItem[]; multi_select: boolean };

export type QuizForAttempt = {
  quiz_id: string;
  pass_threshold_pct: number;
  questions: QuizQuestionPublic[];
};

export type FinalExamIntro = {
  intro_text: string | null;
  question_count: number;
  pass_threshold_pct: number;
};

export type AnswerItem = { question_id: string; choice_ids: string[] };

export type GradedAnswer = {
  question_id: string;
  prompt: string;
  choices: ChoiceItem[];
  submitted_choice_ids: string[];
  correct_choice_ids: string[];
  explanation: string | null;
  correct: boolean;
};

export type QuizAttemptResult = {
  score_pct: number;
  passed: boolean;
  answers: GradedAnswer[];
};

export type CourseProgressModule = {
  id: string;
  title: string;
  locked: boolean;
  quiz_passed: boolean;
  lessons_completed: number;
  lessons_total: number;
};

export type CourseProgress = {
  modules: CourseProgressModule[];
  capstone_status: string | null;
  final_exam_passed: boolean;
  completed_at: string | null;
};

export type CourseEnrollmentSummary = {
  slug: string;
  title: string;
  cover_image_url: string | null;
  completed_at: string | null;
  modules_total: number;
  modules_completed: number;
};

export type CourseWritePayload = {
  slug: string;
  title: string;
  short_description: string;
  description: string;
  cover_image_url: string | null;
  price_kes: number;
};

export type AdminCourseRow = {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  description: string;
  cover_image_url: string | null;
  price_kes: number;
  published_at: string | null;
  archived_at: string | null;
  module_count: number;
  enrollment_count: number;
  created_by: string;
  arms: Arm[];
};

export type AdminModuleRow = {
  id: string;
  course_id: string;
  title: string;
  summary: string | null;
  position: number;
  lesson_count: number;
  has_quiz: boolean;
};

export type AdminLessonRow = {
  id: string;
  module_id: string;
  title: string;
  body: string;
  video_url: string | null;
  position: number;
};

export type AdminQuizRow = {
  id: string;
  kind: QuizKind;
  course_id: string;
  module_id: string | null;
  title: string;
  intro_text: string | null;
  pass_threshold_pct: number;
  question_count: number;
};

export type AdminQuestionRow = {
  id: string;
  quiz_id: string;
  prompt: string;
  choices: ChoiceItem[];
  correct_choice_ids: string[];
  explanation: string | null;
  position: number;
};

export type CapstoneSubmission = {
  id: string;
  github_url: string;
  what_built: string;
  review_status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type CapstoneAssignment = {
  title: string;
  instructions: string;
  submission: CapstoneSubmission | null;
};

export type AdminCapstoneAssignmentRow = {
  id: string;
  course_id: string;
  title: string;
  instructions: string;
  submission_count: number;
};

export type AdminCapstoneRow = {
  id: string;
  who: string;
  github_url: string;
  what_built: string;
  review_status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  created_at: string;
};

export type AdminQuizAttemptRow = {
  quiz_title: string;
  kind: "module_quiz" | "final_exam";
  score_pct: number;
  passed: boolean;
  created_at: string;
};

export type AdminEnrollmentRow = {
  id: string;
  who: string;
  email: string;
  access: "free_member" | "paid";
  enrolled_at: string;
  modules_completed: number;
  modules_total: number;
  final_exam_passed: boolean;
  capstone_status: string | null;
  completed_at: string | null;
};

export type AdminEnrollmentDetail = AdminEnrollmentRow & {
  modules: CourseProgressModule[];
  attempts: AdminQuizAttemptRow[];
};

export const courseApi = {
  list: (armSlug?: string) => apiFetch<CourseSummary[]>(`/courses${armSlug ? `?arm=${armSlug}` : ""}`),
  arms: () => apiFetch<Arm[]>("/courses/arms"),
  get: (slug: string) => apiFetch<CourseDetail>(`/courses/${slug}`),
  enroll: (slug: string, phone?: string) =>
    apiFetch<CourseEnrollment>(`/courses/${slug}/enroll`, { method: "POST", body: JSON.stringify({ phone }) }),
  myEnrollment: (slug: string) => apiFetch<CourseEnrollment | null>(`/courses/${slug}/my-enrollment`),
  myEnrollments: () => apiFetch<CourseEnrollmentSummary[]>("/courses/my-enrollments"),
  modules: (slug: string) => apiFetch<ModulePublic[]>(`/courses/${slug}/modules`),
  lesson: (slug: string, lessonId: string) => apiFetch<LessonDetail>(`/courses/${slug}/lessons/${lessonId}`),
  completeLesson: (slug: string, lessonId: string) =>
    apiFetch<LessonPublic>(`/courses/${slug}/lessons/${lessonId}/complete`, { method: "POST" }),
  moduleQuiz: (slug: string, moduleId: string) => apiFetch<QuizForAttempt>(`/courses/${slug}/modules/${moduleId}/quiz`),
  attemptModuleQuiz: (slug: string, moduleId: string, answers: AnswerItem[]) =>
    apiFetch<QuizAttemptResult>(`/courses/${slug}/modules/${moduleId}/quiz/attempt`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),
  finalExamIntro: (slug: string) => apiFetch<FinalExamIntro>(`/courses/${slug}/final-exam`),
  finalExamQuestions: (slug: string) => apiFetch<QuizForAttempt>(`/courses/${slug}/final-exam/questions`),
  attemptFinalExam: (slug: string, answers: AnswerItem[]) =>
    apiFetch<QuizAttemptResult>(`/courses/${slug}/final-exam/attempt`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),
  progress: (slug: string) => apiFetch<CourseProgress>(`/courses/${slug}/progress`),
  capstone: (slug: string) => apiFetch<CapstoneAssignment>(`/courses/${slug}/capstone`),
  submitCapstone: (slug: string, payload: { github_url: string; what_built: string }) =>
    apiFetch<CapstoneSubmission>(`/courses/${slug}/capstone/submit`, { method: "POST", body: JSON.stringify(payload) }),
};

export type SignatureStatus = { has_signature: boolean; updated_at: string | null };
export type SignatureImage = { image_base64: string; updated_at: string };

export const signatureApi = {
  status: () => apiFetch<SignatureStatus>("/profile/me/signature"),
  image: () => apiFetch<SignatureImage>("/profile/me/signature/image"),
  save: (imageBase64: string) =>
    apiFetch<SignatureStatus>("/profile/me/signature", {
      method: "PUT",
      body: JSON.stringify({ image_base64: imageBase64 }),
    }),
  remove: () => apiFetch<void>("/profile/me/signature", { method: "DELETE" }),
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

export const adminApi = {
  overview: () => apiFetch<AdminOverview>("/admin/overview"),
  memberships: (statusFilter: string) =>
    apiFetch<MembershipApplication[]>(`/admin/memberships?status_filter=${statusFilter}`),
  payments: () => apiFetch<PaymentsOverview>("/admin/payments"),
  donations: () => apiFetch<DonationsOverview>("/admin/donations"),
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
  searchUsers: (query: string) => apiFetch<AdminRow[]>(`/admin/users/search?query=${encodeURIComponent(query)}`),
  makeAdmin: (userId: string) => apiFetch<void>(`/admin/users/${userId}/make-admin`, { method: "POST" }),
  removeAdmin: (userId: string) => apiFetch<void>(`/admin/users/${userId}/remove-admin`, { method: "POST" }),
  listTags: () => apiFetch<Tag[]>("/admin/tags"),
  createTag: (name: string) => apiFetch<Tag>("/admin/tags", { method: "POST", body: JSON.stringify({ name }) }),
  renameTag: (tagId: string, name: string) =>
    apiFetch<Tag>(`/admin/tags/${tagId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteTag: (tagId: string) => apiFetch<void>(`/admin/tags/${tagId}`, { method: "DELETE" }),
  assignTag: (userId: string, tagId: string) =>
    apiFetch<AdminRow>(`/admin/users/${userId}/tags`, { method: "POST", body: JSON.stringify({ tag_id: tagId }) }),
  unassignTag: (userId: string, tagId: string) =>
    apiFetch<AdminRow>(`/admin/users/${userId}/tags/${tagId}`, { method: "DELETE" }),
  addMember: (payload: {
    email: string;
    display_name: string;
    registration_number: string | null;
    github_handle: string | null;
    reason: string;
    password: string | null;
    activation: "active" | "stk_push" | "manual_receipt";
    phone: string | null;
    mpesa_receipt?: string | null;
    amount_kes?: number | null;
  }) => apiFetch<AddMemberResponse>("/admin/members/add", { method: "POST", body: JSON.stringify(payload) }),
  importMembers: (rows: ImportMemberRow[]) =>
    apiFetch<ImportMembersResponse>("/admin/members/import", { method: "POST", body: JSON.stringify({ rows }) }),
  joinRequests: () => apiFetch<AdminJoinRequestRow[]>("/admin/projects/join-requests"),
  approveJoinRequest: (id: string) => apiFetch<void>(`/admin/projects/join-requests/${id}/approve`, { method: "POST" }),
  rejectJoinRequest: (id: string) => apiFetch<void>(`/admin/projects/join-requests/${id}/reject`, { method: "POST" }),
  syncProjects: () => apiFetch<void>("/admin/projects/sync", { method: "POST" }),
  listTrackedProjects: (archived = false) => apiFetch<AdminProjectRow[]>(`/admin/projects?archived=${archived}`),
  addProject: (payload: { repo_name: string; display_name: string | null }) =>
    apiFetch<AdminProjectRow>("/admin/projects", { method: "POST", body: JSON.stringify(payload) }),
  removeProject: (slug: string) => apiFetch<void>(`/admin/projects/${slug}`, { method: "DELETE" }),
  completeProject: (slug: string) => apiFetch<AdminProjectRow>(`/admin/projects/${slug}/complete`, { method: "POST" }),
  activateProject: (slug: string) => apiFetch<AdminProjectRow>(`/admin/projects/${slug}/activate`, { method: "POST" }),
  archiveProject: (slug: string) => apiFetch<AdminProjectRow>(`/admin/projects/${slug}/archive`, { method: "POST" }),
  unarchiveProject: (slug: string) =>
    apiFetch<AdminProjectRow>(`/admin/projects/${slug}/unarchive`, { method: "POST" }),
  listEvents: (archived = false) => apiFetch<AdminEventRow[]>(`/admin/events?archived=${archived}`),
  createEvent: (payload: EventWritePayload) =>
    apiFetch<AdminEventRow>("/admin/events", { method: "POST", body: JSON.stringify(payload) }),
  updateEvent: (slug: string, payload: Partial<EventWritePayload>) =>
    apiFetch<AdminEventRow>(`/admin/events/${slug}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteEvent: (slug: string) => apiFetch<void>(`/admin/events/${slug}`, { method: "DELETE" }),
  archiveEvent: (slug: string) => apiFetch<AdminEventRow>(`/admin/events/${slug}/archive`, { method: "POST" }),
  unarchiveEvent: (slug: string) => apiFetch<AdminEventRow>(`/admin/events/${slug}/unarchive`, { method: "POST" }),
  uploadFile: (file: File) => apiUpload<{ url: string }>("/admin/uploads", file),
  // Courses
  listCourses: (archived = false) => apiFetch<AdminCourseRow[]>(`/admin/courses?archived=${archived}`),
  createCourse: (payload: CourseWritePayload) =>
    apiFetch<AdminCourseRow>("/admin/courses", { method: "POST", body: JSON.stringify(payload) }),
  updateCourse: (slug: string, payload: Partial<CourseWritePayload>) =>
    apiFetch<AdminCourseRow>(`/admin/courses/${slug}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCourse: (slug: string) => apiFetch<void>(`/admin/courses/${slug}`, { method: "DELETE" }),
  publishCourse: (slug: string) => apiFetch<AdminCourseRow>(`/admin/courses/${slug}/publish`, { method: "POST" }),
  unpublishCourse: (slug: string) => apiFetch<AdminCourseRow>(`/admin/courses/${slug}/unpublish`, { method: "POST" }),
  archiveCourse: (slug: string) => apiFetch<AdminCourseRow>(`/admin/courses/${slug}/archive`, { method: "POST" }),
  unarchiveCourse: (slug: string) => apiFetch<AdminCourseRow>(`/admin/courses/${slug}/unarchive`, { method: "POST" }),
  listModules: (slug: string) => apiFetch<AdminModuleRow[]>(`/admin/courses/${slug}/modules`),
  createModule: (slug: string, payload: { title: string; summary: string | null }) =>
    apiFetch<AdminModuleRow>(`/admin/courses/${slug}/modules`, { method: "POST", body: JSON.stringify(payload) }),
  updateModule: (moduleId: string, payload: { title?: string; summary?: string | null }) =>
    apiFetch<AdminModuleRow>(`/admin/modules/${moduleId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteModule: (moduleId: string) => apiFetch<void>(`/admin/modules/${moduleId}`, { method: "DELETE" }),
  reorderModule: (moduleId: string, direction: "up" | "down") =>
    apiFetch<AdminModuleRow>(`/admin/modules/${moduleId}/reorder`, { method: "POST", body: JSON.stringify({ direction }) }),
  listLessons: (moduleId: string) => apiFetch<AdminLessonRow[]>(`/admin/modules/${moduleId}/lessons`),
  createLesson: (moduleId: string, payload: { title: string; body: string; video_url: string | null }) =>
    apiFetch<AdminLessonRow>(`/admin/modules/${moduleId}/lessons`, { method: "POST", body: JSON.stringify(payload) }),
  updateLesson: (lessonId: string, payload: { title?: string; body?: string; video_url?: string | null }) =>
    apiFetch<AdminLessonRow>(`/admin/lessons/${lessonId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteLesson: (lessonId: string) => apiFetch<void>(`/admin/lessons/${lessonId}`, { method: "DELETE" }),
  reorderLesson: (lessonId: string, direction: "up" | "down") =>
    apiFetch<AdminLessonRow>(`/admin/lessons/${lessonId}/reorder`, { method: "POST", body: JSON.stringify({ direction }) }),
  getModuleQuiz: (moduleId: string) => apiFetch<AdminQuizRow | null>(`/admin/modules/${moduleId}/quiz`),
  createModuleQuiz: (moduleId: string, payload: { title: string; intro_text: string | null; pass_threshold_pct: number }) =>
    apiFetch<AdminQuizRow>(`/admin/modules/${moduleId}/quiz`, { method: "POST", body: JSON.stringify(payload) }),
  getFinalExam: (slug: string) => apiFetch<AdminQuizRow | null>(`/admin/courses/${slug}/final-exam`),
  createFinalExam: (slug: string, payload: { title: string; intro_text: string | null; pass_threshold_pct: number }) =>
    apiFetch<AdminQuizRow>(`/admin/courses/${slug}/final-exam`, { method: "POST", body: JSON.stringify(payload) }),
  updateQuiz: (quizId: string, payload: { title?: string; intro_text?: string | null; pass_threshold_pct?: number }) =>
    apiFetch<AdminQuizRow>(`/admin/quizzes/${quizId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteQuiz: (quizId: string) => apiFetch<void>(`/admin/quizzes/${quizId}`, { method: "DELETE" }),
  listQuestions: (quizId: string) => apiFetch<AdminQuestionRow[]>(`/admin/quizzes/${quizId}/questions`),
  createQuestion: (
    quizId: string,
    payload: { prompt: string; choices: ChoiceItem[]; correct_choice_ids: string[]; explanation: string | null }
  ) => apiFetch<AdminQuestionRow>(`/admin/quizzes/${quizId}/questions`, { method: "POST", body: JSON.stringify(payload) }),
  updateQuestion: (
    questionId: string,
    payload: Partial<{ prompt: string; choices: ChoiceItem[]; correct_choice_ids: string[]; explanation: string | null }>
  ) => apiFetch<AdminQuestionRow>(`/admin/questions/${questionId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteQuestion: (questionId: string) => apiFetch<void>(`/admin/questions/${questionId}`, { method: "DELETE" }),
  reorderQuestion: (questionId: string, direction: "up" | "down") =>
    apiFetch<AdminQuestionRow>(`/admin/questions/${questionId}/reorder`, { method: "POST", body: JSON.stringify({ direction }) }),
  getCapstone: (slug: string) => apiFetch<AdminCapstoneAssignmentRow | null>(`/admin/courses/${slug}/capstone`),
  createCapstone: (slug: string, payload: { title: string; instructions: string }) =>
    apiFetch<AdminCapstoneAssignmentRow>(`/admin/courses/${slug}/capstone`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCapstone: (capstoneId: string, payload: Partial<{ title: string; instructions: string }>) =>
    apiFetch<AdminCapstoneAssignmentRow>(`/admin/capstones/${capstoneId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteCapstone: (capstoneId: string) => apiFetch<void>(`/admin/capstones/${capstoneId}`, { method: "DELETE" }),
  listCapstoneSubmissions: (slug: string) =>
    apiFetch<AdminCapstoneRow[]>(`/admin/courses/${slug}/capstone-submissions`),
  reviewCapstoneSubmission: (submissionId: string, approve: boolean) =>
    apiFetch<AdminCapstoneRow>(`/admin/capstone-submissions/${submissionId}/review`, {
      method: "POST",
      body: JSON.stringify({ approve }),
    }),
  listEnrollments: (slug: string) => apiFetch<AdminEnrollmentRow[]>(`/admin/courses/${slug}/enrollments`),
  getEnrollmentDetail: (enrollmentId: string) =>
    apiFetch<AdminEnrollmentDetail>(`/admin/enrollments/${enrollmentId}`),
  // Arms
  listArms: () => apiFetch<Arm[]>("/admin/arms"),
  createArm: (name: string) => apiFetch<Arm>("/admin/arms", { method: "POST", body: JSON.stringify({ name }) }),
  renameArm: (armId: string, name: string) =>
    apiFetch<Arm>(`/admin/arms/${armId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteArm: (armId: string) => apiFetch<void>(`/admin/arms/${armId}`, { method: "DELETE" }),
  reorderArm: (armId: string, direction: "up" | "down") =>
    apiFetch<Arm>(`/admin/arms/${armId}/reorder`, { method: "POST", body: JSON.stringify({ direction }) }),
  assignArm: (slug: string, armId: string) =>
    apiFetch<AdminCourseRow>(`/admin/courses/${slug}/arms`, { method: "POST", body: JSON.stringify({ arm_id: armId }) }),
  unassignArm: (slug: string, armId: string) =>
    apiFetch<AdminCourseRow>(`/admin/courses/${slug}/arms/${armId}`, { method: "DELETE" }),
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

export type CourseBadge = { slug: string; title: string };

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
  completed_courses: CourseBadge[];
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
  completed_at: string | null;
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
  archived: () => apiFetch<ProjectSummary[]>("/projects/archived"),
  get: (slug: string) => apiFetch<ProjectDetail>(`/projects/${slug}`),
  join: (slug: string, payload: { contribution_areas: string[]; message: string | null }) =>
    apiFetch<{ id: string; status: string; created_at: string }>(`/projects/${slug}/join`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export type AdminContentRow = { id: string; title: string; body: string; author: string; when: string };

export type Tag = { id: string; name: string; created_at: string };

export type AdminRow = { user_id: string; name: string; email: string; is_admin: boolean; tags: Tag[] };

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

export type AdminProjectRow = {
  slug: string;
  name: string;
  repo_name: string;
  github_url: string;
  language: string | null;
  stars: number;
  member_count: number;
  synced_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
};

export type RosterRow = {
  user_id: string;
  name: string;
  email: string;
  github_login: string | null;
  invite_status: string;
};

