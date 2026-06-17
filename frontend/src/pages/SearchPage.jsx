import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import TripSearchForm from "../components/trips/TripSearchForm";
import TripCard from "../components/trips/TripCard";
import { SkeletonList } from "../components/common/Skeleton";
import EmptyState from "../components/common/EmptyState";
import { FilterIcon, HeartIcon } from "../components/icons";
import { searchTrips } from "../api/trips";
import { getFavorites, addFavorite, removeFavorite } from "../api/favorites";
import useAuthStore from "../store/authStore";
import { findCityByKey } from "../utils/cities";
import "./pages.css";

const PAGE_SIZE = 10;
const TIME_OF_DAY = ["any", "morning", "afternoon", "evening"];
const TIME_RANGES = { morning: [6, 12], afternoon: [12, 18], evening: [18, 24] };

export default function SearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");
  const [minSeats, setMinSeats] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("any");
  const sentinelRef = useRef(null);

  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const date = searchParams.get("date") || "";

  const fromCity = findCityByKey(from);
  const toCity = findCityByKey(to);

  const queryParams = {};
  if (fromCity) {
    queryParams.originLat = fromCity.lat;
    queryParams.originLng = fromCity.lng;
  }
  if (toCity) {
    queryParams.destinationLat = toCity.lat;
    queryParams.destinationLng = toCity.lng;
  }
  if (date) queryParams.date = date;

  const hasSearched = Boolean(from || to || date);
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated");
  const queryClient = useQueryClient();

  const { data: favData } = useQuery({
    queryKey: ["favorites"],
    queryFn: getFavorites,
    enabled: isAuthenticated,
  });

  const currentFavorite = (favData?.favorites ?? []).find(
    (f) => f.fromCity === from && f.toCity === to
  );

  async function handleToggleFavorite() {
    if (!from || !to) return;
    if (currentFavorite) {
      await removeFavorite(currentFavorite.id);
    } else {
      await addFavorite(from, to);
    }
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
  }

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["trips", "search", queryParams],
    queryFn: ({ pageParam }) => searchTrips({ ...queryParams, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.trips.length, 0);
      return loaded < lastPage.pagination.total ? allPages.length + 1 : undefined;
    },
    enabled: hasSearched,
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) fetchNextPage(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage]);

  const allTrips = data?.pages.flatMap((p) => p.trips) ?? [];
  const totalFromApi = data?.pages[0]?.pagination.total ?? 0;

  function applyClientFilters(list) {
    return list.filter((trip) => {
      if (maxPrice && trip.pricePerSeat > Number(maxPrice)) return false;
      if (minSeats && trip.availableSeats < Number(minSeats)) return false;
      if (timeOfDay !== "any") {
        const hour = new Date(trip.departureAt).getUTCHours();
        const [start, end] = TIME_RANGES[timeOfDay];
        if (hour < start || hour >= end) return false;
      }
      return true;
    });
  }

  const filtered = applyClientFilters(allTrips);
  const activeFilterCount = [maxPrice, minSeats, timeOfDay !== "any"].filter(Boolean).length;

  return (
    <div className="container">
      <div className="page-header">
        <h1>{t("trips.searchTitle")}</h1>
      </div>

      <div className="card search-form-card">
        <TripSearchForm initialValues={{ from, to, date }} onSearch={(params) => setSearchParams(params)} />
      </div>

      <div className="search-filters-bar">
        <button
          type="button"
          className={`btn btn-outline btn-sm ${activeFilterCount > 0 ? "btn-filter-active" : ""}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          <FilterIcon />
          {t("trips.filters")}
          {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { setMaxPrice(""); setMinSeats(""); setTimeOfDay("any"); }}
          >
            {t("trips.clearFilters")}
          </button>
        )}
      </div>

      {showFilters && (
        <div className="card search-filters-panel">
          <div className="field-grid search-filters-grid">
            <div className="field">
              <label htmlFor="filter-price">{t("trips.maxPrice")}</label>
              <input
                id="filter-price"
                type="number"
                min={0}
                placeholder="—"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="filter-seats">{t("trips.minSeats")}</label>
              <input
                id="filter-seats"
                type="number"
                min={1}
                max={8}
                placeholder="1"
                value={minSeats}
                onChange={(e) => setMinSeats(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="filter-time">{t("trips.timeOfDay")}</label>
              <select id="filter-time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)}>
                {TIME_OF_DAY.map((tod) => (
                  <option key={tod} value={tod}>{t(`trips.tod_${tod}`)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {hasSearched && (
        <div className="search-results-header row-between">
          <h2>
            {isLoading
              ? t("common.loading")
              : t("trips.results", { count: totalFromApi })}
          </h2>
          {isAuthenticated && from && to && (
            <button
              type="button"
              className={`btn btn-ghost btn-sm ${currentFavorite ? "fav-active" : ""}`}
              onClick={handleToggleFavorite}
              aria-label={currentFavorite ? t("trips.removeFavorite") : t("trips.addFavorite")}
              title={currentFavorite ? t("trips.removeFavorite") : t("trips.addFavorite")}
            >
              <HeartIcon className={currentFavorite ? "heart-filled" : ""} />
            </button>
          )}
        </div>
      )}

      {isLoading && <SkeletonList count={3} variant="trip" />}

      {isError && <div className="alert alert-danger">{t("errors.GENERIC")}</div>}

      {!isLoading && !isError && hasSearched && filtered.length === 0 && (
        <EmptyState
          variant="search"
          title={t("trips.noTrips")}
          description={t("trips.noTripsDesc")}
        />
      )}

      {!hasSearched && !isLoading && (
        <EmptyState
          variant="search"
          title={t("trips.startSearchTitle")}
          description={t("trips.startSearchDesc")}
        />
      )}

      <div className="list-stack">
        {filtered.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>

      {hasNextPage && (
        <div ref={sentinelRef} className="infinite-sentinel" aria-hidden="true" />
      )}

      {isFetchingNextPage && <SkeletonList count={2} variant="trip" />}
    </div>
  );
}
