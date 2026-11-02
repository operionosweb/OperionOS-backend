import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { build } from "vite";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let server, browser, origin;
before(async () => {
  const result = await build({ root, configFile: false, logLevel: "error", build: {
    write: false, rollupOptions: { input: path.join(root, "tests", "fixtures", "matt-introduction.jsx"), output: { inlineDynamicImports: true } },
  } });
  const script = result.output.find((file) => file.type === "chunk" && file.isEntry).code;
  const css = result.output.filter((file) => file.type === "asset" && file.fileName.endsWith(".css")).map((file) => file.source).join("\n");
  const video = await readFile(path.join(root, "public", "matt", "reference.mp4"));
  server = createServer((request, response) => {
    if (request.url === "/fixture.js") { response.writeHead(200, { "Content-Type": "text/javascript" }); response.end(script); }
    else if (request.url === "/matt/reference.mp4") {
      const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || "");
      if (range) {
        const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), video.length - 1) : video.length - 1;
        response.writeHead(206, { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${video.length}`, "Content-Length": end - start + 1 });
        response.end(video.subarray(start, end + 1));
      } else { response.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": video.length }); response.end(video); }
    }
    else { response.writeHead(200, { "Content-Type": "text/html" }); response.end(`<!doctype html><style>${css}</style><div id="root"></div><script type="module" src="/fixture.js"></script>`); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise((resolve) => server.close(resolve)); });

async function fixture({ failVideo = false, live = false, width = 1440 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage(), requests = [], errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addInitScript((enabled) => { window.__mountSyntheticLive = enabled; }, live);
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname);
    if (url.origin !== origin || (failVideo && url.pathname.endsWith(".mp4"))) return route.abort();
    return route.continue();
  });
  await page.goto(origin);
  return { page, context, requests, errors };
}
test("introduction decodes, never loops, and context rerenders do not restart playback", async () => {
  const f = await fixture();
  try {
    await f.page.waitForFunction(() => document.querySelector("video")?.currentTime > 0.3);
    assert.equal(await f.page.locator("video").evaluate((video) => video.loop), false);
    const before = await f.page.locator("video").evaluate((video) => video.currentTime);
    await f.page.getByRole("button", { name: "Change context", exact: true }).click();
    assert.ok(await f.page.locator("video").evaluate((video) => video.currentTime) >= before);
    assert.equal(await f.page.locator(".matt-environment").getAttribute("data-state"), "INTRODUCTION");
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
test("remount during introduction resumes progress rather than starting again", async () => {
  const f = await fixture();
  try {
    await f.page.waitForFunction(() => document.querySelector("video")?.currentTime > 0.5);
    const before = await f.page.locator("video").evaluate((video) => video.currentTime);
    await f.page.getByRole("button", { name: "Toggle Matt", exact: true }).click();
    await f.page.getByRole("button", { name: "Toggle Matt", exact: true }).click();
    await f.page.waitForFunction((time) => document.querySelector("video")?.currentTime >= time, before);
    assert.equal(await f.page.locator("video").evaluate((video) => video.loop), false);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
test("skip removes footage and survives remount, context changes and reload in the same tab", async () => {
  const f = await fixture({ width: 390 });
  try {
    await f.page.getByRole("button", { name: "Skip introduction", exact: true }).click();
    await f.page.getByRole("heading", { name: "Live Matt unavailable" }).waitFor();
    await f.page.getByRole("button", { name: "Change context", exact: true }).click();
    await f.page.getByRole("button", { name: "Toggle Matt", exact: true }).click();
    await f.page.getByRole("button", { name: "Toggle Matt", exact: true }).click();
    await f.page.reload();
    await f.page.getByRole("heading", { name: "Live Matt unavailable" }).waitFor();
    assert.equal(await f.page.locator("video, img").count(), 0);
    assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
test("actual introduction ended event removes intro and mounts the unavailable live boundary", async () => {
  const f = await fixture();
  try {
    await f.page.waitForFunction(() => document.querySelector("video")?.readyState >= 2);
    await f.page.locator("video").evaluate((video) => { video.currentTime = video.duration - 0.1; return video.play(); });
    await f.page.getByRole("heading", { name: "Live Matt unavailable" }).waitFor();
    assert.equal(await f.page.locator("video").count(), 0);
    assert.equal(await f.page.evaluate(() => window.__intro.completed), 1);
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
test("failed intro advances without retrying footage or impersonating a live answer", async () => {
  const f = await fixture({ failVideo: true });
  try {
    await f.page.getByRole("heading", { name: "Live Matt unavailable" }).waitFor();
    assert.equal(await f.page.locator("video, img").count(), 0);
    assert.match(await f.page.evaluate(() => window.__intro.errors.find((message) => message)), /introduction could not play/);
    assert.ok(f.requests.every((url) => !url.startsWith("/api/")));
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
test("intro completion can mount a supplied synthetic live stream with no prerecorded source", async () => {
  const f = await fixture({ live: true });
  try {
    await f.page.getByRole("button", { name: "Skip introduction", exact: true }).click();
    await f.page.waitForFunction(() => document.querySelector("video")?.srcObject?.getAudioTracks().length === 1);
    assert.equal(await f.page.locator("video source").count(), 0);
    assert.equal(await f.page.locator("video").evaluate((video) => video.loop), false);
    await f.page.evaluate(() => window.__cleanupSynthetic());
    assert.deepEqual(f.errors, []);
  } finally { await f.context.close(); }
});
