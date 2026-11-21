-- ============================================================================
-- ARS Computers — Step 25: Permanent Regular Customers & CRM Directory Table
-- Migration: 20261121000025_create_permanent_customers_crm.sql
-- Status: PREPARED LOCAL MIGRATION (Phase 3A + CRM Regular Customer Module)
-- ============================================================================
-- Objectives:
-- 1. Create table public.customers for permanent, first-class CRM records
--    independent of transactional orders or enquiries.
-- 2. Support customer name, mobile, email, company, address, customer_type,
--    gst_number, notes, is_regular flag, and audit metadata.
-- 3. Implement SECURITY DEFINER RPCs:
--    - public.create_regular_customer: Validates active staff role, normalizes phone/email,
--      detects duplicates, and inserts customer.
--    - public.get_admin_customers: Returns permanent customers with role-appropriate
--      masking (HR PII redaction).
--    - public.search_duplicate_customers: Fast phone/email/name/company matching for
--      in-form duplicate customer suggestions.
-- 4. Follow strict Phase 3A security architecture: revoke table-level access from
--    client roles and grant execute strictly on vetted RPCs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  normalized_phone TEXT,
  email TEXT,
  normalized_email TEXT,
  company TEXT,
  customer_type TEXT DEFAULT 'Individual' CHECK (customer_type IN ('Individual', 'Commercial', 'Government', 'Dealer / Partner', 'Other')),
  gst_number TEXT,
  address TEXT,
  notes TEXT,
  is_regular BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- Indexes for high-speed matching and directory filtering
CREATE INDEX IF NOT EXISTS idx_customers_normalized_phone ON public.customers (normalized_phone) WHERE normalized_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_normalized_email ON public.customers (normalized_email) WHERE normalized_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers (company) WHERE company IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers (name);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers (created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Revoke direct table SELECT and DML from client roles
REVOKE ALL ON TABLE public.customers FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1. STORED PROCEDURE: public.create_regular_customer
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_regular_customer(
  p_name text,
  p_phone text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_company text DEFAULT NULL::text,
  p_address text DEFAULT NULL::text,
  p_customer_type text DEFAULT 'Individual'::text,
  p_gst_number text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_allow_duplicate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_role TEXT;
  v_actor_name TEXT;
  v_raw_phone TEXT;
  v_norm_phone TEXT := NULL;
  v_norm_email TEXT := NULL;
  v_new_customer RECORD;
  v_duplicate_id UUID := NULL;
  v_duplicate_name TEXT := NULL;
  v_lock_phone BIGINT := NULL;
  v_lock_email BIGINT := NULL;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- 1. Verify caller session
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active staff role (Inventory staff is restricted read-only)
  v_role := public.get_staff_role();
  IF v_role IS NULL OR v_role NOT IN ('superadmin', 'admin', 'account', 'technical', 'engineer', 'hr') THEN
    RAISE EXCEPTION 'Access denied: Active administrative staff privileges required to register regular customers.'
      USING ERRCODE = '42501';
  END IF;

  -- Get actor name
  SELECT full_name INTO v_actor_name FROM public.admin_users WHERE id = v_actor_id;

  -- 3. Name validation
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Customer name is mandatory.' USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Indian Mobile Normalization (10-digit starting with 6-9)
  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    v_raw_phone := regexp_replace(p_phone, '\D', '', 'g');
    IF length(v_raw_phone) = 10 AND v_raw_phone ~ '^[6-9]\d{9}$' THEN
      v_norm_phone := v_raw_phone;
    ELSIF length(v_raw_phone) = 11 AND v_raw_phone ~ '^0[6-9]\d{9}$' THEN
      v_norm_phone := substr(v_raw_phone, 2);
    ELSIF length(v_raw_phone) = 12 AND v_raw_phone ~ '^91[6-9]\d{9}$' THEN
      v_norm_phone := substr(v_raw_phone, 3);
    ELSIF length(v_raw_phone) = 13 AND v_raw_phone ~ '^091[6-9]\d{9}$' THEN
      v_norm_phone := substr(v_raw_phone, 4);
    ELSE
      v_norm_phone := NULL;
    END IF;
  END IF;

  -- 5. Email Normalization
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    v_norm_email := lower(trim(p_email));
    IF v_norm_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
      v_norm_email := NULL;
    END IF;
  END IF;

  -- Concurrency Protection: Acquire advisory transaction locks for both normalized phone
  -- and normalized email in a deterministic ascending order to provably eliminate deadlocks.
  IF v_norm_phone IS NOT NULL THEN
    v_lock_phone := hashtext('customer_phone:' || v_norm_phone)::bigint;
  END IF;

  IF v_norm_email IS NOT NULL THEN
    v_lock_email := hashtext('customer_email:' || v_norm_email)::bigint;
  END IF;

  IF v_lock_phone IS NOT NULL AND v_lock_email IS NOT NULL THEN
    IF v_lock_phone < v_lock_email THEN
      PERFORM pg_advisory_xact_lock(v_lock_phone);
      PERFORM pg_advisory_xact_lock(v_lock_email);
    ELSIF v_lock_phone > v_lock_email THEN
      PERFORM pg_advisory_xact_lock(v_lock_email);
      PERFORM pg_advisory_xact_lock(v_lock_phone);
    ELSE
      PERFORM pg_advisory_xact_lock(v_lock_phone);
    END IF;
  ELSIF v_lock_phone IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(v_lock_phone);
  ELSIF v_lock_email IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(v_lock_email);
  END IF;

  -- 6. Duplicate check against existing permanent customers (rechecked after acquiring locks)
  IF v_norm_phone IS NOT NULL THEN
    SELECT id, name INTO v_duplicate_id, v_duplicate_name
    FROM public.customers
    WHERE normalized_phone = v_norm_phone
    LIMIT 1;
  END IF;

  IF v_duplicate_id IS NULL AND v_norm_email IS NOT NULL THEN
    SELECT id, name INTO v_duplicate_id, v_duplicate_name
    FROM public.customers
    WHERE normalized_email = v_norm_email
    LIMIT 1;
  END IF;

  -- Guard: If duplicate is detected and caller did not explicitly confirm bypass,
  -- abort insertion and return duplicate warning without creating a duplicate record.
  IF v_duplicate_id IS NOT NULL AND NOT p_allow_duplicate THEN
    RETURN jsonb_build_object(
      'success', false,
      'duplicate_detected', true,
      'customer', NULL,
      'potential_duplicate', jsonb_build_object('id', v_duplicate_id, 'name', v_duplicate_name),
      'message', 'A customer with matching contact details already exists in CRM. Confirm explicit bypass to save as a distinct profile.'
    );
  END IF;

  -- 7. Insert permanent customer record
  INSERT INTO public.customers (
    name,
    phone,
    normalized_phone,
    email,
    normalized_email,
    company,
    customer_type,
    gst_number,
    address,
    notes,
    is_regular,
    created_by,
    created_by_name,
    created_by_role,
    created_at,
    updated_at
  ) VALUES (
    trim(p_name),
    nullif(trim(p_phone), ''),
    v_norm_phone,
    nullif(trim(p_email), ''),
    v_norm_email,
    nullif(trim(p_company), ''),
    COALESCE(p_customer_type, 'Individual'),
    nullif(upper(trim(p_gst_number)), ''),
    nullif(trim(p_address), ''),
    nullif(trim(p_notes), ''),
    true,
    v_actor_id,
    COALESCE(v_actor_name, 'Staff Member'),
    v_role,
    v_now,
    v_now
  )
  RETURNING * INTO v_new_customer;

  RETURN jsonb_build_object(
    'success', true,
    'duplicate_detected', false,
    'customer', jsonb_build_object(
      'id', v_new_customer.id,
      'name', v_new_customer.name,
      'phone', v_new_customer.phone,
      'normalized_phone', v_new_customer.normalized_phone,
      'email', v_new_customer.email,
      'normalized_email', v_new_customer.normalized_email,
      'company', v_new_customer.company,
      'customer_type', v_new_customer.customer_type,
      'gst_number', v_new_customer.gst_number,
      'address', v_new_customer.address,
      'notes', v_new_customer.notes,
      'is_regular', v_new_customer.is_regular,
      'created_at', v_new_customer.created_at,
      'created_by_name', v_new_customer.created_by_name
    ),
    'potential_duplicate', CASE 
      WHEN v_duplicate_id IS NOT NULL THEN jsonb_build_object('id', v_duplicate_id, 'name', v_duplicate_name)
      ELSE NULL 
    END,
    'message', 'Regular customer registered successfully in CRM.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_regular_customer(text, text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_regular_customer(text, text, text, text, text, text, text, text, boolean) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. STORED PROCEDURE: public.get_admin_customers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_customers(
  p_query text DEFAULT NULL::text,
  p_limit integer DEFAULT NULL::integer,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_role TEXT;
  v_total_count INTEGER;
  v_effective_limit INTEGER;
  v_effective_offset INTEGER;
  v_has_more BOOLEAN;
  v_customers JSONB;
  v_clean_query TEXT := NULL;
BEGIN
  -- 1. Verify caller session
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Verify active staff role
  v_role := public.get_staff_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: Active staff authorization required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_query IS NOT NULL AND length(trim(p_query)) > 0 THEN
    v_clean_query := '%' || lower(trim(p_query)) || '%';
  END IF;

  -- 3. Calculate total count
  SELECT count(*)
  INTO v_total_count
  FROM public.customers c
  WHERE (v_clean_query IS NULL OR (
    lower(c.name) LIKE v_clean_query OR
    lower(COALESCE(c.company, '')) LIKE v_clean_query OR
    COALESCE(c.normalized_phone, '') LIKE v_clean_query OR
    lower(COALESCE(c.email, '')) LIKE v_clean_query
  ));

  v_effective_offset := GREATEST(COALESCE(p_offset, 0), 0);
  v_effective_limit := CASE 
    WHEN p_limit IS NOT NULL AND p_limit > 0 THEN p_limit 
    ELSE v_total_count 
  END;
  v_has_more := (v_effective_offset + v_effective_limit) < v_total_count;

  -- 4. Project role-tailored customers
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'phone', CASE 
        WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]'
        ELSE c.phone 
      END,
      'normalized_phone', CASE 
        WHEN v_role = 'hr' THEN NULL
        ELSE c.normalized_phone 
      END,
      'email', CASE 
        WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]'
        ELSE c.email 
      END,
      'normalized_email', CASE 
        WHEN v_role = 'hr' THEN NULL
        ELSE c.normalized_email 
      END,
      'company', c.company,
      'customer_type', c.customer_type,
      'gst_number', c.gst_number,
      'address', CASE 
        WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]'
        ELSE c.address 
      END,
      'notes', CASE 
        WHEN v_role IN ('hr', 'inventory_staff') THEN NULL
        ELSE c.notes 
      END,
      'is_regular', c.is_regular,
      'created_by_name', c.created_by_name,
      'created_at', c.created_at,
      'updated_at', c.updated_at
    ) ORDER BY c.created_at DESC
  ), '[]'::jsonb)
  INTO v_customers
  FROM (
    SELECT *
    FROM public.customers c_inner
    WHERE (v_clean_query IS NULL OR (
      lower(c_inner.name) LIKE v_clean_query OR
      lower(COALESCE(c_inner.company, '')) LIKE v_clean_query OR
      COALESCE(c_inner.normalized_phone, '') LIKE v_clean_query OR
      lower(COALESCE(c_inner.email, '')) LIKE v_clean_query
    ))
    ORDER BY c_inner.created_at DESC
    LIMIT v_effective_limit
    OFFSET v_effective_offset
  ) c;

  RETURN jsonb_build_object(
    'customers', v_customers,
    'total_count', v_total_count,
    'has_more', v_has_more,
    'role', v_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_customers(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_customers(text, integer, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. STORED PROCEDURE: public.search_duplicate_customers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_duplicate_customers(
  p_name text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_company text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_actor_id UUID;
  v_role TEXT;
  v_raw_phone TEXT;
  v_norm_phone TEXT := NULL;
  v_norm_email TEXT := NULL;
  v_clean_name TEXT := NULL;
  v_clean_comp TEXT := NULL;
  v_results JSONB;
BEGIN
  -- 1. Verify caller session
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: User session not found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_role := public.get_staff_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: Active staff authorization required.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Normalize search inputs
  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    v_raw_phone := regexp_replace(p_phone, '\D', '', 'g');
    IF length(v_raw_phone) = 10 AND v_raw_phone ~ '^[6-9]\d{9}$' THEN
      v_norm_phone := v_raw_phone;
    ELSIF length(v_raw_phone) = 11 AND v_raw_phone ~ '^0[6-9]\d{9}$' THEN
      v_norm_phone := substr(v_raw_phone, 2);
    ELSIF length(v_raw_phone) = 12 AND v_raw_phone ~ '^91[6-9]\d{9}$' THEN
      v_norm_phone := substr(v_raw_phone, 3);
    ELSIF length(v_raw_phone) = 13 AND v_raw_phone ~ '^091[6-9]\d{9}$' THEN
      v_norm_phone := substr(v_raw_phone, 4);
    END IF;
  END IF;

  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    v_norm_email := lower(trim(p_email));
  END IF;

  IF p_name IS NOT NULL AND length(trim(p_name)) >= 2 THEN
    v_clean_name := lower(trim(p_name));
  END IF;

  IF p_company IS NOT NULL AND length(trim(p_company)) >= 2 THEN
    v_clean_comp := lower(trim(p_company));
  END IF;

  -- 3. Match candidates across permanent customers
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'phone', CASE WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]' ELSE c.phone END,
      'normalized_phone', CASE WHEN v_role = 'hr' THEN NULL ELSE c.normalized_phone END,
      'email', CASE WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]' ELSE c.email END,
      'company', c.company,
      'address', CASE WHEN v_role = 'hr' THEN '[REDACTED: HR Privacy Policy]' ELSE c.address END,
      'customer_type', c.customer_type,
      'is_regular', c.is_regular,
      'match_reason', c.match_reason,
      'match_confidence', c.match_confidence
    )
  ), '[]'::jsonb)
  INTO v_results
  FROM (
    SELECT
      cust.*,
      CASE
        WHEN v_norm_phone IS NOT NULL AND cust.normalized_phone = v_norm_phone THEN 'Matched Mobile Number'
        WHEN v_norm_email IS NOT NULL AND cust.normalized_email = v_norm_email THEN 'Matched Email Address'
        WHEN v_clean_comp IS NOT NULL AND lower(COALESCE(cust.company, '')) = v_clean_comp THEN 'Matched Company Name'
        WHEN v_clean_name IS NOT NULL AND lower(cust.name) = v_clean_name THEN 'Matched Full Name'
        ELSE 'Similar Details'
      END as match_reason,
      CASE
        WHEN v_norm_phone IS NOT NULL AND cust.normalized_phone = v_norm_phone THEN 100
        WHEN v_norm_email IS NOT NULL AND cust.normalized_email = v_norm_email THEN 90
        WHEN v_clean_comp IS NOT NULL AND lower(COALESCE(cust.company, '')) = v_clean_comp THEN 75
        WHEN v_clean_name IS NOT NULL AND lower(cust.name) = v_clean_name THEN 60
        ELSE 40
      END as match_confidence
    FROM public.customers cust
    WHERE
      (v_norm_phone IS NOT NULL AND cust.normalized_phone = v_norm_phone)
      OR (v_norm_email IS NOT NULL AND cust.normalized_email = v_norm_email)
      OR (v_clean_comp IS NOT NULL AND lower(COALESCE(cust.company, '')) = v_clean_comp)
      OR (v_clean_name IS NOT NULL AND lower(cust.name) = v_clean_name)
    ORDER BY match_confidence DESC, cust.created_at DESC
    LIMIT 5
  ) c;

  RETURN v_results;
END;
$$;

REVOKE ALL ON FUNCTION public.search_duplicate_customers(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_duplicate_customers(text, text, text, text) TO authenticated;
