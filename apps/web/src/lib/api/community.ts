import { apiFetch, apiUpload } from "./core";

export type CommunityPostKind = "question" | "poll";

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
};

export type PollOption = { id: string; label: string; position: number; vote_count: number };

export type CommunityPostSummary = {
  id: string;
  kind: CommunityPostKind;
  title: string;
  excerpt: string | null;
  author_display: string;
  is_anonymous: boolean;
  created_at: string;
  edited_at: string | null;
  is_hidden: boolean;
  is_mine: boolean;
  comment_count: number;
  score: number | null;
  my_vote: number | null;
  options: PollOption[] | null;
  my_option_id: string | null;
  link: LinkPreview | null;
  attachments: string[];
};

export type CommunityComment = {
  id: string;
  author_display: string;
  is_anonymous: boolean;
  body: string;
  attachments: string[];
  created_at: string;
  edited_at: string | null;
  is_hidden: boolean;
  is_mine: boolean;
  score: number;
  my_vote: number | null;
};

export type CommunityPostDetail = CommunityPostSummary & {
  body: string | null;
  comments: CommunityComment[];
};

export const communityApi = {
  list: (kind?: CommunityPostKind) => apiFetch<CommunityPostSummary[]>(`/community/posts${kind ? `?kind=${kind}` : ""}`),
  get: (id: string) => apiFetch<CommunityPostDetail>(`/community/posts/${id}`),
  create: (payload: {
    kind: CommunityPostKind;
    title: string;
    body: string | null;
    is_anonymous: boolean;
    options: string[];
    attachments: string[];
  }) => apiFetch<CommunityPostSummary>("/community/posts", { method: "POST", body: JSON.stringify(payload) }),
  update: (
    id: string,
    payload: { title: string; body: string | null; is_anonymous: boolean; attachments: string[] }
  ) => apiFetch<CommunityPostSummary>(`/community/posts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: string) => apiFetch<void>(`/community/posts/${id}`, { method: "DELETE" }),
  vote: (id: string, value: 1 | -1) =>
    apiFetch<CommunityPostSummary>(`/community/posts/${id}/vote`, { method: "POST", body: JSON.stringify({ value }) }),
  pollVote: (id: string, optionId: string) =>
    apiFetch<CommunityPostSummary>(`/community/posts/${id}/poll-vote`, {
      method: "POST",
      body: JSON.stringify({ option_id: optionId }),
    }),
  addComment: (id: string, body: string, isAnonymous: boolean, attachments: string[]) =>
    apiFetch<CommunityPostDetail>(`/community/posts/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, is_anonymous: isAnonymous, attachments }),
    }),
  updateComment: (id: string, payload: { body: string; is_anonymous: boolean; attachments: string[] }) =>
    apiFetch<CommunityComment>(`/community/comments/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  voteComment: (id: string, value: 1 | -1) =>
    apiFetch<CommunityComment>(`/community/comments/${id}/vote`, { method: "POST", body: JSON.stringify({ value }) }),
  uploadAttachment: (file: File) => apiUpload<{ url: string }>("/community/uploads", file),
  hidePost: (id: string, reason?: string) =>
    apiFetch<void>(`/community/posts/${id}/hide`, { method: "POST", body: JSON.stringify({ reason: reason ?? null }) }),
  unhidePost: (id: string) => apiFetch<void>(`/community/posts/${id}/unhide`, { method: "POST" }),
  hideComment: (id: string, reason?: string) =>
    apiFetch<void>(`/community/comments/${id}/hide`, { method: "POST", body: JSON.stringify({ reason: reason ?? null }) }),
  unhideComment: (id: string) => apiFetch<void>(`/community/comments/${id}/unhide`, { method: "POST" }),
};
