import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
  },
  session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 30 },
  rateLimit: { enabled: true, storage: "database", modelName: "authRateLimit" },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "admin", input: false },
    },
  },
});
