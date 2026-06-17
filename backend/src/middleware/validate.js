"use strict";

// Validation stricte des entrées via les schémas Zod partagés (@wasel/shared).
// `safeParse` ne lève jamais d'exception : toute entrée invalide est rejetée
// avec un 400 explicite (pas de stack trace, pas de structure interne).
// `req.body`/`req.query`/`req.params` sont remplacés par la sortie validée
// et transformée (ex: email en minuscules, coordonnées GPS arrondies).

function formatIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function validateBody(schema) {
  return function bodyValidator(req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: {
          message: "Données invalides.",
          code: "VALIDATION_ERROR",
          details: formatIssues(result.error),
        },
      });
    }
    req.body = result.data;
    next();
  };
}

function validateQuery(schema) {
  return function queryValidator(req, res, next) {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: {
          message: "Paramètres invalides.",
          code: "VALIDATION_ERROR",
          details: formatIssues(result.error),
        },
      });
    }
    req.query = result.data;
    next();
  };
}

function validateParams(schema) {
  return function paramsValidator(req, res, next) {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        error: {
          message: "Identifiant invalide.",
          code: "VALIDATION_ERROR",
          details: formatIssues(result.error),
        },
      });
    }
    req.params = result.data;
    next();
  };
}

module.exports = { validateBody, validateQuery, validateParams };
