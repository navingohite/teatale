import { db } from "@/lib/db";
import { ShopGrid } from "@/components/store";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shop Teas",
  alternates: { canonical: "/shop" },
  description:
    "Explore all 16 Tea Tale teas, from whole-leaf green and black teas to upcoming herbal infusions.",
};
export default async function Shop() {
  const products = await db.product.findMany({
    where: { archived: false, status: { not: "DRAFT" } },
    orderBy: { position: "asc" },
  });
  products.sort(
    (a, b) =>
      Number(b.status === "AVAILABLE") - Number(a.status === "AVAILABLE") ||
      a.position - b.position,
  );
  return (
    <section className="section shop">
      <div className="page-intro">
        <p className="eyebrow">FIND YOUR NEXT RITUAL</p>
        <h1>A tea for every tale.</h1>
        <p>
          From familiar favourites to something a little unexpected.
          <br />
          Take your time. Find your cup.
        </p>
      </div>
      <ShopGrid products={products.map((p) => ({ ...p, claims: "" }))} />
    </section>
  );
}
