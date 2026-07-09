import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getAuthToken, isSuperAdmin } from "./auth/superAdminAuth";

import MainLayout from "./layouts/MainLayout";

import DashboardHome from "./pages/DashboardHome";
import Schools from "./pages/Schools";
import SchoolDetails from "./pages/SchoolDetails";
import Payments from "./pages/Payments";
import Analytics from "./pages/Analytics";
import SupportTickets from "./pages/SupportTickets";
import SystemHealth from "./pages/SystemHealth";
import Approvals from "./pages/Approvals";
import PlatformControl from "./pages/PlatformControl";
import DiagnosticsCenter from "./pages/DiagnosticsCenter";
import Login from "./pages/Login";

function RequireSuperAdmin({ children }) {
  if (!getAuthToken() || !isSuperAdmin()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
