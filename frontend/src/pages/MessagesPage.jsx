import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import Avatar from "../components/common/Avatar";
import { SkeletonList } from "../components/common/Skeleton";
import EmptyState from "../components/common/EmptyState";
import { MapPinIcon } from "../components/icons";
import { getConversations } from "../api/bookings";
import { bookingStatusBadgeClass } from "../utils/statusBadge";
import useToastStore from "../store/toastStore";
import "../components/trips/trips.css";
import "./pages.css";

function lastMessagePreview(conv, t) {
  if (!conv.lastMessage) return t("messages.empty");
  if (conv.lastMessage.type === "AUDIO") return t("messages.voiceNote");
  if (conv.lastMessage.type === "IMAGE") return t("messages.imageNote");
  return conv.lastMessage.content;
}

export default function MessagesPage() {
  const { t, i18n } = useTranslation();
  const clearUnread = useToastStore((s) => s.clearUnread);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["bookings", "conversations"],
    queryFn: getConversations,
  });

  // Reset unread badge when user visits the messages page
  clearUnread();

  const conversations = data?.conversations || [];

  return (
    <div className="container">
      <div className="page-header">
        <h1>{t("messages.conversationsTitle")}</h1>
      </div>

      {isLoading && <SkeletonList count={3} variant="conversation" />}

      {isError && <div className="alert alert-danger">{t("errors.GENERIC")}</div>}

      {!isLoading && !isError && conversations.length === 0 && (
        <EmptyState
          variant="messages"
          title={t("messages.noConversations")}
          description={t("messages.noConversationsDesc")}
          actionLabel={t("nav.search")}
          actionTo="/search"
        />
      )}

      <div className="list-stack">
        {conversations.map((conv) => (
          <Link key={conv.id} to={`/bookings/${conv.id}`} className="card card--hover booking-item conversation-item">
            <div className="booking-item__header">
              <div className="row">
                <Avatar user={conv.otherParty} size={36} />
                <strong>
                  {conv.otherParty ? `${conv.otherParty.firstName} ${conv.otherParty.lastName}` : ""}
                </strong>
              </div>
              <span className={`badge ${bookingStatusBadgeClass(conv.status)}`}>{t(`bookings.status.${conv.status}`)}</span>
            </div>

            <div className="booking-item__route text-sm text-muted">
              <MapPinIcon className="trip-card__pin--origin" />
              <span>{conv.trip.originLabel}</span>
              <span className="trip-detail__route-arrow">{i18n.dir() === "rtl" ? "←" : "→"}</span>
              <MapPinIcon className="trip-card__pin--destination" />
              <span>{conv.trip.destinationLabel}</span>
            </div>

            <p className="conversation-item__preview text-sm text-muted">
              {lastMessagePreview(conv, t)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
