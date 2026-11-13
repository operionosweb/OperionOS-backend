import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createBlogController } from "../controllers/blogController.js";
import { normalizeBlogCategory, normalizeBlogPostInput } from "../frontend/src/lib/blogContent.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ID = "fcaabfe0-83ee-4ec5-8721-c312b9317f54";

function responseRecorder() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("category names and slugs are normalized and strictly validated", () => {
  assert.deepEqual(normalizeBlogCategory({ name: "  Engine   Maintenance ", description: "  Practical guidance " }), {
    name: "Engine Maintenance",
    slug: "engine-maintenance",
    description: "Practical guidance",
  });
  assert.throws(() => normalizeBlogCategory({ name: "  " }), /Category name is required/);
  assert.throws(() => normalizeBlogCategory({ name: "Aviation", slug: "javascript:alert(1)" }), /lowercase letters/);
  assert.throws(() => normalizeBlogCategory({ name: "Aviation", slug: "bad--slug" }), /lowercase letters/);
});

test("Super Admin category API creates a category, rejects duplicates, and exposes it for article validation", async () => {
  const categories = [];
  const queryFn = async (sql, params = []) => {
    if (sql.includes("SELECT id FROM blog_categories WHERE lower(name)")) {
      return { rows: categories.filter(item => item.name.toLowerCase() === params[0].toLowerCase() || item.slug === params[1]).map(item => ({ id: item.id })) };
    }
    if (sql.includes("INSERT INTO blog_categories")) {
      const item = { id: ID, name: params[0], slug: params[1], description: params[2], created_by: params[3] };
      categories.push(item);
      return { rows: [{ id: item.id, name: item.name, slug: item.slug, description: item.description }] };
    }
    if (sql.includes("FROM blog_categories ORDER BY lower(name)")) return { rows: categories };
    if (sql.includes("SELECT name FROM blog_categories")) return { rows: categories.map(({ name }) => ({ name })) };
    return { rows: [] };
  };
  const controller = createBlogController({ database: {}, queryFn });
  const created = responseRecorder();
  await controller.createCategory({ user: { id: ID }, body: { name: "Engine Maintenance", slug: "engine-maintenance", description: "Reserve and maintenance evidence." } }, created);
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.category.created_by, undefined);
  assert.equal(categories[0].created_by, ID);

  const duplicateName = responseRecorder();
  await controller.createCategory({ user: { id: ID }, body: { name: "ENGINE maintenance", slug: "another-slug" } }, duplicateName);
  assert.equal(duplicateName.statusCode, 409);

  const duplicateSlug = responseRecorder();
  await controller.createCategory({ user: { id: ID }, body: { name: "Another category", slug: "engine-maintenance" } }, duplicateSlug);
  assert.equal(duplicateSlug.statusCode, 409);

  const list = responseRecorder();
  await controller.listCategories({}, list);
  assert.equal(list.body.categories[0].name, "Engine Maintenance");
  const article = normalizeBlogPostInput({
    title: "Engine maintenance obligations",
    category: "Engine Maintenance",
    content: [],
  }, { allowedCategories: ["Engine Maintenance"] });
  assert.equal(article.category, "Engine Maintenance");
});

test("category edits preserve database conflicts and deletion rejects assigned categories", async () => {
  let category = { id: ID, name: "Aircraft Leasing", slug: "aircraft-leasing", description: "" };
  let duplicate = false;
  let inUse = false;
  const queryFn = async (sql, params = []) => {
    if (sql.includes("SELECT id,name FROM blog_categories WHERE id=$1 FOR UPDATE")) {
      return { rows: category && params[0] === category.id ? [{ id: category.id, name: category.name }] : [] };
    }
    if (sql.includes("WHERE id<>$3")) return { rows: duplicate ? [{ id: "another-category" }] : [] };
    if (sql.includes("UPDATE blog_categories")) {
      category = { id: params[3], name: params[0], slug: params[1], description: params[2] };
      return { rows: [{ ...category }] };
    }
    if (sql.includes("SELECT 1 FROM blog_posts")) return { rows: inUse ? [{ "?column?": 1 }] : [] };
    if (sql.includes("DELETE FROM blog_categories")) {
      const deleted = category;
      category = null;
      return { rows: deleted ? [{ id: deleted.id, name: deleted.name }] : [] };
    }
    return { rows: [] };
  };
  const controller = createBlogController({ database: {}, queryFn });
  const request = (body = {}) => ({ params: { id: ID }, body });

  const updated = responseRecorder();
  await controller.updateCategory(request({ name: "Airframe Leasing", description: "Aircraft asset agreements." }), updated);
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.previous_name, "Aircraft Leasing");
  assert.equal(updated.body.category.name, "Airframe Leasing");

  duplicate = true;
  const conflict = responseRecorder();
  await controller.updateCategory(request({ name: "Duplicate Category" }), conflict);
  assert.equal(conflict.statusCode, 409);

  inUse = true;
  const blockedDelete = responseRecorder();
  await controller.deleteCategory(request(), blockedDelete);
  assert.equal(blockedDelete.statusCode, 409);
  assert.ok(category, "in-use category remains intact");

  inUse = false;
  const deleted = responseRecorder();
  await controller.deleteCategory(request(), deleted);
  assert.equal(deleted.statusCode, 200);
  assert.equal(deleted.body.category.name, "Airframe Leasing");
  assert.equal(category, null);
});

test("category migration preserves relationships and blocks direct user-role writes and in-use deletion", async () => {
  const migration = await fs.readFile(path.join(root, "supabase/migrations/037_blog_categories.sql"), "utf8");
  assert.match(migration, /FOREIGN KEY \(category\) REFERENCES public\.blog_categories\(name\)\s+ON UPDATE CASCADE ON DELETE RESTRICT/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON public\.blog_categories FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT SELECT, INSERT ON public\.blog_categories TO service_role/);
  assert.match(migration, /Case-conflicting Blog category values need review/);
});
