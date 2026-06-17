import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import EmptyState from "../components/common/EmptyState";
import { HeartIcon, MapPinIcon } from "../components/icons";
import { getFavorites, removeFavorite } from "../api/favorites";
import "./pages.css";

export default function FavoritesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["favorites"],
    queryFn: getFavorites,
  });

  const { mutate: deleteFav } = useMutation({
    mutationFn: removeFavorite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const favorites = data?.favorites ?? [];

  return (
    <div className="container">
      <div className="page-header">
        <h1>{t("favorites.title")}</h1>
      </div>

      {isLoading && <span className="spinner" />}

      {isError && <div className="alert alert-danger">{t("errors.GENERIC")}</div>}

      {!isLoading && !isError && favorites.length === 0 && (
        <EmptyState
          variant="search"
          title={t("favorites.empty")}
          description={t("favorites.emptyDesc")}
          actionLabel={t("nav.search")}
          actionTo="/search"
        />
      )}

      <div className="list-stack">
        {favorites.map((fav) => (
          <div key={fav.id} className="card row-between">
            <div className="row">
              <MapPinIcon className="trip-card__pin--origin" />
              <span className="text-sm">
                <strong>{fav.fromCity}</strong>
                {" → "}
                <strong>{fav.toCity}</strong>
              </span>
            </div>
            <div className="row">
              <Link
                to={`/search?from=${encodeURIComponent(fav.fromCity)}&to=${encodeURIComponent(fav.toCity)}`}
                className="btn btn-outline btn-sm"
              >
                {t("nav.search")}
              </Link>
              <button
                type="button"
                className="btn btn-ghost btn-sm fav-active"
                aria-label={t("trips.removeFavorite")}
                onClick={() => deleteFav(fav.id)}
              >
                <HeartIcon className="heart-filled" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
