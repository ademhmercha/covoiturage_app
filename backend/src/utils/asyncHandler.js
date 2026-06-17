"use strict";

// Évite la répétition de try/catch dans chaque route async : toute exception
// (y compris un rejet de Promise) est transmise au gestionnaire d'erreurs
// centralisé, qui ne révèle jamais la pile d'appel en production.
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
