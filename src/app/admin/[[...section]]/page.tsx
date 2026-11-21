import { ProductsAdmin } from "@/components/products-admin";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { AdminForm, PasswordChange, OrderActions } from "@/components/admin";
import { money, availability } from "@/lib/format";
export const metadata = {
  title: "Tea Tale Admin",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Admin({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ q?: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  const { section = [] } = await params;
  const tab = section[0] || "dashboard";
  if (
    ![
      "dashboard",
      "products",
      "orders",
      "content",
      "shipping",
      "payments",
      "settings",
    ].includes(tab)
  )
    notFound();
  const settings = await db.settings.findUniqueOrThrow({
    where: { id: "store" },
  });
  const products = await db.product.findMany({ orderBy: { position: "asc" } });
  const { q = "" } = await searchParams;
  const orders = await db.order.findMany({
    where: q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const contents = await db.content.findMany();
  const setup = products.filter(
    (p) =>
      p.status === "AVAILABLE" && (!p.price || p.stock === null || !p.weight),
  );
  return (
    <div className="admin-page">
      <p className="eyebrow">TEA TALE · STORE OPERATIONS</p>
      <h1>
        {tab === "content"
          ? "Website Content"
          : tab[0].toUpperCase() + tab.slice(1)}
      </h1>
      {tab === "dashboard" && (
        <>
          <div className="stats">
            <div>
              New orders
              <strong>
                {await db.order.count({ where: { fulfilment: "NEW" } })}
              </strong>
            </div>
            <div>
              Pending shipments
              <strong>
                {await db.order.count({
                  where: {
                    fulfilment: "NEW",
                    payment: { in: ["PAID", "COD_DUE"] },
                  },
                })}
              </strong>
            </div>
            <div>
              Paid sales
              <strong>
                {money(
                  (
                    await db.order.aggregate({
                      _sum: { total: true },
                      where: { payment: "PAID" },
                    })
                  )._sum.total || 0,
                )}
              </strong>
            </div>
            <div>
              Low stock
              <strong>
                {
                  products.filter(
                    (p) => p.stock !== null && p.stock < 5 && !p.archived,
                  ).length
                }
              </strong>
            </div>
          </div>
          <div className="admin-card">
            <h2>Launch checklist</h2>
            <p>
              {setup.length} launch products require price / inventory setup.
            </p>
            <p>
              {contents.filter((c) => !c.approved).length} content pages need
              approval.
            </p>
            <p>
              Serviceable PINs: {settings.pins || "Not configured"} · COD:{" "}
              {settings.cod ? "Enabled" : "Disabled"} · Prepaid:{" "}
              {settings.prepaid ? "Enabled" : "Disabled"}
            </p>
            <p>
              Review catalogue geographic names, actual suppliers, organic
              certification, label claims, ingredients, allergens and FSSAI. The
              preserved original artwork is not approved for publication.
            </p>
            <p>
              Email: {process.env.SMTP_URL ? "Configured" : "Not configured"} ·
              Razorpay:{" "}
              {process.env.RAZORPAY_KEY_ID ? "Configured" : "Not configured"}
            </p>
          </div>
          <h2>Low-stock teas</h2>
          {products
            .filter((p) => p.stock !== null && p.stock < 5 && !p.archived)
            .map((p) => (
              <p key={p.id}>
                {p.name}: {p.stock} packs
              </p>
            ))}
        </>
      )}
      {tab === "products" && <ProductsAdmin products={products} />}
      {tab === "orders" && (
        <>
          <form className="inline-form">
            <label>
              Search number, email or name
              <input name="q" defaultValue={q} />
            </label>
            <button className="button">Search</button>
          </form>
          {orders.map((o) => (
            <details className="admin-card" key={o.id}>
              <summary>
                {o.number} · {money(o.total)} · {o.payment} / {o.fulfilment}
              </summary>
              <p>
                {o.name} · {o.email} · {o.phone}
              </p>
              <pre>{JSON.stringify(o.address, null, 2)}</pre>
              {o.items.map((i) => (
                <p key={i.id}>
                  {i.name} · {i.weight} g × {i.quantity} ·{" "}
                  {money(i.price * i.quantity)}
                </p>
              ))}
              <p>
                Courier: {o.courier || "Not assigned"} · Tracking:{" "}
                {o.tracking || "—"}
              </p>
              <p>Refund: {o.refundId || "None"}</p>
              <OrderActions id={o.id} />
            </details>
          ))}
          {!orders.length && <p>No orders found.</p>}
        </>
      )}
      {tab === "content" && (
        <>
          {contents.map((c) => (
            <details className="admin-card" key={c.key}>
              <summary>
                {c.key} ·{" "}
                {c.approved ? "Approved" : "Draft — awaiting approval"}
              </summary>
              <AdminForm
                section="content"
                record={c}
                fields={[
                  { key: "title", label: "Heading" },
                  {
                    key: "image",
                    label: "Optional banner image path under /teas/",
                  },
                  {
                    key: "body",
                    label: "Copy (blank lines separate paragraphs)",
                    type: "textarea",
                  },
                  {
                    key: "approved",
                    label: "Approved for public display",
                    type: "boolean",
                  },
                ]}
              />
            </details>
          ))}
        </>
      )}
      {tab === "shipping" && (
        <AdminForm
          section="shipping"
          record={settings}
          fields={[
            {
              key: "pins",
              label: "Serviceable PIN codes, separated by commas",
              type: "textarea",
            },
            { key: "fee", label: "Delivery fee in paise", type: "number" },
            {
              key: "freeAbove",
              label: "Free delivery threshold in paise (blank = disabled)",
              type: "number",
            },
            { key: "estimate", label: "Owner-approved delivery estimate" },
          ]}
        />
      )}
      {tab === "payments" && (
        <>
          <AdminForm
            section="payments"
            record={settings}
            fields={[
              {
                key: "cod",
                label: "Enable cash on delivery",
                type: "boolean",
              },
              {
                key: "prepaid",
                label: "Enable configured Razorpay prepaid",
                type: "boolean",
              },
            ]}
          />
          <p>
            Provider keys and email credentials are configured only in the
            server environment.
          </p>
          <div className="admin-list">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Provider payment</th>
                  <th>Refund</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.number}</td>
                    <td>{money(o.total)}</td>
                    <td>{o.payment}</td>
                    <td>{o.providerPayment || "—"}</td>
                    <td>{o.refundId || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "settings" && (
        <>
          <AdminForm
            section="settings"
            record={settings}
            fields={[
              { key: "name", label: "Store name" },
              { key: "email", label: "Public contact email", type: "email" },
              { key: "instagram", label: "Instagram handle" },
              {
                key: "featured",
                label: "Featured tea slugs, separated by commas",
              },
            ]}
          />
          <p>
            Order sender:{" "}
            {process.env.MAIL_FROM ||
              "Configure MAIL_FROM and SMTP_URL on the server."}
          </p>
          <PasswordChange />
          <h2>Recent audit log</h2>
          {(
            await db.audit.findMany({
              orderBy: { createdAt: "desc" },
              take: 30,
            })
          ).map((a) => (
            <p key={a.id}>
              <small>
                {a.createdAt.toISOString()} · {a.action} · {a.target}
              </small>
            </p>
          ))}
        </>
      )}
    </div>
  );
}
