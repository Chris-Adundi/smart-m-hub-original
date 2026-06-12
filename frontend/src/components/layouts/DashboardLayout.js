import { useState, useMemo, useCallback } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";

import { authService } from "@/App";
import { Button } from "@/components/ui/button";

import {
  LayoutDashboard,
  Users,
  UsersRound,
  CreditCard,
  CalendarCheck,
  GraduationCap,
  Calendar,
  Package,
  LogOut,
  Menu,
  X,
  Bell,
  User,
  FileText,
  ShieldCheck,
  Shield,
  Building2,
} from "lucide-react";

// =========================
// MENU ITEMS
// =========================
const MENU_ITEMS = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    path: "/app/dashboard",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "FINANCE", "SECRETARY"],
  },
  {
    icon: ShieldCheck,
    label: "Super Admin",
    path: "/app/super-admin",
    roles: ["SUPER_ADMIN"],
  },
  {
    icon: Shield,
    label: "Login Portal",
    path: "/app/login-portal",
    roles: ["SCHOOL_ADMIN"],
  },

  // ✅ FIX ADDED HERE
  {
    icon: Building2,
    label: "School Profile",
    path: "/app/school-profile",
    roles: ["SCHOOL_ADMIN"],
  },

  {
    icon: Users,
    label: "Students",
    path: "/app/students",
    roles: ["SCHOOL_ADMIN", "SECRETARY", "TEACHER"],
  },
  {
    icon: UsersRound,
    label: "Staff",
    path: "/app/staff",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  },
  {
    icon: CreditCard,
    label: "Fees",
    path: "/app/fees",
    roles: ["SCHOOL_ADMIN", "FINANCE"],
  },
  {
    icon: CalendarCheck,
    label: "Attendance",
    path: "/app/attendance",
    roles: ["SCHOOL_ADMIN", "TEACHER", "SECRETARY"],
  },
  {
    icon: GraduationCap,
    label: "Exams & Results",
    path: "/app/exams",
    roles: ["SCHOOL_ADMIN", "TEACHER"],
  },
  {
    icon: Calendar,
    label: "Timetable",
    path: "/app/timetable",
    roles: ["SCHOOL_ADMIN", "TEACHER", "STUDENT"],
  },
  {
    icon: Package,
    label: "Inventory",
    path: "/app/inventory",
    roles: ["SCHOOL_ADMIN", "SECRETARY"],
  },
  {
    icon: Bell,
    label: "Announcements",
    path: "/app/announcements",
    roles: ["SCHOOL_ADMIN", "SECRETARY", "TEACHER", "FINANCE", "STUDENT"],
  },
  {
    icon: User,
    label: "Teacher Portal",
    path: "/app/teacher-portal",
    roles: ["TEACHER", "SCHOOL_ADMIN"],
  },
  {
    icon: CreditCard,
    label: "Finance Portal",
    path: "/app/finance-portal",
    roles: ["FINANCE", "SCHOOL_ADMIN"],
  },
  {
    icon: FileText,
    label: "Secretary Portal",
    path: "/app/secretary-portal",
    roles: ["SECRETARY", "SCHOOL_ADMIN"],
  },
  {
    icon: User,
    label: "Student Portal",
    path: "/app/student-portal",
    roles: ["STUDENT"],
  },
];

// =========================
// ROLE NORMALIZER
// =========================
const normalizeRole = (role) => {
  if (!role) return "";

  const r = String(role).trim().toUpperCase();

  const map = {
    ADMIN: "SCHOOL_ADMIN",
    SCHOOLADMIN: "SCHOOL_ADMIN",
    SCHOOL_ADMIN: "SCHOOL_ADMIN",

    SUPERADMIN: "SUPER_ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",

    TEACHER: "TEACHER",
    FINANCE: "FINANCE",
    SECRETARY: "SECRETARY",
    STUDENT: "STUDENT",
    PARENT: "STUDENT",
  };

  return map[r] || r;
};

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const rawUser = authService.getUser();

  const user = useMemo(() => {
    if (!rawUser) return null;

    return {
      ...rawUser,
      role: normalizeRole(rawUser.role),
    };
  }, [rawUser]);

  const role = user?.role || "";

  const handleLogout = useCallback(() => {
    authService.clearAuth();
    navigate("/login", { replace: true });
  }, [navigate]);

  const isActive = useCallback(
    (path) =>
      location.pathname === path ||
      location.pathname.startsWith(`${path}/`),
    [location.pathname]
  );

  const visibleItems = useMemo(() => {
    if (!role) return [];
    return MENU_ITEMS.filter((item) => item.roles.includes(role));
  }, [role]);

  if (!user || !role) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center text-white">
        <Button onClick={handleLogout}>
          Session expired. Login again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0B1220] text-slate-200 overflow-hidden">

      {/* SIDEBAR */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0F172A] border-r border-white/5 transition-transform duration-300 flex flex-col ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >

        {/* HEADER */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/5">
          <div>
            <p className="text-white font-semibold text-sm">
              Smart-M Hub
            </p>
            <p className="text-[11px] text-slate-500 uppercase">
              {role.replace("_", " ")}
            </p>
          </div>

          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X />
          </button>
        </div>

        {/* MENU */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm ${
                  isActive(item.path)
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* USER */}
        <div className="p-4 border-t border-white/5 space-y-3">
          <div>
            <p className="text-white text-sm">{user.full_name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>

          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col">

        <header className="h-14 border-b border-white/5 flex items-center justify-between px-4">
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu />
          </button>

          <div className="text-sm text-slate-300">
            Welcome, {user.full_name}
          </div>

          <div className="text-emerald-400 text-xs uppercase">
            {role.replace("_", " ")}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>

      </div>
    </div>
  );
};

export default DashboardLayout;