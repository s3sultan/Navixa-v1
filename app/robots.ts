import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = "https://navixa.s2shug.workers.dev";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
