"use strict";

// Tests d'intégration : notifications déclenchées par les événements métier
// (NEW_BOOKING, BOOKING_ACCEPTED, NEW_MESSAGE, DEPARTURE_REMINDER) et leur
// API de consultation, avec vérifications d'ownership (cahier des charges
// section 7).
process.env.NODE_ENV = "test";
process.env.CORS_ALLOWED_ORIGINS = "https://wasel.example";
process.env.LOG_LEVEL = "error";
process.env.DATABASE_URL = require("./helpers/testEnv").testDatabaseUrl();

const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/db/prisma");
const redis = require("../src/config/redis");
const { closeNotificationQueue } = require("../src/queues/notificationQueue");
const { processDepartureReminder, REMINDER_LEAD_MS } = require("../src/queues/departureReminder");

const DRIVER_EMAIL = "notif-driver@test.wasel";
const PASSENGER_EMAIL = "notif-passenger@test.wasel";
const PASSWORD = "Sup3r$ecret!";

const TEST_EMAILS = [DRIVER_EMAIL, PASSENGER_EMAIL];

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
    firstName: "Notif",
    lastName: "Test",
    phone: "+212600000003",
  });
  return { userId: res.body.user.id, cookie: getCookie(res, "access_token") };
}

function findNotification(notifications, type) {
  return notifications.find((n) => n.type === type);
}

let driver;
let passenger;
let tripId;
let bookingId;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });

  driver = await registerAndLogin(DRIVER_EMAIL);
  passenger = await registerAndLogin(PASSENGER_EMAIL);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await prisma.$disconnect();
  await redis.quit();
  await closeNotificationQueue();
});

describe("NEW_BOOKING", () => {
  it("notifie le conducteur quand une réservation est créée", async () => {
    // Départ dans 2h : assez tard pour qu'un rappel (1h avant) soit planifiable.
    const departureAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const tripRes = await request(app)
      .post("/api/trips")
      .set("Cookie", driver.cookie)
      .send({
        originLabel: "Tanger",
        origin: { lat: 35.7595, lng: -5.834 },
        destinationLabel: "Tétouan",
        destination: { lat: 35.5785, lng: -5.3684 },
        departureAt,
        seatsAvailable: 2,
        pricePerSeat: 30,
      });
    expect(tripRes.status).toBe(201);
    tripId = tripRes.body.trip.id;

    const bookingRes = await request(app)
      .post("/api/bookings")
      .set("Cookie", passenger.cookie)
      .send({ tripId, seats: 1 });
    expect(bookingRes.status).toBe(201);
    bookingId = bookingRes.body.booking.id;

    const notifRes = await request(app).get("/api/notifications").set("Cookie", driver.cookie);
    expect(notifRes.status).toBe(200);

    const notif = findNotification(notifRes.body.notifications, "NEW_BOOKING");
    expect(notif).toBeDefined();
    expect(notif.read).toBe(false);
    expect(notif.payload.bookingId).toBe(bookingId);
    expect(notif.payload.tripId).toBe(tripId);
    expect(notif.payload.passengerName).toBe("Notif Test");
  });
});

describe("BOOKING_ACCEPTED", () => {
  it("notifie le passager quand le conducteur accepte la réservation", async () => {
    const acceptRes = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set("Cookie", driver.cookie)
      .send({ status: "ACCEPTED" });
    expect(acceptRes.status).toBe(200);

    const notifRes = await request(app).get("/api/notifications").set("Cookie", passenger.cookie);
    expect(notifRes.status).toBe(200);

    const notif = findNotification(notifRes.body.notifications, "BOOKING_ACCEPTED");
    expect(notif).toBeDefined();
    expect(notif.payload.bookingId).toBe(bookingId);
    expect(notif.payload.driverName).toBe("Notif Test");
  });
});

describe("NEW_MESSAGE", () => {
  it("notifie le destinataire quand un message est envoyé", async () => {
    const sendRes = await request(app)
      .post(`/api/bookings/${bookingId}/messages`)
      .set("Cookie", passenger.cookie)
      .send({ type: "TEXT", content: "Je serai à l'arrêt de bus à 14h." });
    expect(sendRes.status).toBe(201);

    const notifRes = await request(app).get("/api/notifications").set("Cookie", driver.cookie);
    expect(notifRes.status).toBe(200);

    const notif = findNotification(notifRes.body.notifications, "NEW_MESSAGE");
    expect(notif).toBeDefined();
    expect(notif.payload.bookingId).toBe(bookingId);
    expect(notif.payload.preview).toBe("Je serai à l'arrêt de bus à 14h.");
  });
});

describe("DEPARTURE_REMINDER", () => {
  it("notifie le conducteur et les passagers acceptés au déclenchement du job", async () => {
    await processDepartureReminder({ data: { tripId } });

    const driverNotifRes = await request(app).get("/api/notifications").set("Cookie", driver.cookie);
    const driverNotif = findNotification(driverNotifRes.body.notifications, "DEPARTURE_REMINDER");
    expect(driverNotif).toBeDefined();
    expect(driverNotif.payload.tripId).toBe(tripId);

    const passengerNotifRes = await request(app).get("/api/notifications").set("Cookie", passenger.cookie);
    const passengerNotif = findNotification(passengerNotifRes.body.notifications, "DEPARTURE_REMINDER");
    expect(passengerNotif).toBeDefined();
  });

  it("REMINDER_LEAD_MS correspond à 1h avant le départ", () => {
    expect(REMINDER_LEAD_MS).toBe(60 * 60 * 1000);
  });
});

describe("API de consultation des notifications", () => {
  it("GET /api/notifications/unread-count renvoie le nombre de notifications non lues", async () => {
    const res = await request(app).get("/api/notifications/unread-count").set("Cookie", driver.cookie);

    expect(res.status).toBe(200);
    // NEW_BOOKING + DEPARTURE_REMINDER pour le conducteur.
    expect(res.body.count).toBeGreaterThanOrEqual(2);
  });

  it("GET /api/notifications?unreadOnly=true ne renvoie que les notifications non lues", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .query({ unreadOnly: "true" })
      .set("Cookie", driver.cookie);

    expect(res.status).toBe(200);
    expect(res.body.notifications.every((n) => n.read === false)).toBe(true);
  });

  it("PATCH /api/notifications/:id/read marque une notification comme lue", async () => {
    const listRes = await request(app).get("/api/notifications").set("Cookie", driver.cookie);
    const target = findNotification(listRes.body.notifications, "NEW_BOOKING");

    const res = await request(app)
      .patch(`/api/notifications/${target.id}/read`)
      .set("Cookie", driver.cookie);

    expect(res.status).toBe(200);
    expect(res.body.notification.read).toBe(true);
  });

  it("PATCH /api/notifications/:id/read refuse l'accès à la notification d'un autre utilisateur", async () => {
    const listRes = await request(app).get("/api/notifications").set("Cookie", driver.cookie);
    const target = listRes.body.notifications[0];

    const res = await request(app)
      .patch(`/api/notifications/${target.id}/read`)
      .set("Cookie", passenger.cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("PATCH /api/notifications/read-all marque toutes les notifications comme lues", async () => {
    const res = await request(app).patch("/api/notifications/read-all").set("Cookie", driver.cookie);
    expect(res.status).toBe(204);

    const countRes = await request(app)
      .get("/api/notifications/unread-count")
      .set("Cookie", driver.cookie);
    expect(countRes.body.count).toBe(0);
  });

  it("GET /api/notifications sans authentification -> 401", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });
});
