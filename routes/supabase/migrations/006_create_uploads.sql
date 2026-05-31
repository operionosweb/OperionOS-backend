-- =====================================================
-- OPERION OS MEDIA STORAGE SYSTEM
-- TABLE: uploads
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- UPLOADS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  file_id TEXT,

  mimetype TEXT,
  size INTEGER,

  provider TEXT DEFAULT 'uploadcare',

  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_uploads_file_id
  ON uploads(file_id);

CREATE INDEX IF NOT EXISTS idx_uploads_created_at
  ON uploads(created_at DESC);
