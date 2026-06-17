import apiClient from "./client";

export function register(payload) {
  return apiClient.post("/api/auth/register", payload).then((res) => res.data);
}

export function login(payload) {
  return apiClient.post("/api/auth/login", payload).then((res) => res.data);
}

export function logout() {
  return apiClient.post("/api/auth/logout").then((res) => res.data);
}

export function fetchMe() {
  return apiClient.get("/api/auth/me").then((res) => res.data);
}
