"use strict";

const crypto = require("node:crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommandé pour GCM
const FORMAT_VERSION = "v1";

/**
 * Chiffrement applicatif des champs sensibles (téléphone, adresse) avant
 * écriture en base — cahier des charges section 6.
 *
 * En production, FIELD_ENCRYPTION_KEY provient d'Azure Key Vault, jamais
 * d'une valeur en dur dans le code.
 */
function getKey() {
  const keyBase64 = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error("FIELD_ENCRYPTION_KEY n'est pas défini.");
  }
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY doit être une clé AES-256 encodée en base64 (32 octets).");
  }
  return key;
}

function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined) {
    return plaintext;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [FORMAT_VERSION, iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

function decryptField(stored) {
  if (stored === null || stored === undefined) {
    return stored;
  }

  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    // Valeur non chiffrée (ne devrait pas arriver hors migration de données).
    return stored;
  }

  const [, ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return plaintext.toString("utf8");
}

module.exports = { encryptField, decryptField };
