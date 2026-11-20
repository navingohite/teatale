export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/checkout",
        "/order-confirmation",
        "/track-order",
        "/cart",
      ],
    },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3010"}/sitemap.xml`,
  };
}
