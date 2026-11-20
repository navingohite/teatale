import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "better-auth/crypto";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { testMode } from "../src/lib/security";
if (
  !testMode() ||
  !new URL(process.env.DATABASE_URL!).pathname.endsWith("_dev")
)
  throw Error(
    "QA admin creation is restricted to the isolated loopback _dev database.",
  );
const email = "qa-admin@example.test",
  password = randomBytes(24).toString("hex"),
  id = randomUUID();
await db.user.deleteMany({ where: { email } });
await db.user.create({
  data: {
    id,
    email,
    name: "Local QA Admin",
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
await mkdir(".local", { recursive: true });
await writeFile(".local/qa-admin.json", JSON.stringify({ email, password }), {
  mode: 0o600,
});
console.log(
  "Random local QA credential saved privately in .local/qa-admin.json.",
);
await db.$disconnect();
