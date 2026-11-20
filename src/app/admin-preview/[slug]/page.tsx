import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { ProductImage } from "@/components/store";
import Link from "next/link";
export const metadata = {
  title: "Private product preview",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const { slug } = await params;
  const p = await db.product.findUnique({ where: { slug } });
  if (!p) notFound();
  return (
    <section className="section">
      <p className="notice">
        Private admin preview · {p.status} {p.archived ? "· Archived" : ""}
      </p>
      <div className="product-detail">
        <ProductImage p={{ ...p, claims: "" }} large />
        <div>
          <p className="eyebrow">{p.type}</p>
          <h1>{p.name}</h1>
          <p>{p.summary}</p>
          <h3>Taste & aroma</h3>
          <p>{p.taste}</p>
          <h3>How to brew</h3>
          <p>{p.brewing}</p>
          <h3>Ingredients</h3>
          <p>{p.ingredients || "Not supplied"}</p>
          <Link className="button" href="/admin/products">
            Back to products
          </Link>
        </div>
      </div>
    </section>
  );
}
