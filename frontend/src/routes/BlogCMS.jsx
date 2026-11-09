import React, { useEffect, useMemo, useState } from "react";
import { Archive, ArrowLeft, Eye, FilePlus2, History, ImagePlus, Save, Send, Undo2 } from "lucide-react";
import { apiRequest, apiUpload } from "../lib/apiClient";
import { BLOG_CATEGORIES, slugFromTitle } from "../lib/blogContent";
import { blogMediaUrl } from "../lib/blogRendering";
import { BlogArticleBody } from "./Blog";
import { PrivateMediaImage } from "./Blog";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function blankArticle() {
  return {
    title: "",
    subtitle: "",
    slug: "",
    excerpt: "",
    content: [],
    cover_image: "",
    cover_image_alt: "",
    category: BLOG_CATEGORIES[0],
    author_name: "Operion",
    author_role: "",
    author_bio: "",
    author_url: "",
    seo_title: "",
    seo_description: "",
    canonical_url: "",
    social_title: "",
    social_description: "",
    is_indexable: true,
    status: "draft",
  };
}

function articleFromApi(post) {
  return { ...blankArticle(), ...post, content: Array.isArray(post.content) ? post.content : [] };
}

function Field({ label, hint, children }) {
  return <label className="op-blog-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function BlockEditor({ block, index, onChange, onRemove, uploadImage }) {
  const set = (values) => onChange(index, { ...block, ...values });
  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (file) uploadImage(file, block.alt, block.caption, (media) => set({ mediaId: media.id }));
    event.target.value = "";
  };

  return (
    <section className="op-blog-block-editor">
      <header><strong>{block.type.replaceAll("_", " ")}</strong><button type="button" className="op-blog-text-button" onClick={() => onRemove(index)}>Remove block</button></header>
      {block.type === "heading" && <>
        <select aria-label="Heading level" value={block.level} onChange={(event) => set({ level: Number(event.target.value) })}><option value="2">Heading 2</option><option value="3">Heading 3</option></select>
        <input aria-label="Heading text" value={block.text} onChange={(event) => set({ text: event.target.value })} maxLength="240" />
      </>}
      {block.type === "paragraph" && <textarea aria-label="Paragraph text" rows="5" value={block.text} onChange={(event) => set({ text: event.target.value })} maxLength="12000" />}
      {["unordered_list", "ordered_list"].includes(block.type) && <textarea aria-label="List items, one per line" rows="5" value={(block.items || []).join("\n")} onChange={(event) => set({ items: event.target.value.split(/\r?\n/) })} placeholder="One item per line" />}
      {block.type === "quote" && <>
        <textarea aria-label="Quote text" rows="3" value={block.text} onChange={(event) => set({ text: event.target.value })} maxLength="4000" />
        <input aria-label="Quote attribution" value={block.attribution} onChange={(event) => set({ attribution: event.target.value })} placeholder="Attribution (optional)" maxLength="240" />
      </>}
      {block.type === "table" && <textarea aria-label="Table rows" rows="5" value={(block.rows || []).map((row) => row.join(" | ")).join("\n")} onChange={(event) => set({ rows: event.target.value.split(/\r?\n/).map((row) => row.split("|").map((cell) => cell.trim())) })} placeholder={"Term | What to verify\nPayment date | Trigger and evidence"} />}
      {block.type === "link" && <>
        <input aria-label="Link text" value={block.text} onChange={(event) => set({ text: event.target.value })} placeholder="Link label" />
        <input aria-label="Link URL" type="url" value={block.href} onChange={(event) => set({ href: event.target.value })} placeholder="https://…" />
      </>}
      {block.type === "image" && <>
        {block.mediaId && <div className="op-blog-editor-image"><PrivateMediaImage mediaId={block.mediaId} alt={block.alt} /><span>Image uploaded</span></div>}
        <input aria-label="Image alt text" value={block.alt} onChange={(event) => set({ alt: event.target.value })} placeholder="Describe the image for accessibility" maxLength="300" />
        <input aria-label="Image caption" value={block.caption} onChange={(event) => set({ caption: event.target.value })} placeholder="Caption (optional)" maxLength="500" />
        <label className="op-blog-upload-button"><ImagePlus size={16} aria-hidden="true" />{block.mediaId ? "Replace image" : "Choose image"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!block.alt.trim()} onChange={handleImage} /></label>
      </>}
    </section>
  );
}

export default function BlogCMS() {
  const [posts, setPosts] = useState([]);
  const [post, setPost] = useState(blankArticle());
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [blockType, setBlockType] = useState("paragraph");
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function loadPosts() {
    setLoading(true);
    try {
      const result = await apiRequest("/api/blog/admin/posts");
      setPosts(result.posts || []);
    } catch (failure) {
      setError(failure.message || "Unable to load articles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPosts(); }, []);

  function startNew() {
    setSelectedId("");
    setPost(blankArticle());
    setPreview(false);
    setHistory([]);
    setError("");
    setMessage("");
  }

  async function selectPost(id) {
    setError("");
    setMessage("");
    setPreview(false);
    try {
      const result = await apiRequest(`/api/blog/admin/posts/${encodeURIComponent(id)}`);
      setPost(articleFromApi(result.post));
      setSelectedId(id);
      setHistory([]);
    } catch (failure) {
      setError(failure.message || "Unable to open article.");
    }
  }

  function change(field, value) {
    setPost((current) => ({ ...current, [field]: value }));
  }

  function changeTitle(value) {
    setPost((current) => ({
      ...current,
      title: value,
      slug: current.slugEdited ? current.slug : slugFromTitle(value),
      seo_title: current.seoTitleEdited ? current.seo_title : value.slice(0, 100),
      social_title: current.socialTitleEdited ? current.social_title : value.slice(0, 100),
    }));
  }

  function changeField(field, value) {
    setPost((current) => ({
      ...current,
      [field]: value,
      ...(field === "slug" ? { slugEdited: true } : {}),
      ...(field === "seo_title" ? { seoTitleEdited: true } : {}),
      ...(field === "social_title" ? { socialTitleEdited: true } : {}),
    }));
  }

  async function saveArticle() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = selectedId
        ? await apiRequest(`/api/blog/admin/posts/${encodeURIComponent(selectedId)}`, { method: "PUT", body: post })
        : await apiRequest("/api/blog/admin/posts", { method: "POST", body: post });
      setPost(articleFromApi(result.post));
      setSelectedId(result.post.id);
      await loadPosts();
      setMessage("Draft saved.");
      return result.post;
    } catch (failure) {
      setError(failure.message || "Unable to save article.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function publishArticle() {
    const saved = await saveArticle();
    if (!saved) return;
    try {
      const result = await apiRequest(`/api/blog/admin/posts/${encodeURIComponent(saved.id)}/publish`, { method: "POST" });
      setPost(articleFromApi(result.post));
      setMessage("Article published.");
      await loadPosts();
    } catch (failure) {
      setError(failure.message || "Unable to publish article.");
    }
  }

  async function changeStatus(action, successMessage) {
    if (!selectedId) return;
    setError("");
    try {
      const result = await apiRequest(`/api/blog/admin/posts/${encodeURIComponent(selectedId)}/${action}`, { method: "POST" });
      setPost(articleFromApi(result.post));
      setMessage(successMessage);
      await loadPosts();
    } catch (failure) {
      setError(failure.message || "Unable to update article status.");
    }
  }

  async function uploadImage(file, altText, caption, onUploaded) {
    if (!altText?.trim()) {
      setError("Add descriptive alt text before uploading an image.");
      return;
    }
    setError("");
    try {
      const result = await apiUpload("/api/blog/admin/media", { file, fields: { alt_text: altText, caption: caption || "" } });
      onUploaded(result.media);
      setMessage("Image uploaded. It remains private until used in a published article.");
    } catch (failure) {
      setError(failure.message || "Unable to upload image.");
    }
  }

  function uploadCover(event) {
    const file = event.target.files?.[0];
    if (file) uploadImage(file, post.cover_image_alt, "", (media) => change("cover_image", media.id));
    event.target.value = "";
  }

  function addBlock() {
    const defaults = {
      heading: { type: "heading", level: 2, text: "" },
      paragraph: { type: "paragraph", text: "" },
      unordered_list: { type: "unordered_list", items: [""] },
      ordered_list: { type: "ordered_list", items: [""] },
      quote: { type: "quote", text: "", attribution: "" },
      table: { type: "table", rows: [["Term", "Details"], ["", ""]] },
      link: { type: "link", text: "", href: "" },
      image: { type: "image", mediaId: "", alt: "", caption: "" },
    };
    change("content", [...post.content, defaults[blockType]]);
  }

  function changeBlock(index, nextBlock) {
    change("content", post.content.map((block, blockIndex) => blockIndex === index ? nextBlock : block));
  }

  function removeBlock(index) {
    change("content", post.content.filter((_block, blockIndex) => blockIndex !== index));
  }

  async function toggleHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    if (!selectedId) return;
    try {
      const result = await apiRequest(`/api/blog/admin/posts/${encodeURIComponent(selectedId)}/history`);
      setHistory(result.history || []);
      setHistoryOpen(true);
    } catch (failure) {
      setError(failure.message || "Unable to load article history.");
    }
  }

  const seoWarnings = useMemo(() => {
    const warnings = [];
    if (post.seo_title.length > 60) warnings.push("SEO title is longer than 60 characters.");
    if (post.seo_title.length > 0 && post.seo_title.length < 25) warnings.push("Consider a more descriptive SEO title.");
    if (post.seo_description.length > 160) warnings.push("Meta description is longer than 160 characters.");
    if (post.seo_description.length > 0 && post.seo_description.length < 70) warnings.push("Consider adding more useful detail to the meta description.");
    if (!post.cover_image && post.status === "published") warnings.push("A social sharing image can improve link previews.");
    return warnings;
  }, [post.seo_title, post.seo_description, post.cover_image, post.status]);

  return (
    <div className="op-blog-cms">
      <header className="op-blog-cms-header">
        <div><p className="op-blog-eyebrow">OPERION / EDITORIAL</p><h1>Insights CMS</h1><p>Manage aviation articles, publishing status and search metadata.</p></div>
        <button type="button" className="op-blog-button op-blog-button-primary" onClick={startNew}><FilePlus2 size={17} />New article</button>
      </header>
      {error && <div className="op-blog-message is-error" role="alert">{error}</div>}
      {message && <div className="op-blog-message" role="status">{message}</div>}
      <div className="op-blog-cms-layout">
        <aside className="op-blog-cms-list" aria-label="Articles">
          <div className="op-blog-cms-list-heading"><h2>All articles</h2><span>{posts.length}</span></div>
          {loading ? <p className="op-blog-muted">Loading articles…</p> : posts.length === 0 ? <p className="op-blog-muted">No articles yet. Create a draft to start.</p> : posts.map((item) => (
            <button type="button" key={item.id} className={`op-blog-cms-list-item${selectedId === item.id ? " is-active" : ""}`} onClick={() => selectPost(item.id)}>
              <span className={`op-blog-status is-${item.status}`}>{item.status}</span><strong>{item.title}</strong><small>{item.category || "Uncategorised"} · {item.slug}</small>
            </button>
          ))}
        </aside>

        <section className="op-blog-cms-editor" aria-label="Article editor">
          {!preview ? <>
            <div className="op-blog-editor-toolbar">
              <span>{selectedId ? `Editing · ${post.status}` : "New draft"}</span>
              <div>
                {selectedId && <button type="button" className="op-blog-button op-blog-button-secondary" onClick={() => setPreview(true)}><Eye size={16} />Preview</button>}
                <button type="button" className="op-blog-button op-blog-button-secondary" onClick={saveArticle} disabled={saving}><Save size={16} />{saving ? "Saving…" : "Save draft"}</button>
                {post.status !== "published" && <button type="button" className="op-blog-button op-blog-button-primary" onClick={publishArticle} disabled={saving}><Send size={16} />Publish</button>}
              </div>
            </div>
            <div className="op-blog-editor-section">
              <Field label="Article title"><input value={post.title} onChange={(event) => changeTitle(event.target.value)} maxLength="200" placeholder="A clear aviation question or insight" /></Field>
              <Field label="Subtitle"><input value={post.subtitle} onChange={(event) => change("subtitle", event.target.value)} maxLength="240" /></Field>
              <Field label="URL slug" hint="Changing a published slug creates a permanent redirect."><input value={post.slug} onChange={(event) => changeField("slug", slugFromTitle(event.target.value))} maxLength="120" /></Field>
              <Field label="Summary"><textarea rows="3" value={post.excerpt} onChange={(event) => change("excerpt", event.target.value)} maxLength="500" placeholder="A concise, factual description of the article" /></Field>
              <Field label="Aviation category"><select value={post.category} onChange={(event) => change("category", event.target.value)}>{BLOG_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field>
            </div>

            <div className="op-blog-editor-section">
              <div className="op-blog-editor-section-title"><div><p className="op-blog-eyebrow">CONTENT / SEMANTIC BLOCKS</p><h2>Article body</h2></div>
                <div className="op-blog-add-block"><select aria-label="Content block type" value={blockType} onChange={(event) => setBlockType(event.target.value)}>
                  <option value="paragraph">Paragraph</option><option value="heading">Heading</option><option value="unordered_list">Bulleted list</option><option value="ordered_list">Numbered list</option><option value="quote">Quote</option><option value="table">Table</option><option value="link">Link</option><option value="image">Image</option>
                </select><button type="button" className="op-blog-button op-blog-button-secondary" onClick={addBlock}>Add block</button></div>
              </div>
              <div className="op-blog-block-list">
                {post.content.map((block, index) => <BlockEditor key={`${index}-${block.type}`} block={block} index={index} onChange={changeBlock} onRemove={removeBlock} uploadImage={uploadImage} />)}
                {post.content.length === 0 && <p className="op-blog-muted">Add headings and paragraphs to build a readable, structured article.</p>}
              </div>
            </div>

            <div className="op-blog-editor-section op-blog-seo-grid">
              <div><p className="op-blog-eyebrow">EDITORIAL / AUTHOR</p><h2>Attribution</h2>
                <Field label="Author name"><input value={post.author_name} onChange={(event) => change("author_name", event.target.value)} maxLength="120" /></Field>
                <Field label="Author role or expertise"><input value={post.author_role} onChange={(event) => change("author_role", event.target.value)} maxLength="160" /></Field>
                <Field label="Author biography"><textarea rows="3" value={post.author_bio} onChange={(event) => change("author_bio", event.target.value)} maxLength="800" /></Field>
                <Field label="Author profile URL"><input type="url" value={post.author_url} onChange={(event) => change("author_url", event.target.value)} placeholder="https://…" /></Field>
              </div>
              <div><p className="op-blog-eyebrow">SEO / DISCOVERABILITY</p><h2>Search metadata</h2>
                <Field label="SEO title" hint={`${post.seo_title.length}/100 characters`}><input value={post.seo_title} onChange={(event) => changeField("seo_title", event.target.value)} maxLength="100" placeholder={post.title || "Defaults to article title"} /></Field>
                <Field label="Meta description" hint={`${post.seo_description.length}/200 characters`}><textarea rows="3" value={post.seo_description} onChange={(event) => change("seo_description", event.target.value)} maxLength="200" placeholder={post.excerpt || "Defaults to article summary"} /></Field>
                <Field label="Canonical URL" hint="Must match this article's Operion URL. Leave empty to use the default."><input type="url" value={post.canonical_url} onChange={(event) => change("canonical_url", event.target.value)} placeholder={`https://operionos.com/blog/${post.slug || "article-slug"}`} /></Field>
                <Field label="Social title"><input value={post.social_title} onChange={(event) => changeField("social_title", event.target.value)} maxLength="100" /></Field>
                <Field label="Social description"><textarea rows="2" value={post.social_description} onChange={(event) => change("social_description", event.target.value)} maxLength="200" /></Field>
                <label className="op-blog-checkbox"><input type="checkbox" checked={post.is_indexable} onChange={(event) => change("is_indexable", event.target.checked)} />Allow search engines to index this published article</label>
                {seoWarnings.length > 0 && <ul className="op-blog-seo-warnings">{seoWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
              </div>
            </div>

            <div className="op-blog-editor-section">
              <p className="op-blog-eyebrow">MEDIA / SOCIAL SHARING</p><h2>Cover image</h2>
              <Field label="Descriptive image alt text"><input value={post.cover_image_alt} onChange={(event) => change("cover_image_alt", event.target.value)} maxLength="300" /></Field>
              {post.cover_image && <div className="op-blog-cover-preview"><PrivateMediaImage mediaId={post.cover_image} alt={post.cover_image_alt} /><button type="button" className="op-blog-text-button" onClick={() => change("cover_image", "")}>Remove image</button></div>}
              <label className="op-blog-upload-button"><ImagePlus size={16} aria-hidden="true" />Upload PNG, JPEG or WebP (max 3 MB)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!post.cover_image_alt.trim()} onChange={uploadCover} /></label>
            </div>

            <div className="op-blog-editor-section op-blog-editor-footer">
              <div className="op-blog-editor-actions">
                {selectedId && post.status === "published" && <button type="button" className="op-blog-button op-blog-button-secondary" onClick={() => changeStatus("unpublish", "Article unpublished and saved as a draft.")}><Undo2 size={16} />Unpublish</button>}
                {selectedId && post.status === "archived" && <button type="button" className="op-blog-button op-blog-button-secondary" onClick={() => changeStatus("restore", "Article restored as a draft.")}><Undo2 size={16} />Restore draft</button>}
                {selectedId && post.status !== "archived" && <button type="button" className="op-blog-button op-blog-button-danger" onClick={() => window.confirm("Archive this article? It will disappear from public pages and remain recoverable as a draft.") && changeStatus("archive", "Article archived.")}><Archive size={16} />Archive</button>}
                {selectedId && <button type="button" className="op-blog-button op-blog-button-secondary" onClick={toggleHistory}><History size={16} />{historyOpen ? "Hide history" : "History"}</button>}
              </div>
              {historyOpen && <ol className="op-blog-history">{history.map((event) => <li key={event.id}><strong>{event.action.replaceAll("_", " ")}</strong><time>{new Date(event.created_at).toLocaleString()}</time></li>)}</ol>}
            </div>
          </> : <>
            <div className="op-blog-editor-toolbar"><button type="button" className="op-blog-button op-blog-button-secondary" onClick={() => setPreview(false)}><ArrowLeft size={16} />Back to editor</button><span>Private draft preview</span></div>
            <article className="op-blog-article-page op-blog-preview-page">
              <p className="op-blog-eyebrow">{post.category}</p><h1>{post.title || "Untitled article"}</h1>
              {post.subtitle && <p className="op-blog-subtitle">{post.subtitle}</p>}
              {post.excerpt && <p className="op-blog-deck">{post.excerpt}</p>}
              <p className="op-blog-byline">{post.author_name}{post.author_role ? ` · ${post.author_role}` : ""}</p>
              {post.cover_image && <figure className="op-blog-cover"><PrivateMediaImage mediaId={post.cover_image} alt={post.cover_image_alt} /></figure>}
              <BlogArticleBody post={post} privateMedia />
              <p className="op-blog-editorial-note">Private preview — not publicly published.</p>
            </article>
          </>}
        </section>
      </div>
    </div>
  );
}
