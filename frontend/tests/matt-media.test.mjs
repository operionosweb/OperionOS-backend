import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { build } from "vite";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let server, browser, origin;
before(async () => {
  const result = await build({ root, configFile: false, logLevel: "error", build: {
    write: false, rollupOptions: { input: path.join(root, "tests", "fixtures", "matt-media.jsx") },
  } });
  const script = result.output.find((file) => file.type === "chunk" && file.isEntry).code;
  server = createServer((request, response) => {
    if (request.url === "/fixture.js") { response.writeHead(200, { "Content-Type": "text/javascript" }); response.end(script); }
    else if (request.url === "/") {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end('<!doctype html><button id="start">Start synthetic media</button><div id="root"></div><script type="module" src="/fixture.js"></script>');
    } else { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise((resolve) => server.close(resolve)); });

test("the component plays one supplied audio/video stream and handles simulated remote track removal without identity substitution", async () => {
  const page = await browser.newPage(), requests = [], errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname);
    return url.origin === origin ? route.continue() : route.abort();
  });
  try {
    await page.goto(origin);
    await page.getByRole("button", { name: "Start synthetic media", exact: true }).click();
    await page.waitForFunction(() => window.__media.statuses.includes("playing"));
    const state = await page.locator("video").evaluate((video) => ({
      sourceIsStream: video.srcObject === window.__testStream, loop: video.loop, muted: video.muted,
      audio: video.srcObject.getAudioTracks().length, video: video.srcObject.getVideoTracks().length,
      references: video.querySelectorAll("source").length, paused: video.paused,
    }));
    assert.deepEqual(state, { sourceIsStream: true, loop: false, muted: false, audio: 1, video: 1, references: 0, paused: false });
    await page.evaluate(() => {
      const track = window.__testStream.getVideoTracks()[0];
      window.__testStream.removeTrack(track);
      window.__testStream.dispatchEvent(new MediaStreamTrackEvent("removetrack", { track }));
    });
    await page.getByRole("button", { name: "Retry Matt video", exact: true }).waitFor();
    assert.match(await page.evaluate(() => window.__media.errors.at(-1)), /live media stream is unavailable/);
    await page.getByRole("button", { name: "Retry Matt video", exact: true }).click();
    assert.equal(await page.locator("video").evaluate((video) => video.paused), true);
    assert.ok(!requests.some((value) => value.startsWith("/matt/")), "No identity-video fallback after live-media failure");
    await page.evaluate(() => { window.unmountMatt(); return window.__stopMedia(); });
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test("video-only input is refused explicitly rather than pretending to provide synchronized speech", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(origin);
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      window.__testStream = canvas.captureStream();
      window.renderMatt(window.__testStream);
    });
    await page.getByRole("button", { name: "Retry Matt video", exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.__media.statuses), ["loading", "error"]);
    assert.equal(await page.locator("video source").count(), 0);
    await page.evaluate(() => { window.unmountMatt(); window.__testStream.getTracks().forEach((track) => track.stop()); });
  } finally { await page.close(); }
});
