"use strict";

const express = require("express");
const { coordinatesSchema, stripControlChars } = require("@wasel/shared");

const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const authenticate = require("../middleware/authenticate");
const { validateQuery } = require("../middleware/validate");
const { createRateLimiter } = require("../middleware/rateLimiters");
const logger = require("../utils/logger");

const router = express.Router();

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_TIMEOUT_MS = 5000;
const MAX_LABEL_LENGTH = 120;

// Géocodage inverse (carte -> libellé de lieu) : proxy serveur vers Nominatim
// (cahier des charges section 9 "Géolocalisation"). Le frontend n'appelle
// jamais directement un service tiers (CSP `connect-src 'self' wss:`
// inchangée) ; toutes les requêtes sortantes sont journalisées et limitées.
//
// 20 requêtes/min/utilisateur : conforme à la politique d'usage de Nominatim
// (≈1 req/s max) et au rate limiting global (cahier des charges section 7).
const geocodeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: "Trop de requêtes de géocodage, veuillez réessayer plus tard.",
  keyGenerator: (req) => req.user.id,
});

// Authentification requise : cet endpoint n'est utile que sur le formulaire
// de publication/édition de trajet (déjà protégé), et l'authentification
// permet un rate limiting par utilisateur plutôt que par IP partagée.
router.use(authenticate);

router.get(
  "/reverse",
  geocodeLimiter,
  validateQuery(coordinatesSchema),
  asyncHandler(async (req, res) => {
    // `coordinatesSchema` arrondit déjà lat/lng à 3 décimales (~111m) : même
    // les requêtes vers un service tiers n'exposent pas de position exacte.
    const { lat, lng } = req.query;

    const url = new URL(NOMINATIM_REVERSE_URL);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("zoom", "16");
    url.searchParams.set("addressdetails", "0");
    url.searchParams.set("accept-language", "fr");

    let response;
    try {
      response = await fetch(url, {
        headers: {
          // Politique d'usage Nominatim : un User-Agent identifiable est obligatoire.
          "User-Agent": "Wasel/1.0 (https://wasel.example)",
          "Accept-Language": "fr",
        },
        signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
      });
    } catch (err) {
      logger.warn("Géocodage inverse indisponible", { reason: err.name });
      throw httpError(503, "Service de géocodage temporairement indisponible.", "GEOCODE_UNAVAILABLE");
    }

    if (!response.ok) {
      logger.warn("Géocodage inverse : réponse non OK", { status: response.status });
      throw httpError(503, "Service de géocodage temporairement indisponible.", "GEOCODE_UNAVAILABLE");
    }

    const data = await response.json();
    const rawLabel = typeof data?.display_name === "string" ? data.display_name : "";
    // Toujours retraiter la sortie d'un service tiers comme une entrée non
    // fiable : suppression des caractères de contrôle + troncature à la
    // longueur maximale acceptée par `placeLabelSchema` (cahier des charges
    // section 3, validation/sanitisation).
    const label = stripControlChars(rawLabel).slice(0, MAX_LABEL_LENGTH);

    return res.json({ label, lat, lng });
  })
);

module.exports = router;
