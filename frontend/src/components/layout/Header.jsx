import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import useAuthStore from "../../store/authStore";
import useToastStore from "../../store/toastStore";
import useDarkMode from "../../hooks/useDarkMode";
import NotificationBell from "../notifications/NotificationBell";
import { MenuIcon, CloseIcon, SunIcon, MoonIcon } from "../icons";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import "./layout.css";

function initialsOf(user) {
  if (!user) return "";
  return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`;
}

export default function Header() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, status, logout } = useAuthStore();
  const unreadMessages = useToastStore((s) => s.unreadMessages);
  const clearUnread = useToastStore((s) => s.clearUnread);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useDarkMode();
  const isAuthenticated = status === "authenticated";

  async function handleLogout() {
    await logout();
    setMenuOpen(false);
    navigate("/");
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="brand" onClick={closeMenu}>
          <img src="/logo-icon.png" alt="" className="brand__mark" width="40" height="40" />
          <span className="brand__name">{t("app.name")}</span>
        </Link>

        <nav className={`site-nav ${menuOpen ? "site-nav--open" : ""}`}>
          <NavLink to="/search" onClick={closeMenu}>
            {t("nav.search")}
          </NavLink>
          {isAuthenticated && (
            <NavLink to="/trips/new" onClick={closeMenu}>
              {t("nav.publish")}
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink to="/my-trips" onClick={closeMenu}>
              {t("nav.myTrips")}
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink to="/my-bookings" onClick={closeMenu}>
              {t("nav.myBookings")}
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink
              to="/messages"
              className={({ isActive }) => `nav-messages-link${isActive ? " active" : ""}`}
              onClick={() => { closeMenu(); clearUnread(); }}
            >
              {t("nav.messages")}
              {unreadMessages > 0 && <span className="nav-messages-badge" aria-hidden="true" />}
            </NavLink>
          )}
          {!isAuthenticated && (
            <>
              <NavLink to="/login" onClick={closeMenu}>
                {t("nav.login")}
              </NavLink>
              <NavLink to="/register" onClick={closeMenu}>
                {t("nav.register")}
              </NavLink>
            </>
          )}
        </nav>

        <div className="site-header__actions">
          <button
            type="button"
            className="dark-mode-toggle"
            onClick={() => setDark((d) => !d)}
            aria-label={dark ? t("common.lightMode") : t("common.darkMode")}
            title={dark ? t("common.lightMode") : t("common.darkMode")}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>

          <div className="lang-switcher">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                className={i18n.resolvedLanguage === lang ? "active" : ""}
                onClick={() => i18n.changeLanguage(lang)}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          {isAuthenticated && <NotificationBell />}

          {isAuthenticated && (
            <details className="user-menu">
              <summary className="user-menu__trigger">
                <span className="avatar">{initialsOf(user)}</span>
              </summary>
              <div className="user-menu__dropdown">
                <Link to="/profile">{t("nav.profile")}</Link>
                <button type="button" className="danger" onClick={handleLogout}>
                  {t("nav.logout")}
                </button>
              </div>
            </details>
          )}

          <button
            type="button"
            className="site-header__burger"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t("nav.menu")}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
    </header>
  );
}
