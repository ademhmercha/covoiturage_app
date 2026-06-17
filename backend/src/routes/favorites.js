"use strict";

const express = require("express");
const { z } = require("zod");
const { uuidSchema } = require("@wasel/shared");

const prisma = require("../db/prisma");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const authenticate = require("../middleware/authenticate");
const { validateBody, validateParams } = require("../middleware/validate");
const { serializeFavoriteRoute } = require("../utils/serializers");

const router = express.Router();

const cityNameSchema = z.string().min(1).max(100);

const favoriteBodySchema = z.object({
  fromCity: cityNameSchema,
  toCity: cityNameSchema,
});

const favoriteParamsSchema = z.object({ favoriteId: uuidSchema });

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const favorites = await prisma.favoriteRoute.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ favorites: favorites.map(serializeFavoriteRoute) });
  })
);

router.post(
  "/",
  validateBody(favoriteBodySchema),
  asyncHandler(async (req, res) => {
    const { fromCity, toCity } = req.body;

    const existing = await prisma.favoriteRoute.findUnique({
      where: { userId_fromCity_toCity: { userId: req.user.id, fromCity, toCity } },
    });
    if (existing) {
      return res.status(200).json({ favorite: serializeFavoriteRoute(existing) });
    }

    const favorite = await prisma.favoriteRoute.create({
      data: { userId: req.user.id, fromCity, toCity },
    });
    return res.status(201).json({ favorite: serializeFavoriteRoute(favorite) });
  })
);

router.delete(
  "/:favoriteId",
  validateParams(favoriteParamsSchema),
  asyncHandler(async (req, res) => {
    const fav = await prisma.favoriteRoute.findUnique({ where: { id: req.params.favoriteId } });
    if (!fav) {
      throw httpError(404, "Route favorite introuvable.", "NOT_FOUND");
    }
    if (fav.userId !== req.user.id && req.user.role !== "ADMIN") {
      throw httpError(403, "Accès refusé.", "FORBIDDEN");
    }
    await prisma.favoriteRoute.delete({ where: { id: fav.id } });
    return res.status(204).end();
  })
);

module.exports = router;
