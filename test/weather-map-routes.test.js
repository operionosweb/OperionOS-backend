import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { createWeatherMapRouter } from "../routes/weatherMapRoutes.js";

const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64");
const credentials = {
  XWEATHER_MAPS_ENABLED: "1",
  XWEATHER_MAPS_SUBSCRIPTION_APPROVED: "1",
  XWEATHER_CLIENT_ID: "offline-client",
  XWEATHER_CLIENT_SECRET: "offline-secret",
};

async function withRouter(options, run) {
  const app = express();
  const authorize = options.authorize || ((_req, _res, next) => next());
  app.use("/api/weather-maps", createWeatherMapRouter({ ...options, authorize: [authorize] }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try { await run(`http://127.0.0.1:${server.address().port}/api/weather-maps`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("weather maps default to disabled and never expose credentials in status", async () => {
  await withRouter({ env: {}, fetchImpl: () => { throw new Error("Must not contact provider"); } }, async (url) => {
    const status = await (await fetch(`${url}/status`)).json();
    assert.equal(status.configured, false);
    assert.equal(status.turbulenceAvailable, false);
    assert.equal((await fetch(`${url}/tiles/radar/1/0/0`)).status, 503);
  });
  await withRouter({ env: credentials }, async (url) => {
    const status = await (await fetch(`${url}/status`)).json();
    assert.equal(status.configured, true);
    assert.equal(status.subscriptionApproved, true);
    assert.equal(status.subscriptionVerified, false);
    assert.equal(status.layers.length, 4);
    assert.doesNotMatch(JSON.stringify(status), /offline-client|offline-secret/);
  });
});

test("weather tiles remain disabled until subscription approval is explicit", async () => {
  let calls = 0;
  const env = { ...credentials, XWEATHER_MAPS_SUBSCRIPTION_APPROVED: "0" };
  await withRouter({ env, fetchImpl: async () => { calls++; throw new Error("Must not contact provider"); } }, async (url) => {
    const status = await (await fetch(`${url}/status`)).json();
    assert.equal(status.configured, false);
    assert.equal(status.subscriptionApproved, false);
    assert.equal(status.subscriptionVerified, false);
    assert.deepEqual(status.layers, []);
    assert.equal((await fetch(`${url}/tiles/radar/1/0/0`)).status, 503);
    assert.equal(calls, 0);
  });
});

test("weather tiles require organization authorization before any provider request", async () => {
  let calls = 0;
  await withRouter({
    env: credentials,
    authorize: (_req, res) => res.status(401).json({ error: "Authentication required" }),
    fetchImpl: async () => { calls++; throw new Error("Must not contact provider"); },
  }, async (url) => {
    const response = await fetch(`${url}/tiles/radar/1/0/0`);
    assert.equal(response.status, 401);
    assert.equal(calls, 0);
  });
});

test("weather tiles use fixed allowlisted Xweather URLs, validate PNGs and cache results", async () => {
  let calls = 0;
  await withRouter({
    env: credentials,
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url, "https://maps.api.xweather.com/offline-client_offline-secret/radar/1/0/0/current.png");
      assert.equal(options.redirect, "error");
      return new Response(image, { headers: { "content-type": "image/png" } });
    },
  }, async (url) => {
    for (let i = 0; i < 2; i++) {
      const response = await fetch(`${url}/tiles/radar/1/0/0`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /image\/png/);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
    }
    assert.equal(calls, 1);
  });
});

test("invalid layers, coordinates, zoom levels and query overrides never contact Xweather", async () => {
  await withRouter({ env: credentials, fetchImpl: () => { throw new Error("Must not contact provider"); } }, async (url) => {
    for (const tile of ["turbulence/1/0/0", "radar/0/0/0", "radar/7/0/0", "radar/1/2/0", "radar/1/0/2", "radar/-1/0/0", "radar/1/0/0?url=example"]) {
      assert.equal((await fetch(`${url}/tiles/${tile}`)).status, 400, tile);
    }
  });
});

test("provider failures are explicit and credential-bearing error content is not returned", async () => {
  await withRouter({ env: credentials, fetchImpl: async () => {
    throw new Error("Provider error containing offline-secret");
  } }, async (url) => {
    const response = await fetch(`${url}/tiles/radar/1/0/0`);
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /offline-secret/);
  });
});

test("non-PNG and oversized responses fail instead of returning success-shaped imagery", async () => {
  for (const response of [
    new Response("denied", { status: 401 }),
    new Response("not a PNG", { headers: { "content-type": "image/png" } }),
    new Response(image, { headers: { "content-type": "image/png", "content-length": String(2 * 1024 * 1024) } }),
  ]) {
    await withRouter({ env: credentials, fetchImpl: async () => response }, async (url) => {
      assert.equal((await fetch(`${url}/tiles/radar/1/0/0`)).status, 502);
    });
  }
});

test("concurrent identical tile requests share one upstream call", async () => {
  let calls = 0;
  await withRouter({ env: credentials, fetchImpl: async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return new Response(image, { headers: { "content-type": "image/png" } });
  } }, async (url) => {
    const responses = await Promise.all([fetch(`${url}/tiles/radar/1/0/0`), fetch(`${url}/tiles/radar/1/0/0`)]);
    assert.ok(responses.every((response) => response.status === 200));
    assert.equal(calls, 1);
  });
});

test("weather cache expires and the per-process upstream request cap fails closed", async () => {
  let clock = 0, calls = 0;
  await withRouter({ env: credentials, now: () => clock, fetchImpl: async () => {
    calls++;
    return new Response(image, { headers: { "content-type": "image/png" } });
  } }, async (url) => {
    await fetch(`${url}/tiles/radar/1/0/0`);
    clock = 300001;
    await fetch(`${url}/tiles/radar/1/0/0`);
    assert.equal(calls, 2);
    for (let i = 0; i < 299; i++) {
      const response = await fetch(`${url}/tiles/radar/6/${i % 64}/${Math.floor(i / 64)}`);
      assert.equal(response.status, 200);
    }
    assert.equal((await fetch(`${url}/tiles/radar/6/63/63`)).status, 429);
  });
});
