import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../context/useSocket";

const STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/**
 * Gère une session d'appel audio WebRTC via Socket.IO comme canal de
 * signalisation. Flux : request → accept → offer/answer → ICE → connexion.
 *
 * @param {object} params
 * @param {string} params.myId        - ID de l'utilisateur courant
 * @param {object} params.otherUser   - { id, firstName, lastName, avatarUrl }
 * @param {string} params.bookingId   - Pour inclure dans call:request
 */
export function useWebRTCCall({ myId, otherUser, bookingId }) {
  const socket = useSocket();

  // Refs stables utilisées dans les handlers d'événements (évitent les
  // closures rassis après re-renders).
  const socketRef = useRef(socket);
  const otherUserRef = useRef(otherUser);
  const bookingIdRef = useRef(bookingId);
  const callStateRef = useRef("idle");
  const remoteIdRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  const timerRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // State déclenche les re-renders pour le JSX.
  const [callState, setCallState] = useState("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [durationSec, setDurationSec] = useState(0);

  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { otherUserRef.current = otherUser; }, [otherUser]);
  useEffect(() => { bookingIdRef.current = bookingId; }, [bookingId]);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setDurationSec((s) => s + 1), 1000);
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    iceCandidateQueueRef.current = [];
    remoteIdRef.current = null;
    callStateRef.current = "idle";
    setCallState("idle");
    setIsMuted(false);
    setDurationSec(0);
  }, []);

  const buildPC = useCallback(() => {
    const pc = new RTCPeerConnection(STUN);
    pcRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate || !socketRef.current || !remoteIdRef.current) return;
      socketRef.current.emit("call:ice-candidate", { to: remoteIdRef.current, candidate });
    };

    pc.ontrack = (ev) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = ev.streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        callStateRef.current = "active";
        setCallState("active");
        startTimer();
      } else if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        if (callStateRef.current !== "idle") cleanup();
      }
    };

    return pc;
  }, [cleanup, startTimer]);

  const drainICEQueue = useCallback(async (pc) => {
    for (const c of iceCandidateQueueRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
    iceCandidateQueueRef.current = [];
  }, []);

  // Handlers d'événements socket (registrés une seule fois par session socket).
  useEffect(() => {
    if (!socket) return;

    const onIncoming = ({ callerId }) => {
      if (callStateRef.current !== "idle") {
        socket.emit("call:reject", { callerId });
        return;
      }
      remoteIdRef.current = callerId;
      callStateRef.current = "incoming";
      setCallState("incoming");
    };

    const onAccepted = async () => {
      // Le destinataire a accepté : le caller crée le PC + l'offre SDP.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        const pc = buildPC();
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socketRef.current && remoteIdRef.current) {
          socketRef.current.emit("call:offer", { recipientId: remoteIdRef.current, offer });
        }
      } catch { cleanup(); }
    };

    const onOffer = async ({ callerId, offer }) => {
      // Le destinataire reçoit l'offre SDP et répond.
      try {
        const pc = pcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await drainICEQueue(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (socketRef.current) {
          socketRef.current.emit("call:answer", { callerId, answer });
        }
        // La connexion sera confirmée via onconnectionstatechange.
      } catch { cleanup(); }
    };

    const onAnswer = async ({ answer }) => {
      try {
        const pc = pcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await drainICEQueue(pc);
      } catch { /* ignore */ }
    };

    const onICECandidate = async ({ candidate }) => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        iceCandidateQueueRef.current.push(candidate);
        return;
      }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* ignore */ }
    };

    const onRejected = () => cleanup();
    const onHangup = () => cleanup();

    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice-candidate", onICECandidate);
    socket.on("call:rejected", onRejected);
    socket.on("call:hangup", onHangup);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice-candidate", onICECandidate);
      socket.off("call:rejected", onRejected);
      socket.off("call:hangup", onHangup);
    };
  }, [socket, buildPC, drainICEQueue, cleanup]);

  // Nettoyage au démontage du composant parent.
  useEffect(() => cleanup, [cleanup]);

  // ─── API publique ────────────────────────────────────────────────────────────

  const startCall = useCallback(() => {
    const so = socketRef.current;
    const ou = otherUserRef.current;
    if (!so || !ou?.id || callStateRef.current !== "idle") return;
    remoteIdRef.current = ou.id;
    callStateRef.current = "calling";
    setCallState("calling");
    so.emit("call:request", { recipientId: ou.id, bookingId: bookingIdRef.current });
  }, []);

  const acceptCall = useCallback(async () => {
    const so = socketRef.current;
    if (!so || !remoteIdRef.current || callStateRef.current !== "incoming") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = buildPC();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      // Le caller enverra l'offre après réception de call:accepted.
      so.emit("call:accept", { callerId: remoteIdRef.current });
    } catch { cleanup(); }
  }, [buildPC, cleanup]);

  const rejectCall = useCallback(() => {
    const so = socketRef.current;
    const rid = remoteIdRef.current;
    if (so && rid) so.emit("call:reject", { callerId: rid });
    cleanup();
  }, [cleanup]);

  const hangUp = useCallback(() => {
    const so = socketRef.current;
    const rid = remoteIdRef.current;
    if (so && rid) so.emit("call:hangup", { to: rid });
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    }
    setIsMuted((m) => !m);
  }, []);

  return { callState, isMuted, durationSec, remoteAudioRef, startCall, acceptCall, rejectCall, hangUp, toggleMute };
}
