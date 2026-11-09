CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content JSONB,
  cover_image TEXT,
  seo_title TEXT,
  seo_description TEXT,
  author_name TEXT DEFAULT 'Operion',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_alt TEXT,
  ADD COLUMN IF NOT EXISTS author_role TEXT,
  ADD COLUMN IF NOT EXISTS author_bio TEXT,
  ADD COLUMN IF NOT EXISTS author_url TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS social_title TEXT,
  ADD COLUMN IF NOT EXISTS social_description TEXT,
  ADD COLUMN IF NOT EXISTS is_indexable BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE public.blog_posts
SET content = '[]'::jsonb
WHERE content IS NULL;

ALTER TABLE public.blog_posts
  ALTER COLUMN content SET DEFAULT '[]'::jsonb,
  ALTER COLUMN content SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.blog_slug_redirects (
  old_slug TEXT PRIMARY KEY,
  new_slug TEXT NOT NULL,
  changed_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_slug_redirects_distinct_slugs CHECK (old_slug <> new_slug)
);

CREATE TABLE IF NOT EXISTS public.blog_media (
  id UUID PRIMARY KEY,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  image_bytes BYTEA NOT NULL,
  alt_text TEXT NOT NULL CHECK (length(alt_text) BETWEEN 1 AND 300),
  caption TEXT CHECK (caption IS NULL OR length(caption) <= 500),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_media_size_limit CHECK (octet_length(image_bytes) <= 3145728)
);

CREATE TABLE IF NOT EXISTS public.blog_post_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'published', 'unpublished', 'archived',
    'restored_to_draft', 'media_uploaded'
  )),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published_indexable
  ON public.blog_posts (published_at DESC)
  WHERE status = 'published' AND archived_at IS NULL AND is_indexable = TRUE;

CREATE INDEX IF NOT EXISTS idx_blog_post_audit_post_created
  ON public.blog_post_audit (post_id, created_at DESC);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_slug_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_audit ENABLE ROW LEVEL SECURITY;
