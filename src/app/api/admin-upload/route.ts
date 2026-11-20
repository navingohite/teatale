import { requireAdmin, audit } from "@/lib/admin";
import { sameOrigin } from "@/lib/security";
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import sharp from "sharp";
export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    sameOrigin(req);
    const length = Number(req.headers.get("content-length"));
    if (length > 8_500_000) throw Error("Maximum upload size is 8 MB.");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 8_000_000)
      throw Error("Choose a PNG, JPEG or WebP under 8 MB.");
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { limitInputPixels: 40000000 });
    const meta = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format || ""))
      throw Error("Only PNG, JPEG and WebP are supported.");
    const name = "upload-" + randomUUID() + ".webp";
    const dir = join(process.cwd(), "public/teas");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, name),
      await image
        .rotate()
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer(),
    );
    await audit(user.id, "IMAGE_UPLOADED", name, { bytes: file.size });
    return NextResponse.json({ path: "/teas/" + name });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json(
      { error },
      { status: error === "Unauthorized" ? 401 : 400 },
    );
  }
}
