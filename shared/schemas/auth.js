"use strict";

const { z } = require("zod");
const { emailSchema, passwordSchema, nameSchema, phoneSchema } = require("./common");

// Whitelist stricte des champs autorisés (.strict()) — cahier des charges section 3.
const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    phone: phoneSchema,
  })
  .strict();

const loginSchema = z
  .object({
    email: emailSchema,
    // Pas de regex de complexité au login : on ne révèle jamais pourquoi
    // un mot de passe est invalide (énumération de règles), seulement
    // "identifiants invalides".
    password: z.string().min(1, "Mot de passe requis.").max(72),
  })
  .strict();

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(72),
    newPassword: passwordSchema,
  })
  .strict();

module.exports = { registerSchema, loginSchema, changePasswordSchema };
