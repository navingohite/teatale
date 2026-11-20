import { Checkout } from "@/components/checkout";
export const metadata = {
  title: "Guest Checkout",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Checkout />;
}
