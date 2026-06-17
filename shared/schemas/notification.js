"use strict";

const { z } = require("zod");
const { paginationSchema } = require("./common");

// z.coerce.boolean() considère toute chaîne non vide (y compris "false")
// comme vraie : on whitelist explicitement "true"/"false" (validation stricte).
const booleanQueryParam = z
  .union([z.literal("true"), z.literal("false")])
  .optional()
  .default("false")
  .transform((value) => value === "true");

const listNotificationsQuerySchema = paginationSchema.extend({
  unreadOnly: booleanQueryParam,
});

module.exports = { listNotificationsQuerySchema };
