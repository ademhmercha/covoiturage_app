import axios from "axios";

// `withCredentials: true` : les cookies httpOnly (access_token / refresh_token)
// sont envoyés automatiquement par le navigateur. Le JS n'a jamais accès aux
// jetons (jamais de stockage en localStorage/sessionStorage).
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Endpoints d'authentification exclus du flux de rafraîchissement automatique
// (éviter une boucle infinie si /refresh lui-même échoue avec 401).
const NO_REFRESH_PATHS = ["/api/auth/refresh", "/api/auth/login", "/api/auth/register", "/api/auth/logout"];

let authLostHandler = null;

/**
 * Permet au store d'authentification de réagir lorsque la session ne peut
 * plus être restaurée (refresh token expiré/révoqué/réutilisé).
 */
export function setOnAuthLost(handler) {
  authLostHandler = handler;
}

function isNoRefreshPath(url = "") {
  return NO_REFRESH_PATHS.some((path) => url.includes(path));
}

// Une seule requête de rafraîchissement à la fois : les appels concurrents
// qui échouent en 401 attendent la même promesse plutôt que de déclencher
// plusieurs POST /api/auth/refresh.
let refreshPromise = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    if (!response || !config || isNoRefreshPath(config.url || "")) {
      return Promise.reject(error);
    }

    const code = response.data?.error?.code;
    const isAuthError = response.status === 401 && (code === "UNAUTHENTICATED" || code === "INVALID_TOKEN");

    if (!isAuthError || config._retried) {
      return Promise.reject(error);
    }
    config._retried = true;

    if (!refreshPromise) {
      refreshPromise = apiClient
        .post("/api/auth/refresh")
        .catch((refreshError) => {
          authLostHandler?.();
          throw refreshError;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    await refreshPromise;
    return apiClient(config);
  }
);

export default apiClient;
