"use strict";

const { PrismaClient } = require("@prisma/client");
const { encryptField, decryptField } = require("../utils/encryption");

const basePrisma = new PrismaClient();

/**
 * Extension Prisma : chiffre/déchiffre le champ `phone` de façon transparente
 * pour tout le reste du code (cahier des charges section 6).
 */
const prisma = basePrisma.$extends({
  name: "field-encryption",
  query: {
    user: {
      async create({ args, query }) {
        if (args.data && typeof args.data.phone === "string") {
          args.data = { ...args.data, phone: encryptField(args.data.phone) };
        }
        const result = await query(args);
        if (result && typeof result.phone === "string") {
          result.phone = decryptField(result.phone);
        }
        return result;
      },
      async update({ args, query }) {
        if (args.data && typeof args.data.phone === "string") {
          args.data = { ...args.data, phone: encryptField(args.data.phone) };
        }
        const result = await query(args);
        if (result && typeof result.phone === "string") {
          result.phone = decryptField(result.phone);
        }
        return result;
      },
      async findUnique({ args, query }) {
        const result = await query(args);
        if (result && typeof result.phone === "string") {
          result.phone = decryptField(result.phone);
        }
        return result;
      },
      async findUniqueOrThrow({ args, query }) {
        const result = await query(args);
        if (result && typeof result.phone === "string") {
          result.phone = decryptField(result.phone);
        }
        return result;
      },
      async findFirst({ args, query }) {
        const result = await query(args);
        if (result && typeof result.phone === "string") {
          result.phone = decryptField(result.phone);
        }
        return result;
      },
      async findMany({ args, query }) {
        const results = await query(args);
        return results.map((item) => {
          if (item && typeof item.phone === "string") {
            item.phone = decryptField(item.phone);
          }
          return item;
        });
      },
    },
  },
});

module.exports = prisma;
