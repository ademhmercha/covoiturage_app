"use strict";

const prisma = require("../db/prisma");
const httpError = require("../utils/httpError");
const { serializeNotification } = require("../utils/serializers");
const { getIO } = require("../realtime/io");

/**
 * Crée une notification persistée et la diffuse en temps réel à
 * l'utilisateur concerné via Socket.IO (salle privée `user:<id>`, voir
 * realtime/socket.js). Si aucun serveur Socket.IO n'est attaché (tests,
 * job exécuté hors process HTTP), la diffusion est simplement ignorée —
 * la notification reste consultable via GET /api/notifications.
 *
 * `payload` doit être JSON-sérialisable (pas d'objets Date) : c'est un
 * champ Prisma `Json`.
 */
async function createNotification({ userId, type, payload }) {
  const notification = await prisma.notification.create({
    data: { userId, type, payload },
  });

  const io = getIO();
  if (io) {
    io.to(`user:${userId}`).emit("notification:new", serializeNotification(notification));
  }

  return notification;
}

async function listNotifications(userId, { page = 1, pageSize = 20, unreadOnly = false } = {}) {
  const where = { userId, ...(unreadOnly ? { readAt: null } : {}) };

  const [notifications, total] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  return { notifications, total };
}

async function countUnread(userId) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

async function markAsRead(notificationId, userId) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) {
    throw httpError(404, "Notification introuvable.", "NOT_FOUND");
  }
  // Ownership : une notification n'est lisible/modifiable que par son destinataire.
  if (notification.userId !== userId) {
    throw httpError(403, "Accès refusé.", "FORBIDDEN");
  }
  if (notification.readAt) {
    return notification;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

async function markAllAsRead(userId) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

module.exports = { createNotification, listNotifications, countUnread, markAsRead, markAllAsRead };
