"use strict";

const express = require("express");
const { z } = require("zod");
const { listNotificationsQuerySchema, uuidSchema } = require("@wasel/shared");

const asyncHandler = require("../utils/asyncHandler");
const authenticate = require("../middleware/authenticate");
const { validateQuery, validateParams } = require("../middleware/validate");
const { serializeNotification } = require("../utils/serializers");
const notificationService = require("../services/notificationService");

const router = express.Router();

const notificationParamsSchema = z.object({ notificationId: uuidSchema });

// Toutes les routes /api/notifications nécessitent une session valide ;
// chaque notification est scopée à son destinataire (ownership vérifié dans
// le service, jamais d'accès aux notifications d'un autre utilisateur).
router.use(authenticate);

router.get(
  "/",
  validateQuery(listNotificationsQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, pageSize, unreadOnly } = req.query;
    const { notifications, total } = await notificationService.listNotifications(req.user.id, {
      page,
      pageSize,
      unreadOnly,
    });

    return res.json({
      notifications: notifications.map(serializeNotification),
      pagination: { page, pageSize, total },
    });
  })
);

router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const count = await notificationService.countUnread(req.user.id);
    return res.json({ count });
  })
);

router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await notificationService.markAllAsRead(req.user.id);
    return res.status(204).end();
  })
);

router.patch(
  "/:notificationId/read",
  validateParams(notificationParamsSchema),
  asyncHandler(async (req, res) => {
    const notification = await notificationService.markAsRead(req.params.notificationId, req.user.id);
    return res.json({ notification: serializeNotification(notification) });
  })
);

module.exports = router;
