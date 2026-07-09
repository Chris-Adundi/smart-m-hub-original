import axios from "axios";
import { logout } from "../auth/superAdminAuth";

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

    if ([401, 403].includes(error?.response?.status)) {
      logout();
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }

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

export async function approveSchool(id) {
  const { data } = await api.patch(`/schools/${encodeURIComponent(id)}/approve`);
  return data;
}

export async function suspendSchool(id) {
  const { data } = await api.patch(`/schools/${encodeURIComponent(id)}/suspend`);
  return data;
}

export async function activateSchool(id) {
  const { data } = await api.patch(`/schools/${encodeURIComponent(id)}/activate`);
  return data;
}

export async function resetSchoolPassword(id, password) {
  const { data } = await api.post(`/schools/${encodeURIComponent(id)}/reset-password`, { password });
  return data;
}

export async function getSchoolUsers(id) {
  const { data } = await api.get(`/schools/${encodeURIComponent(id)}/users`);
  return data;
}

export async function getAnalytics() {
  const { data } = await api.get("/analytics");
  return data;
}

export async function getPlatformControl() {
  const { data } = await api.get("/platform-control");
  return data;
}

export async function getDiagnostics() {
  const { data } = await api.get("/diagnostics");
  return data;
}

export async function updateDiagnosticStatus(id, payload) {
  const { data } = await api.patch(`/diagnostics/${encodeURIComponent(id)}`, payload);
  return data;
}

export async function createSupportNotice(payload) {
  const { data } = await api.post("/support-notices", payload);
  return data;
}

export default api;
