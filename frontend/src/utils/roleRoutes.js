// =========================
// ROLE ROUTE MAPPER (CLEAN + SCALABLE)
// =========================

// =========================
// ROLE NORMALIZER
// =========================
export const normalizeRole = (role) => {
  if (!role) return "";
  const r = String(role)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases = {
    admin: "school_admin",
    schooladmin: "school_admin",
    superadmin: "super_admin",
    guardian: "parent",
  };
  return aliases[r] || r;
};

// =========================
// CENTRAL ROLE ROUTE MAP
// =========================
const ROLE_ROUTES = {
  super_admin: "/app/dashboard",
  school_admin: "/app/dashboard",
  teacher: "/app/teacher-portal",
  finance: "/app/finance-portal",
  secretary: "/app/secretary-portal",
  supporting_staff: "/app/dashboard",
  student: "/app/student-portal",
  parent: "/app/student-portal",
};

// =========================
// GET ROLE ROUTE
// =========================
export const getRoleRoute = (role) => {
  const r = normalizeRole(role);

  if (!r) return "/login";

  return ROLE_ROUTES[r] || "/login";
};

export const getDefaultRouteByRole = (role) => getRoleRoute(role);

export const routePermissions = {
  school_profile: ["super_admin", "school_admin"],
  dashboard: ["super_admin", "school_admin", "teacher", "finance", "secretary", "supporting_staff"],
  students: ["super_admin", "school_admin", "secretary", "teacher", "finance"],
  staff: ["super_admin", "school_admin"],
  fees: ["super_admin", "school_admin", "finance"],
  attendance: ["super_admin", "school_admin", "teacher", "secretary"],
  exams: ["super_admin", "school_admin", "teacher"],
  assessments: ["super_admin", "school_admin", "teacher"],
  timetable: ["super_admin", "school_admin", "teacher", "student"],
  inventory: ["super_admin", "school_admin", "secretary"],
  announcements: ["super_admin", "school_admin", "secretary", "teacher", "finance", "student", "parent"],
  support: ["school_admin", "teacher", "finance", "secretary", "student", "parent"],
  "teacher-portal": ["super_admin", "school_admin", "teacher"],
  "finance-portal": ["super_admin", "school_admin", "finance"],
  "secretary-portal": ["super_admin", "school_admin", "secretary"],
  "student-portal": ["super_admin", "student", "parent"],
};

export const canAccessRoute = (role, routeKey) => {
  const normalized = normalizeRole(role);
  return Boolean(normalized && (routePermissions[routeKey] || []).includes(normalized));
};
