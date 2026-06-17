import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

import useAuthStore from "../../store/authStore";
import useToastStore from "../../store/toastStore";
import { HomeIcon, ChatIcon, UserIcon } from "../icons";

function SearchNavIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="22" y2="22" />
    </svg>
  );
}

export default function BottomNav() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated");
  const unreadCount = useToastStore((s) => s.unreadMessages);

  if (!isAuthenticated) return null;

  return (
    <nav className="bottom-nav" aria-label={t("nav.menu")}>
      <NavLink to="/" end className={({ isActive }) => `bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`}>
        <HomeIcon />
        <span>{t("nav.home")}</span>
      </NavLink>

      <NavLink to="/search" className={({ isActive }) => `bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`}>
        <SearchNavIcon />
        <span>{t("nav.search")}</span>
      </NavLink>

      <NavLink to="/messages" className={({ isActive }) => `bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`}>
        <span className="bottom-nav__icon-wrap">
          <ChatIcon />
          {unreadCount > 0 && <span className="bottom-nav__badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </span>
        <span>{t("nav.messages")}</span>
      </NavLink>

      <NavLink to="/profile" className={({ isActive }) => `bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`}>
        <UserIcon />
        <span>{t("nav.profile")}</span>
      </NavLink>
    </nav>
  );
}
