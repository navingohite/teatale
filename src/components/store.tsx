"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Menu,
  X,
  Minus,
  Plus,
  Check,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { money, availability, discountPercent } from "@/lib/format";
import type { Product } from "@prisma/client";
import {
  activePacks,
  displayProduct,
  selectedPack,
  cartKey,
  packLabel,
  type ProductWithPacks,
} from "@/lib/packs";
type Item = {
  id: string;
  variantId?: string;
  weight?: number;
  name: string;
  image: string;
  quantity: number;
  price: number;
};
const CartContext = createContext<{
  items: Item[];
  setItems: (v: Item[]) => void;
  notify: (title: string, detail: string) => void;
}>({ items: [], setItems: () => {}, notify: () => {} });
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setState] = useState<Item[]>([]);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<{ title: string; detail: string } | null>(
    null,
  );
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);
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
    <CartContext.Provider
      value={{
        items,
        setItems: setState,
        notify: (title, detail) => setToast({ title, detail }),
      }}
    >
      {children}
      {toast && (
        <aside className="bag-toast" aria-label="Bag notification">
          <span className="bag-toast-icon" aria-hidden="true">
            <Check size={20} />
          </span>
          <div className="bag-toast-body">
            <div role="status" aria-live="polite" aria-atomic="true">
              <strong>{toast.title}</strong>
              <p>{toast.detail}</p>
            </div>
            <Link href="/cart" onClick={() => setToast(null)}>
              View Bag <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <button
            type="button"
            className="bag-toast-close"
            aria-label="Close notification"
            onClick={() => setToast(null)}
          >
            <X size={18} />
          </button>
        </aside>
      )}
    </CartContext.Provider>
  );
}
export const useCart = () => useContext(CartContext);
export function Header({ storeName = "Tea Tale" }: { storeName?: string }) {
  const { items } = useCart();
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="store-header">
        <Link href="/" className="brand">
          <img
            className="brand-image"
            src="/brand/tea-tale-logo.png"
            alt={storeName}
            width={1748}
            height={677}
          />
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
  if (p.image.includes("-poster-"))
    return (
      <div className={`product-art catalogue-poster ${large ? "large" : ""}`}>
        <img
          src={p.image}
          srcSet={`${p.image.replace("-960.webp", "-480.webp")} 480w, ${p.image} 960w`}
          sizes={
            large
              ? "(max-width: 600px) 90vw, 45vw"
              : "(max-width: 600px) 45vw, 33vw"
          }
          alt={`${p.name} — full poster from the Tea Tale Word catalogue`}
          loading={large ? "eager" : "lazy"}
        />
      </div>
    );
  if (!p.image.includes("-label."))
    return (
      <div
        className={`product-art photograph ${p.image.includes("/jars/") ? "jar-image" : ""} ${large ? "large" : ""}`}
      >
        <img
          src={p.image}
          alt={
            p.image.includes("product-placeholder")
              ? `${p.name} — product image coming soon`
              : `${p.name} product photograph`
          }
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
export function ProductCard({ p: source }: { p: ProductWithPacks }) {
  const p = displayProduct(source);
  const packs = activePacks(p);
  const status = availability(p);
  const discount = discountPercent(p.price, p.mrp);
  return (
    <Link className="product-card" href={`/tea/${p.slug}`}>
      <div className="card-image">
        <div className="card-image-tags">
          <span
            className={`card-status ${status === "Available" ? "available" : ""}`}
          >
            {status}
          </span>
          {status === "Available" && discount > 0 && (
            <span className="discount-badge">{discount}% OFF</span>
          )}
        </div>
        <ProductImage p={p} />
      </div>
      <div className="card-detail">
        <div className="card-category">
          <small>{p.type}</small>
          {packs.length > 1 ? (
            <span>{packs.length} pack sizes</span>
          ) : p.weight ? (
            <span>{packLabel(p.weight)} · Loose leaf</span>
          ) : null}
        </div>
        <h3>{p.name}</h3>
        <p>{p.taste}</p>
        <div className="card-bottom">
          {status === "Available" && (
            <div className="card-pricing">
              <span className="card-price">
                {packs.length > 1 && "From "}
                {money(p.price!)}
              </span>
              {p.mrp != null && p.mrp > p.price! && (
                <del aria-label={`MRP ${money(p.mrp)}`}>{money(p.mrp)}</del>
              )}
            </div>
          )}
          <span
            className={`card-action ${status === "Available" ? "buy" : ""}`}
          >
            {status === "Available" ? "Buy Tea" : "Discover Tea"}{" "}
            <span aria-hidden="true">↗</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
export function ShopGrid({ products }: { products: ProductWithPacks[] }) {
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
function QuantityControl({
  value,
  max,
  label,
  onChange,
  disabled = false,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const limit = Math.max(1, Math.min(20, max));
  return (
    <div
      className="quantity quantity-stepper"
      role="group"
      aria-label={`Quantity for ${label}`}
    >
      <button
        type="button"
        aria-label={`Decrease quantity for ${label}`}
        title="Decrease quantity"
        disabled={disabled || value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Minus size={16} />
      </button>
      <input
        aria-label={`Quantity for ${label}`}
        type="number"
        inputMode="numeric"
        min={1}
        max={limit}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            Math.max(
              1,
              Math.min(limit, Math.trunc(Number(e.target.value)) || 1),
            ),
          )
        }
      />
      <button
        type="button"
        aria-label={`Increase quantity for ${label}`}
        title="Increase quantity"
        disabled={disabled || value >= limit}
        onClick={() => onChange(Math.min(limit, value + 1))}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
export function AddToCart({ p: source }: { p: ProductWithPacks }) {
  const packs = activePacks(source);
  const [variantId, setVariantId] = useState(
    packs.find((v) => v.stock && v.price)?.id || packs[0]?.id,
  );
  const p = selectedPack(source, variantId) || {
    ...source,
    price: null,
    stock: 0,
    weight: null,
  };
  const purchasable = availability(p) === "Available";
  const key = cartKey({ id: p.id, variantId });
  const router = useRouter();
  const { items, setItems, notify } = useCart();
  const [quantity, setQuantity] = useState(1);
  function add(showNotification = true) {
    if (!purchasable) return;
    const existing = items.find((i) => cartKey(i) === key);
    const next = Math.min(p.stock!, 20, (existing?.quantity || 0) + quantity);
    setItems([
      ...items.filter((i) => cartKey(i) !== key),
      {
        id: p.id,
        variantId,
        weight: p.weight!,
        name: p.name,
        image: p.image,
        quantity: next,
        price: p.price!,
      },
    ]);
    if (showNotification)
      notify(
        next > (existing?.quantity || 0)
          ? "Added to your bag"
          : "Bag limit reached",
        `${p.name} · ${packLabel(p.weight!)}`,
      );
  }
  if (source.status !== "AVAILABLE" || !source.published || source.archived)
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
      {packs.length > 0 && (
        <fieldset className="pack-selector">
          <legend>Choose pack size</legend>
          <div className="pack-options">
            {packs.map((v) => (
              <button
                type="button"
                key={v.id}
                aria-pressed={variantId === v.id}
                onClick={() => {
                  setVariantId(v.id);
                  setQuantity(1);
                }}
              >
                {packLabel(v.weight)}
                {!v.stock || !v.price ? <small>Unavailable</small> : null}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {!purchasable ? (
        <p className="availability" role="status">
          {availability(p)} — choose another pack size.
        </p>
      ) : (
        <>
          <div className="price">
            {money(p.price!)} <small> / {packLabel(p.weight!)}</small>
            {p.mrp != null && p.mrp > p.price! && (
              <div className="card-pricing">
                <del aria-label={`MRP ${money(p.mrp)}`}>{money(p.mrp)}</del>
                {discountPercent(p.price, p.mrp) > 0 && (
                  <span className="discount-badge">
                    {discountPercent(p.price, p.mrp)}% OFF
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="buy-row">
            <QuantityControl
              value={quantity}
              max={p.stock!}
              label={`${p.name} ${packLabel(p.weight!)}`}
              onChange={setQuantity}
            />
            <button className="button add-button" onClick={() => add()}>
              Add to Bag <ShoppingBag size={17} />
            </button>
          </div>
          <button
            className="button secondary buy-now-button"
            onClick={() => {
              add(false);
              router.push("/checkout");
            }}
          >
            Buy Now
          </button>
        </>
      )}
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
export function CartPage({ products }: { products: ProductWithPacks[] }) {
  const { items, setItems } = useCart();
  const changed = items.some((i) => {
    const product = products.find((p) => p.id === i.id);
    const p = product ? selectedPack(product, i.variantId) : null;
    return (
      !p ||
      p.price !== i.price ||
      availability(p) !== "Available" ||
      p.stock! < i.quantity
    );
  });
  return (
    <div className="narrow cart-page">
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
                className="action-icon"
                aria-label="Accept updated prices and availability"
                title="Accept updated prices and availability"
                onClick={() =>
                  setItems(
                    items.flatMap((i) => {
                      const product = products.find((p) => p.id === i.id);
                      const p = product
                        ? selectedPack(product, i.variantId)
                        : null;
                      return p && availability(p) === "Available"
                        ? [
                            {
                              ...i,
                              price: p.price!,
                              weight: p.weight!,
                              quantity: Math.min(i.quantity, p.stock!),
                            },
                          ]
                        : [];
                    }),
                  )
                }
              >
                <RefreshCw size={18} />
              </button>
            </div>
          )}
          {items.map((i) => {
            const product = products.find((p) => p.id === i.id);
            const pack = product ? selectedPack(product, i.variantId) : null;
            const label = `${i.name}${i.weight ? ` ${packLabel(i.weight)}` : ""}`;
            return (
              <div className="cart-line" key={cartKey(i)}>
                <div className="cart-product-info">
                  <h3>{i.name}</h3>
                  <p>
                    {i.weight ? `${packLabel(i.weight)} · ` : ""}
                    {money(i.price)} each
                  </p>
                </div>
                <div className="cart-quantity">
                  <span className="quantity-caption">Quantity</span>
                  <QuantityControl
                    value={i.quantity}
                    max={pack?.stock ?? 0}
                    label={label}
                    disabled={!pack || availability(pack) !== "Available"}
                    onChange={(quantity) =>
                      setItems(
                        items.map((x) =>
                          cartKey(x) === cartKey(i) ? { ...x, quantity } : x,
                        ),
                      )
                    }
                  />
                </div>
                <strong className="cart-line-total">
                  {money(i.price * i.quantity)}
                </strong>
                <button
                  type="button"
                  className="action-icon danger"
                  title={`Remove ${label}`}
                  aria-label={`Remove ${label}`}
                  onClick={() =>
                    setItems(items.filter((x) => cartKey(x) !== cartKey(i)))
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
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
