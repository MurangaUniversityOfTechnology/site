import { apiFetch } from "./core";
import type { ExperienceLevel } from "./shared";

export type MemberSummary = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  interests: string[];
  experience_level: ExperienceLevel | null;
};

export type CourseBadge = { slug: string; title: string; difficulty: number };

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
