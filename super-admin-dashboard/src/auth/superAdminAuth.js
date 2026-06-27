export function getAuthToken() {
return localStorage.getItem("access_token");
}

export function getCurrentUser() {
try {
const user = localStorage.getItem("current_user");
return user ? JSON.parse(user) : null;
} catch {
return null;
}
}

export function isAuthenticated() {
return Boolean(getAuthToken());
}

export function isSuperAdmin() {
const user = getCurrentUser();

if (!user) return false;

const role = (
user.role ||
user.user_role ||
user.account_type ||
""
).toString().toLowerCase();

return [
"super_admin",
"superadmin",
"platform_admin",
"platformadmin",
].includes(role);
}

export function hasRole(...roles) {
const user = getCurrentUser();

if (!user) return false;

const role = (
user.role ||
user.user_role ||
user.account_type ||
""
).toString().toLowerCase();

return roles.map((r) => r.toLowerCase()).includes(role);
}

export function logout() {
localStorage.removeItem("access_token");
localStorage.removeItem("refresh_token");
localStorage.removeItem("current_user");
}
