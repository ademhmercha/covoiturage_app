import apiClient from "./client";

export function getNotifications(params) {
  return apiClient.get("/api/notifications", { params }).then((res) => res.data);
}

export function getUnreadCount() {
  return apiClient.get("/api/notifications/unread-count").then((res) => res.data);
}

export function markNotificationRead(notificationId) {
  return apiClient.patch(`/api/notifications/${notificationId}/read`).then((res) => res.data);
}

export function markAllNotificationsRead() {
  return apiClient.patch("/api/notifications/read-all").then((res) => res.data);
}
