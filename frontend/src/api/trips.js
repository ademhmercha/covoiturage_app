import apiClient from "./client";

export function searchTrips(params) {
  return apiClient.get("/api/trips", { params }).then((res) => res.data);
}

export function getTrip(tripId) {
  return apiClient.get(`/api/trips/${tripId}`).then((res) => res.data);
}

export function getMyTrips() {
  return apiClient.get("/api/trips/mine").then((res) => res.data);
}

export function createTrip(payload) {
  return apiClient.post("/api/trips", payload).then((res) => res.data);
}

export function updateTrip(tripId, payload) {
  return apiClient.patch(`/api/trips/${tripId}`, payload).then((res) => res.data);
}

export function cancelTrip(tripId) {
  return apiClient.delete(`/api/trips/${tripId}`).then((res) => res.data);
}
