"use strict";

const { verifyAccessToken } = require("../utils/jwt");
const { isAccessTokenBlacklisted } = require("../utils/tokenBlacklist");
const { ACCESS_TOKEN_COOKIE } = require("../utils/cookies");

/**
 * Authentifie la requête via le cookie httpOnly `access_token` (JWT RS256).
 * Rejette avec 401 générique si absent, invalide, expiré, ou révoqué
 * (liste noire Redis — déconnexion explicite).
 *
 * Ne révèle jamais la raison précise (token absent vs expiré vs invalide)
 * dans le message client, pour ne pas faciliter le fingerprinting.
 */
async function authenticate(req, res, next) {
  const token = req.cookies ? req.cookies[ACCESS_TOKEN_COOKIE] : undefined;

  if (!token) {
    return res.status(401).json({
      error: { message: "Authentification requise.", code: "UNAUTHENTICATED" },
    });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return res.status(401).json({
      error: { message: "Session invalide ou expirée.", code: "INVALID_TOKEN" },
    });
  }

  if (await isAccessTokenBlacklisted(payload.jti)) {
    return res.status(401).json({
      error: { message: "Session invalide ou expirée.", code: "INVALID_TOKEN" },
    });
  }

  req.user = {
    id: payload.sub,
    role: payload.role,
    jti: payload.jti,
    exp: payload.exp,
  };

  next();
}

module.exports = authenticate;
