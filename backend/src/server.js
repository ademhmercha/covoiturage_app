"use strict";

const env = require("./config/env");
const logger = require("./utils/logger");
const app = require("./app");
const { initSocket } = require("./realtime/socket");

const server = app.listen(env.port, () => {
  logger.info(`Serveur démarré sur le port ${env.port}`, { nodeEnv: env.nodeEnv });
});

// Backstop socket-level : coupe toute connexion inactive après 30s
// (cahier des charges section 7). Le middleware requestTimeout gère, en
// complément, une réponse JSON propre pour les requêtes encore en traitement.
server.timeout = 30_000;

initSocket(server);

module.exports = server;
