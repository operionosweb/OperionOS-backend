import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildAviationContractCore } from "../../domain/contractIntelligence/aviationContractCore.js";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const text = `1 FUEL SURCHARGE
Base fuel surcharge: USD 1000 per flight
Baseline fuel price: USD 0.80 per litre
Fuel price reference: Example Jet A-1 Index
Adjustment frequency: monthly
Adjusted fuel surcharge = Base fuel surcharge * (Current fuel price / Baseline fuel price).`;
const source = { text, title: "FUEL SURCHARGE", clauseId: "fuel-clause", clauseNumber: "1", pageNumber: 3 };

test("actual frontend component renders bounded fuel input, citations and unsupported/missing states offline", async () => {
  const server = await createServer({
    root: path.join(root, "frontend"), configFile: false, logLevel: "error",
    server: { middlewareMode: true, watch: null, ws: false, fs: { allow: [root] } },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const { default: Section } = await server.ssrLoadModule("/src/components/intelligence/AviationContractCoreSection.jsx");
    const html = renderToStaticMarkup(React.createElement(Section, { core: buildAviationContractCore([source]) }));
    assert.match(html, /Aviation review coverage/);
    assert.match(html, /Hypothetical assumption/);
    assert.match(html, /User-supplied observation \(unverified\)/);
    assert.match(html, /type="date"/);
    assert.match(html, /href="#clause-fuel-clause"/);
    assert.match(html, /Page 3/);
    assert.match(html, /Calculate labelled scenario/);
    assert.match(html, /not confirmed obligation, liability or compliance/);
    assert.match(html, /not saved/);
    assert.doesNotMatch(html, /Scenario only:/);

    const unsupported = renderToStaticMarkup(React.createElement(Section, { core: buildAviationContractCore([{ ...source, text: `${text}\nSubject to approval.` }]) }));
    assert.match(unsupported, /requires review/);
    assert.match(unsupported, /conditions or cross-references are not supported/);
    assert.doesNotMatch(unsupported, /Calculate labelled scenario|type="number"/);

    const missing = renderToStaticMarkup(React.createElement(Section, { core: null }));
    assert.match(missing, /existing completed runs are not rewritten/);
    const unavailablePage = renderToStaticMarkup(React.createElement(Section, { core: buildAviationContractCore([{ ...source, pageNumber: null }]) }));
    assert.match(unavailablePage, /Page unavailable/);
    assert.doesNotMatch(unavailablePage, /Page 3/);
  } finally {
    await server.close();
  }
});

test("actual contract result workspace wires persisted core metadata and clears local scenario on analysis change", async () => {
  const workspace = await fs.readFile(path.join(root, "frontend", "src", "routes", "ContractWorkspace.jsx"), "utf8");
  assert.match(workspace, /AviationContractCoreSection key=\{activeAnalysisRunId\} core=\{profile\.metadata\?\.aviationCore\}/);
  assert.match(workspace, /normalizeProfileEvidence\(recommendation\.evidence\)/);
});
