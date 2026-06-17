import apiClient from "./client";

export function updateProfile(payload) {
  return apiClient.patch("/api/users/me", payload).then((res) => res.data);
}

export function changePassword(payload) {
  return apiClient.post("/api/users/me/password", payload).then((res) => res.data);
}

export function getPublicProfile(userId) {
  return apiClient.get(`/api/users/${userId}`).then((res) => res.data);
}

export function uploadAvatar(base64DataUri) {
  return apiClient.patch("/api/users/me/avatar", { avatar: base64DataUri }).then((res) => res.data);
}
