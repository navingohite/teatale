import { db } from "@/lib/db";
import { CartPage } from "@/components/store";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your Bag",
  robots: { index: false, follow: false },
};
export default async function Cart() {
  return (
    <CartPage
      products={(await db.product.findMany({ where: { archived: false } })).map(
        (p) => ({ ...p, claims: "" }),
      )}
    />
  );
}
