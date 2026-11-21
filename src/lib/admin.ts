import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { z } from "zod";
export async function requireAdmin() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s || s.user.role !== "admin") throw Error("Unauthorized");
  return s.user;
}
export const productSchema = z
  .object({
    name: z.string().min(2).max(150),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    sku: z.string().min(1).max(80),
    position: z.coerce.number().int().min(1),
    type: z.enum(["Green Tea", "Black Tea", "Herbal Infusions"]),
    status: z.enum(["DRAFT", "COMING_SOON", "AVAILABLE", "OUT_OF_STOCK"]),
    price: z.number().int().positive().nullable(),
    stock: z.number().int().min(0).nullable(),
    weight: z.number().int().positive().nullable(),
    bestBefore: z.number().int().positive().nullable(),
    image: z.string().regex(/^\/teas\/(?:jars\/)?[a-zA-Z0-9_.-]+\.(webp|png|jpg|jpeg)$/),
    summary: z.string().max(3000),
    taste: z.string().max(2000),
    origin: z.string().max(2000).nullable(),
    ingredients: z.string().max(2000).nullable(),
    caffeine: z.string().max(500),
    brewing: z.string().max(2000),
    storage: z.string().max(2000),
    claims: z.string().max(10000),
    published: z.boolean().default(false),
    archived: z.boolean().default(false),
  })
  .superRefine((p, ctx) => {
    if (p.published && p.status === "DRAFT")
      ctx.addIssue({
        code: "custom",
        message:
          "Choose Coming Soon, Available or Out of Stock before publishing.",
      });
    if (
      p.published &&
      p.status === "AVAILABLE" &&
      (!p.price || p.stock === null || !p.weight)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Available products need a positive price, pack weight and opening stock.",
      });
  });
export async function audit(
  actor: string,
  action: string,
  target: string,
  details: object,
) {
  await db.audit.create({ data: { actor, action, target, details } });
}
