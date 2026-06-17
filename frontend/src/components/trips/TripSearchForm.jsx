import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { CITIES, cityName } from "../../utils/cities";

const PREFILL_KEY = "wasel-last-search";

function loadPrefill() {
  try {
    return JSON.parse(localStorage.getItem(PREFILL_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePrefill(params) {
  try {
    localStorage.setItem(PREFILL_KEY, JSON.stringify(params));
  } catch {
    // localStorage may be unavailable
  }
}

export default function TripSearchForm({ initialValues = {}, onSearch }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const prefill = loadPrefill();

  const [from, setFrom] = useState(initialValues.from || prefill.from || "");
  const [to, setTo] = useState(initialValues.to || prefill.to || "");
  const [date, setDate] = useState(initialValues.date || "");

  function handleSubmit(event) {
    event.preventDefault();
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (date) params.date = date;

    if (from || to) savePrefill({ from, to });

    if (onSearch) {
      onSearch(params);
    } else {
      navigate(`/search?${new URLSearchParams(params).toString()}`);
    }
  }

  return (
    <form className="field-grid trip-search-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="search-from">{t("trips.from")}</label>
        <select id="search-from" value={from} onChange={(event) => setFrom(event.target.value)}>
          <option value="">{t("common.from")}</option>
          {CITIES.map((city) => (
            <option key={city.key} value={city.key} disabled={city.key === to}>
              {cityName(city, i18n.language)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="search-to">{t("trips.to")}</label>
        <select id="search-to" value={to} onChange={(event) => setTo(event.target.value)}>
          <option value="">{t("common.to")}</option>
          {CITIES.map((city) => (
            <option key={city.key} value={city.key} disabled={city.key === from}>
              {cityName(city, i18n.language)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="search-date">{t("trips.date")}</label>
        <input
          id="search-date"
          type="date"
          value={date}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      <button type="submit" className="btn btn-primary">
        {t("trips.searchButton")}
      </button>
    </form>
  );
}
