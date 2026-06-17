"use strict";

// Cahier des charges section 7 : 30 secondes maximum par requête.
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Renvoie une réponse 503 propre (au lieu d'une coupure de connexion brute)
 * si une requête met plus de 30s à être traitée.
 */
function requestTimeout(req, res, next) {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(503).json({
        error: {
          message: "La requête a dépassé le délai autorisé.",
          code: "REQUEST_TIMEOUT",
        },
      });
    }
  });

  next();
}

module.exports = requestTimeout;
