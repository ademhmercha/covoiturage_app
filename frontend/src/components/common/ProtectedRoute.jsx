import { Navigate, Outlet, useLocation } from "react-router-dom";

import useAuthStore from "../../store/authStore";
import LoadingScreen from "./LoadingScreen";

/**
 * Protège les routes nécessitant une session valide. L'état d'authentification
 * n'est connu qu'après l'appel initial à /api/auth/me (cookies httpOnly,
 * illisibles côté client) — on affiche un écran de chargement tant que cet
 * appel n'a pas répondu.
 */
export default function ProtectedRoute() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === "idle" || status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
