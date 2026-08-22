import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NAVIXA SA | ذكاء يفهم يومك",
    short_name: "NAVIXA SA",
    description: "NAVIXA SA مساعد ذكي لحياة أكثر ترتيبًا.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7fbfc",
    theme_color: "#087f83",
    lang: "ar",
    dir: "rtl",
    icons: [
      { src: "/navixa-sa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
    ],
  };
}
