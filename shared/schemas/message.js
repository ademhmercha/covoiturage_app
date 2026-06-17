"use strict";

const { z } = require("zod");
const { freeTextSchema } = require("./common");

// ~150KB de flux audio brut une fois décodé (≈45s en opus 24kbps), encodé en
// base64 (~+33% de taille) : limite choisie pour rester sous la nouvelle
// limite de payload JSON (250kb, voir backend/src/app.js) avec marge.
const MAX_AUDIO_BASE64_LENGTH = 200_000;

// Data URI audio : seuls les conteneurs webm/ogg/mp4 (formats produits par
// MediaRecorder côté navigateur) sont acceptés. Le contenu décodé est en
// outre vérifié via ses "magic bytes" côté serveur (voir messageService.js).
const audioContentSchema = z
  .string()
  .regex(/^data:audio\/(webm|ogg|mp4);base64,[A-Za-z0-9+/]+=*$/, "Format audio invalide.")
  .max(MAX_AUDIO_BASE64_LENGTH, "Message vocal trop volumineux.");

// Images : data URI base64, compressées côté client avant envoi (max 900px,
// JPEG 80%) — en pratique < 500KB → ~670KB base64, bien sous la limite 3MB.
const MAX_IMAGE_BASE64_LENGTH = 3_500_000; // ~2.5MB image brute encodée base64

const imageContentSchema = z
  .string()
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, "Format image invalide.")
  .max(MAX_IMAGE_BASE64_LENGTH, "Image trop volumineuse.");

// Cahier des charges section 8 : messages texte limités à 1KB. Les messages
// vocaux et images sont encodés en base64 (cahier des charges item 14).
const sendMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("TEXT"), content: freeTextSchema(1000) }).strict(),
  z.object({ type: z.literal("AUDIO"), content: audioContentSchema }).strict(),
  z.object({ type: z.literal("IMAGE"), content: imageContentSchema }).strict(),
]);

module.exports = { sendMessageSchema, audioContentSchema, imageContentSchema, MAX_AUDIO_BASE64_LENGTH, MAX_IMAGE_BASE64_LENGTH };
