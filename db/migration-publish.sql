-- Migration: Add publish fields to projects
-- Run this in Supabase SQL Editor if you already have the projects table

ALTER TABLE projects ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_domain ON projects(custom_domain) WHERE custom_domain IS NOT NULL;

-- Allow public (unauthenticated) read access for published projects
CREATE POLICY IF NOT EXISTS projects_public_read ON projects FOR SELECT
  USING (status = 'live' AND slug IS NOT NULL);
