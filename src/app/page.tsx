import Link from "next/link";
import { Leaf, Sun, Flame } from "lucide-react";
import { db } from "@/lib/db";
import { ProductCard, ProductImage } from "@/components/store";
export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };
export default async function Home() {
  const products = await db.product.findMany({
    where: { archived: false, status: { not: "DRAFT" } },
    orderBy: { position: "asc" },
  });
  const content = await db.content.findUnique({ where: { key: "home" } });
  const settings = await db.settings.findUniqueOrThrow({
    where: { id: "store" },
  });
  const featured = products.filter((p) =>
    settings.featured.split(",").includes(p.slug),
  );
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span /> FROM OUR COLLECTION TO YOUR CUP
          </p>
          <h1>
            {content?.approved ? content.title : "Tales of the Himalayas"}
          </h1>
          <p className="hero-description">
            {content?.approved
              ? content.body
              : "A little mountain stillness, in your everyday cup."}
          </p>
          <Link href="/shop" className="button">
            Shop Teas
          </Link>
          <div className="hero-foot">
            <Leaf size={20} />
            <span>Whole leaves. Thoughtful rituals.</span>
          </div>
        </div>
        <div className="hero-visual">
          {content?.approved && content.image ? (
            <img
              className="banner-image"
              src={content.image}
              alt="Tea Tale collection"
            />
          ) : (
            <>
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <span className="visual-top">THE TEA TALE COLLECTION</span>
              {products[0] && (
                <div className="hero-label first">
                  <ProductImage p={{ ...products[0], claims: "" }} />
                </div>
              )}
              {products[1] && (
                <div className="hero-label second">
                  <ProductImage p={{ ...products[1], claims: "" }} />
                </div>
              )}
              <span className="visual-bottom">ROOTED IN A LOVE FOR TEA</span>
              <div className="leaf-mark">
                <Leaf size={95} strokeWidth={0.8} />
              </div>
            </>
          )}
        </div>
      </section>
      <div className="values-strip">
        <span>Whole-leaf beginnings</span>
        <span>A ritual worth slowing down for</span>
        <span>From Tea Tale, Bhopal</span>
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE FIRST CHAPTER</p>
            <h2>Meet your everyday favourites.</h2>
          </div>
          <Link className="text-link" href="/shop">
            Explore all teas
          </Link>
        </div>
        <div className="featured-grid">
          {featured.map((p) => (
            <ProductCard key={p.id} p={{ ...p, claims: "" }} />
          ))}
        </div>
      </section>
      <section className="story-band">
        <div className="story-art">
          <svg
            viewBox="0 0 600 400"
            aria-label="Illustration of Himalayan mountain ridges"
            role="img"
          >
            <path
              d="M0 300 170 90 245 190 350 40 600 320V400H0Z"
              fill="#bcc1a6"
            />
            <path
              d="m120 155 50-65 75 100-65-32-21 13ZM280 145l70-105 80 109-69-42-23 25Z"
              fill="#f7f2e8"
            />
            <path
              d="M0 390 160 230 280 320 460 170 600 300v100H0Z"
              fill="#76866e"
            />
            <path d="m0 400 270-70 100 30 230-100v140Z" fill="#40583f" />
          </svg>
          <span>INSPIRED BY THE HILLS</span>
        </div>
        <div>
          <p className="eyebrow">OUR STORY</p>
          <h2>
            Every leaf.
            <br />A little tale.
          </h2>
          <p>
            We believe a cup of tea can be a moment to pause. Tea Tale brings
            that feeling into your everyday, with a collection inspired by the
            Himalayas and a home in Bhopal.
          </p>
          <Link className="text-link" href="/our-story">
            Get to know Tea Tale
          </Link>
        </div>
      </section>
      <section className="section brewing">
        <p className="eyebrow">MAKE TIME FOR YOUR CUP</p>
        <h2>A simple ritual. A beautiful cup.</h2>
        <div className="brew-steps">
          <div>
            <Leaf />
            <h3>A spoonful of leaves</h3>
            <p>
              About 2 g of tea for a 200 ml cup.
              <br />
              Give the leaves room to unfold.
            </p>
          </div>
          <div>
            <Flame />
            <h3>A little warmth</h3>
            <p>
              Cooler water for green tea.
              <br />
              Near boiling for black tea.
            </p>
          </div>
          <div>
            <Sun />
            <h3>A moment to pause</h3>
            <p>
              Steep, strain and sip slowly.
              <br />
              Make the moment your own.
            </p>
          </div>
        </div>
        <Link className="button secondary" href="/brew-guide">
          Find your perfect brew
        </Link>
      </section>
      <section className="coming-band">
        <p className="eyebrow">THE STORY CONTINUES</p>
        <h2>More leaves. More possibilities.</h2>
        <p>
          Floral, spiced, bright and unexpected. Fourteen new teas are waiting
          in the wings.
        </p>
        <div className="coming-names">
          Tulsi Green Tea <span>·</span> Blue Tea <span>·</span> Chamomile Tea
        </div>
        <Link href="/shop" className="text-link">
          Discover what’s coming
        </Link>
      </section>
    </>
  );
}
