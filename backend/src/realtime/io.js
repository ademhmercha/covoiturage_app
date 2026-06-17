"use strict";

// Singleton minimal pour accéder au serveur Socket.IO depuis les routes REST
// (ex: diffuser un nouveau message envoyé via HTTP aux sockets connectés).
// Évite une dépendance circulaire entre app.js et les routes.
let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function getIO() {
  return ioInstance;
}

module.exports = { setIO, getIO };
