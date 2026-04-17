import { useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { authService } from "@/App";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, UsersRound, CreditCard, CalendarCheck,
  GraduationCap, Calendar, Package, LogOut, Menu, X, Building2, Bell, User, FileText
} from "lucide-react";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = authService.getUser();

  const handleLogout = () => {
    authService.clearAuth();
    navigate("/login");
  };

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/", roles: ["super_admin", "school_admin", "teacher", "finance", "secretary"] },
    { icon: Building2, label: "Super Admin", path: "/super-admin", roles: ["super_admin"] },
    { icon: Building2, label: "School Profile", path: "/school-profile", roles: ["school_admin"] },
    { icon: Users, label: "Students", path: "/students", roles: ["school_admin", "teacher"] },
    { icon: UsersRound, label: "Staff", path: "/staff", roles: ["school_admin"] },
    { icon: CreditCard, label: "Fees", path: "/fees", roles: ["school_admin", "finance"] },
    { icon: CalendarCheck, label: "Attendance", path: "/attendance", roles: ["school_admin", "teacher"] },
    { icon: GraduationCap, label: "Performance", path: "/exams", roles: ["school_admin", "teacher"] },
    { icon: Bell, label: "Announcements", path: "/announcements", roles: ["school_admin", "teacher", "secretary"] },
    { icon: User, label: "Teacher Portal", path: "/teacher-portal", roles: ["teacher"] },
    { icon: CreditCard, label: "Finance Portal", path: "/finance-portal", roles: ["finance"] },
    { icon: FileText, label: "Secretary Portal", path: "/secretary-portal", roles: ["secretary"] },
    { icon: User, label: "Student Portal", path: "/student-portal", roles: ["parent", "student"] },
    { icon: Calendar, label: "Timetable", path: "/timetable", roles: ["school_admin", "teacher"] },
    { icon: Package, label: "Inventory", path: "/inventory", roles: ["school_admin"] },
  ];

  const visibleItems = menuItems.filter(item => item.roles.includes(user?.role));

  return (
    <div className="flex h-screen bg-[#0B1120]">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#111827] border-r border-[#1E293B] transform transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#1E293B]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Smart-M Hub</span>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)} data-testid="close-sidebar-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="p-3 space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 140px)" }}>
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(/[\s/]/g, "-")}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                  isActive
                    ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#1A2332] border border-transparent"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#1E293B]">
          <div className="mb-3 px-1">
            <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            onClick={handleLogout}
            data-testid="logout-btn"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-[#111827] border-b border-[#1E293B] flex items-center justify-between px-5 lg:px-8 gap-4">
          <button className="lg:hidden flex-shrink-0 text-slate-400 hover:text-white" onClick={() => setSidebarOpen(true)} data-testid="open-sidebar-btn">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-sm lg:text-base font-medium text-slate-300 truncate flex-1">
            Welcome, {user?.full_name}
          </h1>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              {user?.role?.replace("_", " ")}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
