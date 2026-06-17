"use strict";

const express = require("express");
const { z } = require("zod");
const { uuidSchema, sendMessageSchema, paginationSchema } = require("@wasel/shared");

const asyncHandler = require("../utils/asyncHandler");
const authenticate = require("../middleware/authenticate");
const { validateBody, validateParams, validateQuery } = require("../middleware/validate");
const { listMessages, createMessage } = require("../services/messageService");
const { serializeMessage } = require("../utils/serializers");
const { getIO } = require("../realtime/io");

const router = express.Router();

const bookingParamsSchema = z.object({ bookingId: uuidSchema });
const listQuerySchema = z.object({
  page: paginationSchema.shape.page,
  pageSize: paginationSchema.shape.pageSize,
});

router.use(authenticate);

router.get(
  "/:bookingId/messages",
  validateParams(bookingParamsSchema),
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const messages = await listMessages(req.params.bookingId, req.user.id, req.query);
    return res.json({ messages: messages.map(serializeMessage) });
  })
);

router.post(
  "/:bookingId/messages",
  validateParams(bookingParamsSchema),
  validateBody(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const { message, recipientId } = await createMessage(
      req.params.bookingId,
      req.user.id,
      req.body.content,
      req.body.type
    );

    // Payload minimal : le frontend n'utilise que `bookingId` pour invalider
    // la requête des messages (voir SocketContext.jsx). Le contenu (base64
    // pour les messages vocaux) ne transite donc pas par Socket.IO, qui reste
    // limité à de petits payloads (cahier des charges section 8).
    const io = getIO();
    if (io) {
      io.to(`user:${recipientId}`).emit("message:new", {
        bookingId: message.bookingId,
        messageId: message.id,
        type: message.type,
        senderName: `${message.sender.firstName} ${message.sender.lastName}`,
        preview: message.type === "TEXT" ? message.content.slice(0, 80) : null,
      });
    }

    return res.status(201).json({ message: serializeMessage(message) });
  })
);

module.exports = router;
