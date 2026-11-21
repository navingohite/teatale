"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  FileText,
  Truck,
  CreditCard,
  Settings,
  ExternalLink,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { ConfirmationProvider } from "./confirm-action";
import { Logout } from "./admin";
const sections = [
  {
    id: "dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    group: "Workspace",
  },
  { id: "products", label: "Products", icon: Package, group: "Workspace" },
  { id: "orders", label: "Orders", icon: ShoppingBag, group: "Workspace" },
  {
    id: "content",
    label: "Website content",
    icon: FileText,
    group: "Workspace",
  },
  {
    id: "shipping",
    label: "Shipping",
    icon: Truck,
    group: "Store configuration",
  },
  {
    id: "payments",
    label: "Payments",
    icon: CreditCard,
    group: "Store configuration",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    group: "Store configuration",
  },
];
function AdminFrameContent({
  children,
  user,
  storeName,
}: {
  children: React.ReactNode;
  user: { name: string; email: string } | null;
  storeName: string;
}) {
  const pathname = usePathname();
  const login = pathname === "/admin/login";
  const current = pathname.startsWith("/admin-preview/")
    ? "Product preview"
    : sections.find((s) => pathname === "/admin/" + s.id)?.label || "Overview";
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open) nav.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className={`admin-workspace ${login ? "admin-auth-layout" : ""}`}>
      <a href="#admin-main" className="skip">
        Skip to admin content
      </a>
      {!login && (
        <>
          <button
            className={`admin-backdrop ${open ? "is-open" : ""}`}
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />
          <aside
            id="admin-sidebar"
            className={`admin-sidebar ${open ? "is-open" : ""}`}
          >
            <Link
              href="/admin"
              className="admin-brand"
              onClick={() => setOpen(false)}
            >
              <span>
                <img
                  className="admin-brand-image"
                  src="/brand/tea-tale-logo-white.png"
                  alt={storeName}
                  width={1996}
                  height={788}
                />
                <small>STORE ADMINISTRATION</small>
              </span>
            </Link>
            <div className="admin-sidebar-heading">
              <span>Navigation</span>
              <button
                aria-label="Close navigation"
                onClick={() => {
                  setOpen(false);
                  toggle.current?.focus();
                }}
              >
                <X size={20} />
              </button>
            </div>
            <nav ref={nav} aria-label="Admin navigation">
              {["Workspace", "Store configuration"].map((group) => (
                <div className="admin-nav-group" key={group}>
                  <p>{group}</p>
                  {sections
                    .filter((s) => s.group === group)
                    .map(({ id, label, icon: Icon }) => {
                      const active =
                        pathname === "/admin/" + id ||
                        (id === "dashboard" && pathname === "/admin");
                      return (
                        <Link
                          key={id}
                          href={"/admin/" + id}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpen(false)}
                        >
                          <Icon size={19} />
                          <span>{label}</span>
                          {active && <ChevronRight size={15} />}
                        </Link>
                      );
                    })}
                </div>
              ))}
            </nav>
            <div className="admin-sidebar-bottom">
              <div className="admin-team">
                <span className="admin-avatar">
                  {(user?.name || "Admin").slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{user?.name || "Store administrator"}</strong>
                  <small>Administrator</small>
                </div>
              </div>
              <Logout />
            </div>
          </aside>
        </>
      )}
      <div className="admin-workspace-body">
        <header className="admin-topbar">
          {login ? (
            <Link href="/" className="admin-brand">
              <span>
                <img
                  className="admin-brand-image"
                  src="/brand/tea-tale-logo.png"
                  alt={storeName}
                  width={1748}
                  height={677}
                />
                <small>STORE ADMINISTRATION</small>
              </span>
            </Link>
          ) : (
            <div className="admin-topbar-left">
              <button
                ref={toggle}
                className="admin-menu-toggle"
                aria-label="Open admin navigation"
                aria-expanded={open}
                aria-controls="admin-sidebar"
                onClick={() => setOpen(!open)}
              >
                <Menu size={22} />
              </button>
              <div className="admin-breadcrumb">
                <span>Store admin</span>
                <ChevronRight size={14} />
                <strong>{current}</strong>
              </div>
            </div>
          )}
          <div className="admin-topbar-actions">
            <Link href="/" target="_blank" rel="noopener noreferrer">
              View storefront <ExternalLink size={15} />
            </Link>
            {!login && (
              <span className="admin-access">
                <ShieldCheck size={16} />
                Admin access
              </span>
            )}
          </div>
        </header>
        <main
          id="admin-main"
          className={`admin-content ${login ? "admin-login-content" : ""}`}
        >
          {children}
        </main>
        <footer className="admin-footer">
          <span>
            © {new Date().getFullYear()} {storeName}
          </span>
          <span>
            Store administration <span aria-hidden="true">·</span>{" "}
            <Link href="mailto:teatale2026@gmail.com">Contact support</Link>
          </span>
        </footer>
      </div>
    </div>
  );
}

export function AdminFrame(props: Parameters<typeof AdminFrameContent>[0]) {
  return (
    <ConfirmationProvider>
      <AdminFrameContent {...props} />
    </ConfirmationProvider>
  );
}
