import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays, ChevronRight } from "lucide-react";
import { apiRequest } from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import { blogMediaUrl } from "../lib/blogRendering";
import { applyRouteMetadata } from "../components/seo/RouteMetadata";

const SITE_URL = "https://operionos.com";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const BLOG_DESCRIPTION = "Evidence-led insights on aircraft leasing, aviation contract intelligence, maintenance reserves, redelivery, MRO agreements and aviation risk.";

function dateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function articleStructuredData(post, canonical) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Article", "BlogPosting"],
        "@id": `${canonical}#article`,
        headline: post.title,
        description: post.seo_description || post.excerpt || "",
        articleSection: post.category,
        datePublished: post.published_at,
        dateModified: post.updated_at || post.published_at,
        author: { "@type": "Person", name: post.author_name || "Operion", ...(post.author_url ? { url: post.author_url } : {}) },
        publisher: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Operion", url: `${SITE_URL}/` },
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        ...(post.cover_image ? { image: blogMediaUrl(post.cover_image, API_BASE_URL) } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Insights", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: canonical },
        ],
      },
    ],
  };
}

export function PrivateMediaImage({ mediaId, alt }) {
  const { session } = useAuth();
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    if (!session?.access_token) return undefined;
    fetch(`${API_BASE_URL}/api/blog/admin/media/${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then((response) => {
      if (!response.ok) throw new Error("Image preview is unavailable.");
      return response.blob();
    }).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }).catch(() => active && setSrc(""));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId, session?.access_token]);

  return src ? <img src={src} alt={alt || ""} /> : <span className="op-blog-private-image">Private image preview</span>;
}

function BlogBlock({ block, privateMedia = false }) {
  if (!block || typeof block !== "object") return null;
  switch (block.type) {
    case "heading": {
      const Tag = [2, 3].includes(Number(block.level)) ? `h${Number(block.level)}` : "h2";
      return <Tag>{block.text}</Tag>;
    }
    case "paragraph":
      return <p>{block.text}</p>;
    case "unordered_list":
      return <ul>{block.items?.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>;
    case "ordered_list":
      return <ol>{block.items?.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol>;
    case "quote":
      return <blockquote><p>{block.text}</p>{block.attribution && <cite>{block.attribution}</cite>}</blockquote>;
    case "table":
      return <div className="op-blog-table-wrap"><table><tbody>{block.rows?.map((row, rowIndex) => {
        const Cell = rowIndex === 0 ? "th" : "td";
        return <tr key={rowIndex}>{row.map((cell, index) => <Cell key={index}>{cell}</Cell>)}</tr>;
      })}</tbody></table></div>;
    case "link": {
      let url;
      try {
        url = new URL(block.href);
      } catch {
        return null;
      }
      if (!["https:", "http:", "mailto:"].includes(url.protocol)) return null;
      return <p><a href={url.href} rel="noopener noreferrer">{block.text || url.href}</a></p>;
    }
    case "image":
      return <figure>{privateMedia
        ? <PrivateMediaImage mediaId={block.mediaId} alt={block.alt} />
        : <img src={blogMediaUrl(block.mediaId, API_BASE_URL)} alt={block.alt || ""} loading="lazy" decoding="async" />}
      <figcaption>{block.caption}</figcaption></figure>;
    default:
      return null;
  }
}

export function BlogArticleBody({ post, privateMedia = false }) {
  if (!post) return null;
  return <div className="op-blog-prose">{Array.isArray(post.content) ? post.content.map((block, index) => <BlogBlock key={`${block.type}-${index}`} block={block} privateMedia={privateMedia} />) : <p>Article body is not available in a supported format.</p>}</div>;
}

function LoadingNotice({ label }) {
  return <div className="op-blog-state" role="status"><BookOpen size={22} />{label}</div>;
}

function ArticleCard({ post }) {
  return (
    <article className={`op-blog-card${post.cover_image ? " has-cover" : ""}`}>
      {post.cover_image && <Link className="op-blog-card-image" to={`/blog/${encodeURIComponent(post.slug)}`} aria-label={`Read ${post.title}`}>
        <img src={blogMediaUrl(post.cover_image, API_BASE_URL)} alt={post.cover_image_alt || ""} loading="lazy" />
      </Link>}
      <div className="op-blog-card-copy">
        <p className="op-blog-eyebrow">{post.category}</p>
        <h2><Link to={`/blog/${encodeURIComponent(post.slug)}`}>{post.title}</Link></h2>
        {post.excerpt && <p>{post.excerpt}</p>}
        <div className="op-blog-byline"><span>{post.author_name || "Operion"}</span><span aria-hidden="true">·</span><time dateTime={post.published_at || undefined}>{dateLabel(post.published_at)}</time></div>
        <Link className="op-blog-read-more" to={`/blog/${encodeURIComponent(post.slug)}`}>Read article <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </article>
  );
}

export function BlogIndex() {
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState("All topics");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/api/blog")
      .then((result) => active && setPosts(Array.isArray(result.posts) ? result.posts : []))
      .catch(() => active && setError("Insights are temporarily unavailable. Please try again later."));
    applyRouteMetadata({
      title: "Operion Insights | Aviation Contract Intelligence",
      description: BLOG_DESCRIPTION,
      canonical: `${SITE_URL}/blog`,
      type: "website",
      structuredData: {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Blog", name: "Operion Insights", url: `${SITE_URL}/blog`, publisher: { "@type": "Organization", name: "Operion", url: `${SITE_URL}/` } },
          { "@type": "BreadcrumbList", itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Insights", item: `${SITE_URL}/blog` },
          ] },
        ],
      },
    });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => ["All topics", ...new Set(posts.map((post) => post.category).filter(Boolean))], [posts]);
  const visiblePosts = category === "All topics" ? posts : posts.filter((post) => post.category === category);

  return (
    <div className="op-blog-page">
      <section className="op-blog-hero">
        <div className="op-blog-hero-inner">
          <p className="op-blog-eyebrow"><span className="op-blog-pulse" aria-hidden="true" />OPERION / AVIATION INTELLIGENCE</p>
          <h1>Insights for the complexity of aviation contracts.</h1>
          <p>Practical perspectives on aircraft leasing, contractual exposure, maintenance agreements and the decisions that keep aviation moving.</p>
          <a className="op-blog-primary-link" href="/request-demo">Explore Operion <ArrowRight size={18} aria-hidden="true" /></a>
        </div>
        <div className="op-blog-hero-mark" aria-hidden="true"><span>AVIATION</span><strong>01</strong><span>CONTRACT INTELLIGENCE</span></div>
      </section>

      <section className="op-blog-content" aria-labelledby="insights-heading">
        <div className="op-blog-section-heading">
          <div><p className="op-blog-eyebrow">KNOWLEDGE / FIELD NOTES</p><h2 id="insights-heading">Ideas for better decisions</h2></div>
          <p>Clear analysis for the people responsible for aviation contracts, assets and operations.</p>
        </div>
        <div className="op-blog-category-list" aria-label="Filter articles by topic">
          {categories.map((item) => <button type="button" className={category === item ? "is-active" : ""} key={item} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}
        </div>
        {error ? <div className="op-blog-state" role="alert">{error}</div>
          : posts.length === 0 ? <LoadingNotice label="New aviation insights are in editorial development. Please check back soon." />
            : visiblePosts.length ? <div className="op-blog-grid">{visiblePosts.map((post) => <ArticleCard key={post.id} post={post} />)}</div>
              : <div className="op-blog-state" role="status">No published articles in this topic yet.</div>}
      </section>

      <section className="op-blog-conversion"><div><p className="op-blog-eyebrow">OPERION / CONTRACT INTELLIGENCE</p><h2>Find the obligations, evidence and exposure that matter.</h2><p>Explore how Operion connects aviation contract terms to clear, evidence-grounded decisions.</p></div><Link to="/request-demo">Talk to Operion <ChevronRight size={18} aria-hidden="true" /></Link></section>
    </div>
  );
}

export function BlogArticle() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setPost(null);
    setError("");
    apiRequest(`/api/blog/${encodeURIComponent(slug)}`)
      .then((result) => {
        if (!active) return;
        if (result.redirectTo) {
          navigate(`/blog/${encodeURIComponent(result.redirectTo)}`, { replace: true });
          return;
        }
        if (!result.post) throw new Error("Article not found.");
        const value = result.post;
        setPost(value);
        const canonical = value.canonical_url ? new URL(value.canonical_url, SITE_URL).href : `${SITE_URL}/blog/${encodeURIComponent(value.slug)}`;
        applyRouteMetadata({
          title: value.seo_title || value.title,
          description: value.seo_description || value.excerpt || BLOG_DESCRIPTION,
          canonical,
          robots: value.is_indexable === false ? "noindex, follow, noarchive" : "index, follow, max-image-preview:large",
          image: value.cover_image ? blogMediaUrl(value.cover_image, API_BASE_URL) : undefined,
          type: "article",
          socialTitle: value.social_title || undefined,
          socialDescription: value.social_description || undefined,
          structuredData: articleStructuredData(value, canonical),
        });
      })
      .catch((failure) => active && setError(failure.message || "Article is temporarily unavailable."));
    return () => { active = false; };
  }, [slug, navigate]);

  if (error) return <div className="op-blog-state op-blog-error" role="alert"><h1>Article unavailable</h1><p>{error}</p><Link to="/blog">Return to Insights</Link></div>;
  if (!post) return <LoadingNotice label="Loading article…" />;
  const published = dateLabel(post.published_at);

  return (
    <article className="op-blog-article-page">
      <nav className="op-blog-breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><ChevronRight size={14} aria-hidden="true" /><Link to="/blog">Insights</Link><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">{post.title}</span></nav>
      <header className="op-blog-article-header">
        <p className="op-blog-eyebrow">{post.category || "Aviation Contract Intelligence"}</p>
        <h1>{post.title}</h1>
        {post.subtitle && <p className="op-blog-subtitle">{post.subtitle}</p>}
        {post.excerpt && <p className="op-blog-deck">{post.excerpt}</p>}
        <div className="op-blog-author">
          <span className="op-blog-author-mark" aria-hidden="true">{(post.author_name || "O").slice(0, 1)}</span>
          <span><strong>{post.author_name || "Operion"}</strong>{post.author_role && <small>{post.author_role}</small>}</span>
          <span className="op-blog-date"><CalendarDays size={15} aria-hidden="true" /><time dateTime={post.published_at || undefined}>{published}</time></span>
        </div>
      </header>
      {post.cover_image && <figure className="op-blog-cover"><img src={blogMediaUrl(post.cover_image, API_BASE_URL)} alt={post.cover_image_alt || ""} fetchPriority="high" /></figure>}
      <BlogArticleBody post={post} />
      <aside className="op-blog-editorial-note">Operion articles share industry information and product perspectives; they are not legal advice. Verify contractual interpretation with qualified advisers.</aside>
      <section className="op-blog-article-cta"><p className="op-blog-eyebrow">OPERION / AVIATION CONTRACT INTELLIGENCE</p><h2>Connect contract terms to decisions.</h2><Link to="/request-demo">Explore Operion <ArrowRight size={17} aria-hidden="true" /></Link></section>
    </article>
  );
}
