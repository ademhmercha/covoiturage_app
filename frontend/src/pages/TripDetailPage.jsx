import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import TripLocationMap from "../components/trips/TripLocationMap";
import { MAP_ICONS } from "../components/trips/mapIcons";
import Avatar from "../components/common/Avatar";
import { MapPinIcon, ShareIcon, BadgeCheckIcon } from "../components/icons";
import useToastStore from "../store/toastStore";
import { cancelTrip, getTrip } from "../api/trips";
import { createBooking, getMyBookings, getTripBookings, updateBookingStatus } from "../api/bookings";
import useAuthStore from "../store/authStore";
import { getErrorMessage } from "../utils/apiError";
import { formatDateTime } from "../utils/format";
import { tripStatusBadgeClass, bookingStatusBadgeClass } from "../utils/statusBadge";
import "../components/trips/trips.css";
import "./pages.css";

export default function TripDetailPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { tripId } = useParams();
  const user = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);

  const addToast = useToastStore((s) => s.addToast);
  const [seats, setSeats] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [now] = useState(() => Date.now());

  async function handleShare() {
    const url = location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      addToast({ message: t("trips.linkCopied"), type: "success" });
    } catch {
      addToast({ message: t("trips.linkCopyFailed"), type: "error" });
    }
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["trips", tripId],
    queryFn: () => getTrip(tripId),
  });

  const trip = data?.trip;
  const isDriver = Boolean(trip && user && trip.driverId === user.id);

  const { data: myBookingsData } = useQuery({
    queryKey: ["bookings", "mine"],
    queryFn: getMyBookings,
    enabled: Boolean(user) && Boolean(trip) && !isDriver,
  });

  const { data: tripBookingsData } = useQuery({
    queryKey: ["bookings", "trip", tripId],
    queryFn: () => getTripBookings(tripId),
    enabled: isDriver,
  });

  if (isLoading) {
    return (
      <div className="container">
        <div className="empty-state">
          <span className="spinner" />
        </div>
      </div>
    );
  }

  if (isError || !trip) {
    return (
      <div className="container">
        <div className="alert alert-danger">{t("trips.notFound")}</div>
      </div>
    );
  }

  const existingBooking = myBookingsData?.bookings?.find(
    (b) => b.tripId === trip.id && (b.status === "PENDING" || b.status === "ACCEPTED")
  );

  const isBookable =
    trip.status === "SCHEDULED" && trip.availableSeats > 0 && new Date(trip.departureAt).getTime() > now;

  async function handleBook(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await createBooking({ tripId: trip.id, seats: Number(seats) });
      setMessage(t("trips.bookingSuccess"));
      queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["trips", trip.id] });
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }

  async function handleCancelTrip() {
    if (!window.confirm(t("trips.cancelTripConfirm"))) return;
    setError("");
    try {
      await cancelTrip(trip.id);
      queryClient.invalidateQueries({ queryKey: ["trips", trip.id] });
      queryClient.invalidateQueries({ queryKey: ["trips", "mine"] });
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }

  async function handleBookingDecision(bookingId, status, confirmKey) {
    if (!window.confirm(t(confirmKey))) return;
    setError("");
    try {
      await updateBookingStatus(bookingId, status);
      queryClient.invalidateQueries({ queryKey: ["bookings", "trip", trip.id] });
      queryClient.invalidateQueries({ queryKey: ["trips", trip.id] });
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }

  const markers = [
    { lat: trip.origin.lat, lng: trip.origin.lng, icon: MAP_ICONS.origin, popup: trip.originLabel },
    { lat: trip.destination.lat, lng: trip.destination.lng, icon: MAP_ICONS.destination, popup: trip.destinationLabel },
  ];

  const tripBookings = tripBookingsData?.bookings || [];

  return (
    <div className="container">
      <div className="trip-detail__header">
        <div>
          <div className="trip-detail__route">
            <MapPinIcon className="trip-card__pin--origin" />
            <span>{trip.originLabel}</span>
            <span className="trip-detail__route-arrow">{i18n.dir() === "rtl" ? "←" : "→"}</span>
            <MapPinIcon className="trip-card__pin--destination" />
            <span>{trip.destinationLabel}</span>
          </div>
          <div className="row">
            <span className={`badge ${tripStatusBadgeClass(trip.status)}`}>{t(`trips.status.${trip.status}`)}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleShare} aria-label={t("trips.shareTrip")}>
              <ShareIcon />
            </button>
          </div>
        </div>

        <div className="trip-detail__driver">
          <Avatar user={trip.driver} size={44} />
          <div>
            <div className="text-sm text-muted">{t("trips.driver")}</div>
            <strong className="row">
              {trip.driver?.firstName} {trip.driver?.lastName}
              {trip.driver?.isVerified && (
                <BadgeCheckIcon className="verified-badge" aria-label={t("trips.verified")} />
              )}
            </strong>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="card trip-detail__section">
            <div className="trip-detail__facts">
              <div>
                <span className="fact-label">{t("trips.departureAt")}</span>
                <span className="fact-value">{formatDateTime(trip.departureAt, i18n.language)}</span>
              </div>
              <div>
                <span className="fact-label">{t("trips.pricePerSeatField")}</span>
                <span className="fact-value">{t("common.pricePerSeat", { price: trip.pricePerSeat })}</span>
              </div>
              <div>
                <span className="fact-label">{t("trips.seatsAvailableField")}</span>
                <span className="fact-value">
                  {trip.availableSeats > 0
                    ? t("trips.seatsAvailable", { count: trip.availableSeats })
                    : t("trips.noSeatsAvailable")}
                </span>
              </div>
              {trip.vehicleInfo && (
                <div>
                  <span className="fact-label">{t("trips.vehicleInfo")}</span>
                  <span className="fact-value">{trip.vehicleInfo}</span>
                </div>
              )}
            </div>
          </div>

          {!isDriver && (
            <div className="card trip-detail__section">
              <h2>{t("trips.bookNow")}</h2>

              {message && (
                <div className="alert alert-success" role="status">
                  {message}
                </div>
              )}
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              {authStatus === "loading" || authStatus === "idle" ? (
                <span className="spinner" />
              ) : !user ? (
                <p className="text-muted">
                  <Link to="/login" state={{ from: location }}>
                    {t("auth.signIn")}
                  </Link>
                </p>
              ) : existingBooking ? (
                <div className="row-between">
                  <span className={`badge ${bookingStatusBadgeClass(existingBooking.status)}`}>
                    {t(`bookings.status.${existingBooking.status}`)}
                  </span>
                  <Link to={`/bookings/${existingBooking.id}`} className="btn btn-outline btn-sm">
                    {t("bookings.viewConversation")}
                  </Link>
                </div>
              ) : isBookable ? (
                <form className="booking-form" onSubmit={handleBook}>
                  <div className="field">
                    <label htmlFor="seats">{t("trips.seatsToBook")}</label>
                    <input
                      id="seats"
                      type="number"
                      min={1}
                      max={Math.min(8, trip.availableSeats)}
                      value={seats}
                      onChange={(event) => setSeats(event.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">
                    {t("trips.bookNow")}
                  </button>
                </form>
              ) : (
                <p className="text-muted">
                  {trip.availableSeats <= 0 ? t("trips.noSeatsAvailable") : t("errors.TRIP_NOT_BOOKABLE")}
                </p>
              )}
            </div>
          )}

          {isDriver && (
            <div className="card trip-detail__section stack">
              <div className="row-between">
                <h2>{t("trips.manageBookings")}</h2>
                {trip.status === "SCHEDULED" && (
                  <div className="row">
                    <Link to={`/trips/${trip.id}/edit`} className="btn btn-outline btn-sm">
                      {t("trips.editAction")}
                    </Link>
                    <button type="button" className="btn btn-danger btn-sm" onClick={handleCancelTrip}>
                      {t("trips.cancelTrip")}
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              <h3>{t("trips.bookingsForTrip")}</h3>

              {tripBookings.length === 0 ? (
                <p className="text-muted">{t("trips.noBookingsForTrip")}</p>
              ) : (
                <div className="list-stack">
                  {tripBookings.map((booking) => (
                    <div key={booking.id} className="card card-compact booking-item">
                      <div className="booking-item__header">
                        <div className="row">
                          <Avatar user={booking.passenger} size={32} />
                          <span>
                            {booking.passenger?.firstName} {booking.passenger?.lastName}
                          </span>
                        </div>
                        <span className={`badge ${bookingStatusBadgeClass(booking.status)}`}>
                          {t(`bookings.status.${booking.status}`)}
                        </span>
                      </div>
                      <span className="text-sm text-muted">{t("bookings.seatsBooked", { count: booking.seats })}</span>
                      <div className="booking-item__actions">
                        {booking.status === "PENDING" && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleBookingDecision(booking.id, "ACCEPTED", "bookings.acceptConfirm")}
                            >
                              {t("bookings.accept")}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => handleBookingDecision(booking.id, "REJECTED", "bookings.rejectConfirm")}
                            >
                              {t("bookings.reject")}
                            </button>
                          </>
                        )}
                        <Link to={`/bookings/${booking.id}`} className="btn btn-ghost btn-sm">
                          {t("bookings.viewConversation")}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="search-map-wrapper">
          <TripLocationMap markers={markers} showPolyline height={400} />
        </div>
      </div>
    </div>
  );
}
