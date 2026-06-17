"use strict";

const { Server } = require("socket.io");
const cookie = require("cookie");
const { z } = require("zod");
const { uuidSchema, freeTextSchema } = require("@wasel/shared");

const env = require("../config/env");
const logger = require("../utils/logger");
const { verifyAccessToken } = require("../utils/jwt");
const { isAccessTokenBlacklisted } = require("../utils/tokenBlacklist");
const { ACCESS_TOKEN_COOKIE } = require("../utils/cookies");
const { checkSocketRateLimit } = require("./socketRateLimit");
const { createMessage, markMessagesSeen } = require("../services/messageService");
const { serializeMessage } = require("../utils/serializers");
const { setIO } = require("./io");

// Cahier des charges section 8 : messages texte limités à 1KB.
const MAX_PAYLOAD_BYTES = 1024;

// maxHttpBufferSize est élevé à 64KB pour permettre les payloads de signalisation
// WebRTC (SDP offer/answer ~2–4KB) tout en gardant le contrôle de taille par
// événement dans les handlers (MAX_PAYLOAD_BYTES pour les messages texte).
const MAX_BUFFER_SIZE = 64 * 1024;

const messagePayloadSchema = z
  .object({
    bookingId: uuidSchema,
    content: freeTextSchema(1000),
  })
  .strict();

function originCheck(origin, callback) {
  if (!origin || env.corsAllowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error("Origine non autorisée par la politique CORS"));
}

async function authenticateSocket(socket) {
  const rawCookie = socket.handshake.headers.cookie;
  if (!rawCookie) throw new Error("Authentification requise.");

  const cookies = cookie.parse(rawCookie);
  const token = cookies[ACCESS_TOKEN_COOKIE];
  if (!token) throw new Error("Authentification requise.");

  const payload = verifyAccessToken(token);

  if (await isAccessTokenBlacklisted(payload.jti)) {
    throw new Error("Session invalide.");
  }

  return { id: payload.sub, role: payload.role, jti: payload.jti, exp: payload.exp };
}

async function isSocketSessionValid(socket) {
  if (socket.user.exp * 1000 < Date.now()) return false;
  return !(await isAccessTokenBlacklisted(socket.user.jti));
}

// Valide qu'un recipientId/callerId est une chaîne non vide (UUID non vérifié
// au niveau du format pour les événements de signalisation — la cible du socket
// room est au pire inexistante, sans fuite d'information).
function isSafeId(id) {
  return typeof id === "string" && id.length > 0 && id.length <= 36;
}

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: originCheck, credentials: true },
    maxHttpBufferSize: MAX_BUFFER_SIZE,
  });

  io.use(async (socket, next) => {
    try {
      socket.user = await authenticateSocket(socket);
      next();
    } catch (err) {
      logger.warn("Connexion Socket.IO refusée", { reason: err.message });
      next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.id}`);

    // ─── Messages texte (via Socket.IO, limit 1KB) ───────────────────────────

    socket.on("message:send", async (payload, ack) => {
      const reply = (response) => {
        if (typeof ack === "function") ack(response);
      };

      try {
        if (!(await isSocketSessionValid(socket))) {
          socket.emit("error", { message: "Session invalide ou expirée.", code: "INVALID_TOKEN" });
          socket.disconnect(true);
          return;
        }

        const size = Buffer.byteLength(JSON.stringify(payload || {}), "utf8");
        if (size > MAX_PAYLOAD_BYTES) {
          socket.emit("error", { message: "Message trop volumineux.", code: "PAYLOAD_TOO_LARGE" });
          reply({ ok: false, code: "PAYLOAD_TOO_LARGE" });
          return;
        }

        const allowed = await checkSocketRateLimit(socket.user.id);
        if (!allowed) {
          socket.emit("error", {
            message: "Trop de messages envoyés, veuillez patienter.",
            code: "RATE_LIMIT_EXCEEDED",
          });
          reply({ ok: false, code: "RATE_LIMIT_EXCEEDED" });
          return;
        }

        const result = messagePayloadSchema.safeParse(payload);
        if (!result.success) {
          socket.emit("error", { message: "Message invalide.", code: "VALIDATION_ERROR" });
          reply({ ok: false, code: "VALIDATION_ERROR" });
          return;
        }

        const { message, recipientId } = await createMessage(
          result.data.bookingId,
          socket.user.id,
          result.data.content
        );
        const serialized = serializeMessage(message);

        io.to(`user:${socket.user.id}`).to(`user:${recipientId}`).emit("message:new", serialized);
        reply({ ok: true, message: serialized });
      } catch (err) {
        const status = err.status || 500;
        socket.emit("error", {
          message: status < 500 ? err.message : "Une erreur interne est survenue.",
          code: err.code || "INTERNAL_ERROR",
        });
        reply({ ok: false, code: err.code || "INTERNAL_ERROR" });
      }
    });

    // ─── Accusés de lecture ───────────────────────────────────────────────────

    socket.on("message:seen", async ({ bookingId } = {}) => {
      if (!bookingId || typeof bookingId !== "string") return;
      try {
        const { count, senderId } = await markMessagesSeen(bookingId, socket.user.id);
        if (count > 0 && senderId) {
          io.to(`user:${senderId}`).emit("messages:seen", {
            bookingId,
            seenAt: new Date().toISOString(),
          });
        }
      } catch {
        // Best-effort — ne pas casser la connexion pour un accusé de lecture
      }
    });

    // ─── Signalisation WebRTC (relais pur, pas de logique métier) ────────────
    // Les événements sont relayés tels quels vers la salle privée du
    // destinataire. La room `user:{id}` garantit que seul le bon destinataire
    // reçoit l'événement. Aucun accès à la base pour cette section.

    socket.on("call:request", ({ recipientId, bookingId } = {}) => {
      if (!isSafeId(recipientId)) return;
      io.to(`user:${recipientId}`).emit("call:incoming", {
        callerId: socket.user.id,
        bookingId: typeof bookingId === "string" ? bookingId : null,
      });
    });

    socket.on("call:accept", ({ callerId } = {}) => {
      if (!isSafeId(callerId)) return;
      io.to(`user:${callerId}`).emit("call:accepted", { recipientId: socket.user.id });
    });

    socket.on("call:offer", ({ recipientId, offer } = {}) => {
      if (!isSafeId(recipientId) || !offer) return;
      io.to(`user:${recipientId}`).emit("call:offer", { callerId: socket.user.id, offer });
    });

    socket.on("call:answer", ({ callerId, answer } = {}) => {
      if (!isSafeId(callerId) || !answer) return;
      io.to(`user:${callerId}`).emit("call:answer", { recipientId: socket.user.id, answer });
    });

    socket.on("call:ice-candidate", ({ to, candidate } = {}) => {
      if (!isSafeId(to) || !candidate) return;
      io.to(`user:${to}`).emit("call:ice-candidate", { from: socket.user.id, candidate });
    });

    socket.on("call:reject", ({ callerId } = {}) => {
      if (!isSafeId(callerId)) return;
      io.to(`user:${callerId}`).emit("call:rejected", { recipientId: socket.user.id });
    });

    socket.on("call:hangup", ({ to } = {}) => {
      if (!isSafeId(to)) return;
      io.to(`user:${to}`).emit("call:hangup", { from: socket.user.id });
    });
  });

  setIO(io);
  return io;
}

module.exports = { initSocket };
