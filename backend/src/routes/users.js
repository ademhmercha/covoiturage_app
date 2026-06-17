"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { updateProfileSchema, changePasswordSchema, uuidSchema } = require("@wasel/shared");

const prisma = require("../db/prisma");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const authenticate = require("../middleware/authenticate");
const { validateBody, validateParams } = require("../middleware/validate");
const { serializeUser, serializePublicUser } = require("../utils/serializers");

const router = express.Router();

const BCRYPT_COST = 12;

const userParamsSchema = z.object({ userId: uuidSchema });

// Toutes les routes /api/users nécessitent une session valide.
router.use(authenticate);

router.patch(
  "/me",
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    if (Object.keys(req.body).length === 0) {
      throw httpError(400, "Aucune donnée à mettre à jour.", "VALIDATION_ERROR");
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: req.body,
    });

    return res.json({ user: serializeUser(user) });
  })
);

router.post(
  "/me/password",
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw httpError(401, "Mot de passe actuel incorrect.", "INVALID_CREDENTIALS");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } }),
      // Un changement de mot de passe révoque toutes les sessions existantes.
      prisma.refreshToken.updateMany({
        where: { userId: req.user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return res.status(204).end();
  })
);

// Avatar : data URI base64 d'une image ≤ 200KB (même approche que les messages
// vocaux — pas de multipart/upload, stockage direct en base comme URL).
const MAX_AVATAR_B64_LENGTH = 2_800_000; // ~2 MB image brute (base64 overhead ×4/3)

const avatarBodySchema = z.object({
  avatar: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/, "Format image invalide.")
    .max(MAX_AVATAR_B64_LENGTH, "Image trop volumineuse (2 Mo maximum)."),
});

router.patch(
  "/me/avatar",
  validateBody(avatarBodySchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: req.body.avatar },
    });
    return res.json({ user: serializeUser(user) });
  })
);

// Profil public minimal (ex: consulter le profil du conducteur d'un trajet).
// Jamais d'email, téléphone, rôle ni date d'inscription pour autrui.
router.get(
  "/:userId",
  validateParams(userParamsSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user) {
      throw httpError(404, "Utilisateur introuvable.", "NOT_FOUND");
    }
    return res.json({ user: serializePublicUser(user) });
  })
);

module.exports = router;
