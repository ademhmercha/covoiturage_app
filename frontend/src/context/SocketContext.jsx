import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import useAuthStore from "../store/authStore";
import useToastStore from "../store/toastStore";
import { SocketContext } from "./useSocket";

/**
 * Connexion Socket.IO unique pour toute l'application, créée uniquement
 * lorsque l'utilisateur est authentifié. L'authentification se fait via le
 * cookie httpOnly `access_token` (envoyé automatiquement grâce à
 * `withCredentials`) — jamais de jeton transmis dans l'URL ou le payload JS.
 */
export function SocketProvider({ children }) {
  const status = useAuthStore((state) => state.status);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const incrementUnread = useToastStore((s) => s.incrementUnread);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (status !== "authenticated") {
      return undefined;
    }

    const instance = io(import.meta.env.VITE_API_URL, {
      withCredentials: true,
    });

    instance.on("notification:new", () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });

    instance.on("message:new", (message) => {
      queryClient.invalidateQueries({ queryKey: ["messages", message.bookingId] });

      incrementUnread();
      const senderName = message.senderName || "";
      let preview = "Nouveau message";
      if (message.type === "AUDIO") preview = "🎤 Message vocal";
      else if (message.type === "IMAGE") preview = "📷 Photo";
      else if (message.preview) preview = message.preview.slice(0, 60);

      addToast({
        message: senderName ? `${senderName} : ${preview}` : preview,
        type: "info",
        duration: 5000,
        action: {
          label: "Voir",
          onClick: () => navigate(`/bookings/${message.bookingId}`),
        },
      });
    });

    // Mise à jour des accusés de lecture côté expéditeur.
    instance.on("messages:seen", ({ bookingId }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", bookingId] });
    });

    // Appel entrant global : toast avec navigation vers la conversation.
    instance.on("call:incoming", ({ bookingId }) => {
      addToast({
        message: "📞 Appel entrant",
        type: "info",
        duration: 30000,
        action: bookingId
          ? { label: "Répondre", onClick: () => navigate(`/bookings/${bookingId}`) }
          : undefined,
      });
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(instance);

    return () => {
      instance.disconnect();
      setSocket(null);
    };
  }, [status, queryClient, addToast, incrementUnread, navigate]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
