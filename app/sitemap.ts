import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://navixasa.com";
  const lastModified = new Date();
  return [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/health`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/worship`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/organize-your-day`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/meeting-summaries`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/smart-reminders`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/local-privacy`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/refunds`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
