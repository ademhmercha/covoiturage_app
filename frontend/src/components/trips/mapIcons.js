import L from "leaflet";

function dropPin(fill) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.625 12.578 21.08 13.106 21.573a1.25 1.25 0 0 0 1.788 0C15.422 35.08 28 23.625 28 14 28 6.268 21.732 0 14 0z" fill="${fill}"/>
    <circle cx="14" cy="13" r="5.5" fill="rgba(255,255,255,0.92)"/>
  </svg>`;
  return L.divIcon({
    className: "wasel-pin",
    html: svg,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  });
}

export const MAP_ICONS = {
  origin: dropPin("#4f46e5"),
  destination: dropPin("#f97316"),
};

export const USER_LOCATION_ICON = L.divIcon({
  className: "wasel-pin",
  html: '<div class="map-user-dot"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
