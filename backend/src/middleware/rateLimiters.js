"use strict";

const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const logger = require("../utils/logger");

/**
 * Factory réutilisable pour tous les limiteurs de débit de l'application
 * (limiteur global ici, limiteur de login à l'étape 2, Socket.IO à l'étape 7).
 *
 * Toute requête bloquée est journalisée comme événement de sécurité
 * (cahier des charges section 14), sans donnée personnelle.
 */
function createRateLimiter({ windowMs, max, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler(req, res) {
      logger.warn("Limite de requêtes dépassée", {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      res.status(429).json({
        error: {
          message: message || "Trop de requêtes, veuillez réessayer plus tard.",
          code: "RATE_LIMIT_EXCEEDED",
        },
      });
    },
  });
}

// Limiteur global : 100 requêtes/minute/IP par défaut (configurable via env).
const globalLimiter = createRateLimiter({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  message: "Trop de requêtes depuis cette adresse IP, veuillez réessayer plus tard.",
});

module.exports = { createRateLimiter, globalLimiter };
