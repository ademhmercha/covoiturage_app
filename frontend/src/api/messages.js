import apiClient from "./client";

export function getMessages(bookingId, params) {
  return apiClient.get(`/api/bookings/${bookingId}/messages`, { params }).then((res) => res.data);
}

export function sendMessage(bookingId, content) {
  return apiClient.post(`/api/bookings/${bookingId}/messages`, { type: "TEXT", content }).then((res) => res.data);
}

export function sendVoiceMessage(bookingId, dataUri) {
  return apiClient
    .post(`/api/bookings/${bookingId}/messages`, { type: "AUDIO", content: dataUri })
    .then((res) => res.data);
}

export function sendImageMessage(bookingId, dataUri) {
  return apiClient
    .post(`/api/bookings/${bookingId}/messages`, { type: "IMAGE", content: dataUri })
    .then((res) => res.data);
}
