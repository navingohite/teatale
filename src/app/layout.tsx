import type { Metadata } from "next";
import Link from "next/link";
import { CartProvider, Header } from "@/components/store";
import "./globals.css";
import { db } from "@/lib/db";
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
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await db.settings.findUniqueOrThrow({
    where: { id: "store" },
  });
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <a href="#main" className="skip">
            Skip to content
          </a>
          <Header storeName={settings.name} />
          <main id="main">{children}</main>
          <footer>
            <div className="footer-top">
              <div>
                <Link className="footer-brand" href="/">
                  {settings.name.toUpperCase()}
                </Link>
                <p>
                  Tales of the Himalayas.
                  <br />A little stillness, one cup at a time.
                </p>
                <small>Bhopal, India</small>
              </div>
              <div>
                <h3>Explore</h3>
                <Link href="/shop">Shop Teas</Link>
                <Link href="/our-story">Our Story</Link>
                <Link href="/brew-guide">Brew Guide</Link>
              </div>
              <div>
                <h3>Here to help</h3>
                <Link href="/track-order">Track Order</Link>
                <Link href="/contact">Contact</Link>
                <Link href="/faq">FAQs</Link>
              </div>
              <div>
                <h3>Stay a little longer</h3>
                <a href={`https://www.instagram.com/${settings.instagram}/`}>
                  @{settings.instagram}
                </a>
                <a href={`mailto:${settings.email}`}>{settings.email}</a>
                <p>Good tea. Unhurried moments.</p>
              </div>
            </div>
            <div className="footer-bottom">
              <span>© {new Date().getFullYear()} Tea Tale</span>
              <div>
                {[
                  ["shipping", "Shipping & Delivery"],
                  ["returns", "Returns & Refunds"],
                  ["privacy", "Privacy"],
                  ["terms", "Terms"],
                ].map(([path, label]) => (
                  <Link key={path} href={"/" + path}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
