// =========================
// FRONTEND AUTH SERVICE
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
// NORMALIZE ROLE (MATCH BACKEND)
// =========================
function normalizeRole(role) {
  if (!role) return "";
  return String(role).trim().toLowerCase().replace(/\s+/g, "_");
}

// =========================
// SAVE AUTH
// =========================
export const authService = {
  setAuth(token, user) {
    if (!token || !user) return;

    // ensure consistent storage shape
    const safeUser = {
      ...user,
      role: normalizeRole(user.role),
      school_id: user.school_id ? String(user.school_id) : null,
    };

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(safeUser));
  },

  // =========================
  // GET TOKEN
  // =========================
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  // =========================
  // GET USER
  // =========================
  getUser() {
    const user = localStorage.getItem(USER_KEY);
    return user ? safeParse(user) : null;
  },

  // =========================
  // CHECK LOGIN
  // =========================
  isAuthenticated() {
    return !!this.getToken();
  },

  // =========================
  // CLEAR AUTH
  // =========================
  clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  // =========================
  // ROLE HELPERS
  // =========================
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
    return this.getRole() === "parent";
  },

  // =========================
  // SCHOOL CONTEXT (CRITICAL FIX)
  // =========================
  getSchoolId() {
    const user = this.getUser();
    const id = user?.school_id;

    if (!id) return null;

    return String(id);
  },
};