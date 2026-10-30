import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origin = "http://127.0.0.1:4176";
const server = spawn(process.execPath, [resolve(root, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", "4176", "--strictPort"], {
  cwd: root, stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk; });
server.stderr.on("data", (chunk) => { serverOutput += chunk; });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Model export server exited: ${serverOutput}`);
    try { ready = (await fetch(origin)).ok; } catch (error) {
      if (error.cause?.code !== "ECONNREFUSED") throw error;
    }
    if (ready) break;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  if (!ready) throw new Error("Model export server did not become ready");
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  // Load Vite's normal module preamble without mounting the app or its globes.
  await page.route(`${origin}/src/main.jsx`, (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async () => {
    const [{ buildAircraft }, { GLTFExporter }, { mergeGeometries }, { Group, Mesh, Box3, Float32BufferAttribute }] = await Promise.all([
      import("/src/components/corporate/AircraftScene.jsx"),
      import("/node_modules/three/examples/jsm/exporters/GLTFExporter.js"),
      import("/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js"),
      import("/node_modules/three/build/three.module.js"),
    ]);
    const { aircraft } = buildAircraft();
    // Preserve Home's glTF-standard +Z nose / +Y up. Cesium corrects both
    // axes to local +X forward / +Z up before applying geographic heading.
    aircraft.updateMatrixWorld(true);
    const batches = new Map();
    aircraft.traverse((object) => {
      if (!object.isMesh) return;
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, index) => index));
      if (!geometry.attributes.uv) geometry.setAttribute("uv", new Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
      if (!batches.has(object.material)) batches.set(object.material, []);
      batches.get(object.material).push(geometry);
    });
    const model = new Group();
    model.name = "Operion Home 3D Asset View Airliner";
    model.userData = { source: "AircraftScene.buildAircraft", forwardAxis: "+Z", upAxis: "+Y", illustrative: true };
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries);
      if (!geometry) throw new Error("Aircraft geometry batching failed");
      model.add(new Mesh(geometry, material));
      geometries.forEach((entry) => entry.dispose());
    }
    // Keep an exaggerated overview model above the globe instead of burying
    // its fuselage/engines when minimumPixelSize increases the visual scale.
    model.position.y = -new Box3().setFromObject(model).min.y;
    const glb = await new GLTFExporter().parseAsync(model, { binary: true, maxTextureSize: 2048 });
    const bytes = new Uint8Array(glb);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 8192) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    }
    return { base64: btoa(binary), bytes: bytes.length, drawCalls: model.children.length };
  });
  const output = resolve(root, "public", "models", "operion-airliner.glb");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(result.base64, "base64"));
  console.log(`Exported Home airliner: ${result.bytes} bytes, ${result.drawCalls} material batches.`);
} finally {
  try { await browser?.close(); } finally { server.kill(); }
}
