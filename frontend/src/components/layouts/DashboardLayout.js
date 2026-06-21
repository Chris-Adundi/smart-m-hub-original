// =========================
// DASHBOARD LAYOUT (CLEAN FINAL)
// =========================

import { useState, useMemo, useCallback } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { authService } from "@/services/authService";
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
// ROLE NORMALIZER (KEEP ONLY ONE SOURCE STYLE)
// =========================
const normalizeRole = (role) => {
  if (!role) return "";

  const r = String(role).trim().toLowerCase();

  const map = {
    admin: "school_admin",
    schooladmin: "school_admin",
    school_admin: "school_admin",
    "school-admin": "school_admin",

    superadmin: "super_admin",
    super_admin: "super_admin",
    "super-admin": "super_admin",

    teacher: "teacher",

    finance: "finance",
    accounts: "finance",
    accountant: "finance",

    secretary: "secretary",

    student: "student",
    parent: "student",
    guardian: "student",
  };

  return map[r] || r;
};

// =========================
// MENU ITEMS
// =========================
const MENU_ITEMS = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    path: "/app/dashboard",
    roles: ["super_admin", "school_admin", "teacher", "finance", "secretary"],
  },
  {
    icon: ShieldCheck,
    label: "Super Admin",
    path: "/app/super-admin",
    roles: ["super_admin"],
  },
  {
    icon: Building2,
    label: "School Profile",
    path: "/app/school-profile",
    roles: ["school_admin"],
  },
  {
    icon: Users,
    label: "Students",
    path: "/app/students",
    roles: ["school_admin", "secretary", "teacher"],
  },
  {
    icon: UsersRound,
    label: "Staff",
    roles: ["super_admin", "school_admin"],
    path: "/app/staff",
  },
  {
    icon: CreditCard,
    label: "Fees",
    path: "/app/fees",
    roles: ["school_admin", "finance"],
  },
  {
    icon: CalendarCheck,
    label: "Attendance",
    path: "/app/attendance",
    roles: ["school_admin", "teacher", "secretary"],
  },
  {
    icon: GraduationCap,
    label: "Exams & Results",
    path: "/app/exams",
    roles: ["school_admin", "teacher"],
  },
  {
    icon: Calendar,
    label: "Timetable",
    path: "/app/timetable",
    roles: ["school_admin", "teacher", "student"],
  },
  {
    icon: Package,
    label: "Inventory",
    path: "/app/inventory",
    roles: ["school_admin", "secretary"],
  },
  {
    icon: Bell,
    label: "Announcements",
    path: "/app/announcements",
    roles: ["school_admin", "secretary", "teacher", "finance", "student"],
  },
  {
    icon: User,
    label: "Teacher Portal",
    path: "/app/teacher-portal",
    roles: ["teacher", "school_admin"],
  },
  {
    icon: CreditCard,
    label: "Finance Portal",
    path: "/app/finance-portal",
    roles: ["finance", "school_admin"],
  },
  {
    icon: FileText,
    label: "Secretary Portal",
    path: "/app/secretary-portal",
    roles: ["secretary", "school_admin"],
  },
  {
    icon: User,
    label: "Student Portal",
    path: "/app/student-portal",
    roles: ["student"],
  },
];

// =========================
// COMPONENT
// =========================
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
      <div className="min-h-screen flex items-center justify-center text-white">
        <Button onClick={handleLogout}>Session expired. Login again</Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0B1220] text-slate-200 overflow-hidden">

      {/* SIDEBAR */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0F172A] border-r border-white/5 transition-transform duration-300 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >

        {/* HEADER */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/5">
          <div>
            <p className="text-white font-semibold text-sm">Smart-M Hub</p>
            <p className="text-[11px] text-slate-500 uppercase">
              {role.replace("_", " ")}
            </p>
          </div>

          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
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
                    ? "text-emerald-400 bg-emerald-500/10"
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
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
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