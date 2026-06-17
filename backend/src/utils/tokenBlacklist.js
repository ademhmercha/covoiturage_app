"use strict";

const redis = require("../config/redis");

// Liste noire des access tokens révoqués (déconnexion explicite). Clé =
// jti (UUID aléatoire du token, pas l'utilisateur), valeur expirée
// automatiquement par Redis à l'échéance naturelle du JWT — inutile de
// conserver l'entrée plus longtemps que le token n'aurait été valide.
const PREFIX = "blacklist:jti:";

async function blacklistAccessToken(jti, expiresAtEpochSeconds) {
  const ttlSeconds = expiresAtEpochSeconds - Math.floor(Date.now() / 1000);
  if (ttlSeconds <= 0) {
    return;
  }
  await redis.set(`${PREFIX}${jti}`, "1", "EX", ttlSeconds);
}

async function isAccessTokenBlacklisted(jti) {
  const value = await redis.get(`${PREFIX}${jti}`);
  return value !== null;
}

module.exports = { blacklistAccessToken, isAccessTokenBlacklisted };
