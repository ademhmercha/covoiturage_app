"use strict";

// Erreur applicative typée : capturée par asyncHandler -> errorHandler, qui
// renvoie `{ message, code }` au client. Ne jamais mettre de donnée sensible
// dans `message` (il est renvoyé tel quel pour les statuts < 500).
function httpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

module.exports = httpError;
