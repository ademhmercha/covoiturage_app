import apiClient from "./client";

export function createBooking(payload) {
  return apiClient.post("/api/bookings", payload).then((res) => res.data);
}

export function getMyBookings() {
  return apiClient.get("/api/bookings/mine").then((res) => res.data);
}

export function getConversations() {
  return apiClient.get("/api/bookings/conversations").then((res) => res.data);
}

export function getTripBookings(tripId) {
  return apiClient.get(`/api/bookings/trip/${tripId}`).then((res) => res.data);
}

export function getBooking(bookingId) {
  return apiClient.get(`/api/bookings/${bookingId}`).then((res) => res.data);
}

export function updateBookingStatus(bookingId, status) {
  return apiClient.patch(`/api/bookings/${bookingId}/status`, { status }).then((res) => res.data);
}

export function createRating(bookingId, payload) {
  return apiClient.post(`/api/bookings/${bookingId}/rating`, payload).then((res) => res.data);
}

export function getBookingRating(bookingId) {
  return apiClient.get(`/api/bookings/${bookingId}/rating`).then((res) => res.data);
}
