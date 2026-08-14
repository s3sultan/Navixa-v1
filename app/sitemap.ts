import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://navixa.s2shug.workers.dev";
  const lastModified = new Date();
  return [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/health`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/worship`, lastModified, changeFrequency: "monthly", priority: 0.8 },
  ];
}
