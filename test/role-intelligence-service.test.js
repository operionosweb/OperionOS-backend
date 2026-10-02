import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRoleBasedIntelligence,
  resolveUserIntelligenceContext,
} from "../services/phase3/intelligence/roleIntelligenceService.js";
import { answerContractQuestion } from "../services/phase3/intelligence/contractAssistantService.js";

const financialRisk = {
  id: "financial-risk",
  title: "Rent and maintenance reserve exposure",
  description: "Recurring payment and currency cost",
  severity: "high",
  source_evidence_id: "evidence-financial",
  evidence: [{ id: "evidence-financial", excerpt: "Monthly rent is due" }],
};

const operationalRisk = {
  id: "operational-risk",
  title: "Aircraft redelivery availability",
  description: "Maintenance records may affect operational continuity",
  severity: "high",
  source_evidence_id: "evidence-operational",
  evidence: [{ id: "evidence-operational", excerpt: "Complete records at redelivery" }],
};

function context(profileId, permissions = ["contract:read"]) {
  return resolveUserIntelligenceContext({
    userId: "user-1",
    organizationId: "organization-1",
    organizationRole: "VIEWER",
    permissions,
    rbiProfileId: profileId,
  });
}

test("CFO and Operations prioritize different views of the same authorized risks", () => {
  const risks = [operationalRisk, financialRisk];
  const cfo = buildRoleBasedIntelligence({ context: context("CFO"), risks });
  const operations = buildRoleBasedIntelligence({ context: context("OPERATIONS"), risks });

  assert.equal(cfo.risks[0].id, "financial-risk");
  assert.equal(operations.risks[0].id, "operational-risk");
  assert.deepEqual(new Set(cfo.risks.map(({ id }) => id)), new Set(risks.map(({ id }) => id)));
  assert.deepEqual(new Set(operations.risks.map(({ id }) => id)), new Set(risks.map(({ id }) => id)));
  assert.deepEqual(cfo.risks.find(({ id }) => id === financialRisk.id).evidence, financialRisk.evidence);
});

test("RBI preserves the exact permissions received from RBAC", () => {
  const permissions = ["contract:read"];
  const intelligence = buildRoleBasedIntelligence({ context: context("CFO", permissions), risks: [financialRisk] });

  assert.deepEqual(intelligence.authorization.permissions, permissions);
  assert.equal(intelligence.authorization.permissions.includes("contract:write"), false);
  assert.equal(intelligence.authorization.permissions.includes("contract:analyze"), false);
});

test("unknown and absent profiles fall back to neutral contract intelligence", () => {
  assert.equal(context("NOT_A_ROLE").rbiProfile.roleId, "DEFAULT");
  assert.equal(context(null).rbiProfile.roleId, "VIEWER");
});

test("canonical customer roles resolve customer intelligence profiles", () => {
  assert.equal(resolveUserIntelligenceContext({ organizationRole: "CUSTOMER_ADMIN" }).rbiProfile.roleId, "CONTRACT_MANAGER");
  assert.equal(resolveUserIntelligenceContext({ organizationRole: "CUSTOMER_USER" }).rbiProfile.roleId, "VIEWER");
});

test("internal RBI is inferred only for a platform superadmin outside organization scope", () => {
  const platform = resolveUserIntelligenceContext({ platformRoles: ["SUPERADMIN"], permissions: ["platform:admin"] });
  const customer = resolveUserIntelligenceContext({
    organizationId: "organization-1",
    organizationRole: "VIEWER",
    platformRoles: ["SUPERADMIN"],
    permissions: ["contract:read"],
  });

  assert.equal(platform.rbiProfile.roleId, "OPERION_INTERNAL");
  assert.equal(customer.rbiProfile.roleId, "VIEWER");
});

test("grounded assistant uses RBI only to rank authorized evidence-backed findings", () => {
  const evidence = [...financialRisk.evidence, ...operationalRisk.evidence];
  const cfo = answerContractQuestion({
    question: "What are the biggest priorities?",
    risks: [operationalRisk, financialRisk],
    evidence,
    rbiProfile: context("CFO").rbiProfile,
  });
  const operations = answerContractQuestion({
    question: "What are the biggest priorities?",
    risks: [operationalRisk, financialRisk],
    evidence,
    rbiProfile: context("OPERATIONS").rbiProfile,
  });

  assert.equal(cfo.findings[0].id, "financial-risk");
  assert.equal(operations.findings[0].id, "operational-risk");
  assert.deepEqual(new Set(cfo.findings.map(({ id }) => id)), new Set(operations.findings.map(({ id }) => id)));
});