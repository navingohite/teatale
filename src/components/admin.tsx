"use client";
import { Save, KeyRound, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useConfirmation } from "./confirm-action";
import { createAuthClient } from "better-auth/react";
const client = createAuthClient();
export function Login() {
  const [error, setError] = useState("");
  return (
    <div className="admin-login-card">
      <p className="eyebrow">TEA TALE · TEAM ACCESS</p>
      <h1>Welcome back.</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const f = new FormData(e.currentTarget);
          const r = await client.signIn.email({
            email: String(f.get("email")),
            password: String(f.get("password")),
          });
          if (r.error) setError(r.error.message || "Unable to sign in");
          else window.location.href = "/admin";
        }}
      >
        <label>
          Email
          <input type="email" name="email" required autoComplete="username" />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </label>
        <button className="button">Sign in</button>
        <p className="error" role="alert">
          {error}
        </p>
      </form>
    </div>
  );
}
export function Logout() {
  const confirm = useConfirmation();
  return (
    <button
      className="text-link"
      onClick={async () => {
        if (
          !(await confirm({
            title: "Are you sure you want to sign out?",
            message: "You can sign in again to continue managing your store.",
            label: "Yes, sign out",
          }))
        )
          return;
        await client.signOut();
        window.location.href = "/admin/login";
      }}
    >
      Sign out
    </button>
  );
}
export function PasswordChange() {
  const confirm = useConfirmation();
  const [msg, setMsg] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (
          !(await confirm({
            title: "Are you sure you want to change your password?",
            message: "Your other signed-in sessions will be revoked.",
            label: "Yes, update password",
          }))
        )
          return;
        const r = await client.changePassword({
          currentPassword: String(f.get("current")),
          newPassword: String(f.get("new")),
          revokeOtherSessions: true,
        });
        setMsg(r.error?.message || "Password updated. Other sessions revoked.");
      }}
    >
      <h2>Change admin password</h2>
      <label>
        Current password
        <input
          name="current"
          type="password"
          required
          autoComplete="current-password"
        />
      </label>
      <label>
        New password
        <input
          name="new"
          type="password"
          minLength={12}
          required
          autoComplete="new-password"
        />
      </label>
      <button
        className="action-icon primary"
        aria-label="Update password"
        title="Update password"
      >
        <KeyRound size={18} />
      </button>
      <p role="status">{msg}</p>
    </form>
  );
}
export function AdminForm({
  section,
  record,
  fields,
}: {
  section: string;
  record: Record<string, unknown>;
  fields: { key: string; label: string; type?: string; options?: string[] }[];
}) {
  const confirm = useConfirmation();
  const [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false),
    [imagePath, setImagePath] = useState(String(record.image || ""));
  return (
    <form
      className="admin-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg("");
        const data: Record<string, unknown> = { ...record };
        const f = new FormData(e.currentTarget);
        for (const field of fields) {
          const v = f.get(field.key);
          data[field.key] =
            field.type === "boolean"
              ? v === "on"
              : field.type === "number"
                ? v === ""
                  ? null
                  : Number(v)
                : v;
        }
        if (
          !(await confirm({
            title: "Are you sure?",
            message:
              section === "orders"
                ? `Apply ${data.action} to this order?`
                : "Save these changes to your store?",
            label: "Yes, save changes",
            danger:
              section === "orders" &&
              ["cancel", "refund"].includes(String(data.action)),
          }))
        )
          return;
        setBusy(true);
        try {
          const r = await fetch("/api/admin/" + section, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          setMsg("Saved successfully.");
          window.location.reload();
        } catch (e) {
          setMsg((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.map((f) => (
        <label className={f.type === "textarea" ? "wide" : ""} key={f.key}>
          {f.label}
          {f.key === "image" ? (
            <>
              <input
                name="image"
                value={imagePath}
                onChange={(e) => setImagePath(e.target.value)}
              />
              <PhotoUpload onUploaded={setImagePath} />
            </>
          ) : f.options ? (
            <select
              name={f.key}
              defaultValue={String(record[f.key] || f.options[0])}
            >
              {f.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea name={f.key} defaultValue={String(record[f.key] || "")} />
          ) : f.type === "boolean" ? (
            <input
              type="checkbox"
              name={f.key}
              defaultChecked={Boolean(record[f.key])}
            />
          ) : (
            <input
              type={f.type || "text"}
              name={f.key}
              defaultValue={String(record[f.key] ?? "")}
              step={f.type === "number" ? 1 : undefined}
            />
          )}
        </label>
      ))}
      <button
        className="action-icon primary"
        disabled={busy}
        aria-label={busy ? "Saving changes" : "Save changes"}
        title="Save changes"
      >
        {busy ? <LoaderCircle size={18} /> : <Save size={18} />}
      </button>
      <p role="status" className="wide error">
        {msg}
      </p>
    </form>
  );
}
export function OrderActions({ id }: { id: string }) {
  return (
    <AdminForm
      section="orders"
      record={{ id }}
      fields={[
        {
          key: "action",
          label: "Action",
          options: ["ship", "deliver", "cancel", "refund", "cod-paid"],
        },
        { key: "courier", label: "Courier" },
        { key: "tracking", label: "Tracking number" },
        { key: "trackingUrl", label: "Tracking URL (HTTPS)" },
      ]}
    />
  );
}

export function PhotoUpload({
  onUploaded,
}: {
  onUploaded: (path: string) => void;
}) {
  const confirm = useConfirmation();
  const [message, setMessage] = useState("");
  return (
    <span>
      <input
        aria-label="Upload approved photo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (
            !(await confirm({
              title: "Are you sure you want to upload this image?",
              message: `Upload ${file.name}? Save the product to use it on the website.`,
              label: "Yes, upload",
            }))
          )
            return;
          setMessage("Uploading…");
          try {
            const form = new FormData();
            form.set("file", file);
            const r = await fetch("/api/admin-upload", {
              method: "POST",
              body: form,
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            onUploaded(d.path);
            setMessage("Photo ready. Save changes to publish it.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      />
      <small role="status">{message}</small>
    </span>
  );
}
