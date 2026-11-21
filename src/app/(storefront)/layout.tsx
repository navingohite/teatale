import Link from "next/link";
import { CartProvider, Header } from "@/components/store";
import { db } from "@/lib/db";
export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await db.settings.findUniqueOrThrow({
    where: { id: "store" },
  });
  return (
    <>
      <CartProvider>
        <a href="#main" className="skip">
          Skip to content
        </a>
        <Header storeName={settings.name} />
        <main id="main" className="storefront-main">
          {children}
        </main>
        <footer>
          <div className="footer-top">
            <div>
              <Link className="footer-brand" href="/">
                <img
                  className="footer-brand-image"
                  src="/brand/tea-tale-logo-white.png"
                  alt={settings.name}
                  width={1996}
                  height={788}
                />
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
    </>
  );
}
