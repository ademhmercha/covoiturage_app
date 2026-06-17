import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import useAuthStore from "../store/authStore";
import { getErrorMessage } from "../utils/apiError";
import "./pages.css";

const INITIAL_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError(t("validation.passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const { firstName, lastName, email, phone, password } = form;
      await register({ firstName, lastName, email, phone, password });
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-page">
      <div className="card auth-card auth-card--wide">
        <h1>{t("auth.registerTitle")}</h1>
        <p className="text-muted">{t("auth.registerSubtitle")}</p>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <form className="stack" onSubmit={handleSubmit} noValidate>
          <div className="field-grid field-grid-2">
            <div className="field">
              <label htmlFor="firstName">{t("auth.firstName")}</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
                minLength={2}
                maxLength={50}
                value={form.firstName}
                onChange={handleChange}
              />
              <span className="text-sm text-muted">{t("validation.nameRules")}</span>
            </div>

            <div className="field">
              <label htmlFor="lastName">{t("auth.lastName")}</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                required
                minLength={2}
                maxLength={50}
                value={form.lastName}
                onChange={handleChange}
              />
              <span className="text-sm text-muted">{t("validation.nameRules")}</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">{t("auth.email")}</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={255}
              value={form.email}
              onChange={handleChange}
            />
          </div>

          <div className="field">
            <label htmlFor="phone">{t("auth.phone")}</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              placeholder={t("auth.phonePlaceholder")}
              value={form.phone}
              onChange={handleChange}
            />
            <span className="text-sm text-muted">{t("validation.phoneInvalid")}</span>
          </div>

          <div className="field-grid field-grid-2">
            <div className="field">
              <label htmlFor="password">{t("auth.password")}</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={form.password}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">{t("auth.confirmPassword")}</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={form.confirmPassword}
                onChange={handleChange}
              />
            </div>
          </div>
          <span className="text-sm text-muted">{t("validation.passwordRules")}</span>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? <span className="spinner" /> : t("auth.registerButton")}
          </button>
        </form>

        <p className="auth-card__footer text-sm text-muted">
          {t("auth.haveAccount")} <Link to="/login">{t("auth.signIn")}</Link>
        </p>
      </div>
    </div>
  );
}
