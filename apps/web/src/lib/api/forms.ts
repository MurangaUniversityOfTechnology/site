import { apiFetch } from "./core";
import type { ChoiceItem } from "./shared";

export type FieldType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multi_choice"
  | "dropdown"
  | "yes_no"
  | "rating"
  | "date"
  | "number"
  | "email";

export type FormFieldPublic = {
  id: string;
  type: FieldType;
  prompt: string;
  help_text: string | null;
  required: boolean;
  choices: ChoiceItem[];
};

export type FormPublic = {
  slug: string;
  title: string;
  description: string;
  require_login: boolean;
  closed: boolean;
  fields: FormFieldPublic[];
};

export type AnswerValue = string | number | boolean | string[] | null;

export type FormAnswerItem = { field_id: string; value: AnswerValue };

export const formApi = {
  get: (slug: string) => apiFetch<FormPublic>(`/forms/${slug}`),
  submit: (slug: string, answers: FormAnswerItem[]) =>
    apiFetch<void>(`/forms/${slug}/responses`, { method: "POST", body: JSON.stringify({ answers }) }),
};
