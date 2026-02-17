import type { MetadataRoute } from "next";

const BASE_URL = "https://fz99lounge.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ["en", "ja"];
  const pages = [
    { path: "", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/leaderboard", priority: 0.8, changeFrequency: "daily" as const },
    { path: "/results", priority: 0.7, changeFrequency: "daily" as const },
    { path: "/rules", priority: 0.5, changeFrequency: "monthly" as const },
  ];

  return locales.flatMap((locale) =>
    pages.map((page) => ({
      url: `${BASE_URL}/${locale}${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    }))
  );
}
