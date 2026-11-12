import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "@playwright/test";
import { renderBlogArticleHtml, renderBlogIndexHtml } from "../src/lib/blogRendering.js";

const origin = "https://blog-acceptance.test";
const mediaId = "bcaabfe0-83ee-4ec5-8721-c312b9317f54";
const post = {
  title: "Synthetic aviation lease review",
  slug: "synthetic-aviation-lease-review",
  status: "published",
  category: "Aircraft Leasing",
  excerpt: "Synthetic fixture for local browser acceptance, not a published article.",
  seo_title: "Synthetic aviation lease review | Operion",
  seo_description: "Review synthetic lease evidence and contractual obligations.",
  author_name: "Synthetic Editorial",
  published_at: "2026-11-09T12:00:00.000Z",
  is_indexable: true,
  cover_image: mediaId,
  cover_image_alt: "Synthetic aircraft illustration",
  content: [
    { type: "heading", level: 2, text: "Evidence to review" },
    { type: "paragraph", text: "Check the executed clause and the responsible reviewer." },
    { type: "table", rows: [["Term", "Review"], ["Payment", "Check the source clause and evidence"]] },
    { type: "link", text: "Explore the product", href: "https://operionos.com/product" },
  ],
};
const relatedPost = {
  title: "MRO agreement renewal controls",
  slug: "mro-agreement-renewal-controls",
  status: "published",
  category: "MRO and Maintenance Contracts",
  excerpt: "Review renewal triggers and notice evidence.",
  author_name: "Synthetic Editorial",
  published_at: "2026-11-08T12:00:00.000Z",
  content: [{ type: "paragraph", text: "Review the executed MRO agreement." }],
};

async function fixture(width, javaScriptEnabled = true) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled });
  const css = await readFile(new URL("../public/blog.css", import.meta.url));
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/blog.css") return route.fulfill({ contentType: "text/css", body: css });
    if (url.pathname.startsWith("/api/blog/media/")) return route.fulfill({
      contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"),
    });
    if (url.pathname === "/blog") return route.fulfill({ contentType: "text/html", body: renderBlogIndexHtml([post], origin) });
    if (url.pathname === `/blog/${post.slug}`) return route.fulfill({ contentType: "text/html", body: renderBlogArticleHtml(post, origin, [relatedPost]) });
    return route.fulfill({ status: 404, body: "Article not found." });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { browser, page, errors };
}

for (const width of [1440, 768, 390, 320]) {
  test(`server-rendered Blog listing and article remain usable at ${width}px`, async () => {
    const { browser, page, errors } = await fixture(width);
    try {
      await page.goto(`${origin}/blog`);
      await page.getByRole("heading", { name: post.title }).waitFor();
      assert.equal(await page.locator("h1").count(), 1);
      await page.getByRole("heading", { name: post.title }).getByRole("link").click();
      await page.getByRole("heading", { name: post.title, level: 1 }).waitFor();
      await page.getByRole("heading", { name: "Evidence to review", level: 2 }).waitFor();
      await page.getByRole("heading", { name: "Related aviation insights" }).waitFor();
      await page.getByRole("region", { name: "Related aviation insights" })
        .getByRole("article").filter({ hasText: relatedPost.title }).waitFor();
      assert.equal(await page.title(), post.seo_title);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), `https://operionos.com/blog/${post.slug}`);
      assert.equal(await page.locator('meta[name="description"]').getAttribute("content"), post.seo_description);
      assert.equal(await page.locator('meta[property="og:type"]').getAttribute("content"), "article");
      assert.equal(await page.locator('meta[name="twitter:title"]').getAttribute("content"), post.seo_title);
      const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
      assert.ok(schema["@graph"].some((item) => item["@type"].includes("BlogPosting")));
      assert.ok(schema["@graph"].some((item) => item["@type"] === "BreadcrumbList"));
      assert.equal(await page.getByRole("img", { name: post.cover_image_alt }).evaluate((image) => image.complete && image.naturalWidth > 0), true);
      assert.equal(await page.getByRole("link", { name: "Explore the product", exact: true }).getAttribute("href"), "https://operionos.com/product");
      assert.ok(await page.locator('a[href="/request-demo"]').count() > 0);
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
      assert.ok(dimensions.content <= dimensions.viewport + 1, JSON.stringify(dimensions));
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test("Blog article text and links render with JavaScript disabled", async () => {
  const { browser, page } = await fixture(390, false);
  try {
    await page.goto(`${origin}/blog/${post.slug}`);
    assert.match(await page.locator("main").innerText(), /Check the executed clause/);
    assert.equal(await page.getByRole("heading", { level: 1 }).innerText(), post.title);
    assert.ok(await page.locator('a[href="/request-demo"]').count() > 0);
  } finally { await browser.close(); }
});
