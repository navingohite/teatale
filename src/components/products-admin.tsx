"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  activePacks,
  packLabel,
  type ProductWithPacks as Product,
} from "@/lib/packs";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Upload,
  RotateCcw,
  Package,
  Save,
  LoaderCircle,
} from "lucide-react";
import { useConfirmation } from "./confirm-action";
import { PhotoUpload } from "./admin";
import { money } from "@/lib/format";
const statuses = {
  DRAFT: "Draft",
  COMING_SOON: "Coming Soon",
  AVAILABLE: "Available",
  OUT_OF_STOCK: "Out of Stock",
};
async function request(body: unknown) {
  const r = await fetch("/api/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Could not save product.");
  return data;
}
export function ProductsAdmin({ products }: { products: Product[] }) {
  const [editor, setEditor] = useState<Product | "new" | null>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const confirm = useConfirmation();
  const router = useRouter();
  async function action(p: Product, action: string) {
    const labels: Record<string, string> = {
      publish: "publish",
      unpublish: "unpublish",
      delete: "delete",
      restore: "restore",
    };
    const messages: Record<string, string> = {
      publish: `“${p.name}” will appear on the website. Available products with a price and stock can be purchased.`,
      unpublish: `“${p.name}” will be hidden from the website and cannot be purchased.`,
      delete: `“${p.name}” will be removed from the website. Previous orders are kept. You can restore it from Deleted products.`,
      restore: `Restore “${p.name}” as unpublished? Review it and publish when ready.`,
    };
    if (
      !(await confirm({
        title: `Are you sure you want to ${labels[action]}?`,
        message: messages[action],
        label: `Yes, ${labels[action]}`,
        danger: action === "delete",
      }))
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await request({ id: p.id, action });
      setMessage(
        `Product ${action === "delete" ? "moved to Deleted products" : action === "publish" ? "published" : action === "unpublish" ? "unpublished" : "restored"}.`,
      );
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (editor)
    return (
      <ProductEditor
        key={editor === "new" ? "new" : editor.id}
        product={editor === "new" ? null : editor}
        nextPosition={Math.max(0, ...products.map((p) => p.position)) + 1}
        onClose={() => setEditor(null)}
        onSaved={(published) => {
          setEditor(null);
          setMessage(
            published
              ? "Product saved and published."
              : "Product saved as unpublished.",
          );
          router.refresh();
        }}
      />
    );
  const visible = products.filter(
    (p) =>
      (filter === "deleted" ? p.archived : !p.archived) &&
      (filter === "published"
        ? p.published
        : filter === "unpublished"
          ? !p.published
          : true) &&
      `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="product-admin-toolbar">
        <p>
          Manage your catalogue. Only published products appear on the website.
        </p>
        <button
          className="button"
          onClick={() => {
            setMessage("");
            setEditor("new");
          }}
        >
          <Plus size={17} />
          Add product
        </button>
      </div>
      <div className="product-admin-filters">
        <label className="product-search">
          <Search size={18} />
          <input
            aria-label="Search products"
            placeholder="Search by product name or SKU"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="product-filter">
          Show
          <select
            aria-label="Filter products"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All products</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
            <option value="deleted">Deleted products</option>
          </select>
        </label>
      </div>
      {message && (
        <p className="product-feedback" role="status">
          {message}
        </p>
      )}
      <div className="admin-list products-table">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Status</th>
              <th>Price / stock</th>
              <th>Website</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="product-cell">
                    <img src={p.image} alt="" />
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {p.sku} · {p.type}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className={`product-status status-${p.status.toLowerCase()}`}
                  >
                    {statuses[p.status as keyof typeof statuses] || p.status}
                  </span>
                  {p.status === "AVAILABLE" &&
                    (!p.price || p.stock === null || !p.weight) && (
                      <small className="setup-note">Setup required</small>
                    )}
                </td>
                <td>
                  <strong>
                    {activePacks(p).length > 1 ? "From " : ""}
                    {p.price ? money(p.price) : "Not set"}
                  </strong>
                  {activePacks(p).length > 0 && (
                    <small>
                      {activePacks(p)
                        .map(
                          (v) =>
                            `${packLabel(v.weight)}: ${v.stock ?? "—"} in stock`,
                        )
                        .join(" · ")}
                    </small>
                  )}
                  {p.mrp != null && <small>MRP {money(p.mrp)}</small>}
                  <small className="stock-note">
                    {p.stock === null ? "Stock not set" : `${p.stock} packs`}
                  </small>
                </td>
                <td>
                  <span
                    className={`publication-status ${p.published && !p.archived ? "is-live" : ""}`}
                  >
                    {p.archived
                      ? "Deleted"
                      : p.published
                        ? "Published"
                        : "Unpublished"}
                  </span>
                </td>
                <td>
                  <div className="product-row-actions">
                    {p.archived ? (
                      <button
                        disabled={busy}
                        onClick={() => action(p, "restore")}
                      >
                        <RotateCcw size={15} />
                        Restore
                      </button>
                    ) : (
                      <>
                        <button
                          className="action-icon"
                          aria-label={`Edit ${p.name}`}
                          title={`Edit ${p.name}`}
                          disabled={busy}
                          onClick={() => {
                            setMessage("");
                            setEditor(p);
                          }}
                        >
                          <Pencil size={18} />
                        </button>
                        <Link href={"/admin-preview/" + p.slug}>
                          <Eye size={15} />
                          Preview
                        </Link>
                        <button
                          disabled={busy}
                          onClick={() =>
                            action(p, p.published ? "unpublish" : "publish")
                          }
                        >
                          <Upload size={15} />
                          {p.published ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          className="action-icon danger"
                          aria-label={`Delete ${p.name}`}
                          title={`Delete ${p.name}`}
                          disabled={busy}
                          onClick={() => action(p, "delete")}
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <div className="products-empty">
            <Package size={30} />
            <h2>No products found</h2>
            <p>
              {filter === "deleted"
                ? "Deleted products will appear here."
                : "Add a product or change your search."}
            </p>
          </div>
        )}
      </div>
      <p className="product-count">{visible.length} products</p>
    </>
  );
}
function ProductEditor({
  product,
  nextPosition,
  onClose,
  onSaved,
}: {
  product: Product | null;
  nextPosition: number;
  onClose: () => void;
  onSaved: (published: boolean) => void;
}) {
  const [image, setImage] = useState(
      product?.image || "/teas/product-placeholder.webp",
    ),
    [name, setName] = useState(product?.name || ""),
    [slug, setSlug] = useState(product?.slug || ""),
    [slugEdited, setSlugEdited] = useState(!!product),
    [status, setStatus] = useState(product?.status || "COMING_SOON"),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [packs, setPacks] = useState(() => {
    const initial = product ? activePacks(product) : [];
    const rows = initial.length
      ? initial
      : product?.weight
        ? [
            {
              id: undefined,
              weight: product.weight,
              price: product.price,
              mrp: product.mrp,
              stock: product.stock,
            },
          ]
        : [];
    return rows.map((v, index) => ({
      key: v.id || `initial-${index}`,
      id: v.id,
      weight: String(v.weight),
      price: v.price == null ? "" : String(v.price / 100),
      mrp: v.mrp == null ? "" : String(v.mrp / 100),
      stock: v.stock == null ? "" : String(v.stock),
    }));
  });
  function updatePack(
    key: string,
    field: "weight" | "price" | "mrp" | "stock",
    value: string,
  ) {
    setDirty(true);
    setPacks((rows) =>
      rows.map((v) => (v.key === key ? { ...v, [field]: value } : v)),
    );
  }
  const confirm = useConfirmation();
  async function close() {
    if (
      dirty &&
      !(await confirm({
        title: "Discard unsaved changes?",
        message: "Your changes have not been saved. Leave this form?",
        label: "Yes, discard",
        danger: true,
      }))
    )
      return;
    onClose();
  }
  async function save(form: HTMLFormElement, mode: string) {
    const f = new FormData(form);
    const nullable = (key: string) =>
      f.get(key) === "" ? null : Number(f.get(key));
    const variants = packs.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      weight: Number(v.weight),
      price: v.price === "" ? null : Math.round(Number(v.price) * 100),
      mrp: v.mrp === "" ? null : Math.round(Number(v.mrp) * 100),
      stock: v.stock === "" ? null : Number(v.stock),
    }));
    const price = variants[0]?.price ?? null;
    const published =
      mode === "publish"
        ? true
        : mode === "draft"
          ? false
          : product?.published || false;
    const data = {
      ...(product ? { id: product.id } : {}),
      name,
      slug,
      sku: String(f.get("sku")),
      position: Number(f.get("position")),
      type: String(f.get("type")),
      status,
      published,
      archived: false,
      price,
      mrp: variants[0]?.mrp ?? null,
      stock: variants[0]?.stock ?? null,
      weight: variants[0]?.weight ?? null,
      variants,
      bestBefore: nullable("bestBefore"),
      image,
      ...Object.fromEntries(
        [
          "summary",
          "taste",
          "origin",
          "ingredients",
          "caffeine",
          "brewing",
          "storage",
          "claims",
        ].map((key) => [key, String(f.get(key) || "")]),
      ),
    };
    setError("");
    if (
      variants.some((v) => v.mrp != null && v.price != null && v.mrp < v.price)
    ) {
      setError("MRP must be greater than or equal to the selling price.");
      return;
    }
    if (
      published &&
      (status === "DRAFT" ||
        (status === "AVAILABLE" &&
          (!variants.length ||
            variants.some((v) => !v.price || v.stock === null || !v.weight))))
    ) {
      setError(
        status === "DRAFT"
          ? "Choose Coming Soon, Available or Out of Stock before publishing."
          : "To publish an Available product, add at least one pack size with a selling price and stock.",
      );
      return;
    }
    if (
      !(await confirm({
        title: published
          ? "Are you sure you want to publish these changes?"
          : "Are you sure you want to save as unpublished?",
        message: published
          ? `“${name}” will appear on the website as ${statuses[status as keyof typeof statuses]}.`
          : `“${name}” will be saved but hidden from the website.`,
        label: published ? "Yes, publish" : "Yes, save",
      }))
    )
      return;
    setBusy(true);
    try {
      await request(data);
      onSaved(published);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="product-editor">
      <div className="product-editor-heading">
        <div>
          <p className="eyebrow">PRODUCT DETAILS</p>
          <h2>{product ? "Edit product" : "Add a new product"}</h2>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={close}
        >
          Back to products
        </button>
      </div>
      <form
        onChange={() => setDirty(true)}
        onSubmit={(e) => {
          e.preventDefault();
          save(
            e.currentTarget,
            (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ||
              "save",
          );
        }}
      >
        <div className="product-editor-grid">
          <section className="admin-card">
            <h3>Basic information</h3>
            <p>Give your tea a name, image and a short introduction.</p>
            <label>
              Product name
              <input
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugEdited)
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, ""),
                    );
                }}
              />
            </label>
            <div className="editor-two">
              <label>
                URL slug
                <input
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setSlug(e.target.value);
                  }}
                />
              </label>
              <label>
                SKU
                <input
                  required
                  name="sku"
                  defaultValue={product?.sku || ""}
                  placeholder="e.g. TT-017"
                />
              </label>
            </div>
            <div className="editor-two">
              <label>
                Tea type
                <select name="type" defaultValue={product?.type || "Green Tea"}>
                  {["Green Tea", "Black Tea", "Herbal Infusions"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Display order
                <input
                  type="number"
                  name="position"
                  min={1}
                  step={1}
                  required
                  defaultValue={product?.position || nextPosition}
                />
              </label>
            </div>
            <label>
              Short description
              <textarea name="summary" defaultValue={product?.summary || ""} />
            </label>
            <label>
              Image path
              <input value={image} onChange={(e) => setImage(e.target.value)} />
            </label>
            <PhotoUpload
              onUploaded={(path) => {
                setImage(path);
                setDirty(true);
              }}
            />
            <img
              className="editor-photo"
              src={image}
              alt="Product image preview"
            />
          </section>
          <section className="admin-card">
            <h3>Status & pricing</h3>
            <label>
              Product status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {Object.entries(statuses).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <p className="editor-hint">
              Coming Soon is browsable but cannot be purchased. Available
              enables buying after price, pack weight and stock are set.
            </p>
            <div className="pack-editor-heading">
              <h3>Pack sizes</h3>
              <button
                type="button"
                className="button secondary"
                disabled={busy || packs.length >= 20}
                onClick={() => {
                  setPacks((rows) => [
                    ...rows,
                    {
                      key: crypto.randomUUID(),
                      id: undefined,
                      weight: "",
                      price: "",
                      mrp: "",
                      stock: "",
                    },
                  ]);
                  setDirty(true);
                }}
              >
                Add pack size
              </button>
            </div>
            <p className="editor-hint">
              Enter weight in grams: 500 = 500g, 1000 = 1kg, 2000 = 2kg. Each
              size has its own price and stock. Leave MRP blank if no discount
              applies.
            </p>
            {!packs.length && (
              <p className="notice">
                No pack sizes yet. Add a size before making this tea available.
              </p>
            )}
            {packs.map((v, index) => (
              <fieldset className="pack-editor-row" key={v.key}>
                <legend>
                  Pack {index + 1}
                  {v.weight ? ` · ${packLabel(Number(v.weight))}` : ""}
                </legend>
                <div className="editor-two">
                  <label>
                    Weight (g)
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      step="1"
                      required
                      readOnly={!!v.id}
                      value={v.weight}
                      onChange={(e) =>
                        updatePack(v.key, "weight", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Stock (packs)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={v.stock}
                      onChange={(e) =>
                        updatePack(v.key, "stock", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Selling Price (₹ INR)
                    <input
                      type="number"
                      min="0.01"
                      max="1000000"
                      step="0.01"
                      value={v.price}
                      onChange={(e) =>
                        updatePack(v.key, "price", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    MRP (₹ INR, optional)
                    <input
                      type="number"
                      min="0.01"
                      max="1000000"
                      step="0.01"
                      value={v.mrp}
                      onChange={(e) => updatePack(v.key, "mrp", e.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="action-icon danger"
                  aria-label={`Remove pack size ${v.weight ? packLabel(Number(v.weight)) : index + 1}`}
                  title="Remove pack size"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Remove this pack size?",
                        message:
                          "It will no longer be offered after saving. Previous orders will keep their selected size.",
                        label: "Yes, remove",
                        danger: true,
                      })
                    ) {
                      setPacks((rows) =>
                        rows.filter((row) => row.key !== v.key),
                      );
                      setDirty(true);
                    }
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </fieldset>
            ))}
            <label>
              Best before (months from packing)
              <input
                type="number"
                name="bestBefore"
                min={1}
                step={1}
                defaultValue={product?.bestBefore ?? ""}
              />
            </label>
            <div className="publication-help">
              <strong>
                {product?.published
                  ? "Currently published"
                  : "Not yet published"}
              </strong>
              <p>
                Save as unpublished to keep this product private. Publish makes
                it visible on the website.
              </p>
            </div>
          </section>
        </div>
        <section className="admin-card">
          <h3>Tea details</h3>
          <div className="editor-two">
            {[
              ["taste", "Taste & aroma"],
              ["origin", "Confirmed sourcing"],
              ["ingredients", "Ingredients"],
              ["caffeine", "Caffeine"],
              ["brewing", "Brewing instructions"],
              ["storage", "Storage instructions"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea
                  name={key}
                  defaultValue={String(product?.[key as keyof Product] || "")}
                />
              </label>
            ))}
          </div>
          <label>
            Internal claims review (not public)
            <textarea name="claims" defaultValue={product?.claims || ""} />
          </label>
        </section>
        <div className="product-editor-bottom">
          <p className="error" role="alert">
            {error}
          </p>
          <div className="product-editor-buttons">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </button>
            <button
              type="submit"
              name="intent"
              value="draft"
              className="action-icon"
              aria-label="Save as unpublished"
              title="Save as unpublished"
              disabled={busy}
            >
              <Save size={18} />
            </button>
            <button
              type="submit"
              name="intent"
              value="publish"
              className="action-icon primary"
              aria-label={
                busy
                  ? "Saving changes"
                  : product?.published
                    ? "Save and publish changes"
                    : "Publish product"
              }
              title={
                product?.published
                  ? "Save and publish changes"
                  : "Publish product"
              }
              disabled={busy}
            >
              {busy ? <LoaderCircle size={18} /> : <Upload size={18} />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
