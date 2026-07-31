import { API } from "@/App";

const backendOrigin = API.replace(/\/api\/?$/, "");

export const resolveMediaUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("/")) return `${backendOrigin}${url}`;
  return url;
};
