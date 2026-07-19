import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { authService, apiClient, formatApiError } from "@/App";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";

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
    key: "supporting_staff",
    label: "Supporting Staff",
    desc: "Restricted school access",
    icon: Users,
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
    supporting_staff: "supporting_staff",

    student: "student",

    parent: "student",
    guardian: "student",
  };

  return roleMap[r] || "";
};

const SCHOOL_CODE_PATTERN = /^(SMH-KE-\d{6}|SMH-[A-Z0-9]{8,12})$/;

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

    case "supporting_staff":
      return "/app/dashboard";

    case "super_admin":
      return "/app/dashboard";

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
  
  const [selectedRole, setSelectedRole] = useState(
  normalizeRole(location.state?.role || "")
);
  // ========================================
  // STATE
  // ========================================

  useEffect(() => {
  const urlRole = new URLSearchParams(location.search).get("role");

  if (urlRole && !selectedRole) {
    setSelectedRole(normalizeRole(urlRole));
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [location.search]);

  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    school_code: new URLSearchParams(location.search).get("school") || "",
    email: "",
    password: "",
    admission_number: "",
    student_access_code: "",
  });
  const [resetMode, setResetMode] = useState(false);
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetForm, setResetForm] = useState({
    email: "",
    school_code: "",
    code: "",
    new_password: "",
  });
  const [resolvedSchool, setResolvedSchool] = useState(null);
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
  const handler = () => {
    const token = authService.getToken();
    const user = authService.getUser();

    if (token && user?.role) {
      navigate(getRedirectPath(user.role), {
        replace: true,
      });
    }
  };

  handler();
  window.addEventListener("auth-change", handler);

  return () => window.removeEventListener("auth-change", handler);
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

const selectedRoleData = roles.find(
  (r) => r.key === selectedRole
);

  useEffect(() => {
    const schoolCode = formData.school_code.trim().toUpperCase();

    if (!SCHOOL_CODE_PATTERN.test(schoolCode)) {
      setResolvedSchool(null);
      return;
    }

    let active = true;
    const resolveSchool = async () => {
      try {
        const response = await apiClient.get(
          `/public/schools/resolve/${encodeURIComponent(schoolCode)}`
        );
        if (active) setResolvedSchool(response?.data?.data || null);
      } catch {
        if (active) setResolvedSchool(null);
      }
    };

    resolveSchool();
    return () => {
      active = false;
    };
  }, [formData.school_code]);
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

    if (
      finalRole !== "super_admin" &&
      !SCHOOL_CODE_PATTERN.test(formData.school_code.trim().toUpperCase())
    ) {
      toast.error("Enter a valid school code, for example SMH-AB12CD34EF");
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

      const response = await apiClient.post(
        "/auth/login",
        {
          email: formData.email.trim().toLowerCase(),
          password: cleanPassword,
          school_code:
            finalRole === "super_admin"
              ? null
              : formData.school_code.trim().toUpperCase(),
          admission_number:
            finalRole === "student" && formData.admission_number.trim()
              ? formData.admission_number.trim()
              : null,
          student_access_code:
            finalRole === "student" && formData.student_access_code.trim()
              ? formData.student_access_code.trim().toUpperCase()
              : null,
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

        school_branding:
          backendUser.school_branding ||
          responseData.school ||
          resolvedSchool ||
          null,

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

      toast.error(formatApiError(error, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (event) => {
    event.preventDefault();
    try {
      const response = await apiClient.post("/auth/forgot-password", {
        email: resetForm.email.trim().toLowerCase(),
        school_code: resetForm.school_code.trim().toUpperCase() || null,
      });
      setResetCodeSent(true);
      const devCode = response?.data?.reset_code;
      toast.success(devCode ? `Verification code: ${devCode}` : "Verification code sent if the account details are valid");
    } catch (error) {
      toast.error(formatApiError(error, "Failed to request reset code"));
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    try {
      await apiClient.post("/auth/reset-password", {
        email: resetForm.email.trim().toLowerCase(),
        school_code: resetForm.school_code.trim().toUpperCase() || null,
        code: resetForm.code.trim(),
        new_password: resetForm.new_password,
      });
      toast.success("Password reset. You can now sign in with the new password.");
      setResetMode(false);
      setResetCodeSent(false);
      setResetForm({ email: "", school_code: "", code: "", new_password: "" });
    } catch (error) {
      toast.error(formatApiError(error, "Failed to reset password"));
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

          <div
            className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 overflow-hidden"
            style={{ backgroundColor: resolvedSchool?.theme?.primary || "#059669" }}
          >
            {resolvedSchool?.logo_url ? (
              <img
                src={resolvedSchool.logo_url}
                alt={`${resolvedSchool.name} logo`}
                className="w-full h-full object-contain"
              />
            ) : (
              <GraduationCap className="w-10 h-10 text-white" />
            )}
          </div>

          <h1 className="text-3xl font-bold text-white">
            {resolvedSchool?.name || "Smart-M Hub"}
          </h1>

          <p className="text-slate-400 mt-2">
            {resolvedSchool?.motto ||
            (selectedRole
              ? `Logging in as ${
                  selectedRoleData?.label ||
                  "User"
                }`
              : "Select how you want to sign in")}
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

            {resetMode ? (
              <form
                onSubmit={resetCodeSent ? handleResetPassword : handleRequestReset}
                className="space-y-5"
              >
                <div>
                  <Label className="text-slate-300 mb-2 block">School Code</Label>
                  <Input
                    placeholder="SMH-AB12CD34EF"
                    value={resetForm.school_code}
                    onChange={(e) => setResetForm({ ...resetForm, school_code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <Label className="text-slate-300 mb-2 block">Email</Label>
                  <Input
                    type="email"
                    value={resetForm.email}
                    onChange={(e) => setResetForm({ ...resetForm, email: e.target.value })}
                    required
                  />
                </div>
                {resetCodeSent && (
                  <>
                    <div>
                      <Label className="text-slate-300 mb-2 block">Verification Code</Label>
                      <Input
                        value={resetForm.code}
                        onChange={(e) => setResetForm({ ...resetForm, code: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-2 block">New Password</Label>
                      <Input
                        type="password"
                        value={resetForm.new_password}
                        onChange={(e) => setResetForm({ ...resetForm, new_password: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}
                <Button type="submit" className="w-full">
                  {resetCodeSent ? "Change Password" : "Send Verification Code"}
                </Button>
                <button
                  type="button"
                  onClick={() => setResetMode(false)}
                  className="w-full text-slate-400 hover:text-white text-sm"
                >
                  Back to sign in
                </button>
              </form>
            ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              {selectedRole !== "super_admin" && (
                <div>
                  <Label className="text-slate-300 mb-2 block">
                    School Code
                  </Label>
                  <Input
                    placeholder="SMH-AB12CD34EF"
                    value={formData.school_code}
                    onChange={(e) =>
                      updateField("school_code", e.target.value.toUpperCase())
                    }
                    required
                  />
                  {formData.school_code && !resolvedSchool && (
                    <p className="text-xs text-amber-400 mt-2">
                      Enter a valid active school code.
                    </p>
                  )}
                </div>
              )}

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

              {selectedRole === "student" && (
                <div>
                  <Label className="text-slate-300 mb-2 block">
                    Admission Number or Student Access Code
                  </Label>
                  <Input
                    placeholder="ADM-00001 or STU-XXXXXXXX"
                    value={formData.student_access_code || formData.admission_number}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      if (value.toUpperCase().startsWith("STU-")) {
                        updateField("student_access_code", value.toUpperCase());
                        updateField("admission_number", "");
                      } else {
                        updateField("admission_number", value);
                        updateField("student_access_code", "");
                      }
                    }}
                  />
                </div>
              )}

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

              {selectedRole === "student" && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                  <p className="text-sm text-slate-300">
                    Parent or guardian access needed?
                  </p>
                  <Link
                    to={`/join-school${formData.school_code ? `?school=${encodeURIComponent(formData.school_code.trim().toUpperCase())}` : ""}`}
                    className="mt-2 inline-flex text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                  >
                    Request parent/guardian access
                  </Link>
                </div>
              )}

            </form>
            )}

            {/* BACK */}
            <div className="mt-5 text-center">
              {!resetMode && (
                <button
                  type="button"
                  onClick={() => setResetMode(true)}
                  className="block w-full mb-3 text-slate-400 hover:text-white text-sm"
                >
                  Forgot password?
                </button>
              )}

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
