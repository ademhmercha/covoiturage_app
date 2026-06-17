"use strict";

const request = require("supertest");

/**
 * Charge une instance fraîche de l'application avec une configuration
 * d'environnement contrôlée (évite toute dépendance à l'ordre des tests).
 */
function loadApp(overrides = {}) {
  jest.resetModules();
  Object.assign(process.env, {
    NODE_ENV: "test",
    CORS_ALLOWED_ORIGINS: "https://wasel.example",
    RATE_LIMIT_WINDOW_MS: "60000",
    RATE_LIMIT_MAX: "100",
    LOG_LEVEL: "error",
    ...overrides,
  });
  // eslint-disable-next-line global-require
  return require("../src/app");
}

describe("Headers de sécurité (Helmet / CSP)", () => {
  let app;

  beforeAll(() => {
    app = loadApp();
  });

  it("renvoie une CSP stricte et les headers de durcissement", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["referrer-policy"]).toBe("strict-origin");
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
  });
});

describe("CORS — liste blanche stricte", () => {
  let app;

  beforeAll(() => {
    app = loadApp();
  });

  it("autorise une origine whitelistée avec credentials", async () => {
    const res = await request(app).get("/api/health").set("Origin", "https://wasel.example");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://wasel.example");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("bloque une origine non whitelistée", async () => {
    const res = await request(app).get("/api/health").set("Origin", "https://evil.example");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CORS_NOT_ALLOWED");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("Limite de taille des payloads", () => {
  let app;

  beforeAll(() => {
    app = loadApp();
  });

  it("rejette un payload JSON de plus de 250kb avec 413", async () => {
    const oversized = "x".repeat(251 * 1024);

    const res = await request(app)
      .post("/api/health")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ data: oversized }));

    expect(res.status).toBe(413);
  });
});

describe("Rate limiting global", () => {
  it("renvoie 429 après dépassement de la limite", async () => {
    const app = loadApp({ RATE_LIMIT_MAX: "2" });

    await request(app).get("/api/health").expect(200);
    await request(app).get("/api/health").expect(200);

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});

describe("Routes inconnues", () => {
  let app;

  beforeAll(() => {
    app = loadApp();
  });

  it("renvoie 404 générique sans détails internes", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error).not.toHaveProperty("stack");
  });
});

describe("Gestionnaire d'erreurs en production", () => {
  let errorHandler;

  beforeAll(() => {
    jest.resetModules();
    Object.assign(process.env, {
      NODE_ENV: "production",
      CORS_ALLOWED_ORIGINS: "https://wasel.example",
    });
    // eslint-disable-next-line global-require
    ({ errorHandler } = require("../src/middleware/errorHandler"));
  });

  afterAll(() => {
    process.env.NODE_ENV = "test";
  });

  it("ne révèle ni stack trace ni détails internes en production", () => {
    const err = new Error("Détail interne sensible : connexion DB refusée");
    const req = { path: "/api/test", method: "GET" };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    errorHandler(err, req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.message).toBe("Une erreur interne est survenue.");
    expect(payload.error).not.toHaveProperty("stack");
  });
});
