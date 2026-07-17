import "@/App.css";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  Outlet,
} from "react-router-dom";

import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { useEffect, useState, useMemo } from "react";
// ======================
// PAGES
// ======================
import LandingPage from "@/pages/LandingPage";
import SchoolProfilePage from "@/pages/SchoolProfilePage";

import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import JoinSchoolPage from "@/pages/JoinSchoolPage";

// ======================
// LAYOUT
// ======================
import DashboardLayout from "@/components/layouts/DashboardLayout";

// ======================
// CORE
// ======================
import Dashboard from "@/pages/Dashboard";
import StudentsPage from "@/pages/StudentsPage";
import StaffPage from "@/pages/StaffPage";
import FeesPage from "@/pages/FeesPage";
import AttendancePage from "@/pages/AttendancePage";
import ExamsPage from "@/pages/ExamsPage";
import AssessmentReportsPage from "@/pages/AssessmentReportsPage";
import TimetablePage from "@/pages/TimetablePage";
import InventoryPage from "@/pages/InventoryPage";
import SupportPage from "@/pages/SupportPage";

// ======================
// PORTALS
// ======================
import StudentPortal from "@/pages/StudentPortal";
import TeacherPortal from "@/pages/TeacherPortal";
import FinancePortal from "@/pages/FinancePortal";
import SecretaryPortal from "@/pages/SecretaryPortal";

import AnnouncementsPage from "@/pages/AnnouncementsPage";

// ======================
// BACKEND (SINGLE SOURCE OF TRUTH)
// ======================
const resolveBackendUrl = () => {
  const configured = process.env.REACT_APP_BACKEND_URL;
  const isLocalBackend = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url || "");
  const isLocalFrontend = () =>
    ["localhost", "127.0.0.1", ""].includes(window.location.hostname);

  if (configured) {
    if (isLocalBackend(configured) && !isLocalFrontend()) {
      console.error(
        "Smart M Hub is using a local backend URL from a public frontend. Set REACT_APP_BACKEND_URL to the public backend URL."
      );
    }
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("REACT_APP_BACKEND_URL must be set for deployed builds");
  }
  return "http://127.0.0.1:8000";
};

const BACKEND_URL = resolveBackendUrl();

export const API = `${BACKEND_URL.replace(/\/$/, "")}/api`;

export const formatApiError = (error, fallback = "Something went wrong") => {
  const detail =
    error?.response?.data?.detail ??
    error?.response?.data?.message ??
    error?.message ??
    fallback;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        const location = Array.isArray(item?.loc) ? item.loc.join(".") : item?.loc;
        return [location, item?.msg].filter(Boolean).join(": ") || JSON.stringify(item);
      })
      .join("; ");
  }

  if (detail && typeof detail === "object") {
    return detail.msg || detail.message || JSON.stringify(detail);
  }

  return String(detail || fallback);
};

// ======================
// ROLE NORMALIZER
// ======================
export const normalizeRole = (role) => {
  if (!role) return "";

  const r = String(role)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const map = {
    admin: "school_admin",
    schooladmin: "school_admin",
    school_admin: "school_admin",

    superadmin: "super_admin",
    super_admin: "super_admin",

    teacher: "teacher",
    finance: "finance",
    secretary: "secretary",
    supporting_staff: "supporting_staff",
    student: "student",
    parent: "student",
  };

  return map[r] || r;
};
// ======================
// DEFAULT REDIRECT
// ======================
export const getDefaultRouteByRole = (role) => {
  switch (normalizeRole(role)) {
    case "super_admin":
      return "/app/dashboard";

    case "teacher":
      return "/app/teacher-portal";

    case "finance":
      return "/app/finance-portal";

    case "secretary":
      return "/app/secretary-portal";

    case "supporting_staff":
      return "/app/dashboard";

    case "student":
      return "/app/student-portal";

    case "school_admin":
    default:
      return "/app/dashboard";
  }
};
// ======================
// AUTH SERVICE (CLEAN SINGLE SOURCE)
// ======================

const TOKEN_KEY = "smart_m_hub_token";
const USER_KEY = "smart_m_hub_user";

export const authService = {
  getToken: () => localStorage.getItem(TOKEN_KEY),

  getUser: () => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw || raw === "undefined") return null;

      const parsed = JSON.parse(raw);

      return {
        ...parsed,
        role: normalizeRole(parsed?.role),
      };
    } catch {
      return null;
    }
  },

  setAuth: (token, user) => {
    if (!token || !user) return;

    const safeUser = {
      ...user,
      role: normalizeRole(user?.role),
    };

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(safeUser));
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isAuthenticated: () => {
    return !!localStorage.getItem(TOKEN_KEY);
  },
};

// ======================
// AXIOS INSTANCE (USES SAME SOURCE AS API)
// ======================
export const apiClient = axios.create({
  baseURL: API,
  timeout: 30000,
});

// ======================
// REQUEST INTERCEPTOR (ONLY ONE)
// ======================
apiClient.interceptors.request.use((config) => {
  const token = authService.getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  } else {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
});

// ======================
// RESPONSE INTERCEPTOR (SINGLE HANDLER)
// ======================
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const backendUrl = String(API || "");
    const publicFrontend =
      !["localhost", "127.0.0.1", ""].includes(window.location.hostname);
    const localBackend =
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(backendUrl);

    if (!error?.response && publicFrontend && localBackend) {
      error.message =
        "Backend is configured as localhost, which testers cannot access from a public link. Set REACT_APP_BACKEND_URL to the public backend URL and restart the frontend.";
    }

    const formattedMessage = formatApiError(error);
    error.message = formattedMessage;
    if (error?.response?.data) {
      error.response.data.detail = formattedMessage;
      error.response.data.message = formattedMessage;
    }

    if (status === 401) {
      authService.clearAuth();

      if (
        window.location.pathname !== "/" &&
        !window.location.pathname.includes("/join/")
      ) {
        window.location.replace("/");
      }
    }

    return Promise.reject(error);
  }
);
// ======================
// ROUTE PERMISSIONS
// ======================
const routePermissions = {
  // =========================
  // CORE
  // =========================
school_profile: ["super_admin", "school_admin"],
  dashboard: [
    "super_admin",
    "school_admin",
    "teacher",
    "finance",
    "secretary",
    "supporting_staff",
  ],

  students: [
    "super_admin",
    "school_admin",
    "secretary",
    "teacher",
    "finance",
  ],

  staff: [
    "super_admin",
    "school_admin",
  ],

  fees: [
    "super_admin",
    "school_admin",
    "finance",
  ],

  attendance: [
    "super_admin",
    "school_admin",
    "teacher",
    "secretary",
  ],

  exams: [
    "super_admin",
    "school_admin",
    "teacher",
  ],

  assessments: [
    "super_admin",
    "school_admin",
    "teacher",
  ],

  timetable: [
    "super_admin",
    "school_admin",
    "teacher",
    "student",
  ],

  inventory: [
    "super_admin",
    "school_admin",
    "secretary",
  ],

  announcements: [
    "super_admin",
    "school_admin",
    "secretary",
    "teacher",
    "finance",
    "student",
  ],

  support: [
    "school_admin",
    "teacher",
    "finance",
    "secretary",
    "student",
  ],

  // =========================
  // PORTALS
  // =========================

  "teacher-portal": [
    "super_admin",
    "school_admin",
    "teacher",
  ],

  "finance-portal": [
    "super_admin",
    "school_admin",
    "finance",
  ],

  "secretary-portal": [
    "super_admin",
    "school_admin",
    "secretary",
  ],

  "student-portal": [
    "super_admin",
    "student",
  ],

};

// ======================
// PROTECTED ROUTE
// ======================
const ProtectedRoute = () => {
  const token = authService.getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

// ======================
// ROLE PROTECTION
// ======================
const RoleProtectedRoute = ({ routeKey, children }) => {
  const [ready, setReady] = useState(false);

  const token = authService.getToken();
  const user = useMemo(() => authService.getUser(), []);

    useEffect(() => {
      const t = setTimeout(() => setReady(true), 0);
      return () => clearTimeout(t);
    }, []);

  // ======================
  // ROLE NORMALIZATION
  // ======================

  const role = normalizeRole(user?.role);

  // ======================
  // SAFE ROUTE LOOKUP
  // ======================

  const allowedRoles =
    routePermissions?.[routeKey] || [];

  // ======================
  // INVALID ROLE SAFETY
  // ======================

  if (!role) {
    authService.clearAuth();

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // ======================
  // ACCESS DENIED
  // ======================

  if (!role || !allowedRoles.includes(role)) {
  return <Navigate to="/login" replace />;
}

  // ======================
  // SUCCESS
  // ======================

  return children;
};

// ======================
// SAFE DASHBOARD LAYOUT
// ======================
const SafeDashboardLayout = () => {
  const location = useLocation();

  const [ready, setReady] = useState(false);

  useEffect(() => {
  const t = setTimeout(() => setReady(true), 0);
  return () => clearTimeout(t);
}, []);

  const token = authService.getToken();
  const user = useMemo(() => authService.getUser(), []);

  if (!ready) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      Loading...
    </div>
  );
}

  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  return <DashboardLayout key={location.pathname} />;
};

// ======================
// APP
// ======================
function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>

          {/* ======================
              PUBLIC ROUTES
          ====================== */}

          {/* MAIN LANDING PAGE */}
          <Route path="/" element={<LandingPage />} />

          {/* OPTIONAL DIRECT PAGES */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* SCHOOL SETUP */}
          <Route
            path="/setup-school"
            element={<RegisterPage />}
          />

          {/* JOIN SCHOOL */}
          <Route
            path="/join-school"
            element={<JoinSchoolPage />}
          />

          <Route
            path="/join/:inviteCode"
            element={<JoinSchoolPage />}
          />

          {/* ======================
              PROTECTED APP
          ====================== */}
          <Route element={<ProtectedRoute />}>

            <Route
              path="/app"
              element={<SafeDashboardLayout />}
            >

              {/* DEFAULT */}
              <Route
                index
                element={
                  <Navigate
                    to={getDefaultRouteByRole(
                      authService.getUser()?.role
                    )}
                    replace
                  />
                }
              />

              {/* DASHBOARD */}
              <Route
                path="dashboard"
                element={
                  <RoleProtectedRoute routeKey="dashboard">
                    <Dashboard />
                  </RoleProtectedRoute>
                }
              />

              {/* STUDENTS */}
              <Route
                path="students"
                element={
                  <RoleProtectedRoute routeKey="students">
                    <StudentsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* STAFF */}
              <Route
                path="staff"
                element={
                  <RoleProtectedRoute routeKey="staff">
                    <StaffPage />
                  </RoleProtectedRoute>
                }
              />

              {/* FEES */}
              <Route
                path="fees"
                element={
                  <RoleProtectedRoute routeKey="fees">
                    <FeesPage />
                  </RoleProtectedRoute>
                }
              />

              {/* ATTENDANCE */}
              <Route
                path="attendance"
                element={
                  <RoleProtectedRoute routeKey="attendance">
                    <AttendancePage />
                  </RoleProtectedRoute>
                }
              />

              {/* EXAMS */}
              <Route
                path="exams"
                element={
                  <RoleProtectedRoute routeKey="exams">
                    <ExamsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* CBC ASSESSMENTS */}
              <Route
                path="assessments"
                element={
                  <RoleProtectedRoute routeKey="assessments">
                    <AssessmentReportsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* TIMETABLE */}
              <Route
                path="timetable"
                element={
                  <RoleProtectedRoute routeKey="timetable">
                    <TimetablePage />
                  </RoleProtectedRoute>
                }
              />

              {/* INVENTORY */}
              <Route
                path="inventory"
                element={
                  <RoleProtectedRoute routeKey="inventory">
                    <InventoryPage />
                  </RoleProtectedRoute>
                }
              />

              {/* ANNOUNCEMENTS */}
              <Route
                path="announcements"
                element={
                  <RoleProtectedRoute routeKey="announcements">
                    <AnnouncementsPage />
                  </RoleProtectedRoute>
                }
              />

              {/* SUPPORT */}
              <Route
                path="support"
                element={
                  <RoleProtectedRoute routeKey="support">
                    <SupportPage />
                  </RoleProtectedRoute>
                }
              />

              {/* STUDENT PORTAL */}
              <Route
                path="student-portal"
                element={
                  <RoleProtectedRoute routeKey="student-portal">
                    <StudentPortal />
                  </RoleProtectedRoute>
                }
              />

              {/* TEACHER PORTAL */}
              <Route
                path="teacher-portal"
                element={
                  <RoleProtectedRoute routeKey="teacher-portal">
                    <TeacherPortal />
                  </RoleProtectedRoute>
                }
              />

              {/* FINANCE PORTAL */}
              <Route
                path="finance-portal"
                element={
                  <RoleProtectedRoute routeKey="finance-portal">
                    <FinancePortal />
                  </RoleProtectedRoute>
                }
              />

              {/* SECRETARY PORTAL */}
              <Route
                path="secretary-portal"
                element={
                  <RoleProtectedRoute routeKey="secretary-portal">
                    <SecretaryPortal />
                  </RoleProtectedRoute>
                }
              />

              {/* SCHOOL PROFILE */}
              <Route
                path="school-profile"
                element={
                  <RoleProtectedRoute routeKey="school_profile">
                    <SchoolProfilePage />
                  </RoleProtectedRoute>
                }
              />
            </Route>
          </Route>

          {/* ======================
              FALLBACK
          ====================== */}
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-right"
        richColors
      />
    </div>
  );
}

export default App;
