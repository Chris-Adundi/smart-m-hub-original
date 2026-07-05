import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api/platform";

const getAuthToken = () =>
  localStorage.getItem("smart_m_hub_token") ||
  localStorage.getItem("access_token");

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

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

  const { data } = await api.get(`/schools/${encodeURIComponent(id)}`);
  return data;
}

export async function toggleSchool(id) {
  if (!id) {
    throw new Error("School ID is required");
  }

  const { data } = await api.patch(
    `/schools/${encodeURIComponent(id)}/toggle`
  );
  return data;
}

export default api;
