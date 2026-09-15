import { apiFetch } from "../core";
import type { Arm, ChoiceItem } from "../shared";
import type { CourseProgressModule, QuizKind } from "../courses";

export type CourseWritePayload = {
  slug: string;
  title: string;
  short_description: string;
  description: string;
  cover_image_url: string | null;
  price_kes: number;
  difficulty: number;
};

export type AdminCourseRow = {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  description: string;
  cover_image_url: string | null;
  price_kes: number;
  difficulty: number;
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

export const adminCoursesApi = {
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
  createLesson: (moduleId: string, payload: { title: string; body: string }) =>
    apiFetch<AdminLessonRow>(`/admin/modules/${moduleId}/lessons`, { method: "POST", body: JSON.stringify(payload) }),
  updateLesson: (lessonId: string, payload: { title?: string; body?: string }) =>
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
};
