export const adminSessionCookieName = "admin_session";
export const userRoleCookieName = "user_role";

const browserBackendApiUrl =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:4000";

const serverBackendApiUrl =
  process.env.BACKEND_URL || browserBackendApiUrl;

export const backendApiUrl =
  typeof window === "undefined" ? serverBackendApiUrl : browserBackendApiUrl;
