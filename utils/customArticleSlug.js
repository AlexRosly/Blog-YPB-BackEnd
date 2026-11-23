const BLOG_URL = "https://www.thewandered.com/";
const COUNTRIES = new Set([
  "home", "australia", "canada", "poland", "singapore", "ukraine",
  "uncharted-planet", "usa",
]);

// Public frontend pages and infrastructure must continue to own these URLs.
const RESERVED_HOME = new Set([
  ...COUNTRIES, "adminka", "api", "api-docs", "authors", "blog",
  "daily-journal-of-your-price-booking-service-history", "en", "private-policy",
  "sitemaps", "terms-conditions-users", "travel-resources", "wandered-posts",
]);

function customArticleUrl(value, rawCountry) {
  if (value === undefined || (typeof value === "string" && !value.trim())) return {};
  if (
    typeof value !== "string" || value.length > 80 || value.trim() !== value ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  ) {
    return { error: 400, message: "Article slug must use up to 80 lowercase letters, digits and single hyphens." };
  }

  const country = rawCountry === undefined || rawCountry === "" ? "home" :
    typeof rawCountry === "string" ? rawCountry.toLowerCase() : "";
  if (!COUNTRIES.has(country)) {
    return { error: 400, message: "Select a valid article section for the custom slug." };
  }

  const reserved =
    (country === "home" && RESERVED_HOME.has(value)) ||
    ((country === "poland" || country === "ukraine") && value === "authors") ||
    (country === "usa" && (
      value === "public-transport-in-new-york-city-2027" ||
      value === "public-transport-in-new-york-city-a-2023-travelq-guide"
    ));
  if (reserved) return { error: 409, message: "This article address is reserved." };
  const prefix = country === "home" ? "" : `${country}/`;
  return { url: `${BLOG_URL}${prefix}${value}` };
}

module.exports = { customArticleUrl };
