import { useEffect } from "react";

// NOTE: update this when you move to a custom domain (also in index.html,
// public/sitemap.xml, public/robots.txt).
export const SITE_URL = "https://uncropit.vercel.app";

export const BRAND = "Uncrop it AI: Photo Extender & Resizer";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Set per-route <title>, description, canonical, and OG/Twitter title+desc. */
export function useSeo(opts: { title: string; description: string; path?: string }) {
  useEffect(() => {
    const url = SITE_URL + (opts.path ?? "/");
    document.title = opts.title;
    setMeta("name", "description", opts.description);
    setCanonical(url);
    setMeta("property", "og:title", opts.title);
    setMeta("property", "og:description", opts.description);
    setMeta("property", "og:url", url);
    setMeta("name", "twitter:title", opts.title);
    setMeta("name", "twitter:description", opts.description);
  }, [opts.title, opts.description, opts.path]);
}
