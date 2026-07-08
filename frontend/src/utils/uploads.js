import { apiClient } from "@/App";

export async function uploadManagedFile(file, category) {
  if (!file) return "";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);

  const response = await apiClient.post("/uploads", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response?.data?.url || "";
}
