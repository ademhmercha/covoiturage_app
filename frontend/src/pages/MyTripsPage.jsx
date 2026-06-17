import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import TripCard from "../components/trips/TripCard";
import { SkeletonList } from "../components/common/Skeleton";
import EmptyState from "../components/common/EmptyState";
import { getMyTrips } from "../api/trips";
import "./pages.css";

export default function MyTripsPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({ queryKey: ["trips", "mine"], queryFn: getMyTrips });

  const trips = data?.trips || [];

  return (
    <div className="container">
      <div className="page-header row-between">
        <h1>{t("trips.myTripsTitle")}</h1>
        <Link to="/trips/new" className="btn btn-primary">
          {t("home.publishCta")}
        </Link>
      </div>

      {isLoading && <SkeletonList count={3} variant="trip" />}

      {isError && <div className="alert alert-danger">{t("errors.GENERIC")}</div>}

      {!isLoading && !isError && trips.length === 0 && (
        <EmptyState
          variant="trips"
          title={t("trips.noMyTrips")}
          description={t("trips.noMyTripsDesc")}
          actionLabel={t("home.publishCta")}
          actionTo="/trips/new"
        />
      )}

      <div className="list-stack">
        {trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  );
}
