import apiClient from "./client";

// Géocodage inverse : proxy backend vers Nominatim (cf. backend/src/routes/geocode.js).
// Aucun appel direct à un service tiers depuis le navigateur (CSP `connect-src 'self' wss:`).
export function reverseGeocode(lat, lng) {
  return apiClient.get("/api/geocode/reverse", { params: { lat, lng } }).then((res) => res.data);
}
