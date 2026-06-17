"use strict";

// Tests d'intégration : cycle de vie trajet -> réservation -> messages,
// avec vérifications RBAC/ownership (cahier des charges section 5).
process.env.NODE_ENV = "test";
process.env.CORS_ALLOWED_ORIGINS = "https://wasel.example";
process.env.LOG_LEVEL = "error";
process.env.DATABASE_URL = require("./helpers/testEnv").testDatabaseUrl();

const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/db/prisma");
const redis = require("../src/config/redis");
const { closeNotificationQueue } = require("../src/queues/notificationQueue");

const DRIVER_EMAIL = "driver@test.wasel";
const PASSENGER_EMAIL = "passenger@test.wasel";
const OUTSIDER_EMAIL = "outsider@test.wasel";
const PASSWORD = "Sup3r$ecret!";

function getCookie(res, name) {
  const setCookie = res.headers["set-cookie"] || [];
  const found = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!found) return null;
  return found.split(";")[0];
}

async function registerAndLogin(email) {
  const res = await request(app).post("/api/auth/register").send({
    email,
    password: PASSWORD,
    firstName: "Test",
    lastName: "User",
    phone: "+212600000001",
  });
  return {
    userId: res.body.user.id,
    cookie: getCookie(res, "access_token"),
  };
}

let driver;
let passenger;
let outsider;
let tripId;
let bookingId;

const TEST_EMAILS = [DRIVER_EMAIL, PASSENGER_EMAIL, OUTSIDER_EMAIL];

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });

  driver = await registerAndLogin(DRIVER_EMAIL);
  passenger = await registerAndLogin(PASSENGER_EMAIL);
  outsider = await registerAndLogin(OUTSIDER_EMAIL);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await prisma.$disconnect();
  await redis.quit();
  await closeNotificationQueue();
});

describe("Trajets", () => {
  it("POST /api/trips sans authentification -> 401", async () => {
    const res = await request(app).post("/api/trips").send({});
    expect(res.status).toBe(401);
  });

  it("POST /api/trips crée un trajet pour le conducteur authentifié", async () => {
    const departureAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post("/api/trips")
      .set("Cookie", driver.cookie)
      .send({
        originLabel: "Casablanca",
        origin: { lat: 33.5731, lng: -7.5898 },
        destinationLabel: "Rabat",
        destination: { lat: 34.0209, lng: -6.8417 },
        departureAt,
        seatsAvailable: 3,
        pricePerSeat: 50,
      });

    expect(res.status).toBe(201);
    expect(res.body.trip.driverId).toBe(driver.userId);
    expect(res.body.trip.availableSeats).toBe(3);
    tripId = res.body.trip.id;
  });

  it("GET /api/trips (recherche publique) renvoie le trajet créé", async () => {
    const res = await request(app).get("/api/trips").query({
      originLat: 33.5731,
      originLng: -7.5898,
    });

    expect(res.status).toBe(200);
    expect(res.body.trips.some((t) => t.id === tripId)).toBe(true);
  });

  it("PATCH /api/trips/:tripId par un autre utilisateur -> 403", async () => {
    const res = await request(app)
      .patch(`/api/trips/${tripId}`)
      .set("Cookie", passenger.cookie)
      .send({ pricePerSeat: 99 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("PATCH /api/trips/:tripId par le conducteur met à jour le trajet", async () => {
    const res = await request(app)
      .patch(`/api/trips/${tripId}`)
      .set("Cookie", driver.cookie)
      .send({ pricePerSeat: 60 });

    expect(res.status).toBe(200);
    expect(res.body.trip.pricePerSeat).toBe(60);
  });
});

describe("Réservations", () => {
  it("POST /api/bookings — le conducteur ne peut pas réserver son propre trajet", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .set("Cookie", driver.cookie)
      .send({ tripId, seats: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("OWN_TRIP");
  });

  it("POST /api/bookings crée une réservation PENDING", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .set("Cookie", passenger.cookie)
      .send({ tripId, seats: 2 });

    expect(res.status).toBe(201);
    expect(res.body.booking.status).toBe("PENDING");
    expect(res.body.booking.passengerId).toBe(passenger.userId);
    bookingId = res.body.booking.id;
  });

  it("GET /api/bookings/:bookingId par un tiers -> 403", async () => {
    const res = await request(app).get(`/api/bookings/${bookingId}`).set("Cookie", outsider.cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("PATCH /api/bookings/:bookingId/status — le passager ne peut pas accepter sa propre réservation", async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set("Cookie", passenger.cookie)
      .send({ status: "ACCEPTED" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("PATCH /api/bookings/:bookingId/status — le conducteur accepte la réservation", async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set("Cookie", driver.cookie)
      .send({ status: "ACCEPTED" });

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("ACCEPTED");
  });

  it("GET /api/trips/:tripId reflète les places restantes après acceptation", async () => {
    const res = await request(app).get(`/api/trips/${tripId}`);

    expect(res.status).toBe(200);
    expect(res.body.trip.availableSeats).toBe(1); // 3 places - 2 acceptées
  });
});

describe("Messages", () => {
  it("POST .../messages par un tiers -> 403", async () => {
    const res = await request(app)
      .post(`/api/bookings/${bookingId}/messages`)
      .set("Cookie", outsider.cookie)
      .send({ type: "TEXT", content: "Bonjour" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("le passager envoie un message et le conducteur le récupère", async () => {
    const sendRes = await request(app)
      .post(`/api/bookings/${bookingId}/messages`)
      .set("Cookie", passenger.cookie)
      .send({ type: "TEXT", content: "Bonjour, à quelle heure le départ ?" });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.message.senderId).toBe(passenger.userId);

    const listRes = await request(app).get(`/api/bookings/${bookingId}/messages`).set("Cookie", driver.cookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.messages).toHaveLength(1);
    expect(listRes.body.messages[0].content).toBe("Bonjour, à quelle heure le départ ?");
  });
});
