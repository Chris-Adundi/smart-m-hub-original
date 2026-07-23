import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getAuthToken, isSuperAdmin } from "./auth/superAdminAuth";

import MainLayout from "./layouts/MainLayout";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import PwaInstall from "./components/PwaInstall";

const DashboardHome = lazy(() => import("./pages/DashboardHome"));
const Schools = lazy(() => import("./pages/Schools"));
const SchoolDetails = lazy(() => import("./pages/SchoolDetails"));
const Payments = lazy(() => import("./pages/Payments"));
const Analytics = lazy(() => import("./pages/Analytics"));
const SupportTickets = lazy(() => import("./pages/SupportTickets"));
const SystemHealth = lazy(() => import("./pages/SystemHealth"));
const Approvals = lazy(() => import("./pages/Approvals"));
const PlatformControl = lazy(() => import("./pages/PlatformControl"));
const DiagnosticsCenter = lazy(() => import("./pages/DiagnosticsCenter"));
const Login = lazy(() => import("./pages/Login"));

function RequireSuperAdmin({ children }) {
  if (!getAuthToken() || !isSuperAdmin()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <PwaInstall />
      <RouteErrorBoundary>
      <Suspense fallback={<div style={{ padding: 24, color: "#4b5563" }}>Loading...</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<RequireSuperAdmin><MainLayout /></RequireSuperAdmin>}>
          <Route index element={<DashboardHome />} />

          <Route path="schools" element={<Schools />} />
          <Route path="schools/:id" element={<SchoolDetails />} />

          <Route path="payments" element={<Payments />} />
          <Route path="analytics" element={<Analytics />} />

          <Route path="support" element={<SupportTickets />} />
          <Route path="system" element={<SystemHealth />} />
          <Route path="diagnostics" element={<DiagnosticsCenter />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="control" element={<PlatformControl />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
