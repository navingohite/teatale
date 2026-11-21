import { db } from "@/lib/db";
import type { MetadataRoute } from "next";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3010";
  const products = await db.product.findMany({
    where: { published: true, archived: false, status: { not: "DRAFT" } },
  });
  return [
    ...[
      "",
      "/shop",
      "/our-story",
      "/brew-guide",
      "/contact",
      "/faq",
      "/shipping",
      "/returns",
      "/privacy",
      "/terms",
    ].map((p) => ({ url: base + p })),
    ...products.map((p) => ({
      url: `${base}/tea/${p.slug}`,
      lastModified: p.updatedAt,
    })),
  ];
}
