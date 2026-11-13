import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import { renderBlogArticleHtml, renderBlogIndexHtml, renderRichTextHtml } from "../src/lib/blogRendering.js";
import { normalizeRichText } from "../src/lib/richText.js";

const origin = "https://blog-acceptance.test";
const frontendRoot = fileURLToPath(new URL("..", import.meta.url));
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

test("Tiptap formatting commands serialize into validated, renderable article content", () => {
  const text = "Synthetic formatting persists";
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, link: { openOnClick: false } }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
  });
  try {
    editor.commands.setTextSelection({ from: 1, to: text.length + 1 });
    for (const result of [
      editor.commands.toggleBold(),
      editor.commands.toggleItalic(),
      editor.commands.toggleUnderline(),
      editor.commands.toggleStrike(),
      editor.commands.setFontFamily("Georgia"),
      editor.commands.setFontSize("24px"),
      editor.commands.setColor("#123456"),
      editor.commands.setHighlight({ color: "#fff2b0" }),
      editor.commands.setTextAlign("center"),
    ]) assert.notEqual(result, false);

    const document = normalizeRichText(editor.getJSON());
    const textNode = document.content[0].content[0];
    const marks = new Set(textNode.marks.map(mark => mark.type));
    for (const mark of ["bold", "italic", "underline", "strike", "textStyle", "highlight"]) assert.ok(marks.has(mark), `Missing persisted ${mark} mark`);
    assert.equal(document.content[0].attrs.textAlign, "center");
    assert.ok(textNode.marks.some(mark => mark.type === "textStyle" && mark.attrs.fontFamily === "Georgia" && mark.attrs.fontSize === "24px" && mark.attrs.color === "#123456"));
    const html = renderRichTextHtml(document);
    for (const tag of ["strong", "em", "u", "s", "mark"]) assert.ok(html.includes(`<${tag}`), `Missing rendered ${tag} formatting`);
    assert.match(html, /font-size:24px/);
    assert.match(html, /text-align:center/);
  } finally {
    editor.destroy();
  }
});

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
      const shareNav = page.getByRole("navigation", { name: "Share this article" });
      assert.equal(await shareNav.getByRole("link", { name: "LinkedIn" }).getAttribute("target"), "_blank");
      assert.match(await shareNav.getByRole("link", { name: "X" }).getAttribute("href"), /twitter\.com\/intent\/tweet/);
      assert.match(await shareNav.getByRole("link", { name: "Email" }).getAttribute("href"), /^mailto:/);
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

test("Blog category, tag, and text filters create crawlable listing URLs", async () => {
  const { browser, page } = await fixture(390);
  try {
    await page.goto(`${origin}/blog`);
    await page.getByLabel("Search insights").fill("lease obligations");
    await page.getByLabel("Category").selectOption("Aircraft Leasing");
    await page.getByLabel("Tag").fill("maintenance");
    await page.getByRole("button", { name: "Search articles", exact: true }).click();
    const url = new URL(page.url());
    assert.equal(url.pathname, "/blog");
    assert.equal(url.searchParams.get("search"), "lease obligations");
    assert.equal(url.searchParams.get("category"), "Aircraft Leasing");
    assert.equal(url.searchParams.get("tag"), "maintenance");
  } finally { await browser.close(); }
});

test("React Blog honours server-rendered pagination URLs and resets paging when filters change", async () => {
  const envNames = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_API_BASE_URL"];
  const previousEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  process.env.VITE_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.VITE_SUPABASE_ANON_KEY = "local-browser-test-key";
  process.env.VITE_API_BASE_URL = "";
  const vite = await createServer({
    root: frontendRoot,
    configFile: `${frontendRoot}\\vite.config.js`,
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0 },
  });
  let browser;
  try {
    await vite.listen();
    const address = vite.httpServer.address();
    browser = await chromium.launch();
    const page = await browser.newPage();
    const requests = [];
    const article = (id, title, slug, category) => ({
      id, title, slug, status: "published", category,
      published_at: "2026-11-09T12:00:00.000Z",
      content: [{ type: "paragraph", text: "Synthetic content for SSR pagination parity." }],
    });
    const firstPost = article("page-one", "Page one article", "page-one-article", "Aircraft Leasing");
    const secondPost = article("page-two", "Page two article", "page-two-article", "Aircraft Leasing");
    const filteredPost = article("filtered-page-one", "Filtered page one article", "filtered-page-one-article", "MRO and Maintenance Contracts");
    await page.route(url => new URL(url).pathname === "/api/blog", async route => {
      const query = new URL(route.request().url()).searchParams;
      const selectedCategory = query.get("category");
      const requestedPage = Number(query.get("page"));
      requests.push({ page: requestedPage, category: selectedCategory });
      const posts = selectedCategory ? [filteredPost] : requestedPage === 2 ? [secondPost] : [firstPost];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          posts,
          categories: ["Aircraft Leasing", "MRO and Maintenance Contracts"],
          pagination: { page: selectedCategory ? 1 : requestedPage, page_size: 12, total: 24, has_more: false },
        }),
      });
    });
    await page.goto(`http://127.0.0.1:${address.port}/blog?page=2`);
    await page.getByRole("link", { name: "Page two article" }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Page one article" }).count(), 0);
    assert.equal(new URL(page.url()).searchParams.get("page"), "2");
    await page.getByRole("button", { name: "MRO and Maintenance Contracts" }).click();
    await page.getByRole("link", { name: "Filtered page one article" }).waitFor();
    assert.equal(requests[0].page, 2);
    assert.deepEqual(requests.at(-1), { page: 1, category: "MRO and Maintenance Contracts" });
    assert.equal(new URL(page.url()).searchParams.get("page"), null);
  } finally {
    if (browser) await browser.close();
    await vite.close();
    for (const name of envNames) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  }
});

test("React Blog ignores an old load-more response after its filters change", async () => {
  const envNames = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_API_BASE_URL"];
  const previousEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  process.env.VITE_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.VITE_SUPABASE_ANON_KEY = "local-browser-test-key";
  process.env.VITE_API_BASE_URL = "";
  const vite = await createServer({
    root: frontendRoot,
    configFile: `${frontendRoot}\\vite.config.js`,
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0 },
  });
  let browser;
  try {
    await vite.listen();
    const address = vite.httpServer.address();
    browser = await chromium.launch();
    const page = await browser.newPage();
    let releaseMore;
    let markMoreStarted;
    const moreStarted = new Promise(resolve => { markMoreStarted = resolve; });
    const moreResponse = new Promise(resolve => { releaseMore = resolve; });
    const article = (id, title, slug, category) => ({
      id, title, slug, status: "published", category,
      published_at: "2026-11-09T12:00:00.000Z",
      content: [{ type: "paragraph", text: "Synthetic content for pagination race verification." }],
    });
    const initialPost = article("initial", "Initial article", "initial-article", "Aircraft Leasing");
    const filteredPost = article("filtered", "Filtered article", "filtered-article", "MRO and Maintenance Contracts");
    const stalePost = article("stale", "Stale article", "stale-article", "Aircraft Leasing");
    await page.route(url => new URL(url).pathname === "/api/blog", async route => {
      const query = new URL(route.request().url()).searchParams;
      const pageNumber = query.get("page");
      const selectedCategory = query.get("category");
      if (pageNumber === "2") {
        markMoreStarted();
        await moreResponse;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, posts: [stalePost], categories: [], pagination: { page: 2, page_size: 12, total: 2, has_more: false } }),
        });
      }
      const posts = selectedCategory ? [filteredPost] : [initialPost];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, posts, categories: ["Aircraft Leasing", "MRO and Maintenance Contracts"], pagination: { page: 1, page_size: 12, total: selectedCategory ? 1 : 2, has_more: !selectedCategory } }),
      });
    });
    await page.goto(`http://127.0.0.1:${address.port}/blog`);
    await page.getByRole("link", { name: "Initial article" }).waitFor();
    await page.getByRole("button", { name: "Load more insights" }).click();
    await moreStarted;
    await page.getByRole("button", { name: "MRO and Maintenance Contracts" }).click();
    await page.getByRole("link", { name: "Filtered article" }).waitFor();
    const staleResponse = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === "/api/blog" && url.searchParams.get("page") === "2";
    });
    releaseMore();
    await staleResponse;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.getByRole("link", { name: "Filtered article" }).count(), 1);
    assert.equal(await page.getByRole("link", { name: "Stale article" }).count(), 0);
  } finally {
    if (browser) await browser.close();
    await vite.close();
    for (const name of envNames) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  }
});
