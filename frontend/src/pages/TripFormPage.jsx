import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import TripLocationMap from "../components/trips/TripLocationMap";
import { MAP_ICONS } from "../components/trips/mapIcons";
import { createTrip, getTrip, updateTrip } from "../api/trips";
import { reverseGeocode } from "../api/geocode";
import useAuthStore from "../store/authStore";
import { getErrorMessage } from "../utils/apiError";
import "../components/trips/trips.css";
import "./pages.css";

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const WEEKDAYS = [
  { value: "1", labelKey: "trips.weekday.mon" },
  { value: "2", labelKey: "trips.weekday.tue" },
  { value: "3", labelKey: "trips.weekday.wed" },
  { value: "4", labelKey: "trips.weekday.thu" },
  { value: "5", labelKey: "trips.weekday.fri" },
  { value: "6", labelKey: "trips.weekday.sat" },
  { value: "0", labelKey: "trips.weekday.sun" },
];

const EMPTY_FORM = {
  originLabel: "",
  destinationLabel: "",
  origin: null,
  destination: null,
  departureAt: "",
  seatsAvailable: 1,
  pricePerSeat: "",
  vehicleInfo: "",
  isRecurring: false,
  recurringDays: [],
};

export default function TripFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tripId } = useParams();
  const isEditMode = Boolean(tripId);
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState(EMPTY_FORM);
  const [activeTarget, setActiveTarget] = useState("origin");
  const [geocoding, setGeocoding] = useState({ origin: false, destination: false });
  const [userLocation, setUserLocation] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(!isEditMode);
  const [minDepartureAt] = useState(() => toDatetimeLocalValue(new Date(Date.now() + 5 * 60 * 1000)));

  const { data, isLoading, isError: loadError } = useQuery({
    queryKey: ["trips", tripId],
    queryFn: () => getTrip(tripId),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (!data?.trip || loaded) return;
    const trip = data.trip;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      originLabel: trip.originLabel,
      destinationLabel: trip.destinationLabel,
      origin: trip.origin,
      destination: trip.destination,
      departureAt: toDatetimeLocalValue(new Date(trip.departureAt)),
      seatsAvailable: trip.seatsAvailable,
      pricePerSeat: trip.pricePerSeat,
      vehicleInfo: trip.vehicleInfo || "",
    });
    setLoaded(true);
  }, [data, loaded]);

  function handleChange(event) {
    const { name, value, checked } = event.target;
    if (name === "isRecurring") {
      setForm((prev) => ({ ...prev, isRecurring: checked, recurringDays: checked ? prev.recurringDays : [] }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  function handleDayToggle(dayValue) {
    setForm((prev) => {
      const days = prev.recurringDays.includes(dayValue)
        ? prev.recurringDays.filter((d) => d !== dayValue)
        : [...prev.recurringDays, dayValue];
      return { ...prev, recurringDays: days };
    });
  }

  function clearPoint(name) {
    const labelKey = name === "origin" ? "originLabel" : "destinationLabel";
    setForm((prev) => ({ ...prev, [name]: null, [labelKey]: "" }));
    setActiveTarget(name);
  }

  async function placePoint(name, latlng) {
    const point = { lat: latlng.lat, lng: latlng.lng };
    const labelKey = name === "origin" ? "originLabel" : "destinationLabel";

    setForm((prev) => ({ ...prev, [name]: point }));
    setGeocoding((prev) => ({ ...prev, [name]: true }));
    try {
      const { label } = await reverseGeocode(point.lat, point.lng);
      if (label) setForm((prev) => ({ ...prev, [labelKey]: label }));
    } catch {
      // best-effort
    } finally {
      setGeocoding((prev) => ({ ...prev, [name]: false }));
    }
  }

  async function handleMapClick(latlng) {
    const target = activeTarget;
    await placePoint(target, latlng);
    // Auto-advance to destination after placing origin
    if (target === "origin" && !form.destination) {
      setActiveTarget("destination");
    }
  }

  async function handleMarkerDrag(name, latlng) {
    await placePoint(name, latlng);
  }

  async function handleLocated(latlng) {
    setUserLocation(latlng);
    // Place the currently active pin at the user's position
    await handleMapClick(latlng);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!form.origin || !form.destination) {
      setError(t("validation.locationRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        originLabel: form.originLabel,
        origin: form.origin,
        destinationLabel: form.destinationLabel,
        destination: form.destination,
        departureAt: new Date(form.departureAt).toISOString(),
        seatsAvailable: Number(form.seatsAvailable),
        pricePerSeat: Number(form.pricePerSeat),
      };
      if (form.vehicleInfo) payload.vehicleInfo = form.vehicleInfo;
      if (form.isRecurring) {
        payload.isRecurring = true;
        if (form.recurringDays.length > 0) {
          payload.recurringDays = [...form.recurringDays].sort((a, b) => a - b).join(",");
        }
      }

      let trip;
      if (isEditMode) {
        ({ trip } = await updateTrip(tripId, payload));
        queryClient.invalidateQueries({ queryKey: ["trips", tripId] });
        queryClient.invalidateQueries({ queryKey: ["trips", "mine"] });
      } else {
        ({ trip } = await createTrip(payload));
      }
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  if (isEditMode) {
    if (isLoading) {
      return (
        <div className="container">
          <div className="empty-state">
            <span className="spinner" />
          </div>
        </div>
      );
    }
    if (loadError || !data?.trip) {
      return (
        <div className="container">
          <div className="alert alert-danger">{t("trips.notFound")}</div>
        </div>
      );
    }
    const trip = data.trip;
    if (trip.driverId !== user?.id) {
      return (
        <div className="container">
          <div className="alert alert-danger">{t("errors.FORBIDDEN")}</div>
        </div>
      );
    }
    if (trip.status !== "SCHEDULED") {
      return (
        <div className="container">
          <div className="alert alert-danger">{t("errors.TRIP_NOT_EDITABLE")}</div>
        </div>
      );
    }
  }

  const submitLabel = isEditMode ? t("trips.updateButton") : t("trips.publishButton");

  const markers = [];
  if (form.origin) {
    markers.push({
      ...form.origin,
      icon: MAP_ICONS.origin,
      popup: form.originLabel || t("trips.originOnMap"),
      name: "origin",
    });
  }
  if (form.destination) {
    markers.push({
      ...form.destination,
      icon: MAP_ICONS.destination,
      popup: form.destinationLabel || t("trips.destinationOnMap"),
      name: "destination",
    });
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>{isEditMode ? t("trips.editTitle") : t("trips.publishTitle")}</h1>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid-2">
          <div className="card stack">
            <div className="field">
              <label htmlFor="originLabel">{t("trips.originLabel")}</label>
              <div className="location-picker__input-wrap">
                <input
                  id="originLabel"
                  name="originLabel"
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder={t("trips.originLabelPlaceholder")}
                  value={form.originLabel}
                  onChange={handleChange}
                />
                {geocoding.origin && <span className="spinner location-picker__input-spinner" aria-hidden="true" />}
              </div>
            </div>

            <div className="field">
              <label htmlFor="destinationLabel">{t("trips.destinationLabel")}</label>
              <div className="location-picker__input-wrap">
                <input
                  id="destinationLabel"
                  name="destinationLabel"
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder={t("trips.destinationLabelPlaceholder")}
                  value={form.destinationLabel}
                  onChange={handleChange}
                />
                {geocoding.destination && <span className="spinner location-picker__input-spinner" aria-hidden="true" />}
              </div>
            </div>

            <div className="field">
              <label htmlFor="departureAt">{t("trips.departureDate")}</label>
              <input
                id="departureAt"
                name="departureAt"
                type="datetime-local"
                required
                min={minDepartureAt}
                value={form.departureAt}
                onChange={handleChange}
              />
            </div>

            <div className="field-grid field-grid-2">
              <div className="field">
                <label htmlFor="seatsAvailable">{t("trips.seatsAvailableField")}</label>
                <input
                  id="seatsAvailable"
                  name="seatsAvailable"
                  type="number"
                  required
                  min={1}
                  max={8}
                  value={form.seatsAvailable}
                  onChange={handleChange}
                />
                <span className="text-sm text-muted">{t("validation.seatsRange")}</span>
              </div>

              <div className="field">
                <label htmlFor="pricePerSeat">{t("trips.pricePerSeatField")}</label>
                <input
                  id="pricePerSeat"
                  name="pricePerSeat"
                  type="number"
                  required
                  min={0}
                  max={10000}
                  step="0.5"
                  value={form.pricePerSeat}
                  onChange={handleChange}
                />
                <span className="text-sm text-muted">{t("validation.priceRange")}</span>
              </div>
            </div>

            <div className="field">
              <label htmlFor="vehicleInfo">{t("trips.vehicleInfoOptional")}</label>
              <input
                id="vehicleInfo"
                name="vehicleInfo"
                type="text"
                maxLength={80}
                placeholder={t("trips.vehicleInfoPlaceholder")}
                value={form.vehicleInfo}
                onChange={handleChange}
              />
              <span className="text-sm text-muted">{t("validation.vehicleInfoMax")}</span>
            </div>

            <div className="field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="isRecurring"
                  checked={form.isRecurring}
                  onChange={handleChange}
                />
                {t("trips.isRecurring")}
              </label>
            </div>

            {form.isRecurring && (
              <fieldset className="field weekdays-fieldset">
                <legend className="field-label">{t("trips.recurringDays")}</legend>
                <div className="weekdays-grid">
                  {WEEKDAYS.map(({ value, labelKey }) => (
                    <label key={value} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={form.recurringDays.includes(value)}
                        onChange={() => handleDayToggle(value)}
                      />
                      {t(labelKey)}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner" /> : submitLabel}
            </button>
          </div>

          <div className="stack">
            {/* Target selector */}
            <div className="location-picker__targets">
              {["origin", "destination"].map((name) => {
                const placed = form[name];
                const isActive = activeTarget === name;
                return (
                  <div
                    key={name}
                    className={`location-picker__target${isActive ? " active" : ""}`}
                  >
                    <button
                      type="button"
                      className="location-picker__target-select"
                      onClick={() => setActiveTarget(name)}
                    >
                      <span className={`location-picker__dot location-picker__dot--${name}`} />
                      <span>
                        {t(name === "origin" ? "trips.setOrigin" : "trips.setDestination")}
                        {placed && (
                          <span className="location-picker__coords">
                            {placed.lat.toFixed(3)}, {placed.lng.toFixed(3)}
                          </span>
                        )}
                      </span>
                    </button>
                    {placed && (
                      <button
                        type="button"
                        className="location-picker__clear"
                        onClick={() => clearPoint(name)}
                        aria-label={t("common.close")}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-sm text-muted">{t("trips.mapHint")}</p>
            {(form.origin || form.destination) && (
              <p className="text-sm text-muted">{t("trips.mapHintDrag")}</p>
            )}

            <TripLocationMap
              markers={markers}
              onMapClick={handleMapClick}
              onMarkerDrag={handleMarkerDrag}
              userLocation={userLocation}
              onLocated={handleLocated}
              showPolyline={Boolean(form.origin && form.destination)}
              height={400}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
