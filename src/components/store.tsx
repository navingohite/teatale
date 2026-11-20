"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag, Leaf, Menu, X, Minus, Plus } from "lucide-react";
import { money, availability } from "@/lib/format";
import type { Product } from "@prisma/client";
type Item = {
  id: string;
  name: string;
  image: string;
  quantity: number;
  price: number;
};
const CartContext = createContext<{
  items: Item[];
  setItems: (v: Item[]) => void;
}>({ items: [], setItems: () => {} });
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setState] = useState<Item[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const a = JSON.parse(localStorage.getItem("tea-tale-cart") || "[]");
      if (Array.isArray(a)) setState(a);
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("tea-tale-cart", JSON.stringify(items));
  }, [items, ready]);
  return (
    <CartContext.Provider value={{ items, setItems: setState }}>
      {children}
    </CartContext.Provider>
  );
}
export const useCart = () => useContext(CartContext);
export function Header({ storeName = "Tea Tale" }: { storeName?: string }) {
  const { items } = useCart();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="announcement">
        TALES OF THE HIMALAYAS <span>•</span> A moment for yourself
      </div>
      <header>
        <Link href="/" className="brand">
          <Leaf size={25} />
          <span>
            {storeName.toUpperCase()}
            <small>TALES OF THE HIMALAYAS</small>
          </span>
        </Link>
        <nav className={open ? "open" : ""} aria-label="Main navigation">
          {[
            ["/shop", "Shop"],
            ["/our-story", "Our Story"],
            ["/brew-guide", "Brew Guide"],
          ].map(([href, name]) => (
            <Link onClick={() => setOpen(false)} key={href} href={href}>
              {name}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link
            href="/cart"
            className="bag"
            aria-label={`Cart with ${items.reduce((s, i) => s + i.quantity, 0)} items`}
          >
            <ShoppingBag size={21} />
            <span>Bag ({items.reduce((s, i) => s + i.quantity, 0)})</span>
          </Link>
          <button
            className="mobile-menu icon-btn"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
    </>
  );
}
export function ProductImage({
  p,
  large = false,
}: {
  p: Pick<Product, "name" | "slug" | "type" | "image" | "claims">;
  large?: boolean;
}) {
  if (!p.image.includes("-label."))
    return (
      <div className="product-art photograph">
        <img
          src={p.image}
          alt={`${p.name} product photograph`}
          loading={large ? "eager" : "lazy"}
        />
      </div>
    );
  return (
    <div
      className={`product-art ${p.type === "Black Tea" ? "black" : p.type === "Herbal Infusions" ? "herbal" : ""} ${large ? "large" : ""}`}
    >
      <span className="art-wordmark">TEA TALE</span>
      <img
        src={p.image}
        srcSet={`${p.image.replace(".webp", "-480.webp")} 480w, ${p.image.replace(".webp", "-960.webp")} 960w`}
        sizes={
          large
            ? "(max-width: 600px) 90vw, 45vw"
            : "(max-width: 600px) 45vw, 33vw"
        }
        alt={`${p.name} — ${p.image.includes("-label.") ? "cropped catalogue label artwork" : "product photograph"}`}
        loading={large ? "eager" : "lazy"}
      />
      <span className="art-caption">
        {p.image.includes("-label.")
          ? "CATALOGUE LABEL ARTWORK"
          : "TEA TALE COLLECTION"}
      </span>
    </div>
  );
}
export function ProductCard({ p }: { p: Product }) {
  const status = availability(p);
  return (
    <Link className="product-card" href={`/tea/${p.slug}`}>
      <div className="card-image">
        <ProductImage p={p} />
        <span className="badge">
          {p.weight ? `${p.weight} g · Loose leaf` : "Coming Soon"}
        </span>
      </div>
      <div className="card-detail">
        <small>{p.type}</small>
        <h3>{p.name}</h3>
        <p>{p.taste}</p>
        <div className="card-bottom">
          <span>{status === "Available" ? money(p.price!) : status}</span>
          <span className="text-link">Discover tea</span>
        </div>
      </div>
    </Link>
  );
}
export function ShopGrid({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState("All Teas");
  const shown = products.filter(
    (p) => filter === "All Teas" || p.type === filter,
  );
  return (
    <>
      <div className="filters" aria-label="Tea types">
        {["All Teas", "Green Tea", "Black Tea", "Herbal Infusions"].map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            className={filter === f ? "selected" : ""}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <span>{shown.length} teas to discover</span>
      </div>
      <div className="product-grid">
        {shown.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </>
  );
}
export function AddToCart({ p }: { p: Product }) {
  const { items, setItems } = useCart();
  const [quantity, setQuantity] = useState(1),
    [message, setMessage] = useState("");
  if (availability(p) !== "Available")
    return (
      <div className="availability">
        <strong>{availability(p)}</strong>
        <p>
          {p.status === "COMING_SOON"
            ? "A new tale is on its way. Explore the tasting notes below."
            : "We’re preparing this tea for your next ritual. Check back for availability."}
        </p>
      </div>
    );
  return (
    <div className="buy">
      <div className="price">
        {money(p.price!)} <small> / {p.weight} g</small>
      </div>
      <div className="buy-row">
        <div className="quantity">
          <button
            aria-label="Decrease quantity"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
          >
            <Minus size={16} />
          </button>
          <input
            aria-label="Quantity"
            type="number"
            min={1}
            max={Math.min(20, p.stock!)}
            value={quantity}
            onChange={(e) =>
              setQuantity(
                Math.max(
                  1,
                  Math.min(20, p.stock!, Number(e.target.value) || 1),
                ),
              )
            }
          />
          <button
            aria-label="Increase quantity"
            onClick={() => setQuantity(Math.min(20, p.stock!, quantity + 1))}
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          className="button add-button"
          onClick={() => {
            const existing = items.find((i) => i.id === p.id);
            const next = Math.min(
              p.stock!,
              20,
              (existing?.quantity || 0) + quantity,
            );
            setItems([
              ...items.filter((i) => i.id !== p.id),
              {
                id: p.id,
                name: p.name,
                image: p.image,
                quantity: next,
                price: p.price!,
              },
            ]);
            setMessage("Added to your bag.");
          }}
        >
          Add to Bag <ShoppingBag size={17} />
        </button>
      </div>
      <p role="status">
        {message} {message && <Link href="/cart">View bag</Link>}
      </p>
    </div>
  );
}
export async function api(action: string, body: unknown) {
  const r = await fetch("/api/store/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Please try again.");
  return data;
}
export function CartPage({ products }: { products: Product[] }) {
  const { items, setItems } = useCart();
  const changed = items.some((i) => {
    const p = products.find((p) => p.id === i.id);
    return (
      !p ||
      p.price !== i.price ||
      availability(p) !== "Available" ||
      p.stock! < i.quantity
    );
  });
  return (
    <div className="narrow">
      <p className="eyebrow">YOUR DAILY RITUAL</p>
      <h1>Your tea bag</h1>
      {!items.length ? (
        <div className="empty">
          <ShoppingBag size={40} />
          <h2>A new tale awaits.</h2>
          <p>Find a tea to make a little time for yourself.</p>
          <Link className="button" href="/shop">
            Explore the teas
          </Link>
        </div>
      ) : (
        <>
          {changed && (
            <div className="notice" role="alert">
              Prices or availability have changed. Review the updated items
              before checkout.
              <button
                className="text-link"
                onClick={() =>
                  setItems(
                    items.flatMap((i) => {
                      const p = products.find((p) => p.id === i.id);
                      return p && availability(p) === "Available"
                        ? [
                            {
                              ...i,
                              price: p.price!,
                              quantity: Math.min(i.quantity, p.stock!),
                            },
                          ]
                        : [];
                    }),
                  )
                }
              >
                Accept updates
              </button>
            </div>
          )}
          {items.map((i) => (
            <div className="cart-line" key={i.id}>
              <div>
                <h3>{i.name}</h3>
                <p>{money(i.price)} each</p>
              </div>
              <label>
                Quantity
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={i.quantity}
                  onChange={(e) =>
                    setItems(
                      items.map((x) =>
                        x.id === i.id
                          ? {
                              ...x,
                              quantity: Math.min(
                                20,
                                Math.max(1, Number(e.target.value) || 1),
                              ),
                            }
                          : x,
                      ),
                    )
                  }
                />
              </label>
              <strong>{money(i.price * i.quantity)}</strong>
              <button
                className="text-link"
                onClick={() => setItems(items.filter((x) => x.id !== i.id))}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="total">
            <span>Subtotal</span>
            <strong>
              {money(items.reduce((s, i) => s + i.price * i.quantity, 0))}
            </strong>
          </div>
          <p>Delivery is calculated using your PIN code at checkout.</p>
          {!changed && (
            <Link className="button" href="/checkout">
              Guest checkout
            </Link>
          )}
        </>
      )}
    </div>
  );
}
