// =========================
// ROLE ROUTE MAPPER (CLEAN + SCALABLE)
// =========================

// =========================
// ROLE NORMALIZER
// =========================
const normalizeRole = (role) => {
  if (!role) return "";
  return String(role)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
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
