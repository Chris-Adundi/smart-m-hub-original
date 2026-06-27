import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";

import DashboardHome from "./pages/DashboardHome";
import Schools from "./pages/Schools";
import SchoolDetails from "./pages/SchoolDetails";
import Payments from "./pages/Payments";
import Analytics from "./pages/Analytics";
import SupportTickets from "./pages/SupportTickets";
import SystemHealth from "./pages/SystemHealth";
import Approvals from "./pages/Approvals";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardHome />} />

          <Route path="schools" element={<Schools />} />
          <Route path="schools/:id" element={<SchoolDetails />} />

          <Route path="payments" element={<Payments />} />
          <Route path="analytics" element={<Analytics />} />

          <Route path="support" element={<SupportTickets />} />
          <Route path="system" element={<SystemHealth />} />
          <Route path="approvals" element={<Approvals />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}