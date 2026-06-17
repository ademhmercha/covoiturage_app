import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { MailIcon, PhoneIcon, MapPinIcon, ShieldIcon, ChatIcon } from "../icons";
import "./layout.css";

// Coordonnées de contact statiques (aucune donnée utilisateur) — placeholders
// cohérents avec le domaine et le format tunisien (+216) déjà utilisés ailleurs.
const CONTACT_EMAIL = "contact@wasel.tn";
const CONTACT_PHONE_DISPLAY = "+216 70 123 456";
const CONTACT_PHONE_TEL = "+21670123456";

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="footer-col footer-col--brand">
          <Link to="/" className="footer-brand">
            <img src="/logo-icon.png" alt="" className="footer-brand__logo" width="48" height="48" />
            <span className="footer-brand__name">{t("app.name")}</span>
          </Link>
          <p className="footer-brand__desc">{t("footer.description")}</p>
        </div>

        <div className="footer-col">
          <h3 className="footer-col__title">{t("footer.linksTitle")}</h3>
          <nav className="footer-links">
            <Link to="/">{t("nav.home")}</Link>
            <Link to="/search">{t("nav.search")}</Link>
            <Link to="/trips/new">{t("nav.publish")}</Link>
            <Link to="/my-trips">{t("nav.myTrips")}</Link>
            <Link to="/my-bookings">{t("nav.myBookings")}</Link>
          </nav>
        </div>

        <div className="footer-col">
          <h3 className="footer-col__title">{t("footer.contactTitle")}</h3>
          <ul className="footer-contact">
            <li>
              <MailIcon />
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </li>
            <li>
              <PhoneIcon />
              <a href={`tel:${CONTACT_PHONE_TEL}`}>{CONTACT_PHONE_DISPLAY}</a>
            </li>
            <li>
              <MapPinIcon />
              <span>{t("footer.addressValue")}</span>
            </li>
          </ul>
        </div>

        <div className="footer-col">
          <h3 className="footer-col__title">{t("footer.trustTitle")}</h3>
          <ul className="footer-trust">
            <li>
              <ShieldIcon />
              {t("home.trustItem1Title")}
            </li>
            <li>
              <ChatIcon />
              {t("home.trustItem2Title")}
            </li>
            <li>
              <MapPinIcon />
              {t("home.trustItem3Title")}
            </li>
          </ul>
        </div>
      </div>

      <div className="site-footer__bottom">
        <div className="container site-footer__bottom-inner">
          <p>
            © {year} {t("app.name")} — {t("footer.rights")}
          </p>
          <p className="text-sm text-muted">{t("footer.tagline")}</p>
        </div>
      </div>
    </footer>
  );
}
