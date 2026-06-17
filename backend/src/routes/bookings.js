"use strict";

const express = require("express");
const { z } = require("zod");
const { createBookingSchema, updateBookingStatusSchema, uuidSchema } = require("@wasel/shared");

const prisma = require("../db/prisma");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const authenticate = require("../middleware/authenticate");
const { validateBody, validateParams } = require("../middleware/validate");
const { serializeBooking, serializeConversation, serializeRating } = require("../utils/serializers");
const { createNotification } = require("../services/notificationService");

const router = express.Router();

const bookingParamsSchema = z.object({ bookingId: uuidSchema });
const tripParamsSchema = z.object({ tripId: uuidSchema });

const PUBLIC_USER_SELECT = {
  select: { id: true, firstName: true, lastName: true, avatarUrl: true },
};

async function notifyNewBooking(booking) {
  await createNotification({
    userId: booking.trip.driverId,
    type: "NEW_BOOKING",
    payload: {
      bookingId: booking.id,
      tripId: booking.tripId,
      passengerId: booking.passengerId,
      passengerName: `${booking.passenger.firstName} ${booking.passenger.lastName}`,
      seats: booking.seats,
      originLabel: booking.trip.originLabel,
      destinationLabel: booking.trip.destinationLabel,
      departureAt: booking.trip.departureAt.toISOString(),
    },
  });
}

async function notifyBookingAccepted(booking) {
  await createNotification({
    userId: booking.passengerId,
    type: "BOOKING_ACCEPTED",
    payload: {
      bookingId: booking.id,
      tripId: booking.tripId,
      driverName: `${booking.trip.driver.firstName} ${booking.trip.driver.lastName}`,
      originLabel: booking.trip.originLabel,
      destinationLabel: booking.trip.destinationLabel,
      departureAt: booking.trip.departureAt.toISOString(),
    },
  });
}

/**
 * Vérifie que `user` est autorisé à appliquer la transition `status` sur
 * `booking`, et que l'état actuel le permet. Extrait du handler PATCH pour
 * limiter sa complexité cognitive.
 */
function assertBookingStatusTransition(booking, status, user) {
  const isPassenger = booking.passengerId === user.id;
  const isDriver = booking.trip.driverId === user.id;
  const isAdmin = user.role === "ADMIN";

  if (status === "CANCELLED") {
    // Annulation : uniquement le passager concerné (ou un admin).
    if (!isPassenger && !isAdmin) {
      throw httpError(403, "Accès refusé.", "FORBIDDEN");
    }
    if (booking.status === "CANCELLED") {
      throw httpError(409, "Cette réservation est déjà annulée.", "ALREADY_CANCELLED");
    }
    return;
  }

  // ACCEPTED / REJECTED : décision réservée au conducteur du trajet (ou admin).
  if (!isDriver && !isAdmin) {
    throw httpError(403, "Accès refusé.", "FORBIDDEN");
  }
  if (booking.status !== "PENDING") {
    throw httpError(409, "Cette réservation a déjà été traitée.", "ALREADY_DECIDED");
  }
}

async function assertSeatsAvailable(booking) {
  const acceptedSeats = await prisma.booking.aggregate({
    where: { tripId: booking.tripId, status: "ACCEPTED" },
    _sum: { seats: true },
  });
  const available = booking.trip.seatsAvailable - (acceptedSeats._sum.seats || 0);
  if (booking.seats > available) {
    throw httpError(409, "Plus assez de places disponibles.", "NOT_ENOUGH_SEATS");
  }
}

// Toutes les routes /api/bookings nécessitent une session valide.
router.use(authenticate);

router.post(
  "/",
  validateBody(createBookingSchema),
  asyncHandler(async (req, res) => {
    const { tripId, seats } = req.body;

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      throw httpError(404, "Trajet introuvable.", "NOT_FOUND");
    }
    if (trip.status !== "SCHEDULED" || trip.departureAt <= new Date()) {
      throw httpError(409, "Ce trajet n'accepte plus de réservations.", "TRIP_NOT_BOOKABLE");
    }
    if (trip.driverId === req.user.id) {
      throw httpError(400, "Vous ne pouvez pas réserver votre propre trajet.", "OWN_TRIP");
    }

    const existing = await prisma.booking.findFirst({
      where: { tripId, passengerId: req.user.id, status: { in: ["PENDING", "ACCEPTED"] } },
    });
    if (existing) {
      throw httpError(409, "Vous avez déjà une réservation active pour ce trajet.", "BOOKING_EXISTS");
    }

    const acceptedSeats = await prisma.booking.aggregate({
      where: { tripId, status: "ACCEPTED" },
      _sum: { seats: true },
    });
    const available = trip.seatsAvailable - (acceptedSeats._sum.seats || 0);
    if (seats > available) {
      throw httpError(409, "Plus assez de places disponibles.", "NOT_ENOUGH_SEATS");
    }

    const booking = await prisma.booking.create({
      data: { tripId, passengerId: req.user.id, seats, status: "PENDING" },
      include: {
        trip: { include: { driver: PUBLIC_USER_SELECT } },
        passenger: PUBLIC_USER_SELECT,
      },
    });

    await notifyNewBooking(booking);

    return res.status(201).json({ booking: serializeBooking(booking) });
  })
);

router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const bookings = await prisma.booking.findMany({
      where: { passengerId: req.user.id },
      include: { trip: { include: { driver: PUBLIC_USER_SELECT } } },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ bookings: bookings.map((b) => serializeBooking(b)) });
  })
);

// Liste des conversations (réservations où l'utilisateur est passager OU
// conducteur du trajet), avec aperçu du dernier message — alimente la page
// "Messages" de la navbar. Déclarée avant /:bookingId pour éviter tout
// conflit de routing avec le paramètre dynamique.
router.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const bookings = await prisma.booking.findMany({
      where: { OR: [{ passengerId: req.user.id }, { trip: { driverId: req.user.id } }] },
      include: {
        trip: { include: { driver: PUBLIC_USER_SELECT } },
        passenger: PUBLIC_USER_SELECT,
        messages: { take: 1, orderBy: { createdAt: "desc" } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ conversations: bookings.map((b) => serializeConversation(b, req.user.id)) });
  })
);

// Vue conducteur : toutes les réservations reçues pour un de ses trajets.
router.get(
  "/trip/:tripId",
  validateParams(tripParamsSchema),
  asyncHandler(async (req, res) => {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.tripId } });
    if (!trip) {
      throw httpError(404, "Trajet introuvable.", "NOT_FOUND");
    }
    if (trip.driverId !== req.user.id && req.user.role !== "ADMIN") {
      throw httpError(403, "Accès refusé.", "FORBIDDEN");
    }

    const bookings = await prisma.booking.findMany({
      where: { tripId: trip.id },
      include: { passenger: PUBLIC_USER_SELECT },
      orderBy: { createdAt: "asc" },
    });

    return res.json({ bookings: bookings.map((b) => serializeBooking(b)) });
  })
);

router.get(
  "/:bookingId",
  validateParams(bookingParamsSchema),
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      include: {
        trip: { include: { driver: PUBLIC_USER_SELECT } },
        passenger: PUBLIC_USER_SELECT,
      },
    });
    if (!booking) {
      throw httpError(404, "Réservation introuvable.", "NOT_FOUND");
    }

    const isPassenger = booking.passengerId === req.user.id;
    const isDriver = booking.trip.driverId === req.user.id;
    if (!isPassenger && !isDriver && req.user.role !== "ADMIN") {
      throw httpError(403, "Accès refusé.", "FORBIDDEN");
    }

    return res.json({ booking: serializeBooking(booking) });
  })
);

router.patch(
  "/:bookingId/status",
  validateParams(bookingParamsSchema),
  validateBody(updateBookingStatusSchema),
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      include: { trip: true },
    });
    if (!booking) {
      throw httpError(404, "Réservation introuvable.", "NOT_FOUND");
    }

    assertBookingStatusTransition(booking, status, req.user);

    if (status === "ACCEPTED") {
      await assertSeatsAvailable(booking);
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status },
      include: {
        trip: { include: { driver: PUBLIC_USER_SELECT } },
        passenger: PUBLIC_USER_SELECT,
      },
    });

    if (status === "ACCEPTED") {
      await notifyBookingAccepted(updated);
    }

    return res.json({ booking: serializeBooking(updated) });
  })
);

// Score 1-5, commentaire optionnel ≤ 500 chars.
const ratingBodySchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// Un passager note le conducteur après une réservation terminée.
// Une seule note par réservation (contrainte UNIQUE sur bookingId en base).
router.post(
  "/:bookingId/rating",
  validateParams(bookingParamsSchema),
  validateBody(ratingBodySchema),
  asyncHandler(async (req, res) => {
    const { score, comment } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      include: { trip: { select: { driverId: true, status: true } } },
    });
    if (!booking) {
      throw httpError(404, "Réservation introuvable.", "NOT_FOUND");
    }
    if (booking.passengerId !== req.user.id) {
      throw httpError(403, "Seul le passager peut noter le conducteur.", "FORBIDDEN");
    }
    if (booking.trip.status !== "COMPLETED") {
      throw httpError(409, "La notation n'est disponible qu'après la fin du trajet.", "TRIP_NOT_BOOKABLE");
    }

    const existing = await prisma.rating.findUnique({ where: { bookingId: booking.id } });
    if (existing) {
      throw httpError(409, "Vous avez déjà noté ce trajet.", "ALREADY_DECIDED");
    }

    const rating = await prisma.rating.create({
      data: {
        bookingId: booking.id,
        raterId: req.user.id,
        ratedId: booking.trip.driverId,
        score,
        comment: comment || null,
      },
    });

    return res.status(201).json({ rating: serializeRating(rating) });
  })
);

// Récupère la note (s'il y en a une) pour une réservation donnée.
router.get(
  "/:bookingId/rating",
  validateParams(bookingParamsSchema),
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.bookingId } });
    if (!booking) {
      throw httpError(404, "Réservation introuvable.", "NOT_FOUND");
    }
    const isPassenger = booking.passengerId === req.user.id;
    const booking2 = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      include: { trip: { select: { driverId: true } } },
    });
    const isDriver = booking2.trip.driverId === req.user.id;
    if (!isPassenger && !isDriver && req.user.role !== "ADMIN") {
      throw httpError(403, "Accès refusé.", "FORBIDDEN");
    }

    const rating = await prisma.rating.findUnique({ where: { bookingId: booking.id } });
    return res.json({ rating: rating ? serializeRating(rating) : null });
  })
);

module.exports = router;
