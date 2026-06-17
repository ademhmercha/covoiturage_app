"use strict";

const env = require("../config/env");
const logger = require("../utils/logger");

function notFoundHandler(req, res) {
  res.status(404).json({
    error: { message: "Ressource non trouvée.", code: "NOT_FOUND" },
  });
}

/**
 * Gestionnaire d'erreurs centralisé.
 *
 * - Log complet côté serveur (sans stack trace si l'erreur est "attendue").
 * - Réponse client générique : jamais de stack trace ni de détails internes
 *   en production (cahier des charges : "jamais de message d'erreur révélant
 *   la structure interne").
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  logger.error("Erreur traitée par le gestionnaire global", {
    message: err.message,
    status,
    path: req.path,
    method: req.method,
  });

  const isInternalError = status >= 500;

  const payload = {
    error: {
      message: isInternalError ? "Une erreur interne est survenue." : err.message,
      code: err.code || "INTERNAL_ERROR",
    },
  };

  if (!env.isProduction && isInternalError) {
    payload.error.stack = err.stack;
  }

  res.status(status).json(payload);
}

module.exports = { notFoundHandler, errorHandler };
