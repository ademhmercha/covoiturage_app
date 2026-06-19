import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import Avatar from "../components/common/Avatar";
import {
  ArrowLeftIcon,
  BadgeCheckIcon,
  CheckCheckIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  ImageIcon,
  MapPinIcon,
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  PhoneOffIcon,
  SendIcon,
  StarIcon,
  StopIcon,
} from "../components/icons";
import {
  getBooking,
  updateBookingStatus,
  createRating,
  getBookingRating,
} from "../api/bookings";
import { getMessages, sendMessage, sendVoiceMessage, sendImageMessage } from "../api/messages";
import useAuthStore from "../store/authStore";
import { getErrorMessage } from "../utils/apiError";
import { formatDate, formatDateTime } from "../utils/format";
import { bookingStatusBadgeClass } from "../utils/statusBadge";
import useVoiceRecorder, { MAX_DURATION_SEC } from "../hooks/useVoiceRecorder";
import { useWebRTCCall } from "../hooks/useWebRTCCall";
import { useSocket } from "../context/useSocket";
import "../components/trips/trips.css";
import "./pages.css";

const RECORDER_ERROR_KEYS = {
  unsupported: "messages.recordingUnsupported",
  "permission-denied": "messages.micPermissionDenied",
  "too-large": "messages.audioTooLarge",
};

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Compresse une image côté client avant envoi (max 900px, JPEG 80 %).
async function compressImageForChat(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, 900 / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("load")); };
    img.src = objectUrl;
  });
}

// ─── Sous-composant : bulle de message ──────────────────────────────────────

function ChatBubble({ msg, isMine, otherUser, onImageClick, language }) {
  return (
    <div className={`chat-bubble-row${isMine ? " chat-bubble-row--mine" : ""}`}>
      {!isMine && <Avatar user={otherUser} size={28} />}
      <div className="chat-bubble-content">
        <div className={`chat-bubble${isMine ? " chat-bubble--mine" : " chat-bubble--other"}`}>
          {msg.type === "AUDIO" ? (
            <audio controls src={msg.content} className="chat-bubble-audio" />
          ) : msg.type === "IMAGE" ? (
            <button
              type="button"
              className="chat-bubble-img-btn"
              onClick={() => onImageClick(msg.content)}
            >
              <img src={msg.content} alt="" className="chat-bubble-img" loading="lazy" />
            </button>
          ) : (
            <p className="chat-bubble-text">{msg.content}</p>
          )}
        </div>
        <div className={`chat-bubble-meta${isMine ? " chat-bubble-meta--mine" : ""}`}>
          <time>{formatDateTime(msg.createdAt, language)}</time>
          {isMine && (
            msg.seenAt
              ? <CheckCheckIcon className="seen-tick seen-tick--seen" />
              : <CheckIcon className="seen-tick" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composant : overlay d'appel ───────────────────────────────────────

function CallOverlay({ callState, otherUser, isMuted, durationSec, onAccept, onReject, onHangUp, onToggleMute, t }) {
  return (
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label={t("call.incoming")}>
      <div className="call-overlay__card">
        <Avatar user={otherUser} size={72} />
        <strong className="call-overlay__name">
          {otherUser?.firstName} {otherUser?.lastName}
        </strong>
        <span className="call-overlay__status text-muted">
          {callState === "incoming" && t("call.incoming")}
          {callState === "calling" && t("call.calling")}
          {callState === "active" && formatDuration(durationSec)}
        </span>

        <div className="call-overlay__actions">
          {callState === "active" && (
            <>
              <button
                type="button"
                className={`call-btn${isMuted ? " call-btn--muted" : " call-btn--mute"}`}
                onClick={onToggleMute}
                aria-label={isMuted ? t("call.unmute") : t("call.mute")}
                title={isMuted ? t("call.unmute") : t("call.mute")}
              >
                {isMuted ? <MicOffIcon /> : <MicIcon />}
              </button>
              <button
                type="button"
                className="call-btn call-btn--hangup"
                onClick={onHangUp}
                aria-label={t("call.hangup")}
                title={t("call.hangup")}
              >
                <PhoneOffIcon />
              </button>
            </>
          )}

          {callState === "calling" && (
            <button
              type="button"
              className="call-btn call-btn--hangup"
              onClick={onHangUp}
              aria-label={t("call.cancel")}
              title={t("call.cancel")}
            >
              <PhoneOffIcon />
            </button>
          )}

          {callState === "incoming" && (
            <>
              <button
                type="button"
                className="call-btn call-btn--reject"
                onClick={onReject}
                aria-label={t("call.reject")}
                title={t("call.reject")}
              >
                <PhoneOffIcon />
              </button>
              <button
                type="button"
                className="call-btn call-btn--accept"
                onClick={onAccept}
                aria-label={t("call.accept")}
                title={t("call.accept")}
              >
                <PhoneIcon />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const { t, i18n } = useTranslation();
  const { bookingId } = useParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const socket = useSocket();

  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [tripInfoOpen, setTripInfoOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [hoverStar, setHoverStar] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const imageInputRef = useRef(null);
  const recorder = useVoiceRecorder();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["bookings", bookingId],
    queryFn: () => getBooking(bookingId),
  });

  const booking = data?.booking;
  const isDriver = booking?.trip?.driverId === user?.id;
  const otherParty = isDriver ? booking?.passenger : booking?.trip?.driver;

  const { data: messagesData } = useQuery({
    queryKey: ["messages", bookingId],
    queryFn: () => getMessages(bookingId),
    enabled: Boolean(booking),
  });

  const { data: ratingData, refetch: refetchRating } = useQuery({
    queryKey: ["rating", bookingId],
    queryFn: () => getBookingRating(bookingId),
    enabled: Boolean(booking) && booking?.trip?.status === "COMPLETED",
  });

  const messages = messagesData?.messages || [];
  const existingRating = ratingData?.rating || null;

  const { callState, isMuted, durationSec, remoteAudioRef, startCall, acceptCall, rejectCall, hangUp, toggleMute } =
    useWebRTCCall({ otherUser: otherParty, bookingId });

  // Scroll vers le bas à chaque nouveau message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Arrêt auto de l'enregistrement à MAX_DURATION_SEC.
  useEffect(() => {
    if (recorder.isRecording && recorder.durationSec >= MAX_DURATION_SEC) {
      handleStopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.durationSec]);

  // Émet message:seen lorsqu'il existe des messages non lus de l'autre partie.
  const hasUnseenFromOther = messages.some((m) => m.senderId !== user?.id && !m.seenAt);
  useEffect(() => {
    if (hasUnseenFromOther && socket) {
      socket.emit("message:seen", { bookingId });
    }
  }, [hasUnseenFromOther, bookingId, socket]);

  if (isLoading) {
    return (
      <div className="container">
        <div className="empty-state">
          <span className="spinner" />
        </div>
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="container">
        <div className="alert alert-danger">{t("errors.NOT_FOUND")}</div>
      </div>
    );
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function adjustTextarea(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError("");
    try {
      await sendMessage(bookingId, trimmed);
      setContent("");
      if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
      queryClient.invalidateQueries({ queryKey: ["messages", bookingId] });
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setSending(false);
    }
  }

  async function handleStopRecording() {
    const { dataUri, error: recError } = await recorder.stop();
    if (recError) { setError(t(RECORDER_ERROR_KEYS[recError] || "errors.GENERIC")); return; }
    if (!dataUri) return;
    setSending(true);
    setError("");
    try {
      await sendVoiceMessage(bookingId, dataUri);
      queryClient.invalidateQueries({ queryKey: ["messages", bookingId] });
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setSending(false);
    }
  }

  async function handleStartRecording() {
    setError("");
    const { error: recError } = await recorder.start();
    if (recError) setError(t(RECORDER_ERROR_KEYS[recError] || "errors.GENERIC"));
  }

  async function handleImageSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setSending(true);
    setError("");
    try {
      const dataUri = await compressImageForChat(file);
      await sendImageMessage(bookingId, dataUri);
      queryClient.invalidateQueries({ queryKey: ["messages", bookingId] });
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setSending(false);
    }
  }

  async function handleDecision(status, confirmKey) {
    if (!window.confirm(t(confirmKey))) return;
    setError("");
    try {
      await updateBookingStatus(bookingId, status);
      queryClient.invalidateQueries({ queryKey: ["bookings", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["trips", booking.tripId] });
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }

  async function handleRate(score) {
    setSubmittingRating(true);
    setError("");
    try {
      await createRating(bookingId, { score });
      await refetchRating();
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setSubmittingRating(false);
    }
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="chat-full-page">
      {/* Audio distant (invisible) */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Overlay d'appel */}
      {callState !== "idle" && (
        <CallOverlay
          callState={callState}
          otherUser={otherParty}
          isMuted={isMuted}
          durationSec={durationSec}
          onAccept={acceptCall}
          onReject={rejectCall}
          onHangUp={hangUp}
          onToggleMute={toggleMute}
          t={t}
        />
      )}

      {/* Visionneuse d'image */}
      {lightboxSrc && (
        <div
          className="chat-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} alt="" className="chat-lightbox__img" />
          <button
            type="button"
            className="chat-lightbox__close"
            onClick={() => setLightboxSrc(null)}
            aria-label={t("common.close")}
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {/* En-tête */}
      <div className="chat-header">
        <Link to="/messages" className="icon-btn" aria-label={t("common.back")}>
          <ArrowLeftIcon />
        </Link>
        <div className="chat-header__user">
          <Avatar user={otherParty} size={38} />
          <strong className="chat-header__name">
            {otherParty?.firstName} {otherParty?.lastName}
            {otherParty?.isVerified && <BadgeCheckIcon className="verified-badge" />}
          </strong>
        </div>
        <button
          type="button"
          className="icon-btn chat-header__call-btn"
          onClick={startCall}
          disabled={callState !== "idle" || !otherParty}
          aria-label={t("call.start")}
          title={t("call.start")}
        >
          <PhoneIcon />
        </button>
      </div>

      {/* Barre d'infos trajet (repliable) */}
      <div className="chat-trip-bar">
        <button
          type="button"
          className="chat-trip-bar__header"
          onClick={() => setTripInfoOpen((o) => !o)}
          aria-expanded={tripInfoOpen}
        >
          <MapPinIcon className="trip-card__pin--origin" />
          <span className="chat-trip-bar__route">
            {booking.trip.originLabel}
            <span className="trip-detail__route-arrow">
              {i18n.dir() === "rtl" ? "←" : "→"}
            </span>
            {booking.trip.destinationLabel}
          </span>
          <span className={`badge ${bookingStatusBadgeClass(booking.status)}`}>
            {t(`bookings.status.${booking.status}`)}
          </span>
          <ChevronDownIcon
            className={`chat-trip-bar__chevron${tripInfoOpen ? " chat-trip-bar__chevron--open" : ""}`}
          />
        </button>

        {tripInfoOpen && (
          <div className="chat-trip-info stack">
            <div className="row text-sm text-muted">
              <span>{formatDateTime(booking.trip.departureAt, i18n.language)}</span>
              <span>{t("bookings.seatsBooked", { count: booking.seats })}</span>
              <span>{t("common.pricePerSeat", { price: booking.trip.pricePerSeat })}</span>
            </div>

            <p className="text-sm text-muted">
              {t("bookings.requestedOn")} {formatDate(booking.createdAt, i18n.language)}
            </p>

            {isDriver && booking.status === "PENDING" && (
              <div className="row">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleDecision("ACCEPTED", "bookings.acceptConfirm")}
                >
                  {t("bookings.accept")}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => handleDecision("REJECTED", "bookings.rejectConfirm")}
                >
                  {t("bookings.reject")}
                </button>
              </div>
            )}

            {!isDriver && (booking.status === "PENDING" || booking.status === "ACCEPTED") && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => handleDecision("CANCELLED", "bookings.cancelBookingConfirm")}
              >
                {t("bookings.cancelBooking")}
              </button>
            )}

            {!isDriver && booking.trip.status === "COMPLETED" && (
              <div className="rating-section">
                <p className="text-sm text-muted">{t("ratings.rateDriver")}</p>
                {existingRating ? (
                  <div className="star-row">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <StarIcon
                        key={n}
                        className={n <= existingRating.score ? "star star--filled" : "star"}
                      />
                    ))}
                  </div>
                ) : (
                  <fieldset className="star-row" onMouseLeave={() => setHoverStar(0)}>
                    <legend className="sr-only">{t("ratings.rateDriver")}</legend>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="star-btn"
                        aria-label={t("ratings.star", { count: n })}
                        disabled={submittingRating}
                        onMouseEnter={() => setHoverStar(n)}
                        onClick={() => handleRate(n)}
                      >
                        <StarIcon className={n <= hoverStar ? "star star--filled" : "star"} />
                      </button>
                    ))}
                  </fieldset>
                )}
              </div>
            )}

            <Link to={`/trips/${booking.tripId}`} className="btn btn-ghost btn-sm">
              {t("trips.viewDetails")}
            </Link>
          </div>
        )}
      </div>

      {/* Zone de messages */}
      <div className="chat-messages-area">
        {messages.length === 0 && (
          <p className="text-muted text-center">{t("messages.empty")}</p>
        )}
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            msg={msg}
            isMine={msg.senderId === user?.id}
            otherUser={otherParty}
            onImageClick={setLightboxSrc}
            language={i18n.language}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Erreur */}
      {error && (
        <div className="alert alert-danger chat-error" role="alert">
          {error}
        </div>
      )}

      {/* Indicateur d'enregistrement */}
      {recorder.isRecording && (
        <div className="chat-recording-bar" role="status">
          <span className="chat-recording-indicator__dot" />
          {t("messages.recording")} {formatDuration(recorder.durationSec)}
        </div>
      )}

      {/* Barre de saisie */}
      <div className="chat-input-bar">
        <button
          type="button"
          className="icon-btn"
          onClick={() => imageInputRef.current?.click()}
          disabled={sending || recorder.isRecording}
          aria-label={t("messages.sendImage")}
          title={t("messages.sendImage")}
        >
          <ImageIcon />
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleImageSelect}
        />
        <textarea
          ref={textareaRef}
          className="chat-input-textarea"
          placeholder={t("messages.placeholder")}
          maxLength={1000}
          value={content}
          rows={1}
          disabled={recorder.isRecording}
          onChange={(e) => {
            setContent(e.target.value);
            adjustTextarea(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
        />
        {content.trim() ? (
          <button
            type="button"
            className="icon-btn icon-btn--primary"
            onClick={handleSend}
            disabled={sending}
            aria-label={t("messages.send")}
          >
            <SendIcon />
          </button>
        ) : (
          <button
            type="button"
            className={`icon-btn${recorder.isRecording ? " icon-btn--recording" : ""}`}
            onClick={recorder.isRecording ? handleStopRecording : handleStartRecording}
            disabled={sending}
            aria-label={recorder.isRecording ? t("messages.stopRecording") : t("messages.record")}
            title={recorder.isRecording ? t("messages.stopRecording") : t("messages.record")}
          >
            {recorder.isRecording ? <StopIcon /> : <MicIcon />}
          </button>
        )}
      </div>
    </div>
  );
}
