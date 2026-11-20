import "dotenv/config";
import { expireReservations } from "../src/lib/commerce";
import { flushMail } from "../src/lib/mail";
import { db } from "../src/lib/db";
await expireReservations();
await flushMail();
await db.$disconnect();
