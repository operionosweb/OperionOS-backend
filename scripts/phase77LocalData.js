import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { createOciRepository } from "../repositories/ociRepository.js";
import { createOciService, validateOciData } from "../services/ociService.js";
import { mapLegacyCountry } from "../shared/ociGeography.js";
import { normalizeBlogPostInput } from "../frontend/src/lib/blogContent.js";

const segments = {
  Airline: ["Airline", "Airline"],
  "Aircraft leasing": ["Aircraft lessor", "Leasing company"],
  MRO: ["MRO", "MRO organisation"],
  "Aviation consultancy": ["Aviation consultancy", "Consultancy"],
  "Ground handling": ["Ground handling", "Ground handler"],
  "Airport operator": ["Airport operator", "Airport operator"],
};
const text = value => {
  assert.equal(typeof value, "string", "Required editorial or research text is missing.");
  assert.ok(value.trim(), "Required editorial or research text is empty.");
  return value.trim();
};
const lines = values => values.filter(Boolean).join("\n\n");
const sourceText = item => item.sources.map(source =>
  `${source.url} | verified ${source.verifiedAt} | ${source.description}`).join("\n");
const bounded = (value, limit, field) => {
  assert.ok(value.length <= limit, `${field} exceeds the existing application field limit; edit explicitly rather than truncating.`);
  return value;
};
function publicUrl(value) {
  const url = new URL(text(value));
  assert.equal(url.protocol, "https:", "Research sources must use HTTPS.");
  assert.ok(!url.username && !url.password, "Credentials are not allowed in source URLs.");
  return url;
}
export function bodyWordCount(article) {
  const body = [];
  for (const block of article.content) {
    if (block.type === "heading" && /^(references|sources|further reading)/i.test(block.text)) break;
    if (block.type === "paragraph" || block.type === "quote") body.push(block.text);
    if (block.items) body.push(...block.items);
    if (block.rows) body.push(...block.rows.flat());
  }
  return body.join(" ").match(/\b[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*\b/gu)?.length || 0;
}
export function bundleHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function prospectAccount(item) {
  const [segment, companyType] = segments[item.segment] || [];
  assert.ok(segment, `Unsupported researched segment: ${item.segment}`);
  const countryCode = mapLegacyCountry(item.country);
  assert.ok(countryCode, `Resolve country before importing ${item.name}`);
  const q = item.qualification;
  return validateOciData("accounts", {
    name: item.name, website: item.website, country: item.country,
    country_code: countryCode, headquarters: item.headquarters || undefined,
    segment, company_type: companyType, description: item.businessDescription,
    operationalLocations: item.operatingRegions.join("; "),
    contractActivities: bounded(lines([
      "Observed activities: " + item.aviationActivities.join("; "),
      ...item.verifiedFacts.map(fact => `${fact.fact} (${fact.sourceUrl})`),
    ]), 4000, "Contract activities"),
    contractUseCases: bounded(lines([
      "Analyst qualification, not customer-validated demand.",
      q.reasonToApproach, q.contractExposure,
      "Contract categories: " + q.contractCategories.join("; "),
      "Existing capability fit: " + q.existingOperionCapabilities.join("; "),
      "Hypothetical paid pilot: " + q.paidPilot,
    ]), 4000, "Use cases"),
    decisionDepartments: item.contact.targetRole,
    priority: { A: "High", B: "Medium", C: "Low" }[item.priority],
    accountStatus: "Researched", researchStatus: "Researched",
    stakeholderDepartment: item.contact.department,
    stakeholderStatus: item.contact.name ? "Publicly identified person" : "Hypothesised buying role",
    stakeholderEvidence: bounded(lines([
      item.contact.name ? `${item.contact.name}, ${item.contact.jobTitle}: ${item.contact.sourceUrl}`
        : "Role hypothesis only; no named decision-maker verified.",
      `Official company channel: ${item.contact.officialChannel}`,
      `Channel source: ${item.contact.sourceUrl}; verified ${item.contact.verifiedAt}`,
      "Not contacted; public availability does not establish a relationship or purchasing authority.",
    ]), 4000, "Stakeholder evidence"),
    needs: bounded(lines([
      "Hypotheses requiring discovery:", ...q.potentialChallenges,
      "No expressed demand or available customer budget has been verified.",
    ]), 4000, "Needs"),
    classification: "Research finding", source: bounded(sourceText(item), 4000, "Sources"),
    researchDate: item.contact.verifiedAt.slice(0, 10), confidence: "Medium",
    researchNotes: bounded(lines([
      `Phase77B research identifier: ${item.id}; commercial priority ${item.priority}.`,
      q.reasoning, "Objections: " + q.objections.join("; "),
      "Uncertainties: " + q.uncertainties.join("; "),
      item.ranking?.rank ? `Shortlist rank ${item.ranking.rank}: ${item.ranking.whyAttractive}` : "",
      "Target role: " + item.contact.targetRole,
      "Official channel: " + item.contact.officialChannel,
    ]), 4000, "Research notes"),
    nextAction: "Founder to review the linked draft outreach and sources before any contact.",
    relationshipHistory: "No outreach sent and no customer interaction established by this research.",
    data_origin: "Real",
  });
}
export function prospectActivities(item) {
  const o = item.outreach;
  return [
    validateOciData("activities", {
      title: bounded(`Draft outreach: ${item.name}`, 240, "Activity title"),
      type: "Email", activityStatus: "Planned", responseStatus: "Not waiting",
      nextAction: bounded(lines([
        "DRAFT ONLY - FOUNDER APPROVAL REQUIRED. Nothing has been sent.",
        `Opening: ${o.opening}`, `Reason: ${o.reason}`, `Challenge hypothesis: ${o.challenge}`,
        `Value proposition: ${o.valueProposition}`, `Recommended decision-maker: ${o.recommendedDecisionMaker}`,
        `Subject: ${o.subject}`, o.email, `Meeting request: ${o.meetingRequest}`,
      ]), 4000, "Initial outreach"),
      data_origin: "Real",
    }),
    validateOciData("activities", {
      title: bounded(`Draft follow-up: ${item.name}`, 240, "Activity title"),
      type: "Follow-up", activityStatus: "Planned", responseStatus: "Not waiting",
      nextAction: bounded(lines([
        "DRAFT ONLY - FOUNDER APPROVAL REQUIRED. No initial message has been sent.",
        o.followUpEmail, `Timing after an approved initial message: ${o.followUpTiming}`,
        "Timing is a recommendation, not an already scheduled or completed interaction.",
      ]), 4000, "Follow-up"),
      data_origin: "Real",
    }),
  ];
}
export function prospectContact(item) {
  const c = item.contact;
  if (!c.name) return null;
  const review = new Date(c.verifiedAt);
  review.setUTCDate(review.getUTCDate() + 90);
  return validateOciData("contacts", {
    name: c.name, jobTitle: c.jobTitle, email: c.email || undefined,
    decisionRole: c.targetRole, decisionDepartment: c.department,
    ...(c.profileUrl && new URL(c.profileUrl).hostname.endsWith("linkedin.com") ? { linkedinUrl: c.profileUrl } : {}),
    identityStatus: "Publicly identified person", relationshipStatus: "Identified",
    source: `${c.sourceUrl}; verified ${c.verifiedAt}`,
    lawfulBasis: "Legitimate interests",
    lawfulBasisDetails: "Limited public professional-role research for relevant aviation B2B prospect assessment. "
      + "Only official public role/contact information retained; no private data, profiling of individuals, "
      + "sensitive inference or communications sent. Role relevance is documented in the linked account. "
      + "Balance professional expectations against limited retention and access. Honour objection/erasure; "
      + "founder must review transparency and applicable direct-marketing rules before any outreach.",
    retentionReviewDate: review.toISOString().slice(0, 10),
    notes: lines([
      "Publicly identified only; no human interaction, purchasing authority or interest verified.",
      `Official business channel: ${c.officialChannel}`,
      c.profileUrl ? `Public professional profile: ${c.profileUrl}` : "",
    ]),
    nextAction: "Founder to verify role currency, lawful outreach conditions and transparency before contact.",
    data_origin: "Real",
  });
}
export function prepareArticle(item, founderId, coverImage, authorAvatar = null) {
  assert.equal(item.author_id, founderId, "Article author differs from verified founder.");
  assert.equal(item.author_name, "Meelis Paloson");
  assert.equal(item.status, "draft");
  assert.equal(item.ai_analysis, null, "Editorial metadata must not masquerade as gateway analysis.");
  assert.equal(item.author_avatar_media, null, "Approved owned author media is attached by the local importer, not embedded in the source bundle.");
  return {
    ...normalizeBlogPostInput({
      ...item, ...item.metadata, cover_image: coverImage,
      cover_image_alt: item.featuredImageBrief.alt,
      author_url: `https://operionos.com/blog/authors/${founderId}`,
      is_indexable: false, tags: item.tags,
    }),
    author_id: founderId, author_avatar_media: authorAvatar,
  };
}
export function validatePhase77Bundle({ prospects, articles, founderId }) {
  assert.ok(Array.isArray(prospects) && prospects.length >= 100, "At least 100 complete prospects are required.");
  assert.ok(Array.isArray(articles) && articles.length >= 10, "At least ten complete articles are required.");
  assert.equal(new Set(prospects.map(item => item.id)).size, prospects.length, "Duplicate research identity.");
  assert.equal(new Set(prospects.map(item => `${item.name.toLowerCase().trim()}|${item.country}`)).size, prospects.length);
  assert.equal(new Set(articles.map(item => item.slug)).size, articles.length, "Duplicate article slug.");
  const ranks = [];
  for (const item of prospects) {
    publicUrl(item.website);
    assert.ok(item.sources.length > 0 && item.verifiedFacts.length > 0, "Company evidence is missing.");
    for (const source of item.sources) {
      publicUrl(source.url); text(source.description);
      assert.ok(Number.isFinite(Date.parse(source.verifiedAt)), "Source verification time is missing.");
    }
    for (const fact of item.verifiedFacts) {
      text(fact.fact);
      assert.ok(item.sources.some(source => source.url === fact.sourceUrl), `${item.name}: fact lacks a retained source.`);
    }
    for (const key of ["reasonToApproach", "contractExposure", "paidPilot", "reasoning"]) text(item.qualification[key]);
    for (const key of ["contractCategories", "potentialChallenges", "existingOperionCapabilities", "objections", "uncertainties"]) {
      assert.ok(Array.isArray(item.qualification[key]) && item.qualification[key].length, `Missing ${key}`);
    }
    assert.ok(["A", "B", "C"].includes(item.priority));
    publicUrl(item.contact.officialChannel); publicUrl(item.contact.sourceUrl);
    for (const url of [item.contact.officialChannel, item.contact.sourceUrl]) {
      assert.ok(item.sources.some(source => source.url === url), `${item.name}: contact channel lacks a retained source.`);
    }
    assert.ok(Number.isFinite(Date.parse(item.contact.verifiedAt)), "Contact verification time is missing.");
    text(item.contact.targetRole);
    assert.equal(item.contact.relationshipStatus, "Not contacted");
    if (item.contact.name) { text(item.contact.jobTitle); text(item.contact.name); }
    for (const key of ["opening", "reason", "challenge", "valueProposition", "recommendedDecisionMaker",
      "subject", "email", "meetingRequest", "followUpEmail", "followUpTiming"]) text(item.outreach[key]);
    assert.equal(item.outreach.status, "Draft - founder approval required");
    if (item.ranking?.rank) ranks.push(item.ranking.rank);
    prospectAccount(item); prospectActivities(item); prospectContact(item);
  }
  assert.deepEqual(ranks.sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1), "Exactly twenty distinct shortlist ranks are required.");
  assert.equal(new Set(prospects.map(item => item.outreach.email)).size, prospects.length, "Duplicate outreach emails.");
  for (const item of articles) {
    const words = bodyWordCount(item);
    assert.ok(words >= 1500 && words <= 2200, `${item.slug}: ${words} body words; required 1500–2200.`);
    assert.ok(item.references.length >= 2, "Article requires reliable references.");
    for (const ref of item.references) {
      publicUrl(ref.url); text(ref.title); text(ref.supports);
      assert.ok(Number.isFinite(Date.parse(ref.verifiedAt)), "Reference verification time missing.");
    }
    for (const key of ["seo_title", "seo_description", "focus_keyword", "search_intent", "canonical_url",
      "social_title", "social_description", "imageRecommendation", "imageAlt"]) text(item.metadata[key]);
    for (const key of ["secondary_keywords", "related_keywords", "internalLinks", "relatedArticles"]) {
      assert.ok(item.metadata[key]?.length, `Missing metadata: ${key}`);
    }
    assert.equal(item.metadata.structuredData["@type"], "BlogPosting");
    assert.equal(item.metadata.structuredData.author.name, "Meelis Paloson");
    assert.ok(item.tags.length > 0);
    prepareArticle(item, founderId, "11111111-1111-4111-8111-111111111111");
  }
  return {
    researchedCompanies: prospects.length, completeOutreachPackages: prospects.length,
    officialChannels: prospects.length, namedPeople: prospects.filter(item => item.contact.name).length,
    shortlist: ranks.length,
    articles: articles.map(item => ({ slug: item.slug, title: item.title, bodyWords: bodyWordCount(item) })),
    automatedGatewayAnalyses: 0,
  };
}
export async function assertPhase77LocalTarget(client, { database, dataDirectory }) {
  assert.ok(["operion_p77b_oci", "operion_p77b_blog"].includes(database), "Only the new named Phase77B scratch databases are allowed.");
  assert.equal(client.connectionParameters.host, "127.0.0.1", "Only the explicit IPv4 loopback endpoint is allowed.");
  assert.equal(Number(client.connectionParameters.port), 55477);
  const { rows } = await client.query(`select current_database() as database,
    host(inet_server_addr()) as address, inet_server_port() as port,
    current_setting('data_directory') as directory`);
  assert.equal(rows[0].database, database);
  assert.equal(rows[0].address, "127.0.0.1");
  assert.equal(rows[0].port, 55477);
  assert.ok(dataDirectory && path.win32.isAbsolute(dataDirectory), "The session-owned absolute Windows data directory is required.");
  assert.equal(path.win32.normalize(rows[0].directory).toLowerCase(), path.win32.normalize(dataDirectory).toLowerCase());
}
export async function importOciProspects(client, { prospects, founderId, dataDirectory }) {
  await assertPhase77LocalTarget(client, { database: "operion_p77b_oci", dataDirectory });
  const service = createOciService(createOciRepository(client.query.bind(client)));
  const result = { createdAccounts: 0, retainedAccounts: 0, createdActivities: 0, createdContacts: 0 };
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(782134,22)");
    for (const item of prospects) {
      const data = prospectAccount(item);
      const existing = await client.query(`select * from public.oci_records
        where kind='accounts' and lower(btrim(data->>'name'))=lower($1)
        and lower(btrim(coalesce(data->>'country','')))=lower($2) and status='active'`, [data.name, data.country]);
      let account = existing.rows[0];
      if (account) {
        assert.deepEqual(account.data, data, `Existing ${item.name} was edited; preserve it and resolve the import conflict explicitly.`);
        result.retainedAccounts++;
      } else {
        account = await service.createRecord("accounts", { data }, founderId);
        result.createdAccounts++;
      }
      const contact = prospectContact(item);
      if (contact) {
        const found = await client.query(`select data from public.oci_records
          where kind='contacts' and account_id=$1 and data->>'name'=$2 and status='active'`, [account.id, contact.name]);
        if (found.rows.length) {
          assert.equal(found.rows.length, 1);
          assert.deepEqual(found.rows[0].data, contact, "Existing contact was edited; no overwrite permitted.");
        } else {
          await service.createRecord("contacts", { data: contact, accountId: account.id }, founderId);
          result.createdContacts++;
        }
      }
      for (const activity of prospectActivities(item)) {
        const found = await client.query(`select data from public.oci_records
          where kind='activities' and account_id=$1 and data->>'title'=$2 and status='active'`, [account.id, activity.title]);
        if (found.rows.length) {
          assert.equal(found.rows.length, 1);
          assert.deepEqual(found.rows[0].data, activity, "Existing outreach was edited; no overwrite permitted.");
        } else {
          await service.createRecord("activities", { data: activity, accountId: account.id }, founderId);
          result.createdActivities++;
        }
      }
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
export async function importBlogArticles(client, { articles, founderId, createFeaturedImage, dataDirectory, authorAvatar = null }) {
  await assertPhase77LocalTarget(client, { database: "operion_p77b_blog", dataDirectory });
  if (authorAvatar) {
    const owned = await client.query("select id from public.blog_media where id=$1 and created_by=$2", [authorAvatar, founderId]);
    assert.equal(owned.rowCount, 1, "The approved founder photograph must exist and belong to the same author.");
  }
  const result = { createdArticles: 0, retainedArticles: 0, createdImages: 0 };
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(760177)");
    for (let index = 0; index < articles.length; index++) {
      const item = articles[index];
      const existing = await client.query("select * from public.blog_posts where slug=$1", [item.slug]);
      if (existing.rows.length) {
        const current = existing.rows[0];
        const article = prepareArticle(item, founderId, current.cover_image, authorAvatar);
        for (const key of ["title", "subtitle", "excerpt", "content", "category", "tags", "seo_title",
          "seo_description", "canonical_url", "social_title", "social_description", "author_name", "author_id", "author_avatar_media"]) {
          assert.deepEqual(current[key] ?? "", article[key] ?? "", `Existing article ${item.slug} changed at ${key}; no overwrite permitted.`);
        }
        assert.equal(current.status, "draft", "Never overwrite or revert a reviewed/published article.");
        result.retainedArticles++;
        continue;
      }
      const media = await createFeaturedImage(item, index);
      assert.ok(Buffer.isBuffer(media.bytes) && media.bytes.length <= 3145728);
      assert.ok(media.bytes.subarray(0, 4).equals(Buffer.from("RIFF")) && media.bytes.toString("ascii", 8, 12) === "WEBP");
      await client.query(`insert into public.blog_media(id,mime_type,image_bytes,alt_text,caption,created_by)
        values($1,'image/webp',$2,$3,$4,$5)`, [media.id, media.bytes, item.featuredImageBrief.alt, media.caption, founderId]);
      const article = prepareArticle(item, founderId, media.id, authorAvatar);
      const inserted = await client.query(`insert into public.blog_posts(
        title,subtitle,slug,excerpt,content,cover_image,cover_image_alt,category,seo_title,seo_description,
        canonical_url,social_title,social_description,author_name,author_id,author_url,tags,is_indexable,status,
        created_by,updated_by,author_avatar_media,ai_analysis)
        values($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,false,'draft',$15,$15,$18,null)
        returning id`, [article.title, article.subtitle, article.slug, article.excerpt, JSON.stringify(article.content),
        article.cover_image, article.cover_image_alt, article.category, article.seo_title, article.seo_description,
        article.canonical_url, article.social_title, article.social_description, article.author_name,
        founderId, article.author_url, article.tags, article.author_avatar_media]);
      await client.query(`insert into public.blog_post_audit(post_id,actor_id,action,snapshot)
        values($1,$2,'created',$3::jsonb)`, [inserted.rows[0].id, founderId, JSON.stringify({
        source: "Phase77B explicit local-only import", contentHash: bundleHash(item),
        attribution: "Verified production UUID; founder-requested display name; local reference only, no Auth session",
        metadataPreparation: "Editorial", automatedGatewayAnalysis: "Pending",
        photograph: authorAvatar ? "Genuine existing website photograph; owner-approved local reuse" : "Unavailable",
        editorialMetadata: item.metadata, references: item.references,
        featuredImage: { mediaId: media.id, caption: media.caption, rights: "Original Operion editorial diagram; no third-party imagery." },
      })]);
      result.createdArticles++; result.createdImages++;
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
