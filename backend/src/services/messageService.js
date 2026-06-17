"use strict";

const prisma = require("../db/prisma");
const httpError = require("../utils/httpError");
const { createNotification } = require("./notificationService");

const PREVIEW_LENGTH = 140;

const PUBLIC_USER_SELECT = {
  select: { id: true, firstName: true, lastName: true, avatarUrl: true },
};

// Magic bytes pour les conteneurs audio acceptés.
const AUDIO_MAGIC_BYTES = {
  webm: { offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }, // EBML
  ogg: { offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] },  // "OggS"
  mp4: { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },   // "ftyp"
};

function assertValidAudioContent(content) {
  const match = content.match(/^data:audio\/(webm|ogg|mp4);base64,(.+)$/);
  if (!match) throw httpError(400, "Format audio invalide.", "VALIDATION_ERROR");

  const [, container, base64] = match;
  const { offset, bytes: expected } = AUDIO_MAGIC_BYTES[container];
  const decoded = Buffer.from(base64, "base64");
  const actual = decoded.subarray(offset, offset + expected.length);

  if (actual.length !== expected.length || !expected.every((b, i) => b === actual[i])) {
    throw httpError(400, "Format audio invalide.", "VALIDATION_ERROR");
  }
}

// Magic bytes pour les images acceptées (JPEG, PNG, WebP).
function assertValidImageContent(content) {
  const match = content.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  if (!match) throw httpError(400, "Format image invalide.", "VALIDATION_ERROR");

  const [, format, base64] = match;
  // Décode les 24 premiers octets — suffisant pour vérifier tous les en-têtes.
  const decoded = Buffer.from(base64.slice(0, 32), "base64");

  function check(offset, bytes) {
    return bytes.every((b, i) => decoded[offset + i] === b);
  }

  let valid = false;
  if (format === "jpeg") valid = check(0, [0xff, 0xd8, 0xff]);
  else if (format === "png") valid = check(0, [0x89, 0x50, 0x4e, 0x47]);
  else if (format === "webp") {
    valid = check(0, [0x52, 0x49, 0x46, 0x46]) && check(8, [0x57, 0x45, 0x42, 0x50]);
  }

  if (!valid) throw httpError(400, "Format image invalide.", "VALIDATION_ERROR");
}

async function assertParticipant(bookingId, userId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { trip: true },
  });
  if (!booking) throw httpError(404, "Réservation introuvable.", "NOT_FOUND");

  const isPassenger = booking.passengerId === userId;
  const isDriver = booking.trip.driverId === userId;
  if (!isPassenger && !isDriver) throw httpError(403, "Accès refusé.", "FORBIDDEN");

  return booking;
}

async function listMessages(bookingId, userId, { page = 1, pageSize = 50 } = {}) {
  await assertParticipant(bookingId, userId);

  return prisma.message.findMany({
    where: { bookingId },
    include: { sender: PUBLIC_USER_SELECT },
    orderBy: { createdAt: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

// Marque comme lus tous les messages d'une conversation qui ne sont pas du
// viewer. Retourne le senderId pour notifier l'expéditeur via Socket.IO.
async function markMessagesSeen(bookingId, viewerId) {
  await assertParticipant(bookingId, viewerId);

  const sample = await prisma.message.findFirst({
    where: { bookingId, senderId: { not: viewerId }, seenAt: null },
    select: { senderId: true },
  });

  if (!sample) return { count: 0, senderId: null };

  const { count } = await prisma.message.updateMany({
    where: { bookingId, senderId: { not: viewerId }, seenAt: null },
    data: { seenAt: new Date() },
  });

  return { count, senderId: sample.senderId };
}

async function createMessage(bookingId, senderId, content, type = "TEXT") {
  const booking = await assertParticipant(bookingId, senderId);

  if (type === "AUDIO") assertValidAudioContent(content);
  else if (type === "IMAGE") assertValidImageContent(content);

  const message = await prisma.message.create({
    data: { bookingId, senderId, content, type },
    include: { sender: PUBLIC_USER_SELECT },
  });

  const recipientId =
    booking.passengerId === senderId ? booking.trip.driverId : booking.passengerId;

  await createNotification({
    userId: recipientId,
    type: "NEW_MESSAGE",
    payload: {
      bookingId,
      messageId: message.id,
      senderId,
      senderName: `${message.sender.firstName} ${message.sender.lastName}`,
      messageType: message.type,
      preview: message.type === "TEXT" ? message.content.slice(0, PREVIEW_LENGTH) : "",
    },
  });

  return { message, recipientId };
}

module.exports = { assertParticipant, listMessages, markMessagesSeen, createMessage };
