"use strict";

const express = require("express");
const compression = require("compression");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { corsOptions, helmetOptions } = require("./config/security");
const httpsRedirect = require("./middleware/httpsRedirect");
const requestTimeout = require("./middleware/requestTimeout");
const { globalLimiter } = require("./middleware/rateLimiters");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const tripRoutes = require("./routes/trips");
const bookingRoutes = require("./routes/bookings");
const messageRoutes = require("./routes/messages");
const notificationRoutes = require("./routes/notifications");
const geocodeRoutes = require("./routes/geocode");
const favoriteRoutes = require("./routes/favorites");

const app = express();

// Azure App Service est derrière un reverse proxy : nécessaire pour que
// req.ip / x-forwarded-proto reflètent le client réel (CORS, rate limit, HTTPS).
app.set("trust proxy", 1);

app.use(compression());
app.use(httpsRedirect);
app.use(helmet(helmetOptions));
app.use(cors(corsOptions));

// Limite de taille des payloads : 10kb (cahier des charges section 3), portée
// à 3mb pour couvrir :
//   • messages vocaux (base64 ≤ 200 000 chars, voir shared/schemas/message.js)
//   • avatars haute qualité (JPEG ≤ 2 Mo → base64 ≤ 2 800 000 chars)
// Les deux routes concernées sont authentifiées et soumises au rate limiting global.
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ limit: "3mb", extended: false }));

// Cookies httpOnly non signés (access/refresh tokens auto-protégés : JWT
// signé RS256, refresh token opaque dont seul le hash est stocké en base —
// une signature de cookie supplémentaire n'apporterait rien).
app.use(cookieParser());

app.use(globalLimiter);
app.use(requestTimeout);

app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/bookings", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/geocode", geocodeRoutes);
app.use("/api/favorites", favoriteRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
