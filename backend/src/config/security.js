"use strict";

const env = require("./env");

/**
 * Politique CORS stricte : liste blanche explicite, jamais "*".
 * `credentials: true` n'est combiné qu'avec des origines whitelistées,
 * jamais avec une origine joker.
 */
const corsOptions = {
  origin(origin, callback) {
    // Pas d'en-tête Origin = appel non-navigateur (health check, service interne).
    // Le CORS ne protège que les requêtes navigateur ; ces appels sont gérés
    // par l'authentification applicative (étape 2), pas par CORS.
    if (!origin || env.corsAllowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    const error = new Error("Origine non autorisée par la politique CORS");
    error.status = 403;
    error.code = "CORS_NOT_ALLOWED";
    callback(error);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
};

/**
 * CSP stricte imposée par le cahier des charges, complétée par des
 * durcissements standards (object-src, base-uri, frame-ancestors).
 *
 * Note pour l'étape 8 (carte Leaflet) : Leaflet applique des styles inline
 * sur les marqueurs/tuiles via `element.style`. `style-src` devra alors être
 * revu (probable ajout de `'unsafe-inline'` limité à style-src uniquement,
 * jamais à script-src) — à traiter explicitement à ce moment-là.
 */
const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:"],
      imgSrc: ["'self'", "data:", "https://tile.openstreetmap.org"],
      // Messages vocaux : lecture de data URI audio (base64) côté <audio>.
      mediaSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  frameguard: { action: "deny" },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin" },
  hsts: {
    maxAge: 63072000, // 2 ans, conforme aux recommandations HSTS preload
    includeSubDomains: true,
    preload: true,
  },
  crossOriginResourcePolicy: { policy: "same-site" },
};

module.exports = { corsOptions, helmetOptions };
