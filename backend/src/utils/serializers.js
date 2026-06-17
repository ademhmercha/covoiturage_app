"use strict";

// Représentation publique d'un utilisateur : exclut systématiquement
// `passwordHash` ainsi que les compteurs internes de verrouillage de compte
// (failedLoginAttempts, lockedUntil) — jamais exposés au client.
function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || null,
    avatarUrl: user.avatarUrl || null,
    isVerified: user.isVerified || false,
    role: user.role,
    createdAt: user.createdAt,
  };
}

// Profil minimal visible par les autres utilisateurs (ex: conducteur d'un
// trajet) : jamais d'email, téléphone, rôle ni date d'inscription.
function serializePublicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl || null,
    isVerified: user.isVerified || false,
  };
}

// `extra` permet d'ajouter des champs calculés (ex: availableSeats) sans
// dupliquer la sérialisation de base.
function serializeTrip(trip, extra = {}) {
  return {
    id: trip.id,
    driverId: trip.driverId,
    driver: trip.driver ? serializePublicUser(trip.driver) : undefined,
    originLabel: trip.originLabel,
    origin: { lat: trip.originLat, lng: trip.originLng },
    destinationLabel: trip.destinationLabel,
    destination: { lat: trip.destinationLat, lng: trip.destinationLng },
    departureAt: trip.departureAt,
    seatsAvailable: trip.seatsAvailable,
    pricePerSeat: trip.pricePerSeat,
    vehicleInfo: trip.vehicleInfo || null,
    status: trip.status,
    isRecurring: trip.isRecurring || false,
    recurringDays: trip.recurringDays || null,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    ...extra,
  };
}

function serializeBooking(booking, extra = {}) {
  return {
    id: booking.id,
    tripId: booking.tripId,
    trip: booking.trip ? serializeTrip(booking.trip) : undefined,
    passengerId: booking.passengerId,
    passenger: booking.passenger ? serializePublicUser(booking.passenger) : undefined,
    seats: booking.seats,
    status: booking.status,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    ...extra,
  };
}

function serializeMessage(message) {
  return {
    id: message.id,
    bookingId: message.bookingId,
    senderId: message.senderId,
    sender: message.sender ? serializePublicUser(message.sender) : undefined,
    type: message.type,
    content: message.content,
    seenAt: message.seenAt || null,
    createdAt: message.createdAt,
  };
}

// Aperçu d'une conversation (réservation + dernier message) pour la liste
// "Messages" de la navbar. `otherParty` dépend du point de vue de l'appelant
// (passager -> conducteur, conducteur -> passager). Le contenu d'un message
// vocal (base64) n'est jamais inclus dans cet aperçu.
function serializeConversation(booking, userId) {
  const isPassenger = booking.passengerId === userId;
  const otherParty = isPassenger ? booking.trip.driver : booking.passenger;
  const last = booking.messages?.[0];

  return {
    id: booking.id,
    tripId: booking.tripId,
    trip: {
      originLabel: booking.trip.originLabel,
      destinationLabel: booking.trip.destinationLabel,
      departureAt: booking.trip.departureAt,
    },
    status: booking.status,
    otherParty: otherParty ? serializePublicUser(otherParty) : null,
    lastMessage: last
      ? {
          type: last.type,
          // Base64 (AUDIO/IMAGE) omis de l'aperçu pour alléger la réponse.
          content: last.type === "TEXT" ? last.content : null,
          createdAt: last.createdAt,
          senderId: last.senderId,
        }
      : null,
    updatedAt: booking.updatedAt,
  };
}

function serializeRating(rating) {
  return {
    id: rating.id,
    bookingId: rating.bookingId,
    raterId: rating.raterId,
    ratedId: rating.ratedId,
    score: rating.score,
    comment: rating.comment || null,
    createdAt: rating.createdAt,
  };
}

function serializeFavoriteRoute(fav) {
  return {
    id: fav.id,
    fromCity: fav.fromCity,
    toCity: fav.toCity,
    createdAt: fav.createdAt,
  };
}

function serializeNotification(notification) {
  return {
    id: notification.id,
    type: notification.type,
    payload: notification.payload,
    read: notification.readAt !== null,
    createdAt: notification.createdAt,
  };
}

module.exports = {
  serializeUser,
  serializePublicUser,
  serializeTrip,
  serializeBooking,
  serializeMessage,
  serializeConversation,
  serializeRating,
  serializeFavoriteRoute,
  serializeNotification,
};
