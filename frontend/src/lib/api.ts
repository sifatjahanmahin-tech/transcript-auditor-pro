import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("audit_pro_token");
}

export function setToken(token: string): void {
  localStorage.setItem("audit_pro_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("audit_pro_token");
}

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      window.location.href = "/auth/signin";
    }
    return Promise.reject(error);
  }
);

export default api;
