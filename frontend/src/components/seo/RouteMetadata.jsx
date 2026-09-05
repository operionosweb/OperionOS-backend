import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://operionos.com";
const DEFAULT_TITLE = "Operion | Aviation Contract Intelligence";
const DEFAULT_DESCRIPTION = "Operion turns aviation contracts into structured, evidence-backed intelligence across clauses, obligations, deadlines, risks, relationships, and recommended actions.";

const PUBLIC_PAGES = {
  "/": {
    title: "Operion | Aviation Contract Intelligence",
    description: "Operion helps aviation organisations understand contracts, obligations, deadlines, risks, aircraft relationships, and the evidence behind every finding.",
    name: "Operion",
  },
  "/platform": {
    title: "Operion Platform | Aviation Contract Intelligence",
    description: "Explore how Operion structures aviation contracts into searchable clauses, obligations, deadlines, risks, relationships, evidence, and decision support.",
    name: "Platform",
  },
  "/solutions": {
    title: "Operion Solutions | Contract Intelligence for Aviation",
    description: "See how Operion supports airlines, aircraft lessors, MRO providers, ground handlers, airports, suppliers, and aviation advisers with contract intelligence.",
    name: "Solutions",
  },
  "/industries/aviation": {
    title: "Operion Aviation | Contract Intelligence for Aviation and Aerospace",
    description: "Operion connects aviation contracts, clauses, obligations, deadlines, risks, evidence, and aircraft relationships for complex aviation organisations.",
    name: "Aviation",
  },
  "/scenarios": {
    title: "Operion Scenarios | Aviation Contract Risk and Decision Intelligence",
    description: "Explore evidence-grounded aviation scenarios that connect contractual rules with operational events, exposure, and potential actions without fabricating outcomes.",
    name: "Scenarios",
  },
  "/enterprise": {
    title: "Operion Enterprise | Secure Aviation Contract Intelligence",
    description: "Review Operion's evidence, security, tenancy, governance, and integration approach for enterprise aviation contract intelligence.",
    name: "Enterprise",
  },
  "/about": {
    title: "About Operion | Aviation Contract Intelligence",
    description: "Learn why Operion is building an intelligence layer for aviation contracts, obligations, operational events, risks, relationships, and decisions.",
    name: "About Operion",
  },
  "/demo/dashboard": {
    title: "Operion Demo | Aviation Contract Intelligence Dashboard",
    description: "Explore a clearly labelled demonstration of Operion's aviation contract intelligence workflows using prepared, non-customer data.",
    name: "Demo Dashboard",
  },
  "/demo/contracts": {
    title: "Operion Demo Contracts | Aviation Contract Intelligence",
    description: "Explore prepared aviation contract examples, clauses, obligations, deadlines, risks, relationships, and evidence in the public Operion demo.",
    name: "Demo Contracts",
  },
  "/demo/upload": {
    title: "Operion Upload Demo | Aviation Contract Processing",
    description: "See the demonstrated workflow from aviation contract upload through structure, analysis, evidence, and contract intelligence.",
    name: "Upload Demo",
  },
  "/demo/intelligence": {
    title: "Operion Intelligence Demo | Evidence-Backed Contract Analysis",
    description: "Explore how Operion presents clauses, obligations, deadlines, risks, relationships, evidence, and grounded contract intelligence.",
    name: "Intelligence Demo",
  },
  "/demo/live-tracking": {
    title: "Operion Live Tracking Demo | Aviation Operational Intelligence",
    description: "Explore a prepared demonstration connecting aviation operational context with aircraft and contract intelligence.",
    name: "Live Tracking Demo",
  },
  "/demo/contracts/demo-aircraft-lease/financial-impact": {
    title: "Financial Impact Demo | Aviation Contract Exposure | Operion",
    description: "Explore how Operion connects synthetic aviation contract clauses, obligations, events, financial exposure, mitigation actions, and potential protected value.",
    name: "Financial Impact Demo",
  },
};

const NON_INDEXED_PAGES = {
  "/login": {
    title: "Sign in to Operion | Secure Account Access",
    description: "Secure access to the private Operion aviation contract intelligence application.",
  },
  "/industries": {
    title: "Operion Industries",
    description: "Operion's industry-specific contract intelligence experiences.",
  },
  "/how-it-works": {
    title: "How Operion Works",
    description: "An overview of Operion's contract ingestion and intelligence workflow.",
  },
};

function setMeta(attribute, key, content) {
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setCanonical(href) {
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = href;
}

function publicStructuredData(page, canonicalUrl, pathname) {
  const graph = [];
  if (pathname === "/") {
    graph.push(
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Operion",
        url: `${SITE_URL}/`,
        description: DEFAULT_DESCRIPTION,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "Operion",
        url: `${SITE_URL}/`,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: "Operion",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: DEFAULT_DESCRIPTION,
        url: `${SITE_URL}/platform`,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    );
  } else {
    graph.push({
      "@type": "WebPage",
      "@id": `${canonicalUrl}#webpage`,
      name: page.title,
      description: page.description,
      url: canonicalUrl,
      isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "Operion", url: `${SITE_URL}/` },
      about: { "@type": "SoftwareApplication", name: "Operion", applicationCategory: "BusinessApplication" },
    });
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Operion", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: page.name, item: canonicalUrl },
      ],
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

function resolvePage(pathname) {
  if (pathname === "/demo") return { ...PUBLIC_PAGES["/demo/dashboard"], pathname: "/demo/dashboard", indexable: true, robots: "index, follow, max-image-preview:large" };
  if (PUBLIC_PAGES[pathname]) return { ...PUBLIC_PAGES[pathname], pathname, indexable: true, robots: "index, follow, max-image-preview:large" };
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    return {
      title: "Operion Application | Private Contract Intelligence",
      description: "Private, authenticated Operion application.",
      pathname: "/app",
      indexable: false,
      privatePage: true,
      robots: "noindex, nofollow, noarchive, nosnippet",
    };
  }
  if (pathname.startsWith("/demo/contracts/")) {
    return {
      title: "Operion Contract Demo | Prepared Aviation Contract Data",
      description: "A prepared, non-customer contract intelligence demonstration.",
      pathname: "/demo/contracts",
      indexable: false,
      robots: "noindex, follow, noarchive",
    };
  }
  if (NON_INDEXED_PAGES[pathname]) return { ...NON_INDEXED_PAGES[pathname], pathname, indexable: false, robots: "noindex, follow, noarchive" };
  return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, pathname: "/", indexable: false, robots: "noindex, follow, noarchive" };
}

export default function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = resolvePage(pathname);
    const canonicalUrl = `${SITE_URL}${page.pathname === "/" ? "/" : page.pathname}`;
    document.title = page.title;
    setCanonical(canonicalUrl);
    setMeta("name", "description", page.description);
    setMeta("name", "robots", page.robots);
    setMeta("property", "og:site_name", "Operion");
    setMeta("property", "og:type", "website");
    setMeta("property", "og:title", page.title);
    setMeta("property", "og:description", page.description);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("name", "twitter:card", "summary");
    setMeta("name", "twitter:title", page.title);
    setMeta("name", "twitter:description", page.description);

    document.head.querySelectorAll('script[type="application/ld+json"]').forEach((script) => script.remove());
    if (page.indexable) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.operionSeo = "route";
      script.textContent = JSON.stringify(publicStructuredData(page, canonicalUrl, page.pathname));
      document.head.appendChild(script);
    }
  }, [pathname]);

  return null;
}
