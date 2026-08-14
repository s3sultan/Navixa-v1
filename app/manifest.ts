import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NAVIXA | ذكاء يفهم يومك",
    short_name: "NAVIXA",
    description: "مساعد ذكي لحياة أكثر ترتيبًا.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7fbfc",
    theme_color: "#087f83",
    lang: "ar",
    dir: "rtl",
    icons: [
      { src: "/navixa-mark.png", sizes: "384x347", type: "image/png", purpose: "any maskable" },
    ],
  };
}
