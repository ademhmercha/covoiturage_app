"use strict";

const crypto = require("node:crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const { registerSchema, loginSchema } = require("@wasel/shared");

const prisma = require("../db/prisma");
const env = require("../config/env");
const logger = require("../utils/logger");
const asyncHandler = require("../utils/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { createRateLimiter } = require("../middleware/rateLimiters");
const authenticate = require("../middleware/authenticate");
const {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
} = require("../utils/jwt");
const {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} = require("../utils/cookies");
const { blacklistAccessToken } = require("../utils/tokenBlacklist");
const { serializeUser } = require("../utils/serializers");

const router = express.Router();

const BCRYPT_COST = 12;
const ACCOUNT_LOCK_THRESHOLD = 5;
const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000;

// Hash factice comparé lorsque l'email n'existe pas, pour que bcrypt.compare()
// prenne un temps comparable que le compte existe ou non (mitigation
// d'énumération de comptes par mesure de temps de réponse).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), BCRYPT_COST);

// Limiteur dédié au login : 5 tentatives / 15 min par IP (cahier des charges
// section 1), en complément du verrouillage par compte ci-dessous.
const loginLimiter = createRateLimiter({
  windowMs: env.loginRateLimit.windowMs,
  max: env.loginRateLimit.max,
  message: "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
  keyGenerator: (req) => `login:${req.ip}`,
});

// Même limite appliquée à la création de compte pour limiter l'énumération
// d'emails et la création massive de comptes.
const registerLimiter = createRateLimiter({
  windowMs: env.loginRateLimit.windowMs,
  max: env.loginRateLimit.max,
  message: "Trop de tentatives. Réessayez dans quelques minutes.",
  keyGenerator: (req) => `register:${req.ip}`,
});

/**
 * Émet un nouveau couple access/refresh token, persiste le refresh token
 * (hash uniquement) et place les deux cookies httpOnly.
 */
async function issueTokenPair(res, user, ip) {
  const { token: accessToken } = signAccessToken(user);
  const { token: refreshToken, tokenHash } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + env.jwt.refreshTokenTtlSeconds * 1000),
      createdByIp: ip,
    },
  });

  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);
}

router.post(
  "/register",
  registerLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, phone } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        error: { message: "Un compte existe déjà avec cet email.", code: "EMAIL_TAKEN" },
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    let user;
    try {
      user = await prisma.user.create({
        data: { email, passwordHash, firstName, lastName, phone },
      });
    } catch (err) {
      if (err.code === "P2002") {
        return res.status(409).json({
          error: { message: "Un compte existe déjà avec cet email.", code: "EMAIL_TAKEN" },
        });
      }
      throw err;
    }

    await issueTokenPair(res, user, req.ip);

    logger.info("Nouveau compte créé", { userId: user.id });

    return res.status(201).json({ user: serializeUser(user) });
  })
);

router.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.lockedUntil && user.lockedUntil > new Date()) {
      logger.warn("Tentative de connexion sur un compte verrouillé", { userId: user.id, ip: req.ip });
      return res.status(423).json({
        error: {
          message: "Compte temporairement verrouillé suite à de multiples échecs. Réessayez plus tard.",
          code: "ACCOUNT_LOCKED",
        },
      });
    }

    const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

    if (!user || !passwordMatches) {
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        const data = { failedLoginAttempts: attempts };
        if (attempts >= ACCOUNT_LOCK_THRESHOLD) {
          data.lockedUntil = new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS);
        }
        await prisma.user.update({ where: { id: user.id }, data });
      }
      logger.warn("Échec d'authentification", { ip: req.ip });
      return res.status(401).json({
        error: { message: "Identifiants invalides.", code: "INVALID_CREDENTIALS" },
      });
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    await issueTokenPair(res, user, req.ip);

    logger.info("Connexion réussie", { userId: user.id });

    return res.json({ user: serializeUser(user) });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies ? req.cookies[REFRESH_TOKEN_COOKIE] : undefined;

    if (!token) {
      return res.status(401).json({
        error: { message: "Session invalide.", code: "UNAUTHENTICATED" },
      });
    }

    const tokenHash = hashToken(token);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) {
      clearAuthCookies(res);
      return res.status(401).json({
        error: { message: "Session invalide.", code: "INVALID_TOKEN" },
      });
    }

    if (stored.revokedAt) {
      // Réutilisation d'un refresh token déjà rotaté : signe probable de vol
      // (cf. OWASP : refresh token reuse detection). Par précaution, on
      // révoque toute la famille de tokens actifs de cet utilisateur.
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      logger.warn("Réutilisation d'un refresh token révoqué détectée — famille révoquée", {
        userId: stored.userId,
      });
      clearAuthCookies(res);
      return res.status(401).json({
        error: { message: "Session invalide.", code: "TOKEN_REUSE_DETECTED" },
      });
    }

    if (stored.expiresAt < new Date()) {
      clearAuthCookies(res);
      return res.status(401).json({
        error: { message: "Session expirée.", code: "TOKEN_EXPIRED" },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({
        error: { message: "Session invalide.", code: "INVALID_TOKEN" },
      });
    }

    const { token: newRefreshToken, tokenHash: newTokenHash } = generateRefreshToken();

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), replacedByHash: newTokenHash },
      }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newTokenHash,
          expiresAt: new Date(Date.now() + env.jwt.refreshTokenTtlSeconds * 1000),
          createdByIp: req.ip,
        },
      }),
    ]);

    const { token: accessToken } = signAccessToken(user);
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, newRefreshToken);

    return res.json({ user: serializeUser(user) });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const refreshTokenCookie = req.cookies ? req.cookies[REFRESH_TOKEN_COOKIE] : undefined;
    const accessTokenCookie = req.cookies ? req.cookies[ACCESS_TOKEN_COOKIE] : undefined;

    if (refreshTokenCookie) {
      const tokenHash = hashToken(refreshTokenCookie);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    if (accessTokenCookie) {
      try {
        const payload = verifyAccessToken(accessTokenCookie);
        await blacklistAccessToken(payload.jti, payload.exp);
      } catch {
        // Token déjà invalide ou expiré : rien à mettre en liste noire.
      }
    }

    clearAuthCookies(res);
    return res.status(204).end();
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(401).json({
        error: { message: "Session invalide.", code: "INVALID_TOKEN" },
      });
    }
    return res.json({ user: serializeUser(user) });
  })
);

module.exports = router;
