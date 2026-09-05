import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://navixasa.com";
  const lastModified = new Date();
  return [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/plus`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/sprint`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/meeting-summaries`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/smart-reminders`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/organize-your-day`, lastModified, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/health`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/worship`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/local-privacy`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/guides`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/support`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/refunds`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
