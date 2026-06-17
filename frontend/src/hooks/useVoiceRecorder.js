import { useCallback, useEffect, useRef, useState } from "react";
// Doit rester synchronisé avec MAX_AUDIO_BASE64_LENGTH dans shared/schemas/message.js.
const MAX_AUDIO_BASE64_LENGTH = 200_000;

// Durée maximale d'un message vocal (cohérent avec MAX_AUDIO_BASE64_LENGTH
// côté schéma partagé). L'arrêt à cette limite est déclenché par l'appelant
// via `durationSec` (voir BookingDetailPage.jsx).
export const MAX_DURATION_SEC = 45;

// Formats produits par MediaRecorder côté navigateur, dans l'ordre de
// préférence. `data:audio/mp4;base64,...` (Safari) est accepté par le schéma
// partagé mais n'est pas un format d'enregistrement courant ici.
const CANDIDATE_MIME_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus"];

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || null;
}

function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Encapsule l'enregistrement d'une note vocale (getUserMedia + MediaRecorder)
 * et sa conversion en data URI base64 — aucun fichier n'est jamais écrit sur
 * disque ni envoyé à un endpoint d'upload (cahier des charges item 14).
 *
 * `start()`/`stop()` retournent directement `{ error }` / `{ dataUri, error }`
 * (plutôt que de s'appuyer sur l'état React) pour que l'appelant puisse agir
 * de façon synchrone juste après l'attente, sans lire un état pas encore
 * re-rendu.
 */
export default function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setDurationSec(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve({ dataUri: null, error: null });
        return;
      }

      recorder.onstop = async () => {
        // MediaRecorder.mimeType inclut souvent des paramètres (`;codecs=opus`)
        // non acceptés par le format `data:audio/<type>;base64,...` attendu —
        // on ne conserve que le type de conteneur (webm/ogg).
        const baseType = recorder.mimeType.split(";")[0];
        const blob = new Blob(chunksRef.current, { type: baseType });
        cleanup();

        try {
          const dataUri = await blobToDataUri(blob);
          if (dataUri.length > MAX_AUDIO_BASE64_LENGTH) {
            setError("too-large");
            resolve({ dataUri: null, error: "too-large" });
            return;
          }
          resolve({ dataUri, error: null });
        } catch {
          setError("unknown");
          resolve({ dataUri: null, error: "unknown" });
        }
      };

      recorder.stop();
    });
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);

    const mimeType = pickMimeType();
    if (!mimeType) {
      setError("unsupported");
      return { error: "unsupported" };
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("permission-denied");
      return { error: "permission-denied" };
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    mediaRecorderRef.current = recorder;

    recorder.start();
    setIsRecording(true);
    setDurationSec(0);

    timerRef.current = setInterval(() => {
      setDurationSec((value) => value + 1);
    }, 1000);

    return { error: null };
  }, []);

  return { isRecording, durationSec, error, start, stop };
}
