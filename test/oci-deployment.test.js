import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("OCI Git deployment has its own root and never rewrites the public build", async () => {
  const own = JSON.parse(await readFile(new URL("../oci/vercel.json", import.meta.url), "utf8"));
  const publicConfig = JSON.parse(await readFile(new URL("../frontend/vercel.json", import.meta.url), "utf8"));
  assert.equal(own.outputDirectory, "dist-oci");
  assert.equal(publicConfig.outputDirectory, "dist");
  assert.match(own.buildCommand, /build-oci\.js/);
  assert.equal(own.rewrites[0].destination, "/oci.html");
  assert.equal(publicConfig.rewrites.at(-1).destination, "/index.html");
  const headers = own.headers[0].headers;
  assert.equal(headers.find((item) => item.key === "X-Frame-Options").value, "DENY");
  assert.match(headers.find((item) => item.key === "X-Robots-Tag").value, /noindex/);
  assert.match(headers.find((item) => item.key === "Cache-Control").value, /no-store/);
});

test("OCI middleware is mounted before permissive public CORS and customer middleware", async () => {
  const source = await readFile(new URL("../index.js", import.meta.url), "utf8");
  const position = source.indexOf('app.use("/api/oci", ociHttpBoundary');
  assert.ok(position > 0 && position < source.indexOf("app.use(cors())"));
  assert.ok(position < source.indexOf("app.use(tenantContext)"));
  assert.match(source, /express\.json\(\{ limit: "64kb" \}\)/);
});
