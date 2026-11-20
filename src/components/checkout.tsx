"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, useCart } from "./store";
import { money } from "@/lib/format";
type Quote = {
  subtotal: number;
  shipping: number;
  total: number;
  methods: string[];
  estimate: string;
};
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}
async function pay(token: string, method: string) {
  if (method === "TEST") {
    await api("test-payment", { token });
    return;
  }
  const data = await api("payment", { token });
  if (!window.Razorpay)
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve();
      s.onerror = () =>
        reject(Error("Unable to load payment form. Retry payment."));
      document.head.appendChild(s);
    });
  await new Promise<void>((resolve, reject) => {
    new window.Razorpay({
      key: data.key,
      order_id: data.providerOrder,
      amount: data.total,
      currency: "INR",
      name: "Tea Tale",
      handler: async (r: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        try {
          await api("verify-payment", {
            token,
            paymentId: r.razorpay_payment_id,
            orderId: r.razorpay_order_id,
            signature: r.razorpay_signature,
          });
          resolve();
        } catch (e) {
          reject(e);
        }
      },
      modal: {
        ondismiss: () =>
          reject(
            Error(
              "Payment cancelled. Your bag is saved. Retry when you are ready.",
            ),
          ),
      },
      theme: { color: "#24382C" },
    }).open();
  });
}
export function Checkout() {
  const { items } = useCart();
  const [q, setQ] = useState<Quote | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [method, setMethod] = useState(""),
    [token, setToken] = useState("");
  const [key, setKey] = useState("");
  useEffect(() => {
    const saved = sessionStorage.getItem("checkout-key") || crypto.randomUUID();
    sessionStorage.setItem("checkout-key", saved);
    setKey(saved);
    setToken(sessionStorage.getItem("pending-order") || "");
  }, []);
  async function submit(form: HTMLFormElement) {
    setError("");
    setBusy(true);
    try {
      const address = Object.fromEntries(new FormData(form).entries());
      delete address["payment-choice"];
      const data = await api("checkout", {
        items,
        address,
        method,
        key,
        expectedTotal: q?.total,
      });
      if (!data.token)
        throw Error(
          "An order already exists. Use Track Order to retrieve its secure link.",
        );
      sessionStorage.setItem("pending-order", data.token);
      setToken(data.token);
      if (method !== "COD") await pay(data.token, method);
      window.location.href = "/order-confirmation?token=" + data.token;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="checkout-wrap">
      <div>
        <p className="eyebrow">JUST YOU AND YOUR NEXT CUP</p>
        <h1>Guest checkout</h1>
        <p>No account needed. Your order link will be sent to your email.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
          onChange={(e) => {
            if (
              (e.target as unknown as HTMLInputElement).name !==
              "payment-choice"
            )
              setQ(null);
          }}
        >
          <h2>Contact & delivery</h2>
          {[
            ["name", "Full name", "text"],
            ["email", "Email address", "email"],
            ["phone", "Mobile number", "tel"],
            ["line1", "Address line 1", "text"],
            ["line2", "Address line 2 (optional)", "text"],
            ["city", "City", "text"],
            ["state", "State", "text"],
            ["pin", "PIN code", "text"],
          ].map(([name, label, type]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                type={type}
                required={name !== "line2"}
                autoComplete={
                  (
                    {
                      name: "name",
                      email: "email",
                      phone: "tel",
                      line1: "address-line1",
                      line2: "address-line2",
                      city: "address-level2",
                      state: "address-level1",
                      pin: "postal-code",
                    } as Record<string, string>
                  )[name]
                }
                pattern={
                  name === "phone"
                    ? "[6-9][0-9]{9}"
                    : name === "pin"
                      ? "[1-9][0-9]{5}"
                      : undefined
                }
              />
            </label>
          ))}
          <button
            className="button secondary"
            type="button"
            disabled={busy || !items.length}
            onClick={async (e) => {
              const form = e.currentTarget.form!;
              if (!form.reportValidity()) return;
              setBusy(true);
              setError("");
              try {
                const result = await api("quote", {
                  items,
                  pin: new FormData(form).get("pin"),
                });
                setQ(result);
                setMethod(result.methods[0] || "");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Check delivery & total
          </button>
          {q && (
            <div className="payment">
              <h2>Payment</h2>
              {q.methods.length === 0 ? (
                <p>Checkout is not available yet. Please contact the store.</p>
              ) : (
                q.methods.map((m) => (
                  <label className="radio" key={m}>
                    <input
                      type="radio"
                      name="payment-choice"
                      value={m}
                      checked={method === m}
                      onChange={(e) => {
                        e.stopPropagation();
                        setMethod(m);
                      }}
                    />
                    {m === "COD"
                      ? "Cash on delivery"
                      : m === "TEST"
                        ? "LOCAL TEST — no real payment"
                        : "Pay securely with Razorpay"}
                  </label>
                ))
              )}
              <p>{q.estimate}</p>
              <div className="total">
                Total <strong>{money(q.total)}</strong>
              </div>
              <button className="button" disabled={!method || busy}>
                {busy ? "Processing…" : `Confirm order · ${money(q.total)}`}
              </button>
            </div>
          )}
          <p role="alert" className="error">
            {error}
          </p>
        </form>
        {token && (
          <>
            <button
              className="button secondary"
              onClick={async () => {
                setError("");
                try {
                  const o = await api("order", { token });
                  if (!["PAID", "COD_DUE"].includes(o.payment))
                    await pay(token, o.method);
                  window.location.href = "/order-confirmation?token=" + token;
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Retry Payment
            </button>
            <button
              className="text-link"
              onClick={async () => {
                const o = await api("order", { token });
                if (!["EXPIRED", "CANCELLED"].includes(o.payment)) {
                  setError(
                    "The current order is still active. Retry its payment or wait for the reservation to expire.",
                  );
                  return;
                }
                sessionStorage.removeItem("pending-order");
                sessionStorage.removeItem("checkout-key");
                setToken("");
                const k = crypto.randomUUID();
                sessionStorage.setItem("checkout-key", k);
                setKey(k);
                setQ(null);
              }}
            >
              Start a new attempt after the previous reservation expires
            </button>
          </>
        )}
      </div>
      <aside className="order-summary">
        <p className="eyebrow">IN YOUR BAG</p>
        {items.map((i) => (
          <p className="summary-line" key={i.id}>
            <span>
              {i.name} × {i.quantity}
            </span>
            <strong>{money(i.price * i.quantity)}</strong>
          </p>
        ))}
        {q && (
          <p className="summary-line">
            Delivery <strong>{money(q.shipping)}</strong>
          </p>
        )}
        <div className="total">
          {q ? "Total" : "Subtotal"}
          <strong>
            {money(
              q?.total || items.reduce((s, i) => s + i.quantity * i.price, 0),
            )}
          </strong>
        </div>
        <p>
          Secure guest checkout.
          <br />A little mountain stillness is on its way.
        </p>
        <Link href="/cart">Edit your bag</Link>
      </aside>
    </div>
  );
}
type Order = {
  number: string;
  items: { name: string; quantity: number; price: number; weight: number }[];
  total: number;
  shipping: number;
  payment: string;
  fulfilment: string;
  method: string;
  courier?: string;
  tracking?: string;
  trackingUrl?: string;
};
export function TrackOrder({
  confirmation = false,
}: {
  confirmation?: boolean;
}) {
  const query = useSearchParams();
  const { setItems } = useCart();
  const [token, setToken] = useState(query.get("token") || ""),
    [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!token) return;
    api("order", { token })
      .then((o) => {
        setOrder(o);
        if (confirmation && ["PAID", "COD_DUE"].includes(o.payment)) {
          setItems([]);
          sessionStorage.removeItem("checkout-key");
          sessionStorage.removeItem("pending-order");
        }
      })
      .catch((e) => setError(e.message));
  }, [token, confirmation]);
  return (
    <div className="narrow">
      <p className="eyebrow">YOUR TEA’S JOURNEY</p>
      <h1>
        {confirmation && order && ["PAID", "COD_DUE"].includes(order.payment)
          ? "A new tale is on its way."
          : "Track your order"}
      </h1>
      {order ? (
        <>
          <p>
            Order <strong>{order.number}</strong>
          </p>
          <div className="order-stages">
            {["NEW", "SHIPPED", "DELIVERED"].map((s) => (
              <span key={s} className={order.fulfilment === s ? "active" : ""}>
                {s === "NEW"
                  ? "Order received"
                  : s === "SHIPPED"
                    ? "On its way"
                    : "Delivered"}
              </span>
            ))}
          </div>
          <p>
            Payment: <strong>{order.payment.replaceAll("_", " ")}</strong> ·
            Fulfilment: {order.fulfilment}
          </p>
          {order.items.map((i, n) => (
            <div className="cart-line" key={n}>
              <span>
                {i.name} · {i.weight} g × {i.quantity}
              </span>
              <strong>{money(i.price * i.quantity)}</strong>
            </div>
          ))}
          <p className="summary-line">
            Delivery <span>{money(order.shipping)}</span>
          </p>
          <div className="total">
            Total <strong>{money(order.total)}</strong>
          </div>
          {order.courier && (
            <p>
              {order.courier} · {order.tracking}{" "}
              {order.trackingUrl && (
                <a href={order.trackingUrl} rel="noreferrer" target="_blank">
                  Track with courier
                </a>
              )}
            </p>
          )}
          {order.payment === "PENDING" && (
            <button
              className="button"
              onClick={async () => {
                try {
                  await pay(token, order.method);
                  setOrder(await api("order", { token }));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Retry Payment
            </button>
          )}
          <p>Keep this link private. It provides access to your order.</p>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const b = Object.fromEntries(new FormData(e.currentTarget));
            try {
              if (!sent) {
                const d = await api("otp-request", b);
                setMessage(d.message);
                setSent(true);
              } else {
                const d = await api("otp-verify", b);
                setToken(d.token);
                window.history.replaceState(
                  null,
                  "",
                  "/track-order?token=" + d.token,
                );
              }
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <p>
            Enter your order number and checkout email. We’ll send a one-time
            code to verify it’s you.
          </p>
          <label>
            Order number
            <input name="number" required placeholder="TT-…" />
          </label>
          <label>
            Checkout email
            <input name="email" type="email" required />
          </label>
          {sent && (
            <label>
              Verification code
              <input
                name="code"
                required
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
              />
            </label>
          )}
          <button className="button">
            {sent ? "Verify & view order" : "Send verification code"}
          </button>
          <p role="status">{message}</p>
        </form>
      )}
      <p className="error" role="alert">
        {error}
      </p>
    </div>
  );
}
