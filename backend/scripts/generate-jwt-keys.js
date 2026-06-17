"use strict";

// Génère une paire de clés RSA (JWT RS256) pour le développement local.
// En production, ces clés sont stockées dans Azure Key Vault, jamais sur disque.
//
// Usage : npm run generate:keys  (depuis backend/)

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const keysDir = path.resolve(__dirname, "../keys");

if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

fs.writeFileSync(path.join(keysDir, "private.pem"), privateKey, { mode: 0o600 });
fs.writeFileSync(path.join(keysDir, "public.pem"), publicKey);

console.log("Clés RSA générées dans backend/keys/ (NE JAMAIS COMMITER — voir .gitignore).");
console.log("En production : stocker ces clés dans Azure Key Vault.");
console.log("");
console.log("Ajoutez ces lignes à votre backend/.env :");
console.log(`FIELD_ENCRYPTION_KEY=${crypto.randomBytes(32).toString("base64")}`);
