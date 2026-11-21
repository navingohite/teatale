import source from "../../data/catalogue-source.json";
export const storage =
  "Keep in an airtight jar in a cool, dry place away from sunlight and moisture. Use a dry spoon and close the lid tightly.";
const ingredients = [
  "Green tea leaves (Camellia sinensis)",
  "Black tea leaves (Camellia sinensis)",
  "Green tea, tulsi (holy basil)",
  "Butterfly pea flowers",
  "Green tea, ginger, lemon, tulsi",
  "Green tea, pomegranate, cinnamon",
  "Green tea, lavender buds",
  "Black tea, ginger, lemon, tulsi",
  "Whole-leaf black tea",
  "Chamomile blossoms",
  "Green tea, moringa leaf, hibiscus petals",
  "Green tea, turmeric, ginger, tulsi",
  "Green tea, peppermint, tulsi",
  null,
  "Black tea, ginger, cardamom, cinnamon",
  "Black tea, rose petals, tulsi",
];
export const catalogue = source.map((p) => ({
  id: `catalogue-${String(p.position).padStart(2, "0")}`,
  slug: p.slug,
  published: true,
  name: p.name,
  sku: `TT-${String(p.position).padStart(3, "0")}`,
  position: p.position,
  type:
    p.name.includes("Black") || p.name.includes("Darjeeling")
      ? "Black Tea"
      : p.name === "Blue Tea" || p.name === "Chamomile Tea"
        ? "Herbal Infusions"
        : "Green Tea",
  status: p.position <= 2 ? "AVAILABLE" : "COMING_SOON",
  price: null,
  stock: null,
  weight: p.position <= 2 ? 100 : null,
  bestBefore: p.position <= 2 ? 12 : null,
  image: `/teas/jars/${p.slug}.png`,
  summary: p.sourceFields.ABOUT.replace("from the hills of Darjeeling, ", "")
    .replace("from Himachal Pradesh, ", "")
    .replace("calming", "fragrant")
    .replace("relaxing", "floral"),
  taste: p.sourceFields["TASTE & AROMA"],
  origin: null,
  ingredients: ingredients[p.position - 1],
  caffeine: p.sourceFields.CAFFEINE,
  brewing: p.sourceFields["HOW TO BREW"],
  storage,
  claims: JSON.stringify({
    review:
      "Owner approval required: sourcing, organic certification, geographic names, health and nutrition claims, vegetarian declaration, FSSAI and ingredient/allergen information.",
    catalogueOrigin: p.sourceFields["ORIGIN & HISTORY"],
    cataloguePack: "PACK" in p.sourceFields ? p.sourceFields.PACK : null,
    benefits: p.sourceFields.BENEFITS,
    note:
      "PLEASE NOTE" in p.sourceFields ? p.sourceFields["PLEASE NOTE"] : null,
  }),
}));
export const initialContent = [
  {
    key: "home",
    title: "Tales of the Himalayas",
    body: "A little mountain stillness, in your everyday cup. Discover whole-leaf teas and a slower way to sip.",
    approved: true,
  },
  {
    key: "our-story",
    title: "Every leaf has a tale.",
    body: "Tea Tale is a tea brand based in Bhopal, India. Our collection begins with Himalayan Green Tea and Himalayan Black Tea, and a love for the ritual of a freshly brewed cup.\n\nInspired by the Himalayas, we are building a collection of familiar leaves and fragrant blends. Take a moment. Warm your cup. Let a new tale unfold.",
    approved: true,
  },
  {
    key: "brew-guide",
    title: "A good cup takes a little care.",
    body: "Start with about 1 teaspoon (2 g) of tea for a 200 ml cup.\n\nGreen tea: use water at 75–80°C. Steep Himalayan Green Tea for 2–3 minutes. Boiling water can make it bitter.\n\nBlack tea: use water at 95–100°C. Steep Himalayan Black Tea for 3–5 minutes. Enjoy plain, with milk or a slice of lemon.\n\nHerbal infusions and blends: follow the individual tea’s brewing guide.\n\nStore your tea in an airtight jar, away from sunlight and moisture. Always use a dry spoon.",
    approved: true,
  },
  {
    key: "faq",
    title: "A few things you might wonder.",
    body: "Do I need an account?\nNo. Checkout is for guests. Use your private tracking link or verify your checkout email to track an order.\n\nWhich teas are launching first?\nHimalayan Green Tea and Himalayan Black Tea, in 100 g packs. Other blends are coming soon.\n\nHow should I store my tea?\nKeep it airtight, cool and dry. The two launch teas are best before 12 months from packing.",
    approved: true,
  },
  ...["shipping", "returns", "privacy", "terms"].map((key) => ({
    key,
    title: (
      {
        shipping: "Shipping & Delivery",
        returns: "Returns & Refunds",
        privacy: "Privacy Policy",
        terms: "Terms & Conditions",
      } as Record<string, string>
    )[key],
    body: "Owner draft: Add and approve the store policy before accepting orders.",
    approved: false,
  })),
];
