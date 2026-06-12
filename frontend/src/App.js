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
import TimetablePage from "@/pages/TimetablePage";
import InventoryPage from "@/pages/InventoryPage";

// ======================
// PORTALS
// ======================
import StudentPortal from "@/pages/StudentPortal";
import TeacherPortal from "@/pages/TeacherPortal";
import FinancePortal from "@/pages/FinancePortal";
import SecretaryPortal from "@/pages/SecretaryPortal";

// ======================
// ADMIN
// ======================
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";
import AnnouncementsPage from "@/pages/AnnouncementsPage";

// ======================
// DEBUG
// ======================
import DataExplorer from "@/pages/DataExplorer";

// ======================
// BACKEND
// ======================
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export const API = `${BACKEND_URL.replace(/\/$/, "")}/api`;

// ======================
// ROLE NORMALIZER
// ======================
export const normalizeRole = (role) => {
  if (!role) return "";

  const r = String(role).trim().toLowerCase();

  const roleMap = {
    admin: "school_admin",
    schooladmin: "school_admin",
    school_admin: "school_admin",

    superadmin: "super_admin",
    super_admin: "super_admin",

    teacher: "teacher",
    finance: "finance",
    secretary: "secretary",

    student: "student",
    parent: "student",
  };

  return roleMap[r] || r;
};
// ======================
// DEFAULT REDIRECT
// ======================
export const getDefaultRouteByRole = (role) => {
  switch (normalizeRole(role)) {
    case "super_admin":
      return "/app/super-admin";

    case "teacher":
      return "/app/teacher-portal";

    case "finance":
      return "/app/finance-portal";

    case "secretary":
      return "/app/secretary-portal";

    case "student":
      return "/app/student-portal";

    case "school_admin":
    default:
      return "/app/dashboard";
  }
};
// ======================
// AUTH SERVICE
// ======================
export const authService = {
  getToken: () => localStorage.getItem("token"),

  getUser: () => {
    try {
      const raw = localStorage.getItem("user");

      if (!raw || raw === "undefined") {
        return null;
      }

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

    localStorage.setItem("token", token);

    localStorage.setItem(
      "user",
      JSON.stringify({
        ...user,
        role: normalizeRole(user?.role),
      })
    );
  },

  clearAuth: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  isAuthenticated: () => {
    return !!localStorage.getItem("token");
  },
};

// ======================
// AXIOS
// ======================
export const apiClient = axios.create({
  baseURL: API,
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = authService.getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers["Content-Type"] = "application/json";

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,

  (error) => {
    const status = error?.response?.status;

    // IMPORTANT FIX:
    // return to LANDING PAGE instead of forcing /login
    if (status === 401) {
      authService.clearAuth();

      if (
        window.location.pathname !== "/" &&
        !window.location.pathname.includes("/join/")
      ) {
        window.location.href = "/";
      }
    }

    console.error("API ERROR:", {
      url: error?.config?.url,
      method: error?.config?.method,
      status,
      data: error?.response?.data,
    });

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
  ],

  students: [
    "super_admin",
    "school_admin",
    "secretary",
    "teacher",
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

  // =========================
  // SUPER ADMIN
  // =========================

  "super-admin": [
    "super_admin",
  ],

  // =========================
  // DEBUG
  // =========================

  debug: [
    "super_admin",
    "school_admin",
  ],
};

// ======================
// PROTECTED ROUTE
// ======================
const ProtectedRoute = () => {
  const token = authService.getToken();

  // IMPORTANT FIX:
  // redirect to LANDING PAGE
  if (!token) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

// ======================
// ROLE PROTECTION
// ======================
const RoleProtectedRoute = ({
  routeKey,
  children,
}) => {
  // ======================
  // AUTH CHECK
  // ======================

  const token = authService.getToken();
  const user = authService.getUser();

  if (!token || !user) {
    authService.clearAuth();

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

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

  if (!allowedRoles.includes(role)) {
    return (
      <Navigate
        to={getDefaultRouteByRole(role)}
        replace
      />
    );
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
            element={<SchoolProfilePage />}
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

              {/* SUPER ADMIN */}
              <Route
                path="super-admin"
                element={
                  <RoleProtectedRoute routeKey="super-admin">
                    <SuperAdminDashboard />
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
              {/* DEBUG */}
              <Route
                path="debug"
                element={
                  <RoleProtectedRoute routeKey="debug">
                    <DataExplorer />
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