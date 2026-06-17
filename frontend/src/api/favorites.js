import apiClient from "./client";

export function getFavorites() {
  return apiClient.get("/api/favorites").then((res) => res.data);
}

export function addFavorite(fromCity, toCity) {
  return apiClient.post("/api/favorites", { fromCity, toCity }).then((res) => res.data);
}

export function removeFavorite(favoriteId) {
  return apiClient.delete(`/api/favorites/${favoriteId}`).then((res) => res.data);
}
