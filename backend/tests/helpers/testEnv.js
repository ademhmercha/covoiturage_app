"use strict";

const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Dérive l'URL de la base de test (`wasel_test`) à partir de DATABASE_URL
 * (base de dev, définie dans backend/.env, jamais commité). Aucun
 * identifiant n'est écrit en dur dans le code des tests.
 */
function testDatabaseUrl() {
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    throw new Error("DATABASE_URL doit être défini (voir backend/.env) pour lancer les tests.");
  }
  return devUrl.replace(/\/([^/?]+)(\?|$)/, "/wasel_test$2");
}

module.exports = { testDatabaseUrl };
