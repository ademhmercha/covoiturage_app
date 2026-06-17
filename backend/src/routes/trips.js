"use strict";

const express = require("express");
const { z } = require("zod");
const { createTripSchema, updateTripSchema, searchTripSchema, uuidSchema } = require("@wasel/shared");

const prisma = require("../db/prisma");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const authenticate = require("../middleware/authenticate");
const { validateBody, validateQuery, validateParams } = require("../middleware/validate");
const { serializeTrip } = require("../utils/serializers");
const { scheduleDepartureReminder, cancelDepartureReminder } = require("../queues/departureReminder");

const router = express.Router();

const tripParamsSchema = z.object({ tripId: uuidSchema });

const PUBLIC_DRIVER_SELECT = {
  select: { id: true, firstName: true, lastName: true, avatarUrl: true },
};

// Recherche géographique simplifiée par boîte englobante (~50km), sans
// dépendance PostGIS — suffisant pour du covoiturage inter-villes où les
// points de départ/arrivée correspondent à des villes, pas des adresses.
const SEARCH_RADIUS_DEG = 0.5;

function toPrismaTripData(body) {
  const data = { ...body };
  if (data.origin) {
    data.originLat = data.origin.lat;
    data.originLng = data.origin.lng;
    delete data.origin;
  }
  if (data.destination) {
    data.destinationLat = data.destination.lat;
    data.destinationLng = data.destination.lng;
    delete data.destination;
  }
  return data;
}

function dayRange(date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function getAcceptedSeatsMap(tripIds) {
  if (tripIds.length === 0) return new Map();
  const grouped = await prisma.booking.groupBy({
    by: ["tripId"],
    where: { tripId: { in: tripIds }, status: "ACCEPTED" },
    _sum: { seats: true },
  });
  return new Map(grouped.map((g) => [g.tripId, g._sum.seats || 0]));
}

function availableSeatsFor(trip, acceptedSeatsMap) {
  const accepted = acceptedSeatsMap.get(trip.id) || 0;
  return Math.max(0, trip.seatsAvailable - accepted);
}

router.post(
  "/",
  authenticate,
  validateBody(createTripSchema),
  asyncHandler(async (req, res) => {
    const trip = await prisma.trip.create({
      data: { ...toPrismaTripData(req.body), driverId: req.user.id },
      include: { driver: PUBLIC_DRIVER_SELECT },
    });

    await scheduleDepartureReminder(trip);

    return res.status(201).json({ trip: serializeTrip(trip, { availableSeats: trip.seatsAvailable }) });
  })
);

router.get(
  "/",
  validateQuery(searchTripSchema),
  asyncHandler(async (req, res) => {
    const { originLat, originLng, destinationLat, destinationLng, date, page, pageSize } = req.query;

    const now = new Date();
    const where = { status: "SCHEDULED", departureAt: { gte: now } };

    if (date) {
      const { start, end } = dayRange(date);
      where.departureAt = { gte: start > now ? start : now, lt: end };
    }

    if (originLat !== undefined && originLng !== undefined) {
      where.originLat = { gte: originLat - SEARCH_RADIUS_DEG, lte: originLat + SEARCH_RADIUS_DEG };
      where.originLng = { gte: originLng - SEARCH_RADIUS_DEG, lte: originLng + SEARCH_RADIUS_DEG };
    }

    if (destinationLat !== undefined && destinationLng !== undefined) {
      where.destinationLat = { gte: destinationLat - SEARCH_RADIUS_DEG, lte: destinationLat + SEARCH_RADIUS_DEG };
      where.destinationLng = { gte: destinationLng - SEARCH_RADIUS_DEG, lte: destinationLng + SEARCH_RADIUS_DEG };
    }

    const [trips, total] = await prisma.$transaction([
      prisma.trip.findMany({
        where,
        include: { driver: PUBLIC_DRIVER_SELECT },
        orderBy: { departureAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.trip.count({ where }),
    ]);

    const acceptedSeatsMap = await getAcceptedSeatsMap(trips.map((t) => t.id));

    return res.json({
      trips: trips.map((trip) => serializeTrip(trip, { availableSeats: availableSeatsFor(trip, acceptedSeatsMap) })),
      pagination: { page, pageSize, total },
    });
  })
);

router.get(
  "/mine",
  authenticate,
  asyncHandler(async (req, res) => {
    const trips = await prisma.trip.findMany({
      where: { driverId: req.user.id },
      orderBy: { departureAt: "desc" },
    });

    const acceptedSeatsMap = await getAcceptedSeatsMap(trips.map((t) => t.id));

    return res.json({
      trips: trips.map((trip) => serializeTrip(trip, { availableSeats: availableSeatsFor(trip, acceptedSeatsMap) })),
    });
  })
);

router.get(
  "/:tripId",
  validateParams(tripParamsSchema),
  asyncHandler(async (req, res) => {
    const trip = await prisma.trip.findUnique({
      where: { id: req.params.tripId },
      include: { driver: PUBLIC_DRIVER_SELECT },
    });

    if (!trip) {
      throw httpError(404, "Trajet introuvable.", "NOT_FOUND");
    }

    const acceptedSeatsMap = await getAcceptedSeatsMap([trip.id]);

    return res.json({ trip: serializeTrip(trip, { availableSeats: availableSeatsFor(trip, acceptedSeatsMap) }) });
  })
);

router.patch(
  "/:tripId",
  authenticate,
  validateParams(tripParamsSchema),
  validateBody(updateTripSchema),
  asyncHandler(async (req, res) => {
    if (Object.keys(req.body).length === 0) {
      throw httpError(400, "Aucune donnée à mettre à jour.", "VALIDATION_ERROR");
    }

    const trip = await prisma.trip.findUnique({ where: { id: req.params.tripId } });
    if (!trip) {
      throw httpError(404, "Trajet introuvable.", "NOT_FOUND");
    }
    if (trip.driverId !== req.user.id && req.user.role !== "ADMIN") {
      throw httpError(403, "Accès refusé.", "FORBIDDEN");
    }
    if (trip.status !== "SCHEDULED") {
      throw httpError(409, "Seul un trajet planifié peut être modifié.", "TRIP_NOT_EDITABLE");
    }

    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: toPrismaTripData(req.body),
      include: { driver: PUBLIC_DRIVER_SELECT },
    });

    await scheduleDepartureReminder(updated);

    const acceptedSeatsMap = await getAcceptedSeatsMap([updated.id]);

    return res.json({ trip: serializeTrip(updated, { availableSeats: availableSeatsFor(updated, acceptedSeatsMap) }) });
  })
);

router.delete(
  "/:tripId",
  authenticate,
  validateParams(tripParamsSchema),
  asyncHandler(async (req, res) => {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.tripId } });
    if (!trip) {
      throw httpError(404, "Trajet introuvable.", "NOT_FOUND");
    }
    if (trip.driverId !== req.user.id && req.user.role !== "ADMIN") {
      throw httpError(403, "Accès refusé.", "FORBIDDEN");
    }
    if (trip.status === "CANCELLED") {
      return res.status(204).end();
    }

    await prisma.trip.update({ where: { id: trip.id }, data: { status: "CANCELLED" } });
    await cancelDepartureReminder(trip.id);

    return res.status(204).end();
  })
);

module.exports = router;
