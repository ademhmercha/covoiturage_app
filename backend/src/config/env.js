"use strict";

const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

// En production, ces variables doivent être injectées via Azure Key Vault.
// Aucune valeur par défaut permissive n'est tolérée : on échoue au démarrage
// plutôt que de tourner avec une configuration dangereuse (ex: CORS ouvert,
// identifiants de base de données de développement, clé de chiffrement absente).
const REQUIRED_IN_PRODUCTION = [
  "CORS_ALLOWED_ORIGINS",
  "DATABASE_URL",
  "REDIS_URL",
  "FIELD_ENCRYPTION_KEY",
  "JWT_PRIVATE_KEY_PATH",
  "JWT_PUBLIC_KEY_PATH",
];

if (isProduction) {
  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `Configuration manquante en production : ${missing.join(", ")}. Arrêt du serveur.`
    );
    process.exit(1);
  }
}

function parseOrigins(value) {
  return (value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === "test",
  port: Number(process.env.PORT) || 4000,
  corsAllowedOrigins: parseOrigins(
    process.env.CORS_ALLOWED_ORIGINS || "http://localhost:5173"
  ),
  logLevel: process.env.LOG_LEVEL || "info",
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  },
  loginRateLimit: {
    windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
  },
  // Pas de valeur par défaut avec identifiants : DATABASE_URL doit venir de
  // .env (copié depuis .env.example) en dev/test, d'Azure Key Vault en prod.
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwt: {
    privateKeyPath: path.resolve(__dirname, "../..", process.env.JWT_PRIVATE_KEY_PATH || "./keys/private.pem"),
    publicKeyPath: path.resolve(__dirname, "../..", process.env.JWT_PUBLIC_KEY_PATH || "./keys/public.pem"),
    accessTokenTtlSeconds: Number(process.env.JWT_ACCESS_TOKEN_TTL_SECONDS) || 15 * 60,
    refreshTokenTtlSeconds: Number(process.env.JWT_REFRESH_TOKEN_TTL_SECONDS) || 7 * 24 * 60 * 60,
  },
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
};

module.exports = env;
