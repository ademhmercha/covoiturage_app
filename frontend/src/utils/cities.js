// Villes tunisiennes principales utilisées pour la recherche de trajets.
// Les coordonnées servent de centre à la recherche par boîte englobante
// (~50km, voir backend/src/routes/trips.js) — il ne s'agit pas de positions
// exactes de passagers/conducteurs (cf. politique de confidentialité géoloc).
export const CITIES = [
  { key: "tunis", nameFr: "Tunis", nameAr: "تونس", lat: 36.8065, lng: 10.1815 },
  { key: "sfax", nameFr: "Sfax", nameAr: "صفاقس", lat: 34.7406, lng: 10.7603 },
  { key: "sousse", nameFr: "Sousse", nameAr: "سوسة", lat: 35.8256, lng: 10.6411 },
  { key: "kairouan", nameFr: "Kairouan", nameAr: "القيروان", lat: 35.6781, lng: 10.0963 },
  { key: "bizerte", nameFr: "Bizerte", nameAr: "بنزرت", lat: 37.2744, lng: 9.8739 },
  { key: "gabes", nameFr: "Gabès", nameAr: "قابس", lat: 33.8815, lng: 10.0982 },
  { key: "ariana", nameFr: "Ariana", nameAr: "أريانة", lat: 36.8625, lng: 10.1956 },
  { key: "gafsa", nameFr: "Gafsa", nameAr: "قفصة", lat: 34.425, lng: 8.7842 },
  { key: "monastir", nameFr: "Monastir", nameAr: "المنستير", lat: 35.778, lng: 10.8262 },
  { key: "nabeul", nameFr: "Nabeul", nameAr: "نابل", lat: 36.4561, lng: 10.7376 },
  { key: "medenine", nameFr: "Médenine", nameAr: "مدنين", lat: 33.3549, lng: 10.5055 },
  { key: "beja", nameFr: "Béja", nameAr: "باجة", lat: 36.7256, lng: 9.1817 },
  { key: "jendouba", nameFr: "Jendouba", nameAr: "جندوبة", lat: 36.5011, lng: 8.78 },
  { key: "mahdia", nameFr: "Mahdia", nameAr: "المهدية", lat: 35.5047, lng: 11.0622 },
  { key: "kasserine", nameFr: "Kasserine", nameAr: "القصرين", lat: 35.1676, lng: 8.8365 },
];

export function cityName(city, lang) {
  return lang === "ar" ? city.nameAr : city.nameFr;
}

export function findCityByKey(key) {
  return CITIES.find((city) => city.key === key) || null;
}
