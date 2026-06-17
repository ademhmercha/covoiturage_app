"use strict";

const Redis = require("ioredis");
const env = require("./env");
const logger = require("../utils/logger");

// Client Redis partagé : liste noire des tokens JWT révoqués, anti-brute-force
// par compte, rate limiting Socket.IO, et files Bull pour les notifications.
// Sécurité : aucune donnée personnelle n'est stockée dans Redis (uniquement
// des identifiants opaques : jti de tokens, userId, compteurs).
const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 3,
  // En test, on évite les tentatives de reconnexion infinies qui empêchent
  // Jest de se terminer proprement.
  lazyConnect: env.isTest,
});

redis.on("error", (err) => {
  logger.error("Erreur de connexion Redis", { message: err.message });
});

redis.on("connect", () => {
  logger.info("Connecté à Redis");
});

module.exports = redis;
