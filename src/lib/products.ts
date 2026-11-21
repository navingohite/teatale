import { z } from "zod";
import { db } from "./db";
import { productSchema } from "./admin";
export async function saveProduct(input: unknown, actor: string) {
  const body = z
    .object({ id: z.string().optional() })
    .passthrough()
    .parse(input);
  const data = productSchema.parse(body);
  return db.$transaction(async (tx) => {
    const product = body.id
      ? await tx.product.update({ where: { id: body.id }, data })
      : await tx.product.create({ data });
    await tx.audit.create({
      data: {
        actor,
        action: data.published
          ? "PRODUCT_SAVED_AND_PUBLISHED"
          : "PRODUCT_DRAFT_SAVED",
        target: product.id,
        details: data,
      },
    });
    return product;
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
    const p = await tx.product.findUniqueOrThrow({ where: { id } });
    if (p.archived && action !== "restore" && action !== "delete")
      throw Error("Restore this product before editing its publication.");
    if (action === "publish") productSchema.parse({ ...p, published: true });
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
