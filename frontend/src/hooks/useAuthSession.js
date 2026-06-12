import { useMemo } from "react";
import { authService } from "@/App";

// =========================
// ROLE NORMALIZER (SINGLE SOURCE OF TRUTH)
// =========================
const normalizeRole = (role) => {
  if (!role) return "";

  return String(role)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
};

// =========================
// AUTH SESSION HOOK
// =========================
export const useAuthSession = () => {
  const user = authService.getUser();
  const token = authService.getToken();

  const role = useMemo(() => {
    return normalizeRole(user?.role);
  }, [user]);

  const isAuthenticated = !!token;

  const permissions = useMemo(() => {
    return {
      isAdmin: role === "school_admin",
      isSuperAdmin: role === "super_admin",
      isTeacher: role === "teacher",
      isFinance: role === "finance",
      isSecretary: role === "secretary",
      isStudent: role === "student",
      isParent: role === "parent",
    };
  }, [role]);

  return {
    user,
    role,
    token,
    isAuthenticated,
    ...permissions,
  };
};