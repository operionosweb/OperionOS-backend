import assert from "node:assert/strict";
import test from "node:test";

import { app } from "../phase2App.js";

const protectedPaths = [
  "/api/contracts",
  "/api/documents/11111111-1111-4111-8111-111111111111",
  "/api/documents/11111111-1111-4111-8111-111111111111/versions",
  "/api/analysis-runs/11111111-1111-4111-8111-111111111111",
  "/api/analysis-runs/11111111-1111-4111-8111-111111111111/evidence",
];

test("protected Phase 2 routes reject requests without a bearer token", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();

  for (const pathname of protectedPaths) {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      headers: { "x-org-id": "11111111-1111-4111-8111-111111111111" },
    });
    const body = await response.json();

    assert.equal(response.status, 401, pathname);
    assert.equal(body.error, "Bearer token required", pathname);
  }
});

test("upload route rejects unauthenticated multipart requests at the route boundary", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const form = new FormData();
  form.append("file", new Blob(["not authenticated"], { type: "application/pdf" }), "source.pdf");

  const response = await fetch(`http://127.0.0.1:${port}/api/contracts/upload`, {
    method: "POST",
    body: form,
    headers: { "x-org-id": "11111111-1111-4111-8111-111111111111" },
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "Bearer token required");
});

test("contract assistant rejects requests without a bearer token", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/api/analysis-runs/11111111-1111-4111-8111-111111111111/assistant`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-org-id": "11111111-1111-4111-8111-111111111111" },
    body: JSON.stringify({ question: "What are the termination rights?", organization_id: "22222222-2222-4222-8222-222222222222" }),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "Bearer token required");
});

test("deterministic clause analysis rejects requests without a bearer token", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/api/analysis-runs/11111111-1111-4111-8111-111111111111/clauses/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-org-id": "11111111-1111-4111-8111-111111111111" },
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "Bearer token required");
});