"use strict";

const { z } = require("zod");
const { uuidSchema } = require("./common");

const createBookingSchema = z
  .object({
    tripId: uuidSchema,
    seats: z.coerce.number().int().min(1, "Au moins 1 place.").max(8, "8 places maximum."),
  })
  .strict();

// Transitions autorisées uniquement (pas de retour PENDING, pas de valeur libre).
const bookingStatusSchema = z.enum(["ACCEPTED", "REJECTED", "CANCELLED"]);

const updateBookingStatusSchema = z
  .object({
    status: bookingStatusSchema,
  })
  .strict();

module.exports = { createBookingSchema, updateBookingStatusSchema, bookingStatusSchema };
