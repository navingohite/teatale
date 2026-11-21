import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProductImage, AddToCart } from "@/components/store";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await db.product.findUnique({ where: { slug } });
  if (!p || !p.published || p.archived || p.status === "DRAFT")
    return { title: "Tea not found", robots: { index: false } };
  return {
    title: p.name,
    description: p?.summary,
    alternates: { canonical: "/tea/" + slug },
  };
}
export default async function Tea({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await db.product.findUnique({ where: { slug } });
  if (!p || !p.published || p.archived || p.status === "DRAFT") notFound();
  return (
    <section className="section">
      <div className="breadcrumbs">
        <Link href="/shop">All teas</Link> / {p.name}
      </div>
      <div className="product-detail">
        <ProductImage p={{ ...p, claims: "" }} large />
        <div className="product-info">
          <p className="eyebrow">{p.type}</p>
          <h1>{p.name}</h1>
          <p className="lead">{p.summary}</p>
          {p.weight && <p>{p.weight} g · Loose leaf</p>}
          <AddToCart p={{ ...p, claims: "" }} />
          <div className="product-notes">
            <h3>Taste & aroma</h3>
            <p>{p.taste}</p>
            <h3>How to brew</h3>
            <p>{p.brewing}</p>
          </div>
        </div>
      </div>
      <div className="detail-grid">
        {[
          ["Caffeine", p.caffeine],
          [
            "Sourcing",
            p.origin || "Supplier details will be shared once confirmed.",
          ],
          [
            "Ingredients",
            p.ingredients ||
              "Full ingredient details will be confirmed before launch.",
          ],
          [
            "Storage & freshness",
            p.storage +
              (p.bestBefore
                ? ` Best before ${p.bestBefore} months from packing.`
                : ""),
          ],
        ].map(([label, text]) => (
          <div key={label}>
            <h3>{label}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
