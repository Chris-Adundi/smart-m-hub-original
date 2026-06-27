import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api/platform";

const SUPER_ADMIN_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNmYwYzIwNDMtZjQ2Ni00OWRmLTk4MTEtOGNmOWUzZjA2MGU0IiwiZW1haWwiOiJkZXZlbG9wZXJAc3lzdGVtLmNvbSIsInJvbGUiOiJzdXBlcl9hZG1pbiIsInNjaG9vbF9pZCI6ImRlbW8tc2Nob29sLTEiLCJleHAiOjE3ODIzODA3Njd9.5yBH0hJzHrrazzkeV9aDwkGYUAr66pr88jsTX2O4dlI";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    config.headers.Authorization = `Bearer ${SUPER_ADMIN_TOKEN}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "An unexpected error occurred";

    return Promise.reject(new Error(message));
  }
);

export async function getPlatformStats() {
  const { data } = await api.get("/metrics");
  return data;
}

export async function getSchools(params = {}) {
  const { data } = await api.get("/schools", { params });
  return data;
}

export async function getSchoolDetail(id) {
  if (!id) {
    throw new Error("School ID is required");
  }

  const { data } = await api.get(`/schools/${id}`);
  return data;
}

export async function toggleSchool(id) {
  if (!id) {
    throw new Error("School ID is required");
  }

  const { data } = await api.patch(`/schools/${id}/toggle`);
  return data;
}

export default api;