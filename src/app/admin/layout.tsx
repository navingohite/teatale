import { AdminFrame } from "@/components/admin-frame";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
export const metadata = { robots: { index: false, follow: false } };
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  try {
    const sessionUser = await requireAdmin();
    user = { name: sessionUser.name, email: sessionUser.email };
  } catch {}
  const settings = await db.settings.findUniqueOrThrow({
    where: { id: "store" },
  });
  return (
    <AdminFrame user={user} storeName={settings.name}>
      {children}
    </AdminFrame>
  );
}
