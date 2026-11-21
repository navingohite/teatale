import type { Product, ProductVariant } from "@prisma/client";
export type ProductWithPacks = Product & { variants?: ProductVariant[] };
export const packInclude = {
  variants: { orderBy: { weight: "asc" as const } },
};
export const packLabel = (grams: number) =>
  grams >= 1000 ? `${grams / 1000} kg` : `${grams} g`;
export function activePacks(p: ProductWithPacks) {
  return (p.variants || []).filter((v) => !v.archived);
}
export function displayProduct(p: ProductWithPacks): ProductWithPacks {
  if (!p.variants?.length) return p;
  const packs = activePacks(p);
  const ready = packs.filter(
    (v) => v.price != null && v.stock != null && v.stock > 0,
  );
  const best = [...(ready.length ? ready : packs)].sort(
    (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
  )[0];
  return {
    ...p,
    price: best?.price ?? null,
    mrp: best?.mrp ?? null,
    weight: best?.weight ?? null,
    stock: packs.reduce((n, v) => n + (v.stock || 0), 0),
  };
}
export function selectedPack(p: ProductWithPacks, variantId?: string) {
  if (!p.variants?.length) return variantId ? null : p;
  const variant = activePacks(p).find((v) => v.id === variantId);
  return variant
    ? {
        ...p,
        price: variant.price,
        mrp: variant.mrp,
        stock: variant.stock,
        weight: variant.weight,
      }
    : null;
}
export const cartKey = (item: { id: string; variantId?: string }) =>
  `${item.id}:${item.variantId || "legacy"}`;
