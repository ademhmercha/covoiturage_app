import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { getUnreadCount } from "../../api/notifications";
import { BellIcon } from "../icons";

const POLL_INTERVAL_MS = 60_000;

export default function NotificationBell() {
  const { t } = useTranslation();

  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: getUnreadCount,
    refetchInterval: POLL_INTERVAL_MS,
  });

  const count = data?.count ?? 0;

  return (
    <Link to="/notifications" className="notification-bell" aria-label={t("nav.notifications")}>
      <BellIcon />
      {count > 0 && <span className="notification-bell__badge">{count > 9 ? "9+" : count}</span>}
    </Link>
  );
}
