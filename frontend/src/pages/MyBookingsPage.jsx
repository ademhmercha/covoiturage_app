import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import Avatar from "../components/common/Avatar";
import { SkeletonList } from "../components/common/Skeleton";
import EmptyState from "../components/common/EmptyState";
import { MapPinIcon } from "../components/icons";
import { getMyBookings, updateBookingStatus } from "../api/bookings";
import { getErrorMessage } from "../utils/apiError";
import { formatDateTime } from "../utils/format";
import { bookingStatusBadgeClass } from "../utils/statusBadge";
import "../components/trips/trips.css";
import "./pages.css";

export default function MyBookingsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const { data, isLoading, isError } = useQuery({ queryKey: ["bookings", "mine"], queryFn: getMyBookings });
  const bookings = data?.bookings || [];

  async function handleCancel(bookingId) {
    if (!window.confirm(t("bookings.cancelBookingConfirm"))) return;
    setError("");
    try {
      await updateBookingStatus(bookingId, "CANCELLED");
      queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] });
    } catch (err) {
      setError(getErrorMessage(err, t));
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>{t("bookings.myBookingsTitle")}</h1>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {isLoading && <SkeletonList count={3} variant="trip" />}

      {isError && <div className="alert alert-danger">{t("errors.GENERIC")}</div>}

      {!isLoading && !isError && bookings.length === 0 && (
        <EmptyState
          variant="bookings"
          title={t("bookings.noBookings")}
          description={t("bookings.noBookingsDesc")}
          actionLabel={t("nav.search")}
          actionTo="/search"
        />
      )}

      <div className="list-stack">
        {bookings.map((booking) => (
          <div key={booking.id} className="card booking-item">
            <div className="booking-item__header">
              <div className="booking-item__route">
                <MapPinIcon className="trip-card__pin--origin" />
                <span>{booking.trip.originLabel}</span>
                <span className="trip-detail__route-arrow">{i18n.dir() === "rtl" ? "←" : "→"}</span>
                <MapPinIcon className="trip-card__pin--destination" />
                <span>{booking.trip.destinationLabel}</span>
              </div>
              <span className={`badge ${bookingStatusBadgeClass(booking.status)}`}>{t(`bookings.status.${booking.status}`)}</span>
            </div>

            <div className="row text-sm text-muted">
              <span>{formatDateTime(booking.trip.departureAt, i18n.language)}</span>
              <span>{t("bookings.seatsBooked", { count: booking.seats })}</span>
              <span>{t("common.pricePerSeat", { price: booking.trip.pricePerSeat })}</span>
            </div>

            <div className="row">
              <Avatar user={booking.trip.driver} size={28} />
              <span className="text-sm">
                {booking.trip.driver?.firstName} {booking.trip.driver?.lastName}
              </span>
            </div>

            <div className="booking-item__actions">
              <Link to={`/bookings/${booking.id}`} className="btn btn-outline btn-sm">
                {t("bookings.viewConversation")}
              </Link>
              {(booking.status === "PENDING" || booking.status === "ACCEPTED") && (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleCancel(booking.id)}>
                  {t("bookings.cancelBooking")}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
