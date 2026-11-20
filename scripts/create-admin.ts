import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
const email = process.env.ADMIN_EMAIL,
  password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12)
  throw Error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in the environment. No default credentials.",
  );
const id = randomUUID();
await db.user.create({
  data: {
    id,
    email: email.toLowerCase(),
    name: "Tea Tale Admin",
    emailVerified: true,
    accounts: {
      create: {
        id: randomUUID(),
        accountId: id,
        providerId: "credential",
        password: await hashPassword(password),
      },
    },
  },
});
console.log("Admin created. Remove ADMIN_PASSWORD from your environment.");
await db.$disconnect();
