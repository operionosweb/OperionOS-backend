import React, { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowLeft, Eye, FilePlus2, History, ImagePlus, Save, Send, Undo2 } from "lucide-react";
import { apiRequest, apiUpload } from "../lib/apiClient";
import { BLOG_CATEGORIES, slugFromTitle } from "../lib/blogContent";
import { blogMediaUrl } from "../lib/blogRendering";
import { BlogArticleBody } from "./Blog";
import { PrivateMediaImage } from "./Blog";
import RichTextEditor from "../components/blog/RichTextEditor";
import { readingMinutes } from "../lib/richText";
import "../styles/publishing.css";

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
    author_name: "",
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
    tags: [],
    is_featured: false,
  };
}

function articleFromApi(post) {
  const defaults = blankArticle();
  const article = { ...defaults, ...post, content: Array.isArray(post.content) ? post.content : [] };
  for (const [key, value] of Object.entries(defaults)) if (typeof value === "string" && article[key] == null) article[key] = "";
  return article;
}

function Field({ label, hint, children }) {
  return <label className="op-blog-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function BlockEditor({ block, index, onChange, onRemove, onMove, last, uploadImage }) {
  const set = (values) => onChange(index, { ...block, ...values });
  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (file) uploadImage(file, block.alt, block.caption, (media) => set({ mediaId: media.id }));
    event.target.value = "";
  };

  return (
    <section className="op-blog-block-editor">
      <header><strong>{block.type.replaceAll("_", " ")}</strong><div><button type="button" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={`Move block ${index + 1} up`}>Move up</button><button type="button" disabled={last} onClick={() => onMove(index, 1)} aria-label={`Move block ${index + 1} down`}>Move down</button><button type="button" className="op-blog-text-button" onClick={() => onRemove(index)}>Remove block</button></div></header>
      {block.type === "rich_text" && <RichTextEditor document={block.document} onChange={(document) => set({ document })} />}
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
        <label>Image size<select value={block.size || "full"} onChange={e => set({ size: e.target.value })}><option value="compact">Compact (480px maximum)</option><option value="wide">Wide (800px maximum)</option><option value="full">Full article width</option></select></label><label>Image alignment<select value={block.alignment || "center"} onChange={e => set({ alignment: e.target.value })}>{["left", "center", "right"].map(a => <option key={a}>{a}</option>)}</select></label>
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
  const [blockType, setBlockType] = useState("rich_text");
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [media, setMedia] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("updated");
  const [saved, setSaved] = useState(() => JSON.stringify(blankArticle()));
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [autosave, setAutosave] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [aiOrganization, setAiOrganization] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [previewWidth, setPreviewWidth] = useState("desktop");
  const savingRef = useRef(false);
  const postsRequest = useRef(0);
  const postRef = useRef(post);
  postRef.current = post;

  async function loadPosts() {
    const request = ++postsRequest.current;
    setLoading(true);
    setPostsLoaded(false);
    try {
      const result = await apiRequest("/api/blog/admin/posts");
      if (request !== postsRequest.current) return;
      if (!Array.isArray(result?.posts)) throw new Error("Article list response is invalid.");
      setPosts(result.posts);
      setPostsLoaded(true);
    } catch (failure) {
      if (request === postsRequest.current) setError(failure.message || "Unable to load articles.");
    } finally {
      if (request === postsRequest.current) setLoading(false);
    }
  }

  useEffect(() => {
    loadPosts();
    apiRequest("/api/blog/admin/profile").then(result => setProfile(result.profile)).catch(failure => setError(failure.message));
    apiRequest("/api/blog/admin/media").then(result => setMedia(result.media)).catch(failure => setError(failure.message));
  }, []);

  const dirty = JSON.stringify(post) !== saved;
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!autosave || !selectedId || post.status !== "draft" || !dirty || saving) return undefined;
    const timeout = setTimeout(() => { saveArticle(); }, 1800);
    return () => clearTimeout(timeout);
  }, [autosave, post, selectedId, dirty, saving]);

  function startNew() {
    if (savingRef.current || (dirty && !window.confirm("Discard unsaved changes and start a new draft?"))) return;
    setSelectedId("");
    setPost(blankArticle());
    setPreview(false);
    setHistory([]);
    setError("");
    setMessage("");
    setSaved(""); setReviewed(false); setAnalysis(null);
  }

  async function selectPost(id) {
    if (savingRef.current || (dirty && !window.confirm("Discard unsaved changes and open another article?"))) return;
    setError("");
    savingRef.current = true;
    setMessage("");
    setPreview(false);
    try {
      const result = await apiRequest(`/api/blog/admin/posts/${encodeURIComponent(id)}`);
      const loaded = articleFromApi(result.post);
      setPost(loaded); setSaved(JSON.stringify(loaded)); setAnalysis(result.post.ai_analysis || null); setReviewed(false);
      setSelectedId(id);
      setHistory([]);
    } catch (failure) {
      setError(failure.message || "Unable to open article.");
    } finally { savingRef.current = false; }
  }

  function change(field, value) {
    setReviewed(false);
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
    if (savingRef.current || post.status !== "draft") return null;
    savingRef.current = true;
    const snapshot = post;
    setSaving(true);
    setError("");
    setReviewed(false);
    setMessage("");
    try {
      const result = selectedId
        ? await apiRequest(`/api/blog/admin/posts/${encodeURIComponent(selectedId)}`, { method: "PUT", body: { ...post, expected_updated_at: post.updated_at } })
        : await apiRequest("/api/blog/admin/posts", { method: "POST", body: post });
      const next = articleFromApi(result.post);
      if (postRef.current === snapshot) { setPost(next); setSaved(JSON.stringify(next)); }
      else {
        setPost(current => ({ ...current, id: next.id, updated_at: next.updated_at, author_id: next.author_id }));
        setSaved(JSON.stringify(next));
      }
      setSelectedId(result.post.id);
      await loadPosts();
      setMessage("Draft saved.");
      setAnalysis(null);
      return result.post;
    } catch (failure) {
      setError(failure.message || "Unable to save article.");
      setAutosave(false);
      return null;
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  async function publishArticle() {
    if (savingRef.current) return;
    if (!reviewed || dirty) { setError("Save the draft, review its current preview and confirm editorial approval before publishing."); return; }
    savingRef.current = true; setSaving(true); setError("");
    try {
      const result = await apiRequest(`/api/blog/admin/posts/${encodeURIComponent(selectedId)}/publish`, { method: "POST", body: { confirm_review: true, expected_updated_at: post.updated_at } });
      const next = articleFromApi(result.post); setPost(next); setSaved(JSON.stringify(next));
      setMessage("Article published.");
      await loadPosts();
    } catch (failure) {
      setError(failure.message || "Unable to publish article.");
    } finally { savingRef.current = false; setSaving(false); }
  }

  async function changeStatus(action, successMessage) {
    if (!selectedId || savingRef.current) return;
    if (!window.confirm(`Confirm ${action} for this article?${dirty ? " Unsaved changes will be discarded." : ""}`)) return;
    savingRef.current = true; setSaving(true);
    setError("");
    try {
      const result = await apiRequest(`/api/blog/admin/posts/${encodeURIComponent(selectedId)}/${action}`, { method: "POST" });
      const next = articleFromApi(result.post); setPost(next); setSaved(JSON.stringify(next));
      setMessage(successMessage);
      await loadPosts();
    } catch (failure) {
      setError(failure.message || "Unable to update article status.");
    } finally { savingRef.current = false; setSaving(false); }
  }

  async function uploadImage(file, altText, caption, onUploaded) {
    if (savingRef.current) return;
    if (!altText?.trim()) {
      setError("Add descriptive alt text before uploading an image.");
      return;
    }
    savingRef.current = true; setSaving(true);
    setError("");
    try {
      const result = await apiUpload("/api/blog/admin/media", { file, fields: { alt_text: altText, caption: caption || "" } });
      onUploaded(result.media);
      setMessage("Image uploaded. It remains private until used in a published article.");
      setMedia(current => [result.media, ...current]);
    } catch (failure) {
      setError(failure.message || "Unable to upload image.");
    } finally { savingRef.current = false; setSaving(false); }
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
      rich_text: { type: "rich_text", document: { type: "doc", content: [{ type: "paragraph" }] } },
    };
    change("content", [...post.content, defaults[blockType]]);
  }

  function changeBlock(index, nextBlock) {
    change("content", post.content.map((block, blockIndex) => blockIndex === index ? nextBlock : block));
  }

  function removeBlock(index) {
    change("content", post.content.filter((_block, blockIndex) => blockIndex !== index));
  }
  function moveBlock(index, direction) {
    const content = [...post.content];
    [content[index], content[index + direction]] = [content[index + direction], content[index]];
    change("content", content);
  }
  async function deleteArchived() {
    if (savingRef.current || post.status !== "archived") return;
    const title = window.prompt("Permanently delete this archived article? Type its exact title. Audits and shared images are retained.");
    if (title !== post.title) { if (title !== null) setError("Article title did not match; nothing was deleted."); return; }
    savingRef.current = true; setSaving(true); setError("");
    try {
      await apiRequest(`/api/blog/admin/posts/${selectedId}`, { method: "DELETE", body: { confirm_title: title, expected_updated_at: post.updated_at } });
      setSelectedId(""); setPost(blankArticle()); setSaved(JSON.stringify(blankArticle())); setReviewed(false); setAnalysis(null); setMessage("Archived article deleted; audit history and shared media retained."); await loadPosts();
    } catch (failure) { setError(failure.message); } finally { savingRef.current = false; setSaving(false); }
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

    async function saveProfile(event) {
      event.preventDefault();
      if (savingRef.current) return;
      savingRef.current = true; setSaving(true); setError("");
      try {
        const result = await apiRequest("/api/blog/admin/profile", { method: "PUT", body: Object.fromEntries(new FormData(event.currentTarget)) });
        setProfile(result.profile); setMessage("Author profile saved. Save your draft to refresh attribution.");
      } catch (failure) { setError(failure.message); } finally { savingRef.current = false; setSaving(false); }
    }
    async function runAnalysis() {
      if (savingRef.current) return;
      if (!selectedId || dirty) { setError("Save the complete article before AI analysis."); return; }
      savingRef.current = true;
      setSaving(true); setError("");
      try {
        const result = await apiRequest(`/api/blog/admin/posts/${selectedId}/analyze`, { method: "POST", body: { organization_id: aiOrganization, public_editorial_consent: aiConsent } });
        setAnalysis(result.analysis); setMessage("AI suggestions are unapproved. Review and apply only the fields you accept.");
      } catch (failure) { setError(failure.message); } finally { savingRef.current = false; setSaving(false); }
    }
    async function scheduleArticle() {
      if (savingRef.current) return;
      if (!reviewed || dirty || !scheduleAt) { setError("Save, review and choose a future local publication time."); return; }
      savingRef.current = true; setSaving(true); setError("");
      try {
        const result = await apiRequest(`/api/blog/admin/posts/${selectedId}/schedule`, { method: "POST", body: { published_at: new Date(scheduleAt).toISOString(), confirm_review: true, expected_updated_at: post.updated_at } });
        const next = articleFromApi(result.post); setPost(next); setSaved(JSON.stringify(next)); await loadPosts(); setMessage("Scheduled in UTC. Public reads remain blocked until the due time.");
      } catch (failure) { setError(failure.message); } finally { savingRef.current = false; setSaving(false); }
    }
    function duplicateArticle() {
      if (savingRef.current) return;
      if (dirty && !window.confirm("Discard unsaved changes and duplicate the saved article?")) return;
      const next = { ...post, id: undefined, title: `${post.title} (copy)`, slug: `${post.slug}-copy`, status: "draft", published_at: null, archived_at: null, canonical_url: "", ai_analysis: null };
      setPost(next); setSelectedId(""); setSaved(""); setAnalysis(null); setReviewed(false);
    }
    const visiblePosts = posts.filter(item => (filter === "all" || item.status === filter) && `${item.title} ${item.author_name || ""} ${item.category || ""}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : Date.parse(b.updated_at) - Date.parse(a.updated_at));

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
      {postsLoaded && <div className="op-publishing-metrics">{["draft", "published", "scheduled", "archived"].map(status => <article key={status}><span>{status}</span><strong>{posts.filter(item => item.status === status).length}</strong><small>Actual loaded records</small></article>)}</div>}
      {postsLoaded && <details className="op-studio-table"><summary>Article management · {posts.length} actual records</summary><div><table><thead><tr>{["Article", "Featured image", "Author", "Category", "Status", "Published (UTC)", "SEO", "Modified", "Action"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{visiblePosts.map(p => <tr key={p.id}><td>{p.title}</td><td>{p.cover_image ? <PrivateMediaImage mediaId={p.cover_image} alt={p.cover_image_alt} /> : "Not set"}</td><td>{p.author_name || "Profile incomplete"}</td><td>{p.category}</td><td>{p.status}</td><td>{p.published_at ? new Date(p.published_at).toISOString() : "Not published"}</td><td>{[p.seo_title, p.seo_description, p.slug, p.excerpt, p.cover_image, p.cover_image_alt].filter(Boolean).length}/6 metadata fields</td><td>{p.updated_at ? new Date(p.updated_at).toLocaleString() : "Not available"}</td><td><button onClick={() => selectPost(p.id)}>Open article</button></td></tr>)}</tbody></table></div></details>}
      <details className="op-profile-completion"><summary>Author profile {profile?.author_name && profile?.author_avatar_media ? "available" : "completion required before publication"}</summary>
        <p>Attribution is resolved server-side from your Auth profile. Names and photographs are never generated from an email or logo. Upload your own photograph below, then choose its media ID here.</p>
        <form key={profile?.author_name || "empty"} onSubmit={saveProfile}><Field label="Your full name"><input name="full_name" required defaultValue={profile?.author_name || ""} maxLength={120} /></Field><Field label="Biography"><textarea name="biography" defaultValue={profile?.author_bio || ""} maxLength={800} /></Field><Field label="Your uploaded profile photograph"><select name="avatar_media_id" required defaultValue={profile?.author_avatar_media || ""}><option value="">Select your photograph</option>{media.map(m => <option key={m.id} value={m.id}>{m.alt_text}</option>)}</select></Field><button type="submit" className="op-blog-button">Save my author profile</button></form>
      </details>
      <div className="op-blog-cms-layout">
        <aside className="op-blog-cms-list" aria-label="Articles">
          <div className="op-blog-cms-list-heading"><h2>All articles</h2>{postsLoaded && <span>{posts.length}</span>}</div>
          <label>Search articles<input value={search} onChange={e => setSearch(e.target.value)} /></label><label>Status<select value={filter} onChange={e => setFilter(e.target.value)}>{["all", "draft", "published", "scheduled", "archived"].map(s => <option key={s}>{s}</option>)}</select></label><label>Sort<select value={sort} onChange={e => setSort(e.target.value)}><option value="updated">Recently edited</option><option value="title">Title</option></select></label>
          {loading ? <p className="op-blog-muted">Loading articles…</p> : !postsLoaded ? <p className="op-blog-muted">Article list unavailable. Resolve the error before creating content.</p> : visiblePosts.length === 0 ? <p className="op-blog-muted">No matching articles available.</p> : visiblePosts.map((item) => (
            <button type="button" key={item.id} className={`op-blog-cms-list-item${selectedId === item.id ? " is-active" : ""}`} onClick={() => selectPost(item.id)}>
              <span className={`op-blog-status is-${item.status}`}>{item.status}</span><strong>{item.title}</strong><small>{item.category || "Uncategorised"} · {item.slug}</small>
            </button>
          ))}
        </aside>

        <section className="op-blog-cms-editor" aria-label="Article editor">
          {!preview ? <>
            <div className="op-blog-editor-toolbar">
              <span>{selectedId ? `Editing · ${post.status}` : "New draft"} · {dirty ? "Unsaved changes" : "Saved"} · {readingMinutes(post)} min read</span>
              <div>
                {selectedId && <button type="button" className="op-blog-button op-blog-button-secondary" onClick={() => setPreview(true)}><Eye size={16} />Preview</button>}
                <button type="button" className="op-blog-button op-blog-button-secondary" onClick={saveArticle} disabled={saving || post.status !== "draft"}><Save size={16} />{saving ? "Saving…" : "Save draft"}</button>
                {post.status === "draft" && <button type="button" className="op-blog-button op-blog-button-primary" onClick={publishArticle} disabled={saving || !selectedId || dirty || !reviewed}><Send size={16} />Publish</button>}
                {selectedId && <button type="button" className="op-blog-button" onClick={duplicateArticle} disabled={saving}>Duplicate draft</button>}
                {post.status === "archived" && <button type="button" className="op-blog-button" disabled={saving} onClick={deleteArchived}>Delete archived article</button>}
              </div>
              <label className="op-blog-checkbox"><input type="checkbox" checked={autosave} onChange={e => setAutosave(e.target.checked)} />Autosave existing drafts only (never updates a public article)</label>
              {post.status !== "draft" && <p role="status">Unpublish or cancel scheduling to edit this article. Public content is never autosaved.</p>}
            </div>
            <fieldset disabled={post.status !== "draft" || saving}>
            <div className="op-blog-editor-section">
              <Field label="Article title"><input value={post.title} onChange={(event) => changeTitle(event.target.value)} maxLength="200" placeholder="A clear aviation question or insight" /></Field>
              <Field label="Subtitle"><input value={post.subtitle} onChange={(event) => change("subtitle", event.target.value)} maxLength="240" /></Field>
              <Field label="URL slug" hint="Changing a published slug creates a permanent redirect."><input value={post.slug} onChange={(event) => changeField("slug", slugFromTitle(event.target.value))} maxLength="120" /></Field>
              <Field label="Summary"><textarea rows="3" value={post.excerpt} onChange={(event) => change("excerpt", event.target.value)} maxLength="500" placeholder="A concise, factual description of the article" /></Field>
              <Field label="Aviation category"><select value={post.category} onChange={(event) => change("category", event.target.value)}>{BLOG_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field>
              <Field label="Tags (comma separated; applied when leaving this field)"><input key={(post.tags || []).join(",")} defaultValue={(post.tags || []).join(", ")} onBlur={e => change("tags", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} /></Field>
              <label className="op-blog-checkbox"><input type="checkbox" checked={post.is_featured} onChange={e => change("is_featured", e.target.checked)} />Featured editorial article</label>
            </div>

            <div className="op-blog-editor-section">
              <div className="op-blog-editor-section-title"><div><p className="op-blog-eyebrow">CONTENT / SEMANTIC BLOCKS</p><h2>Article body</h2></div>
                <div className="op-blog-add-block"><select aria-label="Content block type" value={blockType} onChange={(event) => setBlockType(event.target.value)}>
                  <option value="rich_text">Rich text document</option><option value="paragraph">Legacy paragraph</option><option value="heading">Heading</option><option value="unordered_list">Bulleted list</option><option value="ordered_list">Numbered list</option><option value="quote">Pull quote</option><option value="table">Table</option><option value="link">Link</option><option value="image">Image</option>
                </select><button type="button" className="op-blog-button op-blog-button-secondary" onClick={addBlock}>Add block</button></div>
              </div>
              <div className="op-blog-block-list">
                {post.content.map((block, index) => <BlockEditor key={`${index}-${block.type}`} block={block} index={index} last={index === post.content.length - 1} onMove={moveBlock} onChange={changeBlock} onRemove={removeBlock} uploadImage={uploadImage} />)}
                {post.content.length === 0 && <p className="op-blog-muted">Add headings and paragraphs to build a readable, structured article.</p>}
              </div>
            </div>

            <div className="op-blog-editor-section op-blog-seo-grid">
              <div><p className="op-blog-eyebrow">EDITORIAL / AUTHOR</p><h2>Attribution</h2>
                <p>{post.author_name || profile?.author_name || "Complete your author profile."}</p><p>{post.author_bio || profile?.author_bio}</p><p>Attribution is read-only here and resolved from the original author's Auth profile, not client-supplied identity.</p>
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
              <h3>Private media library</h3><div className="op-media-library">{media.map(m => <article key={m.id}><PrivateMediaImage mediaId={m.id} alt={m.alt_text} /><p>{m.alt_text}</p><button type="button" onClick={() => setPost(current => ({ ...current, cover_image: m.id, cover_image_alt: m.alt_text }))}>Use as featured image</button><button type="button" onClick={() => change("content", [...post.content, { type: "image", mediaId: m.id, alt: m.alt_text, caption: m.caption || "" }])}>Insert inline block</button></article>)}</div>
            </div>
            </fieldset>
            <section className="op-blog-editor-section"><h2>AI content analysis · review only</h2><p>Analyzes the actual saved article through the existing Mistral gateway, organization budget and audit path. No new provider. No automatic publication. A legitimate publishing-budget organization and active administrator membership are required.</p><Field label="Authorized publishing-budget organization UUID"><input value={aiOrganization} onChange={e => setAiOrganization(e.target.value)} /></Field><label className="op-blog-checkbox"><input type="checkbox" checked={aiConsent} onChange={e => setAiConsent(e.target.checked)} />This is public-intended editorial content, with no confidential or personal customer information, and I authorize the existing provider analysis.</label><button type="button" className="op-blog-button" disabled={!selectedId || dirty || saving || !aiConsent || post.status !== "draft"} onClick={runAnalysis}>Analyze saved article</button>
              {analysis && <div className="op-ai-review"><p>Unapproved AI suggestions · {analysis.provider}</p>{Object.entries(analysis.metadata).map(([field, value]) => <div key={field}><strong>{field.replaceAll("_", " ")}</strong><p>{Array.isArray(value) ? value.join(", ") : value}</p><button type="button" onClick={() => { change(field, value); if (field === "slug") change("canonical_url", ""); }}>Apply this suggestion</button></div>)}<h3>Writing and evidence review</h3>{Object.entries(analysis.notes).map(([key, value]) => <p key={key}><strong>{key.replaceAll("_", " ")}:</strong> {Array.isArray(value) ? value.join("; ") : value}</p>)}</div>}
            </section>
            <section className="op-blog-editor-section"><h2>Editorial approval & scheduling</h2><label className="op-blog-checkbox"><input type="checkbox" checked={reviewed} disabled={dirty || !selectedId} onChange={e => setReviewed(e.target.checked)} />I reviewed the saved preview, attribution, evidence and metadata and approve publication.</label><Field label="Publication time (your device timezone; transmitted as UTC)"><input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} /></Field><button className="op-blog-button" type="button" disabled={!reviewed || dirty || post.status !== "draft"} onClick={scheduleArticle}>Approve & schedule</button></section>

            <div className="op-blog-editor-section op-blog-editor-footer">
              <div className="op-blog-editor-actions">
                {selectedId && ["published", "scheduled"].includes(post.status) && <button type="button" className="op-blog-button op-blog-button-secondary" onClick={() => changeStatus("unpublish", "Article unpublished or schedule canceled; saved as a draft.")}><Undo2 size={16} />Unpublish / cancel schedule</button>}
                {selectedId && post.status === "archived" && <button type="button" className="op-blog-button op-blog-button-secondary" onClick={() => changeStatus("restore", "Article restored as a draft.")}><Undo2 size={16} />Restore draft</button>}
                {selectedId && post.status !== "archived" && <button type="button" className="op-blog-button op-blog-button-danger" onClick={() => window.confirm("Archive this article? It will disappear from public pages and remain recoverable as a draft.") && changeStatus("archive", "Article archived.")}><Archive size={16} />Archive</button>}
                {selectedId && <button type="button" className="op-blog-button op-blog-button-secondary" onClick={toggleHistory}><History size={16} />{historyOpen ? "Hide history" : "History"}</button>}
              </div>
              {historyOpen && <ol className="op-blog-history">{history.map((event) => <li key={event.id}><strong>{event.action.replaceAll("_", " ")}</strong><time>{new Date(event.created_at).toLocaleString()}</time></li>)}</ol>}
            </div>
          </> : <>
            <div className="op-blog-editor-toolbar"><button type="button" className="op-blog-button op-blog-button-secondary" onClick={() => setPreview(false)}><ArrowLeft size={16} />Back to editor</button><span>Private draft preview</span></div>
            <label>Preview viewport<select value={previewWidth} onChange={e => setPreviewWidth(e.target.value)}><option value="desktop">Desktop</option><option value="mobile">Mobile · 390px</option></select></label>
            <article className="op-blog-article-page op-blog-preview-page" style={{ maxWidth: previewWidth === "mobile" ? 390 : undefined, margin: "auto" }}>
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
