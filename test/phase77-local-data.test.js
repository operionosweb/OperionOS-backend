import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  assertPhase77LocalTarget, bodyWordCount, bundleHash, importBlogArticles,
  importOciProspects, prepareArticle, prospectAccount, prospectActivities,
  prospectContact, validatePhase77Bundle,
} from "../scripts/phase77LocalData.js";
import { createPhase77FeaturedImage, preparePhase77AuthorPhotograph } from "../scripts/phase77EditorialImages.js";

const founderId = "11111111-1111-4111-8111-111111111111";
const dataDirectory = String.raw`C:\test\phase77\postgres-verified`;
const when = "2026-11-11T13:00:00Z";
test("private Phase 77 research and unpublished drafts are excluded from Git and Vercel uploads", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const files = ["data/phase77/prospects.json", "data/phase77/articles.json"];
  const ignored = execFileSync("git", ["check-ignore", "--no-index", "--", ...files], { cwd: root, encoding: "utf8" });
  assert.deepEqual(ignored.trim().split(/\r?\n/), files);
  const vercelIgnore = readFileSync(new URL("../.vercelignore", import.meta.url), "utf8").split(/\r?\n/);
  assert.ok(vercelIgnore.includes("data/phase77"));
});
function prospect(index = 1) {
  return {
    id: `test-${index}`, name: `Synthetic test aviation ${index}`, website: `https://example.com/test-${index}`,
    country: "United Kingdom", headquarters: "Test location", segment: "Airline", operatingRegions: ["Test region"],
    businessDescription: "Synthetic fixture only; not a researched company.",
    aviationActivities: ["Test operations"], verifiedFacts: [{ fact: "Test assertion only.", sourceUrl: "https://example.com/evidence" }],
    sources: [
      { url: "https://example.com/evidence", verifiedAt: when, status: 200, description: "Synthetic source fixture." },
      { url: "https://example.com/contact", verifiedAt: when, status: 200, description: "Synthetic contact-channel fixture." },
    ],
    priority: "A", qualification: {
      reasonToApproach: "A synthetic contract review use case.", contractExposure: "Hypothetical test exposure.",
      contractCategories: ["Test supply"], potentialChallenges: ["Hypothetical boundary ambiguity."],
      existingOperionCapabilities: ["Evidence review"], paidPilot: "A bounded test review.",
      reasoning: "Test-only reasoning.", objections: ["No demand verified."], uncertainties: ["Budget unknown."],
    },
    contact: { name: null, targetRole: "Head of Procurement", department: "Procurement",
      officialChannel: "https://example.com/contact", sourceUrl: "https://example.com/evidence",
      verifiedAt: when, relationshipStatus: "Not contacted" },
    outreach: {
      opening: `Test introduction ${index}`, reason: "Test reason", challenge: "Test hypothesis",
      valueProposition: "Evidence review", recommendedDecisionMaker: "Procurement", subject: `Test subject ${index}`,
      email: `Unique synthetic test email ${index}, never send.`, meetingRequest: "Test discovery request.",
      followUpEmail: `Test follow-up ${index}`, followUpTiming: "Five business days after approved initial message.",
      status: "Draft - founder approval required",
    },
    ranking: { rank: index <= 20 ? index : null, whyAttractive: "Test hypothesis" },
  };
}
function article(index = 1) {
  const slug = `test-aviation-${index}`;
  return {
    slug, title: `Synthetic test article ${index}`, subtitle: "Test fixture", excerpt: "Test excerpt",
    category: "Aircraft Leasing", content: [
      { type: "heading", level: 2, text: "Test body" },
      { type: "paragraph", text: Array.from({ length: 1500 }, () => "fixture").join(" ") },
      { type: "heading", level: 2, text: "References" },
      { type: "paragraph", text: "Excluded reference words." },
    ],
    tags: ["Test"], author_id: founderId, author_name: "Meelis Paloson", author_avatar_media: null,
    status: "draft", ai_analysis: null, featuredImageBrief: { alt: "Illustrative test diagram" },
    metadata: {
      seo_title: "Test SEO", seo_description: "Test description", focus_keyword: "Test focus",
      secondary_keywords: ["Test secondary"], related_keywords: ["Test related"], search_intent: "Informational",
      canonical_url: `https://operionos.com/blog/${slug}`, social_title: "Test social", social_description: "Test social description",
      imageRecommendation: "Original diagram", imageAlt: "Original test diagram",
      internalLinks: [{ slug: "test-related", reason: "Related test" }], relatedArticles: ["test-related"],
      structuredData: { "@type": "BlogPosting", author: { name: "Meelis Paloson" } },
    },
    references: [1, 2].map(n => ({ url: `https://example.com/reference-${n}`, title: "Test reference", verifiedAt: when, supports: "Test claim" })),
  };
}
function bundle() {
  return { founderId, prospects: Array.from({ length: 100 }, (_, i) => prospect(i + 1)),
    articles: Array.from({ length: 10 }, (_, i) => article(i + 1)) };
}
function localClient(overrides = {}) {
  return {
    connectionParameters: { host: "127.0.0.1", port: 55477 },
    query: async () => ({ rows: [{ database: "operion_p77b_oci", address: "127.0.0.1", port: 55477, directory: dataDirectory }] }),
    ...overrides,
  };
}
test("word thresholds exclude headings and reference text rather than counting a proxy", () => {
  assert.equal(bodyWordCount(article()), 1500);
  const b = bundle();
  assert.equal(validatePhase77Bundle(b).researchedCompanies, 100);
  b.articles[0].content[1].text = "incomplete";
  assert.throws(() => validatePhase77Bundle(b), /required 1500/);
});
test("research bundle rejects missing companies, duplicate identities and missing shortlist ranks", () => {
  const b = bundle();
  b.prospects.pop();
  assert.throws(() => validatePhase77Bundle(b), /100 complete/);
  const c = bundle();
  c.prospects[1].id = c.prospects[0].id;
  assert.throws(() => validatePhase77Bundle(c), /Duplicate research/);
  const d = bundle();
  d.prospects[0].ranking.rank = null;
  assert.throws(() => validatePhase77Bundle(d), /twenty/);
});
test("missing qualification, source evidence or follow-up cannot count as a complete dossier", () => {
  for (const mutate of [
    b => { b.prospects[0].qualification.paidPilot = ""; },
    b => { b.prospects[0].verifiedFacts[0].sourceUrl = "https://example.com/unretained"; },
    b => { b.prospects[0].outreach.followUpEmail = ""; },
  ]) {
    const b = bundle(); mutate(b);
    assert.throws(() => validatePhase77Bundle(b));
  }
});
test("all ten outreach fields persist through existing account and planned-activity contracts", () => {
  const p = prospect();
  const account = prospectAccount(p);
  assert.equal(account.accountStatus, "Researched");
  assert.equal(account.stakeholderStatus, "Hypothesised buying role");
  assert.equal(account.priority, "High");
  assert.ok(account.stakeholderEvidence.includes(p.contact.officialChannel));
  const activities = prospectActivities(p);
  assert.equal(activities.length, 2);
  assert.ok(activities[0].nextAction.includes(p.outreach.email));
  assert.ok(activities[1].nextAction.includes(p.outreach.followUpEmail));
  assert.ok(activities.every(a => a.activityStatus === "Planned" && a.responseStatus === "Not waiting"));
  p.outreach.email = "x".repeat(4001);
  assert.throws(() => prospectActivities(p), /rather than truncating/);
});
test("aviation suppliers retain their own classification instead of becoming ground handlers", () => {
  const p = prospect();
  p.segment = "Aviation supplier";
  const account = prospectAccount(p);
  assert.equal(account.segment, "Aviation supplier");
  assert.equal(account.company_type, "Aviation supplier");
});
test("official channels and professional contact references require retained dated evidence", () => {
  for (const field of ["sourceUrl", "officialChannel"]) {
    const b = bundle();
    b.prospects[0].contact[field] = "https://example.com/not-retained";
    assert.throws(() => validatePhase77Bundle(b), /contact channel lacks a retained source/);
  }
  const b = bundle();
  b.prospects[0].contact.verifiedAt = "not-a-date";
  assert.throws(() => validatePhase77Bundle(b), /Contact verification time/);
});
test("a sourced public business email is retained without inventing a named contact", () => {
  const b = bundle();
  const p = b.prospects[0];
  p.contact.email = "sales@example.com";
  validatePhase77Bundle(b);
  assert.ok(prospectAccount(p).stakeholderEvidence.includes("Public business email: sales@example.com"));
  assert.equal(prospectContact(p), null);
  p.contact.email = "not a valid email";
  assert.throws(() => validatePhase77Bundle(b), /Invalid professional email/);
});
test("role hypotheses never become fabricated people or relationship-verified contacts", () => {
  const p = prospect();
  assert.equal(prospectContact(p), null);
  p.contact.name = "Synthetic professional";
  p.contact.jobTitle = "Test procurement director";
  const contact = prospectContact(p);
  assert.equal(contact.identityStatus, "Publicly identified person");
  assert.equal(contact.relationshipStatus, "Identified");
  assert.equal(contact.email, undefined);
  assert.equal(contact.retentionReviewDate, "2027-02-09");
  assert.ok(contact.lawfulBasisDetails.includes("before any outreach"));
});
test("prepared article keeps editorial SEO distinct from absent gateway processing and portrait", () => {
  const a = article();
  const prepared = prepareArticle(a, founderId, founderId);
  assert.equal(prepared.author_id, founderId);
  assert.equal(prepared.author_avatar_media, null);
  assert.equal(prepared.is_indexable, false);
  assert.equal(prepared.seo_title, a.metadata.seo_title);
  const approvedMedia = "22222222-2222-4222-8222-222222222222";
  assert.equal(prepareArticle(a, founderId, founderId, approvedMedia).author_avatar_media, approvedMedia);
  a.author_id = "22222222-2222-4222-8222-222222222222";
  assert.throws(() => prepareArticle(a, founderId, founderId), /differs/);
  a.author_id = founderId; a.ai_analysis = { provider: "invented" };
  assert.throws(() => prepareArticle(a, founderId, founderId), /masquerade/);
});
test("owner-approved existing author images use decoded, size-bounded media without generating a portrait", async () => {
  const source = createCanvas(2000, 1000).toBuffer("image/png");
  const result = await preparePhase77AuthorPhotograph(source);
  const decoded = await loadImage(result.bytes);
  assert.equal(decoded.width, 1600);
  assert.equal(decoded.height, 800);
  assert.ok(result.caption.includes("approved by the owner for local Blog reuse"));
  await assert.rejects(preparePhase77AuthorPhotograph(Buffer.from("not an image")));
});
test("safe local target requires the named database, explicit loopback port and physical data directory", async () => {
  await assertPhase77LocalTarget(localClient(), { database: "operion_p77b_oci", dataDirectory });
  for (const [client, options] of [
    [localClient({ connectionParameters: { host: "db.production.supabase.co", port: 55477 } }), { database: "operion_p77b_oci", dataDirectory }],
    [localClient({ connectionParameters: { host: "127.0.0.1", port: 5432 } }), { database: "operion_p77b_oci", dataDirectory }],
    [localClient(), { database: "postgres", dataDirectory }],
    [localClient(), { database: "operion_p77b_oci", dataDirectory: String.raw`C:\different` }],
    [localClient(), { database: "operion_p77b_oci" }],
  ]) await assert.rejects(assertPhase77LocalTarget(client, options));
});
test("both import entry points reject remote clients before executing any write", async () => {
  let queries = 0;
  const remote = { connectionParameters: { host: "db.production.supabase.co", port: 5432 },
    query: async () => { queries++; throw new Error("Remote query must not happen."); } };
  await assert.rejects(importOciProspects(remote, { prospects: [], founderId, dataDirectory }));
  await assert.rejects(importBlogArticles(remote, { articles: [], founderId, dataDirectory }));
  assert.equal(queries, 0);
});
test("original featured diagrams are ten distinct decoded 1200x630 WebP images, never portraits", async () => {
  const hashes = [];
  for (let index = 0; index < 10; index++) {
    const image = await createPhase77FeaturedImage(article(index + 1), index);
    assert.ok(image.bytes.length < 3145728);
    const decoded = await loadImage(image.bytes);
    assert.equal(decoded.width, 1200); assert.equal(decoded.height, 630);
    assert.ok(image.caption.includes("no third-party imagery or founder portrait"));
    hashes.push(bundleHash([...image.bytes]));
  }
  assert.equal(new Set(hashes).size, 10);
  await assert.rejects(createPhase77FeaturedImage(article(), 10));
});
