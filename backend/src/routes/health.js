"use strict";

const express = require("express");

const router = express.Router();

// Endpoint de supervision : pas d'authentification, aucune donnée sensible.
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

module.exports = router;
