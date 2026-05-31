-- =====================================================
-- OPERION OS BLOG SYSTEM
-- TABLE: blog_posts
-- =====================================================

-- Enable UUID support (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- BLOG POSTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  title TEXT NOT NULL,
  subtitle TEXT,
  slug TEXT UNIQUE NOT NULL,

  excerpt TEXT,
  content JSONB,

  cover_image TEXT,

  seo_title TEXT,
  seo_description TEXT,

  author_name TEXT DEFAULT 'Operion',

  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),

  published_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES (performance for CMS + frontend)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug
  ON blog_posts(slug);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status
  ON blog_posts(status);

CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at
  ON blog_posts(created_at DESC);

-- =====================================================
-- AUTO-UPDATE updated_at TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION update_blog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blog_updated_at ON blog_posts;

CREATE TRIGGER trg_blog_updated_at
BEFORE UPDATE ON blog_posts
FOR EACH ROW
EXECUTE FUNCTION update_blog_updated_at();
