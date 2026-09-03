import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const read = (path) => fs.readFile(path, "utf8");

test("upload hands the created contract identity back to the portfolio workflow", async () => {
  const [upload, portfolio] = await Promise.all([
    read("frontend/src/components/demo/UploadContract.jsx"),
    read("frontend/src/routes/ContractPortfolio.jsx"),
  ]);
  assert.match(upload, /uploadContract\(\{ file, organizationId \}\)/);
  assert.match(upload, /onUploaded\?\.\(result\)/);
  assert.match(upload, /Contract uploaded and ready for analysis/);
  assert.match(upload, /state === "uploading"/);
  assert.match(portfolio, /result\?\.contractId/);
  assert.match(portfolio, /navigate\(`\/demo\/contracts\/\$\{result\.contractId\}`\)/);
});

test("upload-created analysis selection is isolated per contract and used by deterministic contract processing", async () => {
  const [portfolio, workspace, analysis, api] = await Promise.all([
    read("frontend/src/routes/ContractPortfolio.jsx"),
    read("frontend/src/routes/ContractWorkspace.jsx"),
    read("frontend/src/routes/AnalysisView.jsx"),
    read("frontend/src/lib/contractsApi.js"),
  ]);
  assert.match(workspace, /operion\.activeAnalysisRunId\.\$\{contractId\}/);
  assert.match(portfolio, /localStorage\.setItem\(`operion\.activeAnalysisRunId\.\$\{result\.contractId\}`, result\.analysisRunId\)/);
  assert.match(api, /\/api\/analysis-runs\/\$\{analysisRunId\}\/process/);
  assert.match(workspace, /processContractIntelligence\(analysisRun\.id, organizationId\)/);
  assert.match(analysis, /operion\.activeAnalysisRunId\.\$\{contractId\}/);
  assert.doesNotMatch(workspace, /getItem\("operion\.activeAnalysisRunId"\)/);
  assert.doesNotMatch(workspace, /ContractSpatialBridge/);
});

test("contract workspace exposes the complete intelligence navigation", async () => {
  const workspace = await read("frontend/src/routes/ContractWorkspace.jsx");
  for (const [target, label] of [["overview", "Overview"], ["clauses", "Clauses"], ["obligations", "Obligations"], ["deadlines", "Deadlines"], ["risks", "Risks"], ["assistant", "Assistant"]]) {
    assert.match(workspace, new RegExp(`\\["${target}", "${label}"\\]`));
    assert.match(workspace, new RegExp(`id="${target}"`));
  }
  assert.match(workspace, /Process contract/);
  assert.match(workspace, /Analyse obligations/);
  assert.match(workspace, /Build deadline intelligence/);
  assert.match(workspace, /Analyse contractual risks/);
  assert.match(workspace, /No active analysis run selected/);
  assert.match(workspace, /Key risks/);
  assert.match(workspace, /Key obligations/);
  assert.match(workspace, /Key deadlines/);
  assert.match(workspace, /Important clauses/);
  assert.doesNotMatch(workspace, /risk score/i);
});

test("workspace evidence navigation uses canonical excerpts and source locators", async () => {
  const [workspace, evidencePanel, api] = await Promise.all([
    read("frontend/src/routes/ContractWorkspace.jsx"),
    read("frontend/src/components/intelligence/EvidencePanel.jsx"),
    read("frontend/src/lib/contractsApi.js"),
  ]);
  assert.match(api, /\/api\/analysis-runs\/\$\{analysisRunId\}\/evidence/);
  assert.match(workspace, /listAnalysisRunEvidence/);
  assert.match(workspace, /EvidencePanel findingLabel=\{clause/);
  assert.match(workspace, /EvidencePanel findingLabel=\{obligation/);
  assert.match(workspace, /EvidencePanel findingLabel=\{deadline/);
  assert.match(evidencePanel, /source\.excerpt/);
  assert.match(evidencePanel, /source\.source_locator/);
  assert.match(evidencePanel, /Page \$\{source\.page_number\}/);
});

test("assistant interaction is analysis-run scoped and handles missing intelligence", async () => {
  const [assistant, api, service] = await Promise.all([
    read("frontend/src/components/intelligence/ContractAssistantPanel.jsx"),
    read("frontend/src/lib/contractsApi.js"),
    read("services/phase3/intelligence/contractAssistantService.js"),
  ]);
  assert.match(api, /\/api\/analysis-runs\/\$\{analysisRunId\}\/assistant/);
  assert.match(api, /body: \{ question \}/);
  assert.match(assistant, /askContractAssistant\(analysisRunId, organizationId, question\.trim\(\)\)/);
  assert.match(assistant, /Evidence-backed answer/);
  assert.match(assistant, /Not established/);
  assert.match(service, /intelligenceConsumption: 0/);
  assert.match(service, /does not establish an evidence-backed answer/);
});
