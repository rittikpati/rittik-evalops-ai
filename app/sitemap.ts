import type { MetadataRoute } from "next";

const baseUrl = (process.env.NEXTAUTH_URL ?? "https://rittikevalops.ai").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.7 },
    { url: `${baseUrl}/register`, lastModified: now, changeFrequency: "yearly", priority: 0.7 },
  ];
}