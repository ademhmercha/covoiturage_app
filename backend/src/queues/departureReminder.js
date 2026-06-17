"use strict";

const { getNotificationQueue } = require("./notificationQueue");
const prisma = require("../db/prisma");
const logger = require("../utils/logger");
const { createNotification } = require("../services/notificationService");

const JOB_NAME = "departure-reminder";

// Rappel envoyé 1h avant le départ (cahier des charges section 7 :
// DEPARTURE_REMINDER).
const REMINDER_LEAD_MS = 60 * 60 * 1000;

function jobIdForTrip(tripId) {
  return `${JOB_NAME}:${tripId}`;
}

/**
 * Logique du job, exportée séparément pour pouvoir être testée sans
 * attendre le délai Bull (cahier des charges section 10 : couverture des
 * notifications).
 */
async function processDepartureReminder(job) {
  const { tripId } = job.data;

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (trip?.status !== "SCHEDULED") {
    return;
  }

  const acceptedBookings = await prisma.booking.findMany({
    where: { tripId, status: "ACCEPTED" },
    select: { passengerId: true },
  });

  const recipientIds = [trip.driverId, ...acceptedBookings.map((b) => b.passengerId)];
  const payload = {
    tripId: trip.id,
    originLabel: trip.originLabel,
    destinationLabel: trip.destinationLabel,
    departureAt: trip.departureAt.toISOString(),
  };

  await Promise.all(
    recipientIds.map((userId) => createNotification({ userId, type: "DEPARTURE_REMINDER", payload }))
  );

  logger.info("Rappels de départ envoyés", { tripId, recipients: recipientIds.length });
}

let processorRegistered = false;

function ensureProcessor(queue) {
  if (processorRegistered) return;
  processorRegistered = true;
  queue.process(JOB_NAME, processDepartureReminder);
}

/**
 * (Ré)planifie le rappel de départ d'un trajet. Supprime toute tâche
 * existante avant d'en ajouter une nouvelle — évite les doublons quand un
 * trajet est modifié (changement d'horaire) ou republié.
 */
async function scheduleDepartureReminder(trip) {
  const queue = getNotificationQueue();
  ensureProcessor(queue);

  const jobId = jobIdForTrip(trip.id);
  const existing = await queue.getJob(jobId);
  if (existing) {
    await existing.remove();
  }

  if (trip.status !== "SCHEDULED") {
    return;
  }

  const delay = trip.departureAt.getTime() - REMINDER_LEAD_MS - Date.now();
  if (delay <= 0) {
    // Départ trop proche (< 1h) ou déjà passé : pas de rappel.
    return;
  }

  await queue.add(JOB_NAME, { tripId: trip.id }, { jobId, delay });
}

/**
 * Annule le rappel de départ d'un trajet (ex: trajet annulé/supprimé).
 */
async function cancelDepartureReminder(tripId) {
  const queue = getNotificationQueue();
  ensureProcessor(queue);

  const existing = await queue.getJob(jobIdForTrip(tripId));
  if (existing) {
    await existing.remove();
  }
}

module.exports = {
  scheduleDepartureReminder,
  cancelDepartureReminder,
  processDepartureReminder,
  REMINDER_LEAD_MS,
  JOB_NAME,
};
