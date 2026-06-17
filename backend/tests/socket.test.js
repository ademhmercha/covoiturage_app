"use strict";

// Tests d'intégration Socket.IO : authentification par cookie httpOnly,
// validation, limite de taille (1KB) et rate limiting (10 msg/min).
process.env.NODE_ENV = "test";
process.env.CORS_ALLOWED_ORIGINS = "https://wasel.example";
process.env.LOG_LEVEL = "error";
process.env.DATABASE_URL = require("./helpers/testEnv").testDatabaseUrl();

const http = require("node:http");
const request = require("supertest");
const { io: ioClient } = require("socket.io-client");

const app = require("../src/app");
const prisma = require("../src/db/prisma");
const redis = require("../src/config/redis");
const { initSocket } = require("../src/realtime/socket");
const { closeNotificationQueue } = require("../src/queues/notificationQueue");

const DRIVER_EMAIL = "socket-driver@test.wasel";
const PASSENGER_EMAIL = "socket-passenger@test.wasel";
const OUTSIDER_EMAIL = "socket-outsider@test.wasel";
const PASSWORD = "Sup3r$ecret!";

const TEST_EMAILS = [DRIVER_EMAIL, PASSENGER_EMAIL, OUTSIDER_EMAIL];

let httpServer;
let baseUrl;

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
    firstName: "Sock",
    lastName: "Test",
    phone: "+212600000002",
  });
  return { userId: res.body.user.id, cookie: getCookie(res, "access_token") };
}

function connectClient(cookie) {
  return ioClient(baseUrl, {
    transports: ["websocket"],
    extraHeaders: cookie ? { Cookie: cookie } : undefined,
    reconnection: false,
    forceNew: true,
  });
}

function waitFor(socket, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), 5000);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ack on "${event}"`)), 5000);
    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

let driver;
let passenger;
let outsider;
let bookingId;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });

  driver = await registerAndLogin(DRIVER_EMAIL);
  passenger = await registerAndLogin(PASSENGER_EMAIL);
  outsider = await registerAndLogin(OUTSIDER_EMAIL);

  const departureAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const tripRes = await request(app)
    .post("/api/trips")
    .set("Cookie", driver.cookie)
    .send({
      originLabel: "Casablanca",
      origin: { lat: 33.5731, lng: -7.5898 },
      destinationLabel: "Marrakech",
      destination: { lat: 31.6295, lng: -7.9811 },
      departureAt,
      seatsAvailable: 3,
      pricePerSeat: 80,
    });
  const tripId = tripRes.body.trip.id;

  const bookingRes = await request(app)
    .post("/api/bookings")
    .set("Cookie", passenger.cookie)
    .send({ tripId, seats: 1 });
  bookingId = bookingRes.body.booking.id;

  httpServer = http.createServer(app);
  initSocket(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  baseUrl = `http://localhost:${httpServer.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => httpServer.close(resolve));
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await prisma.$disconnect();
  await redis.quit();
  await closeNotificationQueue();
});

describe("Authentification Socket.IO", () => {
  it("refuse une connexion sans cookie d'authentification", async () => {
    const client = connectClient(null);
    const err = await waitFor(client, "connect_error");
    expect(err.message).toBe("UNAUTHENTICATED");
    client.close();
  });

  it("accepte une connexion avec un access token valide", async () => {
    const client = connectClient(driver.cookie);
    await waitFor(client, "connect");
    expect(client.connected).toBe(true);
    client.close();
  });
});

describe("message:send", () => {
  let driverSocket;
  let passengerSocket;

  beforeEach(async () => {
    driverSocket = connectClient(driver.cookie);
    passengerSocket = connectClient(passenger.cookie);
    await Promise.all([waitFor(driverSocket, "connect"), waitFor(passengerSocket, "connect")]);
  });

  afterEach(() => {
    driverSocket.close();
    passengerSocket.close();
  });

  it("envoie un message valide et le diffuse au destinataire", async () => {
    const newMessagePromise = waitFor(driverSocket, "message:new");

    const ack = await emitAck(passengerSocket, "message:send", {
      bookingId,
      content: "Bonjour, je serai à l'heure.",
    });

    expect(ack.ok).toBe(true);
    expect(ack.message.content).toBe("Bonjour, je serai à l'heure.");
    expect(ack.message.senderId).toBe(passenger.userId);

    const broadcast = await newMessagePromise;
    expect(broadcast.content).toBe("Bonjour, je serai à l'heure.");
  });

  it("rejette un payload invalide (champ manquant)", async () => {
    const ack = await emitAck(passengerSocket, "message:send", { content: "Sans bookingId" });
    expect(ack.ok).toBe(false);
    expect(ack.code).toBe("VALIDATION_ERROR");
  });

  it("rejette un message dépassant 1KB", async () => {
    const ack = await emitAck(passengerSocket, "message:send", {
      bookingId,
      content: "x".repeat(1100),
    });
    expect(ack.ok).toBe(false);
    expect(ack.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("refuse l'accès à un tiers qui n'est pas participant de la réservation", async () => {
    const outsiderSocket = connectClient(outsider.cookie);
    await waitFor(outsiderSocket, "connect");

    const ack = await emitAck(outsiderSocket, "message:send", {
      bookingId,
      content: "Je m'invite dans la conversation",
    });

    expect(ack.ok).toBe(false);
    expect(ack.code).toBe("FORBIDDEN");
    outsiderSocket.close();
  });

  it("applique la limite de 10 messages/minute", async () => {
    // Repart d'un compteur propre : les tests précédents ont déjà incrémenté
    // la limite de débit de cet utilisateur.
    await redis.del(`ratelimit:socket:${passenger.userId}`);

    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const ack = await emitAck(passengerSocket, "message:send", {
        bookingId,
        content: `Message ${i}`,
      });
      expect(ack.ok).toBe(true);
    }

    const eleventh = await emitAck(passengerSocket, "message:send", {
      bookingId,
      content: "Message de trop",
    });
    expect(eleventh.ok).toBe(false);
    expect(eleventh.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
