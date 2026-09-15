import { apiFetch } from "./core";
import type { Arm, ChoiceItem } from "./shared";

export type QuizKind = "module_quiz" | "final_exam";

export type CourseSummary = {
  slug: string;
  title: string;
  short_description: string;
  cover_image_url: string | null;
  price_kes: number;
  difficulty: number;
  module_count: number;
  arms: Arm[];
};

export type CourseModuleOutline = {
  id: string;
  title: string;
  summary: string | null;
  position: number;
  lesson_count: number;
  est_minutes: number;
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
  difficulty: number;
  completed_at: string | null;
  modules_total: number;
  modules_completed: number;
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
