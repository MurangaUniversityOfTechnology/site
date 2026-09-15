import { apiFetch, API_URL } from "../core";
import type { ChoiceItem } from "../shared";
import type { FieldType, FormAnswerItem } from "../forms";

export type FormWritePayload = {
  slug: string;
  title: string;
  description: string;
  require_login: boolean;
  closes_at: string | null;
};

export type AdminFormRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  require_login: boolean;
  closes_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  field_count: number;
  response_count: number;
  created_by: string;
};

export type FieldWritePayload = {
  type: FieldType;
  prompt: string;
  help_text: string | null;
  required: boolean;
  choices: ChoiceItem[];
};

export type AdminFieldRow = {
  id: string;
  form_id: string;
  type: FieldType;
  prompt: string;
  help_text: string | null;
  required: boolean;
  choices: ChoiceItem[];
  position: number;
};

export type AdminResponseRow = {
  id: string;
  respondent: string;
  submitted_at: string;
  answers: FormAnswerItem[];
};

export type AdminResponsesPage = {
  responses: AdminResponseRow[];
  tallies: Record<string, Record<string, number>>;
};

export const adminFormsApi = {
  listForms: (archived = false) => apiFetch<AdminFormRow[]>(`/admin/forms?archived=${archived}`),
  createForm: (payload: FormWritePayload) =>
    apiFetch<AdminFormRow>("/admin/forms", { method: "POST", body: JSON.stringify(payload) }),
  updateForm: (slug: string, payload: Partial<FormWritePayload>) =>
    apiFetch<AdminFormRow>(`/admin/forms/${slug}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteForm: (slug: string) => apiFetch<void>(`/admin/forms/${slug}`, { method: "DELETE" }),
  publishForm: (slug: string) => apiFetch<AdminFormRow>(`/admin/forms/${slug}/publish`, { method: "POST" }),
  unpublishForm: (slug: string) => apiFetch<AdminFormRow>(`/admin/forms/${slug}/unpublish`, { method: "POST" }),
  archiveForm: (slug: string) => apiFetch<AdminFormRow>(`/admin/forms/${slug}/archive`, { method: "POST" }),
  unarchiveForm: (slug: string) => apiFetch<AdminFormRow>(`/admin/forms/${slug}/unarchive`, { method: "POST" }),
  listFormFields: (slug: string) => apiFetch<AdminFieldRow[]>(`/admin/forms/${slug}/fields`),
  createFormField: (slug: string, payload: FieldWritePayload) =>
    apiFetch<AdminFieldRow>(`/admin/forms/${slug}/fields`, { method: "POST", body: JSON.stringify(payload) }),
  updateFormField: (fieldId: string, payload: Partial<FieldWritePayload>) =>
    apiFetch<AdminFieldRow>(`/admin/forms/fields/${fieldId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteFormField: (fieldId: string) => apiFetch<void>(`/admin/forms/fields/${fieldId}`, { method: "DELETE" }),
  reorderFormField: (fieldId: string, direction: "up" | "down") =>
    apiFetch<AdminFieldRow>(`/admin/forms/fields/${fieldId}/reorder`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    }),
  listFormResponses: (slug: string) => apiFetch<AdminResponsesPage>(`/admin/forms/${slug}/responses`),
  exportFormResponsesUrl: (slug: string) => `${API_URL}/admin/forms/${slug}/responses/export`,
};
