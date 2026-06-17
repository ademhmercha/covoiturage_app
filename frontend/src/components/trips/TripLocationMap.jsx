import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { LocateIcon } from "../icons";
import { USER_LOCATION_ICON } from "./mapIcons";

// Vite ne résout pas les assets Leaflet par défaut — on les force ici.
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const TUNISIA_CENTER = [34.5, 9.5];
const DEFAULT_ZOOM = 7;
const SINGLE_POINT_ZOOM = 13;

function MapController({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], SINGLE_POINT_ZOOM);
    } else {
      map.fitBounds(points, { padding: [40, 40] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(points)]);
  return null;
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

/**
 * Carte réutilisable — recherche, détail de trajet, sélection de points.
 * Les coordonnées affichées sont arrondies à 3 décimales côté serveur (~111 m) :
 * la carte ne révèle jamais une adresse précise (cahier des charges §6).
 */
export default function TripLocationMap({
  markers = [],
  onMapClick,
  onMarkerDrag,
  userLocation,
  onLocated,
  showPolyline = false,
  height = 320,
}) {
  const { t } = useTranslation();
  const mapRef = useRef(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  const points = markers.map((m) => [m.lat, m.lng]);

  function handleLocate() {
    if (!navigator.geolocation) {
      setLocateError(t("trips.locateError"));
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mapRef.current?.flyTo([latlng.lat, latlng.lng], 14, { animate: true, duration: 1 });
        setLocating(false);
        onLocated?.(latlng);
      },
      () => {
        setLocateError(t("trips.locateError"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className={`map-wrapper${onMapClick ? " map-wrapper--clickable" : ""}`} style={{ height }}>
      <MapContainer
        center={points[0] || TUNISIA_CENTER}
        zoom={points.length ? SINGLE_POINT_ZOOM : DEFAULT_ZOOM}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <MapController mapRef={mapRef} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {markers.map((marker, idx) => (
          <Marker
            key={idx}
            position={[marker.lat, marker.lng]}
            icon={marker.icon}
            draggable={Boolean(onMarkerDrag)}
            eventHandlers={
              onMarkerDrag
                ? {
                    dragend(e) {
                      onMarkerDrag(marker.name ?? idx, e.target.getLatLng());
                    },
                  }
                : {}
            }
          >
            {marker.popup && <Popup>{marker.popup}</Popup>}
          </Marker>
        ))}

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={USER_LOCATION_ICON}
            interactive={false}
          />
        )}

        {showPolyline && points.length === 2 && (
          <Polyline
            positions={points}
            pathOptions={{ color: "#4f46e5", weight: 3, dashArray: "6 8" }}
          />
        )}

        {onMapClick && <ClickHandler onMapClick={onMapClick} />}
        <FitBounds points={points} />
      </MapContainer>

      {onLocated && (
        <div className="map-overlay-controls">
          <button
            type="button"
            className="map-locate-btn"
            onClick={handleLocate}
            disabled={locating}
            aria-label={t("trips.locateMe")}
            title={t("trips.locateMe")}
          >
            {locating ? <span className="spinner" /> : <LocateIcon />}
          </button>
        </div>
      )}

      {locateError && (
        <p className="map-locate-error" role="alert">
          {locateError}
        </p>
      )}
    </div>
  );
}
