"use strict";

const { z } = require("zod");
const validator = require("validator");

const uuidSchema = z.string().uuid({ message: "Identifiant invalide." });

/**
 * Coordonnées GPS : précision réduite à 3 décimales max (~111m) côté serveur,
 * cahier des charges section 10 ("Sécurité géolocalisation").
 */
function roundCoordinate(value) {
  return Math.round(value * 1000) / 1000;
}

const latitudeSchema = z.coerce.number().min(-90).max(90).transform(roundCoordinate);
const longitudeSchema = z.coerce.number().min(-180).max(180).transform(roundCoordinate);

const coordinatesSchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * Retire les caractères de contrôle invisibles (mais conserve les retours
 * ligne pour les messages multi-lignes). L'échappement HTML est délégué à
 * React au moment de l'affichage (jamais dangerouslySetInnerHTML) — voir
 * cahier des charges section 4.
 */
function stripControlChars(value) {
  return validator.stripLow(value, true).trim();
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Adresse email invalide.")
  .max(255);

// bcrypt tronque silencieusement au-delà de 72 octets : on le rejette explicitement.
const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(72, "Le mot de passe ne doit pas dépasser 72 caractères.")
  .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule.")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre.")
  .regex(/[^A-Za-z0-9]/, "Le mot de passe doit contenir au moins un caractère spécial.");

// Lettres latines accentuées + arabe + espace/tiret/apostrophe (noms FR/AR).
const nameSchema = z
  .string()
  .trim()
  .transform(stripControlChars)
  .pipe(
    z
      .string()
      .min(2, "Trop court.")
      .max(50, "Trop long.")
      .regex(/^[a-zA-ZÀ-ÖØ-öø-ÿ؀-ۿ\s'-]+$/, "Caractères non autorisés.")
  );

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, "Numéro de téléphone invalide.");

const placeLabelSchema = z
  .string()
  .trim()
  .transform(stripControlChars)
  .pipe(z.string().min(2, "Trop court.").max(120, "Trop long."));

const freeTextSchema = (max) =>
  z
    .string()
    .trim()
    .transform(stripControlChars)
    .pipe(z.string().min(1, "Champ requis.").max(max, "Trop long."));

module.exports = {
  uuidSchema,
  roundCoordinate,
  latitudeSchema,
  longitudeSchema,
  coordinatesSchema,
  paginationSchema,
  emailSchema,
  passwordSchema,
  nameSchema,
  phoneSchema,
  placeLabelSchema,
  freeTextSchema,
  stripControlChars,
};
