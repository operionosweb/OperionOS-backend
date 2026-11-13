import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const resolveDir = fileURLToPath(new URL("..", import.meta.url));
const ACTOR = "acaabfe0-83ee-4ec5-8721-c312b9317f54";
const OTHER = "bcaabfe0-83ee-4ec5-8721-c312b9317f54";
const SEO_SCORE_IDS = [
  "seo_title_length", "meta_description_length", "primary_keyword", "keyword_placement",
  "heading_structure", "content_quality", "search_intent_alignment", "readability",
  "internal_linking", "image_alt_text", "url_slug", "duplicate_content", "aviation_relevance",
];
const fixtureApi = `
  const ACTOR=${JSON.stringify(ACTOR)}, OTHER=${JSON.stringify(OTHER)};
  const clone = value => JSON.parse(JSON.stringify(value));
  let post = { id: OTHER, title: "Local aviation fixture", slug: "local-aviation-fixture", status: "draft", category: "Aircraft Leasing", content: clone(window.fixtureContent || []), tags: [], updated_at: "2030-01-01T10:00:00Z", created_by: ACTOR, author_name: "Local Fixture Author", author_id: ACTOR, author_avatar_media: null, seo_title: null, seo_description: null, social_title:null, social_description:null };
  let categories = [{id:"fixture-aircraft-leasing",name:"Aircraft Leasing",slug:"aircraft-leasing",description:""}];
  window.fixtureCalls = [];
  window.fixtureUploads = [];
  export async function apiRequest(path, options = {}) {
    window.fixtureCalls.push({path, ...options});
    const body = options.body;
    if (path === "/api/blog/admin/posts") {
      if (options.method === "POST") { post = {...body,id:OTHER,author_id:ACTOR,author_name:"Local Fixture Author",updated_at:new Date().toISOString()}; return { post: clone(post) }; }
      if (window.fixturePostsDeferred) return await new Promise(resolve => { window.resolveFixturePosts = resolve; });
      if (window.fixturePostsUnavailable) throw new Error("Blog service is unavailable.");
      if (window.fixturePostsInvalid) return null;
      return { posts: [clone(post)] };
    }
    if (path === "/api/blog/admin/posts/"+OTHER) {
      if (options.method === "PUT") { if (body.expected_updated_at !== post.updated_at) throw new Error("Stale fixture revision"); post={...body,updated_at:new Date().toISOString()}; }
      return {post:clone(post)};
    }
    if (path === "/api/blog/admin/posts/"+OTHER+"/publish") {
      if (!body.confirm_review || body.expected_updated_at !== post.updated_at) throw new Error("Missing editorial revision approval");
      post = {...post,status:"published",published_at:new Date().toISOString()}; return {post:clone(post)};
    }
    if (path === "/api/blog/admin/categories" && !options.method) return {categories:clone(categories)};
    if (path === "/api/blog/admin/categories" && options.method === "POST") {
      if (categories.some(category => category.name.toLowerCase()===body.name.toLowerCase() || category.slug===body.slug)) throw new Error("A category with this name or slug already exists.");
      const category={...body,id:"fixture-new-category"}; categories.push(category); return {category:clone(category)};
    }
    if (path === "/api/blog/admin/posts/"+OTHER+"/analyze") {
      if (window.fixtureAnalysisFailure) throw new Error("AI analysis is unavailable. No score was generated or saved; retry after the provider is available.");
      return {analysis:clone(window.fixtureAnalysis)};
    }
    if (path === "/api/blog/admin/profile") return {profile:{author_name:"Local Fixture Author",author_bio:"In-memory fixture",author_avatar_media:null}};
    if (path === "/api/blog/admin/media") return {media:[]};
    if (path.startsWith("/api/platform-admin/summary")) return {metrics:{users:1,contracts:0},sources:{users:"Local isolated test fixture, not production",contracts:"Local fixture"},activity:[{day:"2030-01-01",events:2}],events:[],dependencies:[{name:"fixture_missing_table",available:false}],unavailable:["Revenue unavailable"],generatedAt:"2030-01-01T10:00:00Z"};
    if (path === "/api/admin/health") { if (window.fixtureHealthDeferred) return await new Promise(resolve => { window.resolveFixtureHealth = resolve; }); if (window.fixtureHealthUnavailable) throw new Error("Health check unavailable."); return {admin_system:"healthy",timestamp:"2030-01-01T10:00:00Z"}; }
    if (path === "/api/platform-admin/contract-intelligence") return {metrics:[
      {key:"clauses",label:"Extracted clause records",value:0,available:true,source:"Synthetic source with repeated analyses."},
      {key:"risks",label:"Identified risk records",value:null,available:false,source:"Synthetic missing source."}
    ],generatedAt:"2030-01-01T10:00:00Z"};
    if (path.startsWith("/api/platform-admin/users?")) return {users:[{id:OTHER,email:"fixture@example.test",full_name:"Local Fixture User",roles:[],organizations:[],created_at:"2030-01-01",last_sign_in_at:null,email_confirmed_at:"2030-01-01"}],page:1,total:1};
    if (path === "/api/platform-admin/users/"+OTHER) return {user:{id:OTHER,email:"fixture@example.test",full_name:"Local Fixture User"},history:[]};
    if (path.startsWith("/api/platform-admin/organizations?")) return {organizations:[],page:1,total:0};
    if (path === "/api/platform-admin/users" && options.method === "POST") return {accountCreated:true,emailRequested:true,message:"Local fixture account creation recorded"};
    if (path === "/api/platform-admin/organizations" && options.method === "POST") return {organization:{id:OTHER,name:body.name}};
    throw new Error("Unexpected isolated API: "+path);
  }
  export async function apiUpload(path, options = {}) {
    window.fixtureUploads.push({path,fields:options.fields});
    return {media:{id:"dcaabfe0-83ee-4ec5-8721-c312b9317f54",alt_text:options.fields.alt_text,caption:options.fields.caption||"",mime_type:"image/webp"}};
  }
`;
async function bundle(section) {
  const result = await build({
    stdin: { contents: `
      import React from "react"; import { createRoot } from "react-dom/client"; import { MemoryRouter } from "react-router-dom";
      import BlogCMS from "./src/routes/BlogCMS"; import AdminCommandCentre from "./src/routes/AdminCommandCentre";
      import { DemoDisclosure } from "./src/demo/DemoUI";
      createRoot(document.getElementById("root")).render(<MemoryRouter>${section === "disclosure" ? "<DemoDisclosure/>" : section === "studio" ? "<BlogCMS/>" : `<AdminCommandCentre section=${JSON.stringify(section)}/>`}</MemoryRouter>);
    `, loader: "jsx", resolveDir },
    bundle: true, write: false, platform: "browser", format: "iife", loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
    plugins: [{ name: "isolated-phase76", setup(plugin) {
      plugin.onLoad({filter:/[\\/]lib[\\/]apiClient\.js$/}, () => ({contents:fixtureApi,loader:"js"}));
      plugin.onLoad({filter:/[\\/]context[\\/]AuthContext\.jsx$/}, () => ({contents:`export function useAuth(){return {user:{id:${JSON.stringify(ACTOR)}},session:null};}`,loader:"js"}));
    } }],
  });
  return result.outputFiles[0].text;
}
const css = (await Promise.all(["public\\blog.css", "src\\styles\\admin.css", "src\\styles\\publishing.css"].map(path => readFile(`${resolveDir}\\${path}`, "utf8")))).join("\n");
async function fixture(section, width, run, setup) {
  const script = await bundle(section);
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({viewport:{width,height:1000}});
    await context.route("**/*", route => route.abort());
    const page = await context.newPage(); const errors=[];
    page.setDefaultTimeout(10000);
    page.on("pageerror", e => errors.push(e.message));
    await page.setContent('<div id="root"></div>'); await page.addStyleTag({content:css});
    if (setup) await setup(page);
    await page.addScriptTag({content:script});
    await run(page);
    assert.deepEqual(errors, [], "No runtime page errors in tested isolated journey");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    assert.equal(overflow, false, "Page must not overflow horizontally");
  } finally { await browser.close(); }
}
for (const width of [1440,768,390,320]) {
  test(`Command Centre renders source-labelled metrics and section navigation at ${width}px`, async () => {
    await fixture("overview", width, async page => {
      await page.getByRole("heading",{name:"Super Admin Command Centre",exact:true}).waitFor();
      await page.getByText("Local isolated test fixture, not production",{exact:true}).waitFor();
      await page.getByRole("heading",{name:"Global contract intelligence",exact:true}).waitFor();
      const available = page.locator("article").filter({hasText:"Extracted clause records"});
      const missing = page.locator("article").filter({hasText:"Identified risk records"});
      assert.equal(await available.locator("strong").innerText(), "0");
      assert.equal(await missing.locator("strong").innerText(), "Unavailable");
      await page.getByText(/Cross-customer peer benchmarking is unavailable/).waitFor();
      await page.getByText(/Unavailable: schema object not found/).waitFor();
      assert.equal(await page.getByRole("link",{name:"Publishing Studio",exact:true}).count(),1);
      assert.equal(await page.getByRole("link",{name:"Commercial Intelligence",exact:true}).count(),1);
    });
  });
}
test("a failed health recheck clears the previous success", async () => {
  await fixture("overview",1440,async page => {
    const check = page.getByRole("button",{name:"Check protected API health"});
    await check.click();
    await page.getByText(/healthy/,{exact:false}).waitFor();
    await page.getByText(/Blog and OCI persistence not checked/).waitFor();
    await page.evaluate(() => { window.fixtureHealthUnavailable = true; });
    await check.click();
    await page.getByRole("alert").filter({hasText:"Health check unavailable."}).waitFor();
    assert.equal(await page.getByText(/healthy/,{exact:false}).count(),0);
    await page.evaluate(() => { window.fixtureHealthDeferred = true; });
    await check.click();
    await page.waitForFunction(() => typeof window.resolveFixtureHealth === "function");
    await page.evaluate(() => { window.fixtureHealthDeferred = false; });
    await check.click();
    await page.getByRole("alert").filter({hasText:"Health check unavailable."}).waitFor();
    await page.evaluate(() => window.resolveFixtureHealth({admin_system:"healthy",timestamp:"2030-01-01T10:00:00Z"}));
    await page.waitForTimeout(100);
    assert.equal(await page.getByText(/healthy/,{exact:false}).count(),0);
  });
});
test("a failed article refresh hides stale records and counts", async () => {
  await fixture("studio",1440,async page => {
    const article = page.locator(".op-blog-cms-list-item").filter({hasText:"Local aviation fixture"});
    await article.click();
    await page.getByText(/Article management · 1 actual records/).waitFor();
    await page.evaluate(() => { window.fixturePostsUnavailable = true; });
    await page.getByLabel("Article title",{exact:true}).fill("Updated fixture");
    await page.getByRole("button",{name:"Save draft",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"Blog service is unavailable."}).waitFor();
    await page.getByText("Article list unavailable. Resolve the error before creating content.",{exact:true}).waitFor();
    assert.equal(await page.locator(".op-blog-cms-list-item").count(),0);
    assert.equal(await page.getByText(/Article management ·/).count(),0);
    assert.equal(await page.locator(".op-publishing-metrics").count(),0);
    assert.equal(await page.locator(".op-blog-cms-list-heading span").count(),0);
    await page.evaluate(() => { window.fixturePostsUnavailable = false; window.fixturePostsInvalid = true; });
    await page.getByLabel("Article title",{exact:true}).fill("Updated fixture again");
    await page.getByRole("button",{name:"Save draft",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"Article list response is invalid."}).waitFor();
    assert.equal(await page.locator(".op-publishing-metrics").count(),0);
  });
});
test("an older article response cannot hide a newer refresh failure", async () => {
  await fixture("studio",1440,async page => {
    await page.waitForFunction(() => typeof window.resolveFixturePosts === "function");
    await page.evaluate(() => { window.fixturePostsDeferred = false; window.fixturePostsUnavailable = true; });
    await page.getByLabel("Article title",{exact:true}).fill("New local fixture");
    await page.getByRole("button",{name:"Save draft",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"Blog service is unavailable."}).waitFor();
    await page.evaluate(() => window.resolveFixturePosts({posts:[{id:"old",title:"Stale fixture",status:"draft"}]}));
    await page.waitForTimeout(100);
    await page.getByText("Article list unavailable. Resolve the error before creating content.",{exact:true}).waitFor();
    assert.equal(await page.locator(".op-blog-cms-list-item").count(),0);
    assert.equal(await page.locator(".op-publishing-metrics").count(),0);
  }, async page => { await page.evaluate(() => { window.fixturePostsDeferred = true; }); });
});
test("user administration submits Auth account creation with a reason and exposes no secret fields", async () => {
  await fixture("users",1440,async page => {
    await page.getByRole("button",{name:"Local Fixture User",exact:true}).waitFor();
    const form = page.getByRole("heading",{name:"Create account & request setup email"}).locator("..").locator("form");
    await form.getByLabel("Full name").fill("Created Local Fixture");
    await form.getByLabel("Email").fill("created@example.test");
    await form.getByLabel("Reason").fill("Isolated browser acceptance");
    await form.getByRole("button").click();
    await page.getByText("Local fixture account creation recorded",{exact:true}).waitFor();
    const call = await page.evaluate(() => window.fixtureCalls.find(c => c.method==="POST"));
    assert.equal(call.path,"/api/platform-admin/users"); assert.equal(call.body.email,"created@example.test");
    assert.ok(!("password" in call.body));
  });
});
test("publishing studio rich formatting survives save/reopen and reviewed revision publication", async () => {
  await fixture("studio",1440,async page => {
    await page.getByRole("heading",{name:"Insights CMS"}).waitFor();
    await page.locator(".op-blog-cms-list-item").filter({hasText:"Local aviation fixture"}).click();
    await page.getByLabel("Article title",{exact:true}).fill("Verified rich aviation fixture");
    await page.getByRole("button",{name:"Add block",exact:true}).click();
    const editor = page.getByRole("textbox",{name:"Rich article content"});
    await editor.waitFor();
    await page.getByRole("button",{name:"Bold",exact:true}).click();
    await editor.pressSequentially("Saved aviation evidence formatting.");
    await page.getByRole("button",{name:"Save draft",exact:true}).click();
    await page.getByText("Draft saved.",{exact:true}).waitFor();
    let saved = await page.evaluate(() => window.fixtureCalls.filter(c=>c.method==="PUT").at(-1).body);
    assert.ok(saved.content[0].document.content[0].content.some(t=>t.marks?.some(m=>m.type==="bold")));
    await page.locator(".op-blog-cms-list-item").filter({hasText:"Verified rich aviation fixture"}).click();
    await editor.locator("strong").getByText("Saved aviation evidence formatting.",{exact:true}).waitFor();
    const approval = page.getByRole("checkbox",{name:/reviewed/});
    await approval.check();
    await page.getByRole("button",{name:"Publish",exact:true}).click();
    await page.getByText("Article published.",{exact:true}).waitFor();
    const published = await page.evaluate(() => window.fixtureCalls.find(c=>c.path.endsWith("/publish")));
    assert.equal(published.body.confirm_review,true); assert.ok(published.body.expected_updated_at);
    assert.equal(await page.getByLabel("Article title",{exact:true}).isDisabled(),true);
  });
});
test("publishing studio loads the real editor layout on mobile without runtime errors", async () => {
  await fixture("studio",390,async page => {
    await page.getByRole("heading",{name:"Insights CMS"}).waitFor();
    await page.locator(".op-blog-cms-list-item").filter({hasText:"Local aviation fixture"}).click();
    await page.getByRole("button",{name:"Add block",exact:true}).click();
    await page.getByRole("textbox",{name:"Rich article content"}).waitFor();
  });
});
test("rich-text toolbar formats content and inserts accessible structured image blocks", async () => {
  await fixture("studio",1440,async page => {
    await page.locator(".op-blog-cms-list-item").filter({hasText:"Local aviation fixture"}).click();
    await page.getByRole("button",{name:"Add block",exact:true}).click();
    const editor = page.getByRole("textbox",{name:"Rich article content"});
    await editor.fill("Aviation formatting sample");
    await editor.press("Control+A");
    for (const mark of ["Bold","Italic","Underline"]) await page.getByRole("button",{name:mark,exact:true}).click();
    const structure = page.getByLabel("Text structure");
    for (const [level, tag] of [["1","h1"],["2","h2"],["3","h3"]]) {
      await structure.selectOption(level);
      assert.ok(await editor.locator(tag).count()>=1,`${tag} formatting is applied`);
    }
    await structure.selectOption("paragraph");
    await page.getByLabel("Font family").selectOption("Georgia");
    await page.getByLabel("Font size").selectOption("20px");
    await page.getByLabel("Text colour").evaluate(element => { element.value="#183a57"; element.dispatchEvent(new Event("input",{bubbles:true})); element.dispatchEvent(new Event("change",{bubbles:true})); });
    await page.getByLabel("Highlight colour").evaluate(element => { element.value="#fff2b0"; element.dispatchEvent(new Event("input",{bubbles:true})); element.dispatchEvent(new Event("change",{bubbles:true})); });
    await page.getByRole("button",{name:"Align center"}).click();
    assert.match(await editor.locator("p").filter({hasText:"Aviation formatting sample"}).getAttribute("style"),/text-align:\s*center/);
    await page.getByRole("button",{name:"Bulleted list"}).click();
    assert.equal(await editor.locator("ul").count(),1);
    await page.getByRole("button",{name:"Numbered list"}).click();
    assert.equal(await editor.locator("ol").count(),1);
    page.once("dialog",dialog => dialog.accept("https://operionos.com/blog"));
    await page.getByRole("button",{name:"Link",exact:true}).click();
    assert.equal(await editor.locator("a").getAttribute("href"),"https://operionos.com/blog");
    await page.getByRole("button",{name:"Undo",exact:true}).click();
    await page.getByRole("button",{name:"Redo",exact:true}).click();
    await page.getByRole("button",{name:"Remove formatting"}).click();
    await page.getByRole("button",{name:"Insert image"}).click();
    const imageBlock = page.locator(".op-blog-block-editor").last();
    await page.getByLabel("Image alt text",{exact:true}).fill("Synthetic aircraft maintenance image");
    await imageBlock.locator('input[type="file"]').setInputFiles({name:"fixture.png",mimeType:"image/png",buffer:Buffer.from("synthetic image fixture")});
    await page.getByText("Image uploaded. It remains private until used in a published article.",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Save draft",exact:true}).click();
    await page.getByText("Draft saved.",{exact:true}).waitFor();
    const saved = await page.evaluate(() => window.fixtureCalls.filter(call=>call.method==="PUT").at(-1).body);
    assert.equal(saved.content[0].type,"rich_text");
    assert.equal(saved.content[1].type,"image");
    assert.equal(saved.content[1].alt,"Synthetic aircraft maintenance image");
    assert.equal(saved.content[1].mediaId,"dcaabfe0-83ee-4ec5-8721-c312b9317f54");
    assert.equal(await page.evaluate(() => window.fixtureUploads.length),1);
  });
});
for (const width of [1440,390]) {
  test(`body editor toolbar sticks only inside its scroll boundary at ${width}px`, async () => {
    await fixture("studio",width,async page => {
      await page.locator(".op-blog-cms-list-item").filter({hasText:"Local aviation fixture"}).click();
      const wrapper = page.locator(".op-rich-editor");
      await wrapper.waitFor();
      const insideScroll = await wrapper.evaluate(element => {
        element.scrollTop = Math.min(500, element.scrollHeight);
        const toolbar = element.querySelector(".op-rich-toolbar");
        const parent = element.getBoundingClientRect();
        const bar = toolbar.getBoundingClientRect();
        return {position:getComputedStyle(toolbar).position,overflow:getComputedStyle(toolbar).overflowX,maxScroll:element.scrollHeight-element.clientHeight,offset:bar.top-parent.top,barHeight:bar.height,buttonHeight:toolbar.querySelector("button").getBoundingClientRect().height};
      });
      assert.equal(insideScroll.position,"sticky");
      assert.ok(insideScroll.maxScroll>0,"long article body has an internal scroll range");
      assert.ok(Math.abs(insideScroll.offset)<=2,"toolbar remains pinned to the body editor boundary");
      if (width<600) {
        assert.equal(insideScroll.overflow,"auto");
        assert.ok(insideScroll.buttonHeight>=44,"mobile toolbar controls remain touch friendly");
        assert.ok(await wrapper.locator(".op-rich-toolbar").evaluate(element=>element.scrollWidth>element.clientWidth),"mobile controls can scroll horizontally");
      }
      const outsideScroll = await page.evaluate(() => {
        window.scrollTo(0,document.documentElement.scrollHeight);
        const editor=document.querySelector(".op-rich-editor"),toolbar=editor.querySelector(".op-rich-toolbar");
        return {position:getComputedStyle(toolbar).position,offset:toolbar.getBoundingClientRect().top-editor.getBoundingClientRect().top};
      });
      assert.equal(outsideScroll.position,"sticky");
      assert.ok(Math.abs(outsideScroll.offset)<=2,"toolbar follows its editor instead of the browser viewport");
    },async page => {
      await page.evaluate(() => {
        window.fixtureContent=[{type:"rich_text",document:{type:"doc",content:Array.from({length:32},(_,index)=>({type:"paragraph",content:[{type:"text",text:`Synthetic aviation paragraph ${index+1} provides enough editorial text to verify the contained formatting toolbar while reviewing a long article.`}]}))}}];
      });
    });
  });
}
test("Super Admin can add a category in the article editor and immediately select it", async () => {
  await fixture("studio",1440,async page => {
    await page.locator(".op-blog-cms-list-item").filter({hasText:"Local aviation fixture"}).click();
    await page.getByRole("button",{name:"Add Category"}).click();
    await page.getByLabel("Category name").fill("Engine Maintenance");
    await page.getByLabel("Category description (optional)").fill("Maintenance and reserve evidence.");
    await page.getByLabel("Category URL slug").fill("engine-maintenance");
    await page.getByRole("button",{name:"Save category and select"}).click();
    await page.getByText("Category “Engine Maintenance” created and selected.",{exact:false}).waitFor();
    assert.equal(await page.getByLabel("Aviation category").inputValue(),"Engine Maintenance");
    const request = await page.evaluate(() => window.fixtureCalls.find(call=>call.path==="/api/blog/admin/categories" && call.method==="POST"));
    assert.equal(request.body.slug,"engine-maintenance");
    assert.equal(request.body.description,"Maintenance and reserve evidence.");
    await page.getByRole("button",{name:"Save draft",exact:true}).click();
    await page.getByText("Draft saved.",{exact:true}).waitFor();
    const saved = await page.evaluate(() => window.fixtureCalls.filter(call=>call.method==="PUT").at(-1).body);
    assert.equal(saved.category,"Engine Maintenance");
  });
});
test("AI SEO analysis renders provider results, applies only selected suggestions, and supports retry", async () => {
  await fixture("studio",1440,async page => {
    await page.locator(".op-blog-cms-list-item").filter({hasText:"Local aviation fixture"}).click();
    await page.evaluate(ids => {
      window.fixtureAnalysis={
        overall_score:72,
        scores:Object.fromEntries(ids.map(id=>[id,{score:72,explanation:`Evidence for ${id}.`} ])),
        recommendations:[{category:"heading_structure",problem:"Headings are sparse.",why_it_matters:"Readers need topic boundaries.",improvement:"Add descriptive subheadings.",priority:"High"}],
        suggestions:{metadata:{seo_title:"Improved aviation article title"},primary_keyword:"aviation contract review",secondary_keywords:["maintenance reserves"],headings:["Evidence review"],internal_link_topics:["aircraft leasing"],article_structure:["Terms","Evidence","Review"],paragraph_improvements:[]},
        baseline:{seo_title:"",seo_description:""},
        provider:"mistral",
        disclaimer:"Editorial guidance only.",
        scoring_explanation:"Rounded mean of equally weighted categories.",
      };
      window.fixtureAnalysisFailure=true;
    },SEO_SCORE_IDS);
    await page.getByLabel("Authorized publishing-budget organization UUID").fill(OTHER);
    await page.getByLabel(/public-intended editorial content/).check();
    await page.getByRole("button",{name:"AI ANALYSE ARTICLE",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"No score was generated"}).waitFor();
    assert.equal(await page.getByRole("heading",{name:/SEO score/}).count(),0);
    await page.evaluate(() => {window.fixtureAnalysisFailure=false;});
    await page.getByRole("button",{name:"AI ANALYSE ARTICLE",exact:true}).click();
    await page.getByRole("heading",{name:"SEO score · 72/100"}).waitFor();
    await page.getByText("Heading structure and hierarchy",{exact:true}).first().waitFor();
    await page.getByText("Headings are sparse.",{exact:false}).waitFor();
    await page.getByRole("button",{name:"Apply seo title"}).click();
    assert.equal(await page.locator(".op-blog-seo-grid").getByLabel("SEO title").inputValue(),"Improved aviation article title");
    assert.equal(await page.getByRole("heading",{name:"SEO score · 72/100"}).count(),1);
    assert.equal(await page.getByRole("button",{name:"Reanalyse saved article"}).isDisabled(),true);
    assert.equal(await page.evaluate(() => window.fixtureCalls.filter(call=>call.method==="PUT").length),0,"Applying a suggestion does not silently persist article content");
  });
});
test("a new unsaved draft can be privately previewed without persistence", async () => {
  await fixture("studio",1440,async page => {
    await page.getByRole("heading",{name:"Insights CMS"}).waitFor();
    await page.getByLabel("Article title",{exact:true}).fill("Unsaved aviation editorial preview");
    await page.getByRole("button",{name:"Preview",exact:true}).click();
    await page.getByRole("heading",{name:"Unsaved aviation editorial preview",exact:true}).waitFor();
    await page.getByText("Private preview — not publicly published.",{exact:true}).waitFor();
    const writes = await page.evaluate(() => window.fixtureCalls.filter(call => ["POST","PUT"].includes(call.method)));
    assert.deepEqual(writes,[]);
    await page.getByRole("button",{name:"Back to editor"}).click();
    assert.equal(await page.getByLabel("Article title",{exact:true}).inputValue(),"Unsaved aviation editorial preview");
  });
});
test("Demo header uses compact expandable disclosure without hiding synthetic-data limitations", async () => {
  await fixture("disclosure",390,async page => {
    const details = page.locator("details");
    assert.equal(await details.evaluate(e => e.open),false);
    await page.getByText("Synthetic demo · illustrative data · View limitations",{exact:true}).click();
    assert.equal(await details.evaluate(e => e.open),true);
    await page.getByText(/Actual probabilistic forecasts remain unavailable and unvalidated/).waitFor();
  });
});
