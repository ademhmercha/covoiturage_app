"use strict";

const { z } = require("zod");
const {
  coordinatesSchema,
  latitudeSchema,
  longitudeSchema,
  placeLabelSchema,
  freeTextSchema,
  paginationSchema,
} = require("./common");

const createTripSchema = z
  .object({
    originLabel: placeLabelSchema,
    origin: coordinatesSchema,
    destinationLabel: placeLabelSchema,
    destination: coordinatesSchema,
    departureAt: z.coerce.date().refine((date) => date.getTime() > Date.now(), {
      message: "La date de départ doit être dans le futur.",
    }),
    seatsAvailable: z.coerce.number().int().min(1, "Au moins 1 place.").max(8, "8 places maximum."),
    pricePerSeat: z.coerce.number().min(0, "Le prix ne peut pas être négatif.").max(10000),
    vehicleInfo: freeTextSchema(80).optional(),
    isRecurring: z.boolean().optional(),
    recurringDays: z
      .string()
      .regex(/^[0-6](,[0-6]){0,6}$/, "Jours invalides (0=dim … 6=sam, séparés par virgule).")
      .optional(),
  })
  .strict();

const updateTripSchema = createTripSchema.partial().strict();

const searchTripSchema = z
  .object({
    originLat: latitudeSchema.optional(),
    originLng: longitudeSchema.optional(),
    destinationLat: latitudeSchema.optional(),
    destinationLng: longitudeSchema.optional(),
    date: z.coerce.date().optional(),
    page: paginationSchema.shape.page,
    pageSize: paginationSchema.shape.pageSize,
  })
  .strict();

module.exports = { createTripSchema, updateTripSchema, searchTripSchema };
