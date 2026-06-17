"use strict";

const { z } = require("zod");
const { nameSchema, phoneSchema } = require("./common");

const updateProfileSchema = z
  .object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .strict();

module.exports = { updateProfileSchema };
