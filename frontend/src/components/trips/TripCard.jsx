import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Avatar from "../common/Avatar";
import { MapPinIcon, BadgeCheckIcon } from "../icons";
import { formatDateTime } from "../../utils/format";
import { tripStatusBadgeClass } from "../../utils/statusBadge";
import "./trips.css";

export default function TripCard({ trip }) {
  const { t, i18n } = useTranslation();
  const seats = trip.availableSeats ?? trip.seatsAvailable;
  const isFull = seats <= 0;

  let availabilityBadge;
  if (trip.status !== "SCHEDULED") {
    availabilityBadge = <span className={`badge ${tripStatusBadgeClass(trip.status)}`}>{t(`trips.status.${trip.status}`)}</span>;
  } else if (isFull) {
    availabilityBadge = <span className="badge badge-danger">{t("trips.noSeatsAvailable")}</span>;
  } else {
    availabilityBadge = <span className="badge badge-success">{t("trips.seatsAvailable", { count: seats })}</span>;
  }

  return (
    <div className="card card--hover trip-card">
      <div className="trip-card__route">
        <div className="trip-card__place">
          <MapPinIcon className="trip-card__pin--origin" />
          <span>{trip.originLabel}</span>
        </div>
        <div className="trip-card__divider" />
        <div className="trip-card__place">
          <MapPinIcon className="trip-card__pin--destination" />
          <span>{trip.destinationLabel}</span>
        </div>
      </div>

      <div className="trip-card__meta">
        <span>{formatDateTime(trip.departureAt, i18n.language)}</span>
        <span className="trip-card__price">{t("common.pricePerSeat", { price: trip.pricePerSeat })}</span>
      </div>

      <div className="row-between trip-card__footer">
        <div className="row">
          <Avatar user={trip.driver} size={32} />
          <span className="text-sm">
            {trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : ""}
          </span>
          {trip.driver?.isVerified && (
            <BadgeCheckIcon className="verified-badge" aria-label="Conducteur vérifié" />
          )}
        </div>
        <div className="row">
          {availabilityBadge}
          <Link to={`/trips/${trip.id}`} className="btn btn-primary btn-sm">
            {t("trips.viewDetails")}
          </Link>
        </div>
      </div>
    </div>
  );
}
