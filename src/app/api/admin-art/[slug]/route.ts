import { requireAdmin } from "@/lib/admin";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireAdmin();
    const { slug } = await params;
    if (!/^[a-z0-9-]+$/.test(slug)) throw Error();
    await db.product.findUniqueOrThrow({ where: { slug } });
    const b = await readFile(
      join(process.cwd(), "assets/review", slug + "-960.webp"),
    );
    return new Response(b, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Not available", { status: 401 });
  }
}
