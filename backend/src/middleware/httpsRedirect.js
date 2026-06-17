"use strict";

const env = require("../config/env");

/**
 * Redirige HTTP -> HTTPS en production.
 *
 * Azure App Service termine le TLS au niveau du load balancer et transmet
 * la requête en HTTP interne avec l'en-tête `x-forwarded-proto`. On se base
 * donc sur cet en-tête plutôt que sur `req.secure`.
 *
 * No-op en dehors de la production (dev local en HTTP).
 */
function httpsRedirect(req, res, next) {
  if (!env.isProduction) {
    next();
    return;
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (forwardedProto && forwardedProto !== "https") {
    res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    return;
  }

  next();
}

module.exports = httpsRedirect;
