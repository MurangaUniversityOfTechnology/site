import { apiFetch } from "../core";

export type Tag = { id: string; name: string; created_at: string };

export type AdminRow = {
  user_id: string;
  name: string;
  email: string;
  is_admin: boolean;
  is_staff: boolean;
  tags: Tag[];
};

export const adminUsersApi = {
  listAdmins: () => apiFetch<AdminRow[]>("/admin/admins"),
  listStaff: () => apiFetch<AdminRow[]>("/admin/staff"),
  searchUsers: (query: string) => apiFetch<AdminRow[]>(`/admin/users/search?query=${encodeURIComponent(query)}`),
  makeAdmin: (userId: string) => apiFetch<void>(`/admin/users/${userId}/make-admin`, { method: "POST" }),
  removeAdmin: (userId: string) => apiFetch<void>(`/admin/users/${userId}/remove-admin`, { method: "POST" }),
  setMembershipStatus: (userId: string, status: "active" | "expired" | "inactive", reason: string) =>
    apiFetch<void>(`/admin/users/${userId}/membership-status`, {
      method: "POST",
      body: JSON.stringify({ status, reason }),
    }),
  makeStaff: (userId: string) => apiFetch<void>(`/admin/users/${userId}/make-staff`, { method: "POST" }),
  removeStaff: (userId: string) => apiFetch<void>(`/admin/users/${userId}/remove-staff`, { method: "POST" }),
  listTags: () => apiFetch<Tag[]>("/admin/tags"),
  createTag: (name: string) => apiFetch<Tag>("/admin/tags", { method: "POST", body: JSON.stringify({ name }) }),
  renameTag: (tagId: string, name: string) =>
    apiFetch<Tag>(`/admin/tags/${tagId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteTag: (tagId: string) => apiFetch<void>(`/admin/tags/${tagId}`, { method: "DELETE" }),
  assignTag: (userId: string, tagId: string) =>
    apiFetch<AdminRow>(`/admin/users/${userId}/tags`, { method: "POST", body: JSON.stringify({ tag_id: tagId }) }),
  unassignTag: (userId: string, tagId: string) =>
    apiFetch<AdminRow>(`/admin/users/${userId}/tags/${tagId}`, { method: "DELETE" }),
};
