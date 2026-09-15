import { apiUpload } from "../core";

export const adminUploadsApi = {
  uploadFile: (file: File) => apiUpload<{ url: string }>("/admin/uploads", file),
};
