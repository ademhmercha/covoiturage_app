"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

const ISSUER = "wasel-api";
const AUDIENCE = "wasel-app";

// Clés RS256 chargées une seule fois au démarrage (générées via
// `npm run generate:keys`, jamais commitées — voir .gitignore).
// En production, ces fichiers sont fournis via Azure Key Vault.
const privateKey = fs.readFileSync(env.jwt.privateKeyPath, "utf8");
const publicKey = fs.readFileSync(env.jwt.publicKeyPath, "utf8");

/**
 * Émet un access token JWT RS256 de courte durée (15 min par défaut).
 * Payload minimal : `sub` (UUID utilisateur), `role`, `jti` unique
 * (utilisé pour la liste noire Redis lors de la déconnexion).
 */
function signAccessToken(user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ role: user.role }, privateKey, {
    algorithm: "RS256",
    subject: user.id,
    expiresIn: env.jwt.accessTokenTtlSeconds,
    jwtid: jti,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return { token, jti };
}

/**
 * Vérifie un access token. Lève une erreur (TokenExpiredError,
 * JsonWebTokenError, ...) si invalide, expiré, ou signé avec une autre clé.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

/**
 * Génère un refresh token opaque (haute entropie, non-JWT). Seul son hash
 * SHA-256 est stocké en base (table refresh_tokens) — le token en clair
 * n'existe que dans le cookie httpOnly côté client.
 */
function generateRefreshToken() {
  const token = crypto.randomBytes(40).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
};
