BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.blog_posts
    WHERE category IS NOT NULL
      AND (length(btrim(category)) = 0 OR length(category) > 160)
  ) THEN
    RAISE EXCEPTION 'Existing Blog category values need review before category management can be enabled.';
  END IF;

  IF EXISTS (
    SELECT lower(category)
    FROM public.blog_posts
    WHERE category IS NOT NULL
    GROUP BY lower(category)
    HAVING count(DISTINCT category) > 1
  ) THEN
    RAISE EXCEPTION 'Case-conflicting Blog category values need review before category management can be enabled.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.blog_posts p
    JOIN (VALUES
      ('Aircraft Leasing'),
      ('Aviation Contract Intelligence'),
      ('MRO and Maintenance Contracts'),
      ('Aviation Risk and Compliance'),
      ('Airline Supplier Contracts'),
      ('Predictive Contract Intelligence')
    ) AS seeded(name) ON lower(seeded.name) = lower(p.category)
    WHERE p.category <> seeded.name
  ) THEN
    RAISE EXCEPTION 'A legacy Blog category conflicts with a standard category by case; review it before enabling category management.';
  END IF;
END
$$;

CREATE TABLE public.blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_categories_name_length CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT blog_categories_description_length CHECK (length(description) <= 500),
  CONSTRAINT blog_categories_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX blog_categories_name_ci_unique ON public.blog_categories (lower(name));

INSERT INTO public.blog_categories (name, slug)
VALUES
  ('Aircraft Leasing', 'aircraft-leasing'),
  ('Aviation Contract Intelligence', 'aviation-contract-intelligence'),
  ('MRO and Maintenance Contracts', 'mro-and-maintenance-contracts'),
  ('Aviation Risk and Compliance', 'aviation-risk-and-compliance'),
  ('Airline Supplier Contracts', 'airline-supplier-contracts'),
  ('Predictive Contract Intelligence', 'predictive-contract-intelligence')
ON CONFLICT DO NOTHING;

INSERT INTO public.blog_categories (name, slug)
SELECT DISTINCT category, 'legacy-' || substr(md5(category), 1, 24)
FROM public.blog_posts
WHERE category IS NOT NULL AND btrim(category) <> ''
ON CONFLICT DO NOTHING;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_category_fk
  FOREIGN KEY (category) REFERENCES public.blog_categories(name)
  ON UPDATE CASCADE ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.blog_posts VALIDATE CONSTRAINT blog_posts_category_fk;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_categories FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.blog_categories TO service_role;

COMMIT;
