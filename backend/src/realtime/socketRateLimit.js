"use strict";

const redis = require("../config/redis");

// Limite de débit Socket.IO : 10 messages/minute/utilisateur (cahier des
// charges section 8), implémentée via un compteur Redis avec expiration
// glissante (fenêtre fixe de 60s, suffisant pour une messagerie de chat).
const WINDOW_SECONDS = 60;
const MAX_MESSAGES = 10;

async function checkSocketRateLimit(userId) {
  const key = `ratelimit:socket:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  return count <= MAX_MESSAGES;
}

module.exports = { checkSocketRateLimit, MAX_MESSAGES, WINDOW_SECONDS };
