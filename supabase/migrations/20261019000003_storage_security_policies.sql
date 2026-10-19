-- ============================================================================
-- ARS Computers — Migration 20261019000003: Storage Security Policies
-- ============================================================================
-- Security Hardening for 'product-images' Storage Bucket:
-- 1. Configures the 'product-images' bucket in Supabase Storage with:
--    - public: true (allows CDN image distribution)
--    - file_size_limit: 5,242,880 bytes (5 MB strict limit)
--    - allowed_mime_types: image/jpeg, image/png, image/webp, image/avif
-- 2. Restricts object creation, update/upsert, and deletion to active store
--    administrators ('superadmin' and 'admin').
-- 3. Enables public read access on 'product-images' so anon visitors and customers
--    can display product images in catalog and detail views.
-- 4. Defense-in-depth policy checks: validates metadata size and MIME type,
--    and checks case-insensitive file extensions (.jpg, .jpeg, .png, .webp, .avif).
--
-- LIMITATIONS OF STORAGE RLS POLICIES & COMPREHENSIVE ARCHITECTURE DEFENSE:
-- - Metadata MIME Spoofing: Client-sent `metadata->>'mimetype'` reflects the
--   HTTP Content-Type header. A malicious client could send an executable with
--   a fake 'image/jpeg' header. PostgreSQL RLS cannot inspect binary magic bytes.
--   Defense: The server-level bucket configuration (`allowed_mime_types`) enforced
--   by the Supabase Storage API combined with client-side canvas/file inspection
--   prevents spoofed payload processing.
-- - SVG Exclusion: 'image/svg+xml' is intentionally EXCLUDED from allowed MIME
--   types to prevent Stored Cross-Site Scripting (XSS) via embedded XML/scripts.
-- - Upsert Requirements: When uploading with `upsert: true`, Supabase Storage
--   executes an UPDATE on `storage.objects`. The UPDATE policy below is mandatory
--   to prevent runtime permission denials during image replacements.
--
-- TARGET ENVIRONMENT: Supabase Cloud / Self-Hosted Supabase Storage
-- DO NOT APPLY TO LIVE SUPABASE WITHOUT STAGING VALIDATION.
-- ============================================================================

DO $$
BEGIN
  -- Verify whether the target database contains the Supabase Storage schema
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    RAISE NOTICE 'Notice: Schema "storage" does not exist in this database environment. Skipping execution. (Supabase Storage schema is provisioned automatically in Supabase instances).';
    RETURN;
  END IF;

  -- --------------------------------------------------------------------------
  -- 1. PROVISION / CONFIGURE 'product-images' BUCKET
  -- --------------------------------------------------------------------------
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'product-images',
    'product-images',
    true,
    5242880, -- 5 MB (5 * 1024 * 1024 bytes)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

  -- --------------------------------------------------------------------------
  -- 2. ROW LEVEL SECURITY ON storage.objects
  -- --------------------------------------------------------------------------
  -- In Supabase (both local Docker and hosted platform), Row Level Security is
  -- enabled on storage.objects by default upon provisioning (owned by supabase_storage_admin).
  -- Note: Do not execute 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;'
  -- here, as migration scripts run as 'postgres' which is not the table owner (SQLSTATE 42501).
  -- We rely on the existing Supabase-managed RLS and apply bucket-specific policies below.

  -- --------------------------------------------------------------------------
  -- 3. DROP PRE-EXISTING POLICIES ON 'product-images'
  -- --------------------------------------------------------------------------
  DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;

  -- --------------------------------------------------------------------------
  -- 4. POLICY: Public Read Access
  -- Anyone (unauthenticated visitor or authenticated customer) can view images
  -- in the public 'product-images' bucket.
  -- --------------------------------------------------------------------------
  CREATE POLICY "Public can view product images"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'product-images');

  -- --------------------------------------------------------------------------
  -- 5. POLICY: Administrator Insert / Upload Access
  -- Only active administrators (superadmin, admin) can upload images.
  -- Defense-in-depth: Enforces 5 MB size limit, MIME type allowlist, and valid extension.
  -- --------------------------------------------------------------------------
  CREATE POLICY "Admins can upload product images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'product-images' AND
      public.is_admin() AND
      -- File size <= 5 MB
      (
        COALESCE((metadata->>'size')::bigint, (metadata->>'contentLength')::bigint, 0) <= 5242880
      ) AND
      -- Strict MIME allowlist (no SVGs, no executables, no HTML)
      (
        (metadata->>'mimetype') IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
      ) AND
      -- Case-insensitive extension check
      (
        lower(substring(name from '\.([^\.]+)$')) IN ('jpg', 'jpeg', 'png', 'webp', 'avif')
      )
    );

  -- --------------------------------------------------------------------------
  -- 6. POLICY: Administrator Update / Upsert Access
  -- Required when Supabase Storage client uses `upsert: true` to replace an existing image.
  -- --------------------------------------------------------------------------
  CREATE POLICY "Admins can update product images"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'product-images' AND
      public.is_admin()
    )
    WITH CHECK (
      bucket_id = 'product-images' AND
      public.is_admin() AND
      (
        COALESCE((metadata->>'size')::bigint, (metadata->>'contentLength')::bigint, 0) <= 5242880
      ) AND
      (
        (metadata->>'mimetype') IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
      ) AND
      (
        lower(substring(name from '\.([^\.]+)$')) IN ('jpg', 'jpeg', 'png', 'webp', 'avif')
      )
    );

  -- --------------------------------------------------------------------------
  -- 7. POLICY: Administrator Delete Access
  -- Only active administrators can delete images from 'product-images'.
  -- --------------------------------------------------------------------------
  CREATE POLICY "Admins can delete product images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'product-images' AND
      public.is_admin()
    );

  RAISE NOTICE '✓ Supabase Storage policies successfully applied to storage.objects for "product-images" bucket.';
END $$;
