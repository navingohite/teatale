import { z } from "zod";
import { db } from "./db";
import { productSchema } from "./admin";
import { packInclude, activePacks } from "./packs";
export async function saveProduct(input: unknown, actor: string) {
  const body = z
    .object({ id: z.string().optional() })
    .passthrough()
    .parse(input);
  const parsed = productSchema.parse(body);
  const { variants, ...data } = parsed;
  return db.$transaction(async (tx) => {
    if (body.id) {
      await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id"=${body.id} FOR UPDATE`;
      if (variants) {
        const existing = await tx.productVariant.findMany({
          where: { productId: body.id },
        });
        for (const v of variants) {
          if (
            v.id &&
            !existing.some((e) => e.id === v.id && e.weight === v.weight)
          )
            throw Error(
              "Pack size does not belong to this product, or its weight changed. Remove it and add a new size instead.",
            );
        }
      }
    } else if (variants?.some((v) => v.id))
      throw Error("New products cannot reuse existing pack IDs.");
    if (variants) {
      const first = [...variants].sort(
        (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
      )[0];
      Object.assign(data, {
        price: first?.price ?? null,
        mrp: first?.mrp ?? null,
        weight: first?.weight ?? null,
        stock: variants.reduce((n, v) => n + (v.stock || 0), 0),
      });
    }
    const product = body.id
      ? await tx.product.update({ where: { id: body.id }, data })
      : await tx.product.create({ data });
    if (variants) {
      await tx.productVariant.updateMany({
        where: { productId: product.id },
        data: { archived: true },
      });
      for (const { id: _id, ...v } of variants) {
        await tx.productVariant.upsert({
          where: {
            productId_weight: { productId: product.id, weight: v.weight },
          },
          create: { ...v, productId: product.id },
          update: { ...v, archived: false },
        });
      }
    }
    await tx.audit.create({
      data: {
        actor,
        action: data.published
          ? "PRODUCT_SAVED_AND_PUBLISHED"
          : "PRODUCT_DRAFT_SAVED",
        target: product.id,
        details: parsed,
      },
    });
    return tx.product.findUniqueOrThrow({
      where: { id: product.id },
      include: packInclude,
    });
  });
}
export const productActionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["publish", "unpublish", "delete", "restore"]),
});
export async function changeProductState(input: unknown, actor: string) {
  const { id, action } = productActionSchema.parse(input);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id"=${id} FOR UPDATE`;
    const p = await tx.product.findUniqueOrThrow({
      where: { id },
      include: packInclude,
    });
    if (p.archived && action !== "restore" && action !== "delete")
      throw Error("Restore this product before editing its publication.");
    if (action === "publish")
      productSchema.parse({
        ...p,
        variants: p.variants.length ? activePacks(p) : undefined,
        published: true,
      });
    const data =
      action === "delete"
        ? { archived: true, published: false }
        : action === "restore"
          ? { archived: false, published: false }
          : { published: action === "publish" };
    const product = await tx.product.update({ where: { id }, data });
    await tx.audit.create({
      data: {
        actor,
        action: "PRODUCT_" + action.toUpperCase(),
        target: id,
        details: {
          name: p.name,
          before: { published: p.published, archived: p.archived },
          after: data,
        },
      },
    });
    return product;
  });
}
