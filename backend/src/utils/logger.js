"use strict";

const winston = require("winston");
const env = require("../config/env");

// Clés jamais journalisées, même en cas d'erreur : mots de passe, tokens,
// PII et coordonnées GPS exactes (cahier des charges, section 14).
const SENSITIVE_KEYS = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "phone",
  "phonenumber",
  "email",
  "lat",
  "latitude",
  "lng",
  "lon",
  "longitude",
  "gps",
  "address",
]);

function redact(value, seen = new WeakSet()) {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen));
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    return Object.entries(value).reduce((acc, [key, val]) => {
      acc[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redact(val, seen);
      return acc;
    }, {});
  }

  return value;
}

// Redacte les métadonnées en place pour préserver les propriétés internes
// (Symbol) utilisées par les autres formats winston (colorize, etc.).
const redactMeta = winston.format((info) => {
  const { level, message, timestamp, ...meta } = info;
  Object.assign(info, redact(meta));
  return info;
});

const logger = winston.createLogger({
  level: env.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    redactMeta(),
    env.isProduction
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  transports: [new winston.transports.Console()],
  silent: env.isTest,
});

// Exposé pour les tests unitaires de la redaction (section 14 du cahier des
// charges) sans modifier l'API publique du logger (`logger.info(...)`, etc.).
logger.redact = redact;

module.exports = logger;
