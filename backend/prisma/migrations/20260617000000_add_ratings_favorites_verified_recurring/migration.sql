-- Verified badge on User
ALTER TABLE "users" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- Recurring trip fields on Trip
ALTER TABLE "trips" ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trips" ADD COLUMN "recurringDays" TEXT;

-- Rating model (one per booking, passenger → driver)
CREATE TABLE "ratings" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "raterId" UUID NOT NULL,
    "ratedId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ratings_bookingId_key" ON "ratings"("bookingId");
CREATE INDEX "ratings_ratedId_idx" ON "ratings"("ratedId");

ALTER TABLE "ratings" ADD CONSTRAINT "ratings_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_raterId_fkey"
    FOREIGN KEY ("raterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ratedId_fkey"
    FOREIGN KEY ("ratedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FavoriteRoute model
CREATE TABLE "favorite_routes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fromCity" TEXT NOT NULL,
    "toCity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorite_routes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "favorite_routes_userId_fromCity_toCity_key" ON "favorite_routes"("userId", "fromCity", "toCity");
CREATE INDEX "favorite_routes_userId_idx" ON "favorite_routes"("userId");

ALTER TABLE "favorite_routes" ADD CONSTRAINT "favorite_routes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
