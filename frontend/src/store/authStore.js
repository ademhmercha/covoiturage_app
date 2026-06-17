import { create } from "zustand";

import { fetchMe, login as loginRequest, logout as logoutRequest, register as registerRequest } from "../api/auth";
import { setOnAuthLost } from "../api/client";

// `status` distingue "on ne sait pas encore" (idle/loading) de "on sait que
// l'utilisateur n'est pas connecté" (unauthenticated) : nécessaire car le
// seul moyen de connaître l'état d'authentification est d'appeler /api/auth/me
// (les jetons sont des cookies httpOnly, illisibles en JS).
const useAuthStore = create((set) => ({
  user: null,
  status: "idle",

  async init() {
    set({ status: "loading" });
    try {
      const { user } = await fetchMe();
      set({ user, status: "authenticated" });
    } catch {
      set({ user: null, status: "unauthenticated" });
    }
  },

  async login(credentials) {
    const { user } = await loginRequest(credentials);
    set({ user, status: "authenticated" });
    return user;
  },

  async register(payload) {
    const { user } = await registerRequest(payload);
    set({ user, status: "authenticated" });
    return user;
  },

  async logout() {
    try {
      await logoutRequest();
    } finally {
      set({ user: null, status: "unauthenticated" });
    }
  },

  setUser(user) {
    set({ user });
  },

  clear() {
    set({ user: null, status: "unauthenticated" });
  },
}));

// Si le rafraîchissement de session échoue (refresh token expiré, révoqué ou
// réutilisé), l'API client signale la perte de session pour que le store se
// remette à "unauthenticated" et que l'UI redirige vers /login.
setOnAuthLost(() => useAuthStore.getState().clear());

export default useAuthStore;
