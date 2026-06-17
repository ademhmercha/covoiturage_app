"use strict";

const Queue = require("bull");
const env = require("../config/env");
const logger = require("../utils/logger");

// File Bull dédiée aux notifications différées (ex: rappel de départ).
// Les notifications immédiates (NEW_BOOKING, BOOKING_ACCEPTED, NEW_MESSAGE)
// sont écrites directement via notificationService — Bull n'est utile que
// pour la planification temporelle (cahier des charges section 7).
//
// Instanciation paresseuse : tant qu'aucune notification différée n'est
// planifiée/annulée, aucune connexion Redis n'est ouverte (utile pour les
// suites de tests qui rechargent `app` sans jamais appeler les routes
// /api/trips).
let queue = null;

function getNotificationQueue() {
  if (!queue) {
    queue = new Queue("notifications", env.redisUrl);
    queue.on("error", (err) => {
      logger.error("Erreur de file de notifications", { message: err.message });
    });
  }
  return queue;
}

async function closeNotificationQueue() {
  if (queue) {
    await queue.close();
    queue = null;
  }
}

module.exports = { getNotificationQueue, closeNotificationQueue };
