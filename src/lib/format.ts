export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
export function availability(p: {
  status: string;
  price: number | null;
  stock: number | null;
  weight: number | null;
}) {
  if (p.status === "COMING_SOON") return "Coming Soon";
  if (p.status === "DRAFT") return "Draft";
  if (p.status === "OUT_OF_STOCK" || p.stock === 0) return "Out of Stock";
  if (!p.price || p.stock === null || !p.weight) return "Launching soon";
  return "Available";
}
