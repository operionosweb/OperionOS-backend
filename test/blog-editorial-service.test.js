import assert from "node:assert/strict";
import test from "node:test";

import { SEO_SCORE_CATEGORIES, createEditorialAnalyzer } from "../services/blogEditorialService.js";
import { applyParagraphSuggestion } from "../frontend/src/lib/blogEditorSuggestions.js";

const ID = "fcaabfe0-83ee-4ec5-8721-c312b9317f54";
const post = {
  id: ID,
  title: "Aircraft lease maintenance obligations",
  subtitle: "",
  slug: "aircraft-lease-maintenance-obligations",
  excerpt: "",
  seo_title: "",
  seo_description: "",
  social_title: "",
  social_description: "",
  cover_image_alt: "",
  tags: [],
  updated_at: "2026-11-13T10:00:00.000Z",
  content: [
    { type: "heading", level: 2, text: "Evidence to examine" },
    { type: "paragraph", text: "Review aircraft lease obligations against executed schedules, maintenance records, and the notice provisions that govern each event. Confirm the responsible party and the evidence required before deciding whether a reserve adjustment is due." },
    { type: "paragraph", text: "Aviation teams should compare contractual language with the relevant aircraft and engine records. A clear review trail helps commercial, legal, and technical teams discuss the same facts without assuming that a general industry practice overrides the executed agreement." },
  ],
};

function providerAnalysis(overrides = {}) {
  return {
    scores: Object.fromEntries(SEO_SCORE_CATEGORIES.map(({ id }, index) => [
      id,
      { score: index * 7, explanation: `Evidence-backed assessment for ${id}.` },
    ])),
    recommendations: [{
      category: "heading_structure",
      problem: "The section hierarchy is too shallow.",
      why_it_matters: "Readers need clear topic boundaries.",
      improvement: "Add descriptive subheadings that match the article sections.",
      priority: "High",
    }],
    suggestions: {
      metadata: {
        seo_title: "Aircraft lease maintenance obligations | Operion",
        seo_description: "Review aircraft lease maintenance obligations against records and executed terms.",
        slug: "aircraft-lease-maintenance-review",
      },
      primary_keyword: "aircraft lease maintenance obligations",
      secondary_keywords: ["maintenance reserve evidence"],
      headings: ["Linking reserve events to evidence"],
      internal_link_topics: ["aircraft lease redelivery obligations"],
      article_structure: ["Define the obligation", "Identify the evidence", "Document the review"],
      paragraph_improvements: [{
        original_text: "Review aircraft lease obligations against executed schedules, maintenance records, and the notice provisions that govern each event. Confirm the responsible party and the evidence required before deciding whether a reserve adjustment is due.",
        suggested_text: "For each maintenance event, compare the executed lease schedule, applicable records, and notice provisions. Identify the responsible party and required evidence before assessing a reserve adjustment.",
        reason: "The revision groups the review steps while preserving the original meaning.",
      }],
    },
    ...overrides,
  };
}

test("editorial analysis uses the configured backend provider and returns a consistent scored review", async () => {
  let request;
  const analyzer = createEditorialAnalyzer({
    generate: async (input, provider, options) => {
      request = { input: JSON.parse(input), provider, options };
      return { provider: "mistral", analysis: providerAnalysis() };
    },
  });
  const result = await analyzer(post, { organizationId: ID, userId: ID, consent: true });

  assert.equal(request.provider, "mistral");
  assert.equal(request.options.organizationId, ID);
  assert.equal(request.options.userId, ID);
  assert.equal(request.options.operation, "summarisation");
  assert.equal(request.options.structured, true);
  assert.equal(request.options.cache, false);
  assert.equal(request.options.promptVersion, "blog-seo-score-v2");
  assert.equal(request.input.seo_title, "");
  assert.equal(request.input.seo_description, "");
  assert.match(request.options.system, /do not guarantee search rankings/i);
  assert.match(request.options.system, /paragraph_improvements/);
  assert.equal(result.overall_score, Math.round(SEO_SCORE_CATEGORIES.reduce((sum, { id }, index) => sum + index * 7, 0) / SEO_SCORE_CATEGORIES.length));
  assert.equal(Object.keys(result.scores).length, SEO_SCORE_CATEGORIES.length);
  assert.equal(result.scores.heading_structure.score, 28);
  assert.equal(result.recommendations[0].priority, "High");
  assert.equal(result.suggestions.metadata.seo_title, "Aircraft lease maintenance obligations | Operion");
  assert.equal(result.suggestions.paragraph_improvements.length, 1);
  assert.equal(result.baseline.seo_title, "");
  assert.equal(result.provider, "mistral");
  assert.equal(result.approved, false);
  assert.match(result.disclaimer, /does not guarantee Google indexing/);
});

test("analysis rejects missing scores and invalid metadata instead of inventing a result", async () => {
  const missingScore = providerAnalysis();
  delete missingScore.scores.aviation_relevance;
  const analyzer = createEditorialAnalyzer({ generate: async () => ({ provider: "mistral", analysis: missingScore }) });
  await assert.rejects(() => analyzer(post, { organizationId: ID, consent: true }), { status: 502 });

  const invalidSlug = providerAnalysis();
  invalidSlug.suggestions.metadata.slug = "javascript:alert(1)";
  const invalidAnalyzer = createEditorialAnalyzer({ generate: async () => ({ provider: "mistral", analysis: invalidSlug }) });
  await assert.rejects(() => invalidAnalyzer(post, { organizationId: ID, consent: true }), { status: 502 });
});

test("provider failure returns no score and a subsequent explicit retry can succeed", async () => {
  let attempts = 0;
  const analyzer = createEditorialAnalyzer({
    generate: async () => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error("provider detail must not escape"), { code: "PROVIDER_FAILED" });
      return { provider: "mistral", analysis: providerAnalysis() };
    },
  });
  await assert.rejects(() => analyzer(post, { organizationId: ID, consent: true }), (error) => {
    assert.equal(error.status, 503);
    assert.match(error.message, /No score was generated or saved/);
    assert.doesNotMatch(error.message, /provider detail/);
    return true;
  });
  assert.equal((await analyzer(post, { organizationId: ID, consent: true })).provider, "mistral");
  assert.equal(attempts, 2);
});

test("analysis requires explicit editorial consent and substantive saved content", async () => {
  const analyzer = createEditorialAnalyzer({ generate: async () => { throw new Error("must not be called"); } });
  await assert.rejects(() => analyzer(post, { organizationId: ID, consent: false }), { status: 400 });
  await assert.rejects(() => analyzer({ ...post, content: [] }, { organizationId: ID, consent: true }), { status: 400 });
});

test("paragraph suggestions apply only to one exact unformatted match", () => {
  const content = [
    { type: "paragraph", text: "Original paragraph." },
    { type: "rich_text", document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Another original." }] }] } },
  ];
  const applied = applyParagraphSuggestion(content, "Original paragraph.", "Improved paragraph.");
  assert.equal(applied.applied, true);
  assert.equal(applied.content[0].text, "Improved paragraph.");
  assert.equal(content[0].text, "Original paragraph.");
  assert.equal(applyParagraphSuggestion(content, "Missing source.", "Replacement.").applied, false);

  const duplicate = [...content, { type: "paragraph", text: "Original paragraph." }];
  assert.equal(applyParagraphSuggestion(duplicate, "Original paragraph.", "Replacement.").applied, false);
  const formatted = [{ type: "rich_text", document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Formatted.", marks: [{ type: "bold" }] }] }] } }];
  assert.equal(applyParagraphSuggestion(formatted, "Formatted.", "Replacement.").applied, false);
});
