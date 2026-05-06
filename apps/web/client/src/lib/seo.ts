export interface SeoMetadata {
  canonicalPath?: string;
  description: string;
  jsonLd?: Record<string, unknown>;
  title: string;
}

const DEFAULT_SITE_URL = "https://pymeshub.lat";

function resolveSiteUrl() {
  const configuredUrl = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (typeof configuredUrl === "string" && configuredUrl.trim()) {
    return configuredUrl.replace(/\/$/, "");
  }

  return DEFAULT_SITE_URL;
}

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

function upsertJsonLd(jsonLd: Record<string, unknown>) {
  const id = "pymeshub-page-schema";
  let element = document.head.querySelector<HTMLScriptElement>(`script#${id}`);

  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(jsonLd);
}

export function applySeoMetadata({ canonicalPath = "/", description, jsonLd, title }: SeoMetadata) {
  const siteUrl = resolveSiteUrl();
  const canonicalUrl = `${siteUrl}${canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`}`;

  document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", "index, follow");
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:url", canonicalUrl);
  upsertMeta("property", "og:site_name", "PymesHub");
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertLink("canonical", canonicalUrl);

  if (jsonLd) {
    upsertJsonLd(jsonLd);
  }
}

export function buildSoftwareSchema(path: string, name: string, description: string) {
  const siteUrl = resolveSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${siteUrl}${path}`,
    description,
    offers: {
      "@type": "Offer",
      category: "SaaS",
      availability: "https://schema.org/InStock",
    },
    provider: {
      "@type": "Organization",
      name: "PymesHub",
      url: siteUrl,
    },
  };
}
