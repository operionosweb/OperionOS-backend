import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const resolveDir = fileURLToPath(new URL("..", import.meta.url));
const ACTOR = "acaabfe0-83ee-4ec5-8721-c312b9317f54";
const OTHER = "bcaabfe0-83ee-4ec5-8721-c312b9317f54";
const fixtureApi = `
  const ACTOR=${JSON.stringify(ACTOR)}, OTHER=${JSON.stringify(OTHER)};
  const clone = value => JSON.parse(JSON.stringify(value));
  let post = { id: OTHER, title: "Local aviation fixture", slug: "local-aviation-fixture", status: "draft", category: "Aircraft Leasing", content: [], tags: [], updated_at: "2030-01-01T10:00:00Z", created_by: ACTOR, author_name: "Local Fixture Author", author_id: ACTOR, author_avatar_media: null, seo_title: null, seo_description: null, social_title:null, social_description:null };
  window.fixtureCalls = [];
  export async function apiRequest(path, options = {}) {
    window.fixtureCalls.push({path, ...options});
    const body = options.body;
    if (path === "/api/blog/admin/posts") {
      if (options.method === "POST") { post = {...body,id:OTHER,author_id:ACTOR,author_name:"Local Fixture Author",updated_at:new Date().toISOString()}; return { post: clone(post) }; }
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
    if (path === "/api/blog/admin/profile") return {profile:{author_name:"Local Fixture Author",author_bio:"In-memory fixture",author_avatar_media:null}};
    if (path === "/api/blog/admin/media") return {media:[]};
    if (path.startsWith("/api/platform-admin/summary")) return {metrics:{users:1,contracts:0},sources:{users:"Local isolated test fixture, not production",contracts:"Local fixture"},activity:[{day:"2030-01-01",events:2}],events:[],dependencies:[],unavailable:["Revenue unavailable"],generatedAt:"2030-01-01T10:00:00Z"};
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
  export async function apiUpload() { throw new Error("Upload not included in this browser fixture; backend image tests cover validation"); }
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
async function fixture(section, width, run) {
  const script = await bundle(section);
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({viewport:{width,height:1000}});
    await context.route("**/*", route => route.abort());
    const page = await context.newPage(); const errors=[];
    page.setDefaultTimeout(10000);
    page.on("pageerror", e => errors.push(e.message));
    await page.setContent('<div id="root"></div>'); await page.addStyleTag({content:css}); await page.addScriptTag({content:script});
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
      assert.equal(await page.getByRole("link",{name:"Publishing Studio",exact:true}).count(),1);
      assert.equal(await page.getByRole("link",{name:"Commercial Intelligence",exact:true}).count(),1);
    });
  });
}
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
    await page.getByRole("button",{name:"bold",exact:true}).click();
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
test("Demo header uses compact expandable disclosure without hiding synthetic-data limitations", async () => {
  await fixture("disclosure",390,async page => {
    const details = page.locator("details");
    assert.equal(await details.evaluate(e => e.open),false);
    await page.getByText("Synthetic demo · illustrative data · View limitations",{exact:true}).click();
    assert.equal(await details.evaluate(e => e.open),true);
    await page.getByText(/Actual probabilistic forecasts remain unavailable and unvalidated/).waitFor();
  });
});
