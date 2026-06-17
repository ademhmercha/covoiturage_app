"use strict";

// Tests de sécurité complémentaires : rate limiting du login, verrouillage
// de compte, anti mass-assignment (.strict()), identifiants UUID v4, arrondi
// des coordonnées GPS, chiffrement applicatif du téléphone et redaction des
// journaux (cahier des charges sections 1, 5, 6, 9, 14).
process.env.NODE_ENV = "test";
process.env.CORS_ALLOWED_ORIGINS = "https://wasel.example";
process.env.LOG_LEVEL = "error";
process.env.DATABASE_URL = require("./helpers/testEnv").testDatabaseUrl();

const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/db/prisma");
const redis = require("../src/config/redis");
const logger = require("../src/utils/logger");
const { encryptField, decryptField } = require("../src/utils/encryption");
const { closeNotificationQueue } = require("../src/queues/notificationQueue");

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PASSWORD = "Sup3r$ecret!";

const MASS_ASSIGN_EMAIL = "mass-assign@test.wasel";
const GEO_EMAIL = "geo-extra@test.wasel";
const CRYPT_EMAIL = "encrypt-extra@test.wasel";
const LOCKOUT_EMAIL = "lockout@test.wasel";
const TEST_EMAILS = [MASS_ASSIGN_EMAIL, GEO_EMAIL, CRYPT_EMAIL, LOCKOUT_EMAIL];

function getCookie(res, name) {
  const setCookie = res.headers["set-cookie"] || [];
  const found = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!found) return null;
  return found.split(";")[0];
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await prisma.$disconnect();
  await redis.quit();
  await closeNotificationQueue();
});

describe("Rate limiting du login", () => {
  it("renvoie 429 après 5 tentatives sur la même IP", async () => {
    const email = "inconnu-rate-limit@test.wasel";

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "Whatever1!" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    }

    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "Whatever1!" });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});

describe("Verrouillage de compte après échecs répétés", () => {
  let lockApp;
  let lockPrisma;
  let lockRedis;
  let closeLockQueue;

  beforeAll(async () => {
    // Le limiteur de login par défaut (5/15min) ne laisserait pas passer les
    // 5 échecs + la tentative finale dans une même instance : on l'augmente
    // pour cette instance fraîche, dédiée à ce scénario.
    process.env.LOGIN_RATE_LIMIT_MAX = "10";
    jest.resetModules();
    lockApp = require("../src/app");
    lockPrisma = require("../src/db/prisma");
    lockRedis = require("../src/config/redis");
    ({ closeNotificationQueue: closeLockQueue } = require("../src/queues/notificationQueue"));

    await lockPrisma.user.deleteMany({ where: { email: LOCKOUT_EMAIL } });

    const register = await request(lockApp).post("/api/auth/register").send({
      email: LOCKOUT_EMAIL,
      password: PASSWORD,
      firstName: "Test",
      lastName: "Lockout",
      phone: "+212600000003",
    });
    if (register.status !== 201) {
      throw new Error(`Échec de préparation du test de verrouillage : ${JSON.stringify(register.body)}`);
    }
  });

  afterAll(async () => {
    delete process.env.LOGIN_RATE_LIMIT_MAX;
    await lockPrisma.user.deleteMany({ where: { email: LOCKOUT_EMAIL } });
    await lockPrisma.$disconnect();
    await lockRedis.quit();
    await closeLockQueue();
  });

  it("verrouille le compte après 5 mots de passe invalides puis bloque même le bon mot de passe", async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await request(lockApp)
        .post("/api/auth/login")
        .send({ email: LOCKOUT_EMAIL, password: "MauvaisMotDePasse1!" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    }

    const locked = await request(lockApp)
      .post("/api/auth/login")
      .send({ email: LOCKOUT_EMAIL, password: PASSWORD });

    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");
  });
});

describe("Anti mass-assignment (schémas Zod .strict())", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: MASS_ASSIGN_EMAIL } });
  });

  it("rejette un champ inconnu (role) à l'inscription", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: MASS_ASSIGN_EMAIL,
      password: PASSWORD,
      firstName: "Test",
      lastName: "Mass",
      phone: "+212600000004",
      role: "ADMIN",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");

    const created = await prisma.user.findUnique({ where: { email: MASS_ASSIGN_EMAIL } });
    expect(created).toBeNull();
  });

  it("rejette un champ inconnu (role) sur la mise à jour du profil", async () => {
    const register = await request(app).post("/api/auth/register").send({
      email: MASS_ASSIGN_EMAIL,
      password: PASSWORD,
      firstName: "Test",
      lastName: "Mass",
      phone: "+212600000004",
    });
    const cookie = getCookie(register, "access_token");

    const res = await request(app)
      .patch("/api/users/me")
      .set("Cookie", cookie)
      .send({ firstName: "Nouveau", role: "ADMIN" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Identifiants UUID v4 et arrondi des coordonnées GPS", () => {
  let cookie;
  let userId;
  let tripId;

  beforeAll(async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: GEO_EMAIL,
      password: PASSWORD,
      firstName: "Test",
      lastName: "Geo",
      phone: "+212600000005",
    });
    cookie = getCookie(res, "access_token");
    userId = res.body.user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: GEO_EMAIL } });
  });

  it("génère des identifiants UUID v4 pour l'utilisateur et le trajet créé", async () => {
    expect(userId).toMatch(UUID_V4_RE);

    const departureAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post("/api/trips")
      .set("Cookie", cookie)
      .send({
        originLabel: "Casablanca",
        origin: { lat: 33.123456, lng: -7.654321 },
        destinationLabel: "Marrakech",
        destination: { lat: 31.987654, lng: -8.123987 },
        departureAt,
        seatsAvailable: 2,
        pricePerSeat: 70,
      });

    expect(res.status).toBe(201);
    expect(res.body.trip.id).toMatch(UUID_V4_RE);
    tripId = res.body.trip.id;
  });

  it("arrondit les coordonnées GPS à 3 décimales (~111m) dans la réponse API", async () => {
    const res = await request(app).get(`/api/trips/${tripId}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.trip.origin).toEqual({ lat: 33.123, lng: -7.654 });
    expect(res.body.trip.destination).toEqual({ lat: 31.988, lng: -8.124 });
  });
});

describe("Chiffrement applicatif du téléphone (AES-256-GCM)", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: CRYPT_EMAIL } });
  });

  it("encryptField/decryptField : aller-retour fidèle avec IV aléatoire", () => {
    const plaintext = "+212611223344";
    const encryptedA = encryptField(plaintext);
    const encryptedB = encryptField(plaintext);

    expect(encryptedA.startsWith("v1:")).toBe(true);
    expect(encryptedA).not.toBe(plaintext);
    // IV aléatoire : deux chiffrements de la même valeur diffèrent.
    expect(encryptedA).not.toBe(encryptedB);
    expect(decryptField(encryptedA)).toBe(plaintext);
    expect(decryptField(encryptedB)).toBe(plaintext);
  });

  it("laisse passer les valeurs null/undefined sans erreur", () => {
    expect(encryptField(null)).toBeNull();
    expect(encryptField(undefined)).toBeUndefined();
    expect(decryptField(null)).toBeNull();
  });

  it("stocke le téléphone chiffré en base mais le renvoie en clair via l'API", async () => {
    const phone = "+212611998877";

    const register = await request(app).post("/api/auth/register").send({
      email: CRYPT_EMAIL,
      password: PASSWORD,
      firstName: "Test",
      lastName: "Crypt",
      phone,
    });

    expect(register.status).toBe(201);
    expect(register.body.user.phone).toBe(phone);

    const rows = await prisma.$queryRaw`SELECT phone FROM "users" WHERE email = ${CRYPT_EMAIL}`;
    expect(rows[0].phone).not.toBe(phone);
    expect(rows[0].phone.startsWith("v1:")).toBe(true);
    expect(decryptField(rows[0].phone)).toBe(phone);
  });
});

describe("Redaction des journaux (logger)", () => {
  it("masque les champs sensibles dans les métadonnées journalisées", () => {
    const redacted = logger.redact({
      userId: "abc-123",
      password: "secret",
      token: "abc.def.ghi",
      profile: { phone: "+212600000000", email: "user@example.com", city: "Casablanca" },
    });

    expect(redacted.userId).toBe("abc-123");
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.token).toBe("[REDACTED]");
    expect(redacted.profile.phone).toBe("[REDACTED]");
    expect(redacted.profile.email).toBe("[REDACTED]");
    expect(redacted.profile.city).toBe("Casablanca");
  });
});
