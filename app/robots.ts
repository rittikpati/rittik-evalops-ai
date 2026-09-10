import type { MetadataRoute } from "next";

const baseUrl = (process.env.NEXTAUTH_URL ?? "https://rittikevalops.ai").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/datasets", "/experiments", "/models", "/prompts", "/analytics", "/evaluations", "/runs", "/settings"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}