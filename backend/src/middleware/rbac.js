"use strict";

/**
 * Autorise uniquement les utilisateurs dont le rôle figure dans `roles`.
 * Doit toujours être placé après `authenticate`.
 */
function requireRole(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { message: "Accès refusé.", code: "FORBIDDEN" },
      });
    }
    next();
  };
}

/**
 * Autorise l'utilisateur authentifié à agir sur sa propre ressource
 * (req.params[paramName] === req.user.id), ou un administrateur (ADMIN).
 * Utilisé par ex. pour GET/PATCH /api/users/:userId.
 */
function requireSelfOrAdmin(paramName = "userId") {
  return function ownershipGuard(req, res, next) {
    if (req.user.role === "ADMIN" || req.user.id === req.params[paramName]) {
      return next();
    }
    return res.status(403).json({
      error: { message: "Accès refusé.", code: "FORBIDDEN" },
    });
  };
}

module.exports = { requireRole, requireSelfOrAdmin };
