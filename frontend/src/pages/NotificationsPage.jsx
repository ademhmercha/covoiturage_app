import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { SkeletonList } from "../components/common/Skeleton";
import EmptyState from "../components/common/EmptyState";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../api/notifications";
import { formatDateTime } from "../utils/format";
import "./pages.css";

const TRIP_NOTIFICATION_TYPES = new Set(["DEPARTURE_REMINDER"]);

function notificationTypeKey(notification) {
  if (notification.type === "NEW_MESSAGE" && notification.payload.messageType === "AUDIO") {
    return "notifications.types.NEW_MESSAGE_AUDIO";
  }
  return `notifications.types.${notification.type}`;
}

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => getNotifications({ page: 1, pageSize: 50 }),
  });

  const notifications = data?.notifications || [];
  const hasUnread = notifications.some((notification) => !notification.read);

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function handleClick(notification) {
    if (!notification.read) {
      await markNotificationRead(notification.id);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
    const target = TRIP_NOTIFICATION_TYPES.has(notification.type)
      ? `/trips/${notification.payload.tripId}`
      : `/bookings/${notification.payload.bookingId}`;
    navigate(target);
  }

  return (
    <div className="container">
      <div className="page-header row-between">
        <h1>{t("notifications.title")}</h1>
        {hasUnread && (
          <button type="button" className="btn btn-outline btn-sm" onClick={handleMarkAllRead}>
            {t("notifications.markAllRead")}
          </button>
        )}
      </div>

      {isLoading && <SkeletonList count={4} variant="notification" />}

      {isError && <div className="alert alert-danger">{t("errors.GENERIC")}</div>}

      {!isLoading && !isError && notifications.length === 0 && (
        <EmptyState
          variant="notifications"
          title={t("notifications.empty")}
          description={t("notifications.emptyDesc")}
        />
      )}

      <div className="notification-list">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            className={`notification-item ${notification.read ? "" : "notification-item--unread"}`}
            onClick={() => handleClick(notification)}
          >
            {!notification.read && <span className="notification-item__dot" />}
            <div className="notification-item__body">
              <div>{t(notificationTypeKey(notification), notification.payload)}</div>
              <span className="notification-item__time">{formatDateTime(notification.createdAt, i18n.language)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
