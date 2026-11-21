import { db } from "@/lib/db";
import { notFound } from "next/navigation";
const pages = [
  "our-story",
  "brew-guide",
  "contact",
  "faq",
  "shipping",
  "returns",
  "privacy",
  "terms",
];
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const c = await db.content.findUnique({ where: { key: page } });
  return {
    title: c?.title || "Contact",
    alternates: { canonical: "/" + page },
  };
}
export default async function ContentPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  if (!pages.includes(page)) notFound();
  const s = await db.settings.findUniqueOrThrow({ where: { id: "store" } });
  const c = await db.content.findUnique({ where: { key: page } });
  return (
    <article className="narrow prose">
      <p className="eyebrow">TEA TALE · BHOPAL, INDIA</p>
      <h1>{page === "contact" ? "Let’s talk tea." : c?.title}</h1>
      {page === "contact" ? (
        <>
          <p>Questions about a tea or an order? We’d love to hear from you.</p>
          <h2>Write to us</h2>
          <a href={"mailto:" + s.email}>{s.email}</a>
          <h2>Find us on Instagram</h2>
          <a href={`https://www.instagram.com/${s.instagram}/`}>
            @{s.instagram}
          </a>
        </>
      ) : c?.approved ? (
        c.body.split("\n\n").map((p, i) => (
          <p key={i} style={{ whiteSpace: "pre-line" }}>
            {p}
          </p>
        ))
      ) : (
        <>
          <p>
            We’re finalising this information before the store opens for orders.
          </p>
          <p>
            For current details, please email{" "}
            <a href={"mailto:" + s.email}>{s.email}</a>.
          </p>
        </>
      )}
    </article>
  );
}
