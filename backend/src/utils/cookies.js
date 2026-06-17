"use strict";

const env = require("../config/env");

// Cahier des charges : jamais de JWT en localStorage/sessionStorage. Access
// ET refresh tokens voyagent uniquement via cookies httpOnly + Secure +
// SameSite=Strict — invisibles au JavaScript (protection XSS) et non envoyés
// vers des sites tiers (protection CSRF de base, en complément de la
// whitelist CORS stricte).
//
// Compromis documenté : `secure` est forcé à true uniquement en production.
// En dev (http://localhost), les navigateurs modernes traitent localhost
// comme un contexte sécurisé et acceptent les cookies `Secure`, mais on
// n'impose pas HTTPS local pour ne pas bloquer le développement sur d'autres
// hôtes (ex: IP LAN en http://). La production est de toute façon forcée en
// HTTPS par `httpsRedirect` + HSTS.
const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";

const baseOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "strict",
  domain: env.cookieDomain,
};

function setAccessTokenCookie(res, token) {
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    ...baseOptions,
    path: "/",
    maxAge: env.jwt.accessTokenTtlSeconds * 1000,
  });
}

function setRefreshTokenCookie(res, token) {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...baseOptions,
    // Cookie de refresh restreint aux routes d'authentification : il n'est
    // jamais envoyé sur le reste de l'API, réduisant la surface d'attaque.
    path: "/api/auth",
    maxAge: env.jwt.refreshTokenTtlSeconds * 1000,
  });
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...baseOptions, path: "/" });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...baseOptions, path: "/api/auth" });
}

module.exports = {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
};
