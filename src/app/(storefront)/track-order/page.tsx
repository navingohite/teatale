import { Suspense } from "react";
import { TrackOrder } from "@/components/checkout";
export const metadata = {
  title: "Track Order",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <TrackOrder />
    </Suspense>
  );
}
