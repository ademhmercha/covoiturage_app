import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import TripSearchForm from "../components/trips/TripSearchForm";
import { ShieldIcon, ChatIcon, MapPinIcon } from "../components/icons";
import "./pages.css";

export default function HomePage() {
  const { t } = useTranslation();

  const steps = [
    { title: t("home.step1Title"), body: t("home.step1Body") },
    { title: t("home.step2Title"), body: t("home.step2Body") },
    { title: t("home.step3Title"), body: t("home.step3Body") },
  ];

  const trustItems = [
    { title: t("home.trustItem1Title"), body: t("home.trustItem1Body"), Icon: ShieldIcon },
    { title: t("home.trustItem2Title"), body: t("home.trustItem2Body"), Icon: ChatIcon },
    { title: t("home.trustItem3Title"), body: t("home.trustItem3Body"), Icon: MapPinIcon },
  ];

  return (
    <div className="container">
      <section className="hero">
        <div className="hero__shape hero__shape--1" aria-hidden="true" />
        <div className="hero__shape hero__shape--2" aria-hidden="true" />
        <img src="/logo-icon.png" alt="" className="hero__logo" width="88" height="88" />
        <h1>{t("home.heroTitle")}</h1>
        <p>{t("home.heroSubtitle")}</p>
        <div className="hero__actions">
          <Link to="/search" className="btn btn-accent">
            {t("home.searchCta")}
          </Link>
          <Link to="/trips/new" className="btn btn-outline">
            {t("home.publishCta")}
          </Link>
        </div>
      </section>

      <div className="hero-search-card card">
        <TripSearchForm />
      </div>

      <section className="section">
        <h2 className="section-title">{t("home.howItWorksTitle")}</h2>
        <div className="steps-grid">
          {steps.map((step, index) => (
            <div key={step.title} className="card card--hover step-card">
              <span className="step-card__badge">{index + 1}</span>
              <h3>{step.title}</h3>
              <p className="text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{t("home.trustTitle")}</h2>
        <div className="trust-grid">
          {trustItems.map(({ title, body, Icon }) => (
            <div key={title} className="card card--hover trust-card">
              <span className="trust-card__badge">
                <Icon />
              </span>
              <h3>{title}</h3>
              <p className="text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <h2>{t("home.ctaTitle")}</h2>
        <p className="text-muted">{t("home.ctaBody")}</p>
        <Link to="/register" className="btn btn-primary">
          {t("home.ctaButton")}
        </Link>
      </section>
    </div>
  );
}
