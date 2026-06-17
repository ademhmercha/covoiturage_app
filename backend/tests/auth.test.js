"use strict";

// Tests d'intégration de l'authentification : utilisent la base
// `wasel_test` (jamais la base de développement) et un Redis local.
process.env.NODE_ENV = "test";
process.env.CORS_ALLOWED_ORIGINS = "https://wasel.example";
process.env.LOG_LEVEL = "error";
process.env.DATABASE_URL = require("./helpers/testEnv").testDatabaseUrl();

const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/db/prisma");
const redis = require("../src/config/redis");

const TEST_EMAIL = "auth-flow@test.wasel";
const TEST_PASSWORD = "Sup3r$ecret!";

function getCookie(res, name) {
  const setCookie = res.headers["set-cookie"] || [];
  const found = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!found) return null;
  return found.split(";")[0];
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
  await redis.quit();
});

describe("POST /api/auth/register", () => {
  it("rejette une donnée invalide (mot de passe trop simple)", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: TEST_EMAIL,
      password: "weak",
      firstName: "Amal",
      lastName: "Test",
      phone: "+212600000000",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("crée un compte et place les cookies httpOnly", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      firstName: "Amal",
      lastName: "Test",
      phone: "+212600000000",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.user).not.toHaveProperty("passwordHash");

    const access = getCookie(res, "access_token");
    const refresh = getCookie(res, "refresh_token");
    expect(access).toBeTruthy();
    expect(refresh).toBeTruthy();

    const setCookieHeaders = res.headers["set-cookie"];
    setCookieHeaders.forEach((c) => {
      expect(c).toMatch(/HttpOnly/);
      expect(c).toMatch(/SameSite=Strict/);
    });
  });

  it("rejette un email déjà utilisé", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      firstName: "Amal",
      lastName: "Test",
      phone: "+212600000000",
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });
});

describe("POST /api/auth/login", () => {
  it("refuse un mauvais mot de passe", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: "MauvaisMotDePasse1!" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("refuse un email inconnu avec le même message générique", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "inconnu@test.wasel", password: "MauvaisMotDePasse1!" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("connecte avec les bons identifiants", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(getCookie(res, "access_token")).toBeTruthy();
    expect(getCookie(res, "refresh_token")).toBeTruthy();
  });
});

describe("Sessions authentifiées", () => {
  let accessCookie;
  let refreshCookie;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    accessCookie = getCookie(res, "access_token");
    refreshCookie = getCookie(res, "refresh_token");
  });

  it("GET /api/auth/me sans cookie -> 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("GET /api/auth/me avec cookie valide -> 200", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", accessCookie);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
  });

  it("POST /api/auth/refresh fait tourner le refresh token", async () => {
    const res = await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie);

    expect(res.status).toBe(200);
    const newRefresh = getCookie(res, "refresh_token");
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(refreshCookie);

    // Réutilisation de l'ancien refresh token : doit être détectée et révoquer
    // toute la famille de tokens (protection contre le vol de token).
    const reuse = await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe("TOKEN_REUSE_DETECTED");

    // Le nouveau token, bien que valide à l'origine, fait partie de la
    // famille révoquée par la détection de réutilisation ci-dessus.
    const afterReuse = await request(app).post("/api/auth/refresh").set("Cookie", newRefresh);
    expect(afterReuse.status).toBe(401);
  });

  it("POST /api/auth/logout révoque la session et met l'access token en liste noire", async () => {
    const logoutRes = await request(app).post("/api/auth/logout").set("Cookie", accessCookie);
    expect(logoutRes.status).toBe(204);

    const meRes = await request(app).get("/api/auth/me").set("Cookie", accessCookie);
    expect(meRes.status).toBe(401);
    expect(meRes.body.error.code).toBe("INVALID_TOKEN");
  });
});
