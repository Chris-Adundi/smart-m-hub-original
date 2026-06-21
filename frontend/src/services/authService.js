// =========================
// FRONTEND AUTH SERVICE (FINAL CLEAN)
// =========================

const TOKEN_KEY = "smart_m_hub_token";
const USER_KEY = "smart_m_hub_user";

// =========================
// SAFE PARSE
// =========================
function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// =========================
// ROLE NORMALIZER (SINGLE SOURCE OF TRUTH STYLE)
// =========================
function normalizeRole(role) {
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
}

// =========================
// AUTH SERVICE
// =========================
export const authService = {
  setAuth(token, user) {
    if (!token || !user) return;

    if (token === "undefined" || token === "null") return;

    const safeUser = {
      ...user,
      role: normalizeRole(user?.role),
      school_id: user?.school_id ? String(user.school_id) : null,
    };

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(safeUser));
  },

  getToken() {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token || token === "undefined" || token === "null") {
      return null;
    }

    return token;
  },

  getUser() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? safeParse(raw) : null;
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  getRole() {
    const user = this.getUser();
    return normalizeRole(user?.role);
  },

  isAdmin() {
    const role = this.getRole();
    return role === "school_admin" || role === "super_admin";
  },

  isSuperAdmin() {
    return this.getRole() === "super_admin";
  },

  isTeacher() {
    return this.getRole() === "teacher";
  },

  isFinance() {
    return this.getRole() === "finance";
  },

  isSecretary() {
    return this.getRole() === "secretary";
  },

  isStudent() {
    return this.getRole() === "student";
  },

  isParent() {
    return this.getRole() === "student";
  },

  getSchoolId() {
    const user = this.getUser();
    const id = user?.school_id;
    return id ? String(id) : null;
  },
};