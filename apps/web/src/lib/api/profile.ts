import { apiFetch, apiUpload } from "./core";
import type { ExperienceLevel } from "./shared";

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
  uploadPhoto: (file: File) => apiUpload<{ url: string }>("/profile/me/photo", file),
  deletePhoto: () => apiFetch<void>("/profile/me/photo", { method: "DELETE" }),
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

// The Dean/Club Patron's signature — visible only to whoever currently holds
// the "Chairperson" tag (or an admin), for reuse on official documents later.
export const orgSignatureApi = {
  status: () => apiFetch<SignatureStatus>("/org-signature"),
  image: () => apiFetch<SignatureImage>("/org-signature/image"),
  save: (imageBase64: string) =>
    apiFetch<SignatureStatus>("/org-signature", {
      method: "PUT",
      body: JSON.stringify({ image_base64: imageBase64 }),
    }),
  remove: () => apiFetch<void>("/org-signature", { method: "DELETE" }),
};
