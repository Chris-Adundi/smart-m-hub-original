import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import StudentsPage from "@/pages/StudentsPage";
import StaffPage from "@/pages/StaffPage";
import FeesPage from "@/pages/FeesPage";
import AttendancePage from "@/pages/AttendancePage";
import ExamsPage from "@/pages/ExamsPage";
import TimetablePage from "@/pages/TimetablePage";
import InventoryPage from "@/pages/InventoryPage";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";
import AnnouncementsPage from "@/pages/AnnouncementsPage";
import StudentPortal from "@/pages/StudentPortal";
import SchoolProfilePage from "@/pages/SchoolProfilePage";
import TeacherPortal from "@/pages/TeacherPortal";
import FinancePortal from "@/pages/FinancePortal";
import SecretaryPortal from "@/pages/SecretaryPortal";




const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const authService = {
  getToken: () => localStorage.getItem('token'),
  getUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  isAuthenticated: () => !!localStorage.getItem('token')
};

export const apiClient = axios.create({
  baseURL: API,
});

apiClient.interceptors.request.use((config) => {
  const token = authService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const ProtectedRoute = ({ children }) => {
  return authService.isAuthenticated() ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="fees" element={<FeesPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="exams" element={<ExamsPage />} />
            <Route path="school-profile" element={<SchoolProfilePage />} />
            <Route path="teacher-portal" element={<TeacherPortal />} />
            <Route path="finance-portal" element={<FinancePortal />} />
            <Route path="secretary-portal" element={<SecretaryPortal />} />


            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="student-portal" element={<StudentPortal />} />

            <Route path="timetable" element={<TimetablePage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="super-admin" element={<SuperAdminDashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
