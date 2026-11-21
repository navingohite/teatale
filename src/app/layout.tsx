import type { Metadata } from "next";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3010",
  ),
  title: {
    default: "Tea Tale — Tales of the Himalayas",
    template: "%s | Tea Tale",
  },
  description:
    "Discover Tea Tale, a collection of whole-leaf teas and fragrant blends. Based in Bhopal, India.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
