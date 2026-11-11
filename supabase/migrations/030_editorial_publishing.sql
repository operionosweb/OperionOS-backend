-- Proposed only. Requires approved 026, verified backup and isolated rehearsal.
BEGIN;
ALTER TABLE public.blog_posts
  ADD COLUMN author_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN author_avatar_media UUID REFERENCES public.blog_media(id) ON DELETE RESTRICT,
  ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN ai_analysis JSONB,
  ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE public.blog_posts DROP CONSTRAINT blog_posts_status_check;
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_status_check
  CHECK (status IN ('draft','published','scheduled','archived'));
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_publication_time_check
  CHECK (status NOT IN ('published','scheduled') OR published_at IS NOT NULL);
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_schedule_approval_check
  CHECK (status <> 'scheduled' OR approved_at IS NOT NULL);
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_tags_limit
  CHECK (cardinality(tags) <= 12);
ALTER TABLE public.blog_post_audit DROP CONSTRAINT blog_post_audit_action_check;
ALTER TABLE public.blog_post_audit ADD CONSTRAINT blog_post_audit_action_check
  CHECK (action IN ('created','updated','published','unpublished','archived',
    'restored_to_draft','media_uploaded','scheduled','ai_analyzed','deleted'));
CREATE INDEX blog_posts_due_publication_idx ON public.blog_posts(published_at)
  WHERE status='scheduled' AND approved_at IS NOT NULL AND archived_at IS NULL;
COMMIT;
