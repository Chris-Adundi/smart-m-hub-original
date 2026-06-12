import { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";
import axios from "axios";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";

import { authService, API } from "@/App";

import {
  GraduationCap,
  Building2,
  BookOpen,
  CreditCard,
  Users,
  FileText,
  ArrowLeft,
  Eye,
  EyeOff,
  Shield,
} from "lucide-react";

// ========================================
// ROLE CONFIG
// ========================================

const roles = [
  {
    key: "school_admin",
    label: "School Admin",
    desc: "Full school management access",
    icon: Building2,
  },

  {
    key: "teacher",
    label: "Teacher",
    desc: "Academics, attendance & results",
    icon: BookOpen,
  },

  {
    key: "finance",
    label: "Finance / Accounts",
    desc: "Fee collection & financial records",
    icon: CreditCard,
  },

  {
    key: "secretary",
    label: "Secretary",
    desc: "Student records & announcements",
    icon: FileText,
  },

  {
    key: "student",
    label: "Student / Parent",
    desc: "View records, fees & results",
    icon: Users,
  },
];

// ========================================
// ROLE NORMALIZER
// ========================================

const normalizeRole = (role) => {
  if (!role) return "";

  const r = String(role).trim().toLowerCase();

  const roleMap = {
    // SCHOOL ADMIN
    admin: "school_admin",
    schooladmin: "school_admin",
    school_admin: "school_admin",
    "school-admin": "school_admin",

    // SUPER ADMIN
    superadmin: "super_admin",
    super_admin: "super_admin",
    "super-admin": "super_admin",

    // OTHER ROLES
    teacher: "teacher",

    finance: "finance",
    accounts: "finance",
    accountant: "finance",

    secretary: "secretary",

    student: "student",

    parent: "student",
    guardian: "student",
  };

  return roleMap[r] || "";
};

// ========================================
// REDIRECT HANDLER
// ========================================

const getRedirectPath = (role) => {
  switch (normalizeRole(role)) {
    case "student":
      return "/app/student-portal";

    case "teacher":
      return "/app/teacher-portal";

    case "finance":
      return "/app/finance-portal";

    case "secretary":
      return "/app/secretary-portal";

    case "super_admin":
      return "/app/super-admin";

    case "school_admin":
    default:
      return "/app/dashboard";
  }
};

// ========================================
// COMPONENT
// ========================================

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // ========================================
  // STATE
  // ========================================

  const [selectedRole, setSelectedRole] = useState(
    normalizeRole(location.state?.role || "")
    );

    useEffect(() => {
      const urlRole = new URLSearchParams(location.search).get("role");

      if (urlRole && !selectedRole) {
        setSelectedRole(normalizeRole(urlRole));
      }
    }, [location.search]);

  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const query = new URLSearchParams(location.search);
  const joinCode = query.get("code");
  const params = useParams();

const schoolSlug =
  params.schoolname ||
  params.inviteCode;
  // ========================================
  // AUTO REDIRECT
  // ========================================

  useEffect(() => {
    const token = authService.getToken();
    const user = authService.getUser();

    if (token && user?.role) {
      navigate(getRedirectPath(user.role), {
        replace: true,
      });
    }
  }, [navigate]);

  // ========================================
  // HELPERS
  // ========================================

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const selectedRoleData = useMemo(() => {
    return roles.find((r) => r.key === selectedRole);
  }, [selectedRole]);

  // ========================================
  // LOGIN SUBMIT
  // ========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    // ========================================
    // VALIDATION
    // ========================================

    const finalRole = normalizeRole(
      selectedRole || location.state?.role || ""
    );

    if (!finalRole) {
      toast.error("Please select a role");
      return;
    }

    if (!formData.email?.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!formData.password?.trim()) {
      toast.error("Password is required");
      return;
    }

    // ========================================
    // PASSWORD CLEANUP
    // ========================================

    const cleanPassword = String(
      formData.password
    ).trim();

    // bcrypt safety limit
    if (
      new TextEncoder().encode(cleanPassword)
        .length > 72
    ) {
      toast.error("Password is too long");
      return;
    }

    setLoading(true);

    try {
      // ========================================
      // LOGIN REQUEST
      // ========================================

      const response = await axios.post(
        `${API}/auth/login`,
        {
          email: formData.email
            .trim()
            .toLowerCase(),

          password: cleanPassword,
        },
        {
          timeout: 15000,
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );

      // ========================================
      // RESPONSE EXTRACTION
      // ========================================

      const responseData = response?.data || {};

      const token =
        responseData.access_token ||
        responseData.token ||
        responseData.jwt ||
        null;

      if (!token) {
        throw new Error(
          "Authentication token missing"
        );
      }

      // ========================================
      // SAFE USER OBJECT
      // ========================================

      const backendUser =
        responseData.user || {};

      const normalizedBackendRole =
        normalizeRole(
          backendUser.role ||
            backendUser.user_role
        );

      const approvalStatus =
        backendUser.approval_status ||
        backendUser.status ||
        "approved";

      const safeUser = {
        id:
          backendUser.id ||
          backendUser.user_id ||
          backendUser._id ||
          null,

        email:
          backendUser.email ||
          formData.email
            .trim()
            .toLowerCase(),

        full_name:
          backendUser.full_name ||
          backendUser.name ||
          "User",

        role: normalizedBackendRole,

        school_id:
          backendUser.school_id ||
          backendUser.schoolId ||
          backendUser.school ||
          null,

        school_name:
          backendUser.school_name ||
          backendUser.schoolName ||
          "",

        school_code:
          backendUser.school_code ||
          backendUser.schoolCode ||
          "",

        approval_status:
          approvalStatus,

        is_active:
          backendUser.is_active !== false,
      };

      // ========================================
      // SAFETY VALIDATION
      // ========================================

      if (!safeUser.role) {
        throw new Error("User role missing");
      }

      // ========================================
      // ROLE MATCH CHECK
      // ========================================

      if (
        selectedRole &&
        safeUser.role !== finalRole &&
        !(
          finalRole === "student" &&
          safeUser.role === "student"
        )
      ) {
        toast.error(
          `This account belongs to ${safeUser.role.replace(
            "_",
            " "
          )}`
        );
        return;
      }

      // ========================================
      // ACCOUNT STATUS CHECKS
      // ========================================

      if (approvalStatus === "blocked") {
        toast.error(
          "Your account has been blocked"
        );
        return;
      }

      if (approvalStatus === "rejected") {
        toast.error(
          "Your login request was rejected"
        );
        return;
      }

      if (
        approvalStatus === "pending" &&
        safeUser.role !== "school_admin" &&
        safeUser.role !== "super_admin"
      ) {
        toast.error(
          "Your account is awaiting approval"
        );
        return;
      }

      if (safeUser.is_active === false) {
        toast.error(
          "Your account is inactive"
        );
        return;
      }

      // ========================================
      // SCHOOL CONTEXT VALIDATION
      // ========================================

      if (
        !safeUser.school_id &&
        safeUser.role !== "super_admin"
      ) {
        toast.error(
          "Missing school context. Contact administrator."
        );
        return;
      }

      // ========================================
      // SAVE AUTH
      // ========================================

      authService.setAuth(
        String(token),
        safeUser
      );

      // ========================================
      // SUCCESS
      // ========================================

      toast.success(
        `Welcome ${
          safeUser.full_name || "User"
        }`
      );

      // ========================================
      // FORCE AUTH EVENT
      // ========================================

      window.dispatchEvent(
        new Event("auth-change")
      );

      // ========================================
      // REDIRECT
      // ========================================

      const redirectPath = getRedirectPath(safeUser.role);

      const finalRedirect =
        joinCode && schoolSlug
          ? `${redirectPath}?code=${joinCode}`
          : redirectPath;

      navigate(finalRedirect, {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Login failed";

      toast.error(String(detail));
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // UI
  // ========================================

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* HEADER */}
        <div className="text-center mb-8">

          <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mb-4">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-white">
            Smart-M Hub
          </h1>

          <p className="text-slate-400 mt-2">
            {selectedRole
              ? `Logging in as ${
                  selectedRoleData?.label ||
                  "User"
                }`
              : "Select how you want to sign in"}
          </p>

        </div>

        {/* ROLE SELECT */}
        {!selectedRole ? (
          <div className="space-y-3">

            {roles.map((role) => {
              const Icon = role.icon;

              return (
                <button
                  key={role.key}
                  type="button"
                  onClick={() =>
                    setSelectedRole(role.key)
                  }
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#1A2332] border border-[#1E3A4F]/40 hover:border-emerald-500/40 transition-all"
                >

                  <div className="w-10 h-10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-emerald-400" />
                  </div>

                  <div className="text-left">

                    <p className="text-white font-medium">
                      {role.label}
                    </p>

                    <p className="text-slate-500 text-sm">
                      {role.desc}
                    </p>

                  </div>

                </button>
              );
            })}

          </div>
        ) : (
          <div className="bg-[#1A2332] border border-[#1E3A4F]/40 rounded-2xl p-8">

            {/* SELECTED ROLE */}
            <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-[#101826] border border-white/5">

              <Shield className="w-5 h-5 text-emerald-400" />

              <div>
                <p className="text-white text-sm font-medium">
                  {selectedRoleData?.label}
                </p>

                <p className="text-slate-500 text-xs">
                  Secure portal access
                </p>
              </div>

            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              {/* EMAIL */}
              <div>

                <Label className="text-slate-300 mb-2 block">
                  Email
                </Label>

                <Input
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) =>
                    updateField(
                      "email",
                      e.target.value
                    )
                  }
                  required
                />

              </div>

              {/* PASSWORD */}
              <div>

                <Label className="text-slate-300 mb-2 block">
                  Password
                </Label>

                <div className="relative">

                  <Input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={(e) =>
                      updateField(
                        "password",
                        e.target.value
                      )
                    }
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >

                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}

                  </button>

                </div>

              </div>

              {/* SUBMIT */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading
                  ? "Signing in..."
                  : "Sign In"}
              </Button>

            </form>

            {/* BACK */}
            <div className="mt-5 text-center">

              <button
                type="button"
                onClick={() =>
                  setSelectedRole("")
                }
                className="text-slate-400 hover:text-white text-sm"
              >

                <ArrowLeft className="w-3 h-3 inline mr-1" />

                Back to role selection

              </button>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default LoginPage;