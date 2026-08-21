export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
export const API_ROOT = API_URL.replace(/\/api\/?$/, "");

export function getImageUrl(path) {
  if (!path) return "";
  const value = String(path).trim();
  if (!value) return "";
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("blob:") || value.startsWith("data:")) return value;
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${API_ROOT}/${normalized}`;
}

export function getToken() {
  return localStorage.getItem("hotel_park_plaza_token");
}

export function setToken(token) {
  localStorage.setItem("hotel_park_plaza_token", token);
}

export function clearToken() {
  localStorage.removeItem("hotel_park_plaza_token");
}

export async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || "Error de comunicacion con el servidor");
    error.status = response.status;
    error.details = data?.details;
    throw error;
  }
  return data;
}
