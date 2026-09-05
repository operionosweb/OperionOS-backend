import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relativePath) => fs.readFile(path.join(root, relativePath), "utf8");

const publicRoutes = [
  "/",
  "/platform",
  "/solutions",
  "/industries/aviation",
  "/scenarios",
  "/enterprise",
  "/about",
  "/demo/dashboard",
  "/demo/contracts",
  "/demo/contracts/demo-aircraft-lease/financial-impact",
  "/demo/upload",
  "/demo/intelligence",
  "/demo/live-tracking",
];

test("authenticated SaaS routes use canonical app paths and real components", async () => {
  const app = await read("frontend/src/App.jsx");
  assert.match(app, /<Route index element={<Navigate to="dashboard" replace \/>} \/>/);
  assert.match(app, /<Route path="dashboard" element={<ProductionDashboard \/>} \/>/);
  assert.match(app, /<Route path="contracts" element={<ProductionContracts \/>} \/>/);
  assert.match(app, /<Route path="contracts\/:id" element={<ContractWorkspace \/>} \/>/);
  assert.match(app, /<Route path="upload" element={<ProductionUpload \/>} \/>/);
  assert.match(app, /<Route path="aviation" element={<ProductionIntelligence \/>} \/>/);
  assert.match(app, /<Route path="live-tracking" element={<ProductionLiveTracking \/>} \/>/);
  assert.match(app, /<Route path="intelligence" element={<Navigate to="\.\.\/aviation" replace \/>} \/>/);
  assert.match(app, /<Route path="\*" element={<Navigate to="dashboard" replace \/>} \/>/);
});

test("authentication restores safe app destinations and defaults to dashboard", async () => {
  const [guard, login, layout] = await Promise.all([
    read("frontend/src/components/auth/RequireAuth.jsx"),
    read("frontend/src/routes/Login.jsx"),
    read("frontend/src/components/layout/ProductionLayout.jsx"),
  ]);
  assert.match(guard, /state={{ from: location }}/);
  assert.match(login, /requestedPath\.startsWith\("\/app\/"\)/);
  assert.match(login, /"\/app\/dashboard"/);
  assert.match(login, /mode === "signup" && !data\?\.session/);
  assert.match(login, /<Navigate to="\/app\/dashboard" replace \/>/);
  assert.match(layout, /auth\.logout/);
  assert.doesNotMatch(layout, /meelis@operionos\.com/i);
});

test("every intentionally indexable public route has route metadata and sitemap coverage", async () => {
  const [metadata, sitemap] = await Promise.all([
    read("frontend/src/components/seo/RouteMetadata.jsx"),
    read("frontend/public/sitemap.xml"),
  ]);
  for (const route of publicRoutes) {
    assert.match(metadata, new RegExp(`"${route.replaceAll("/", "\\/")}"`), `metadata missing for ${route}`);
    assert.ok(sitemap.includes(`<loc>https://operionos.com${route}</loc>`), `sitemap missing ${route}`);
  }
  assert.doesNotMatch(sitemap, /<loc>https:\/\/operionos\.com\/app(?:\/|<)/);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/operionos\.com\/login<\/loc>/);
});

test("private routes are noindex in HTML policy, robots, and Vercel headers", async () => {
  const [metadata, robots, vercelText] = await Promise.all([
    read("frontend/src/components/seo/RouteMetadata.jsx"),
    read("frontend/public/robots.txt"),
    read("vercel.json"),
  ]);
  const vercel = JSON.parse(vercelText);
  assert.match(metadata, /pathname === "\/app" \|\| pathname\.startsWith\("\/app\/"\)/);
  assert.match(metadata, /noindex, nofollow, noarchive, nosnippet/);
  assert.match(robots, /Disallow: \/app\r?\n/);
  assert.match(robots, /Disallow: \/app\//);
  assert.match(robots, /Sitemap: https:\/\/operionos\.com\/sitemap\.xml/);
  assert.deepEqual(vercel.rewrites, [{ source: "/(.*)", destination: "/index.html" }]);
  const appHeaders = vercel.headers.filter((entry) => entry.source.startsWith("/app"));
  assert.equal(appHeaders.length, 2);
  assert.ok(appHeaders.every((entry) => entry.headers.some(({ key, value }) => key === "X-Robots-Tag" && value.includes("noindex"))));
});

test("static home metadata and structured data are valid and customer-free", async () => {
  const html = await read("frontend/index.html");
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large" \/>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/operionos\.com\/" \/>/);
  assert.match(html, /<meta property="og:title"/);
  assert.match(html, /<meta name="twitter:title"/);
  const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match, "home JSON-LD is missing");
  const structuredData = JSON.parse(match[1]);
  assert.equal(structuredData["@context"], "https://schema.org");
  assert.ok(structuredData["@graph"].some((entry) => entry["@type"] === "Organization"));
  assert.ok(structuredData["@graph"].some((entry) => entry["@type"] === "WebSite"));
  assert.ok(structuredData["@graph"].some((entry) => entry["@type"] === "SoftwareApplication"));
  assert.doesNotMatch(html, /organizationId|contractId|analysisRunId|customer/i);
});

test("public route components retain semantic primary headings", async () => {
  const files = ["CorporateHome.jsx", "Platform.jsx", "Solutions.jsx", "Aviation.jsx", "Scenarios.jsx", "Enterprise.jsx", "About.jsx"];
  for (const file of files) {
    const source = file === "CorporateHome.jsx"
      ? await read("frontend/src/components/corporate/HomeSections.jsx")
      : await read(`frontend/src/routes/${file}`);
    assert.match(source, /<h1(?:\s|>)/, `${file} must expose a semantic H1`);
  }
});
