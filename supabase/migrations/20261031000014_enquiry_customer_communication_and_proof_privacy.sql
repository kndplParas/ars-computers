-- ============================================================================
-- ARS Computers — Step 3: Customer Communication & Proof Privacy Hardening
-- Migration: 20261031000014_enquiry_customer_communication_and_proof_privacy.sql
-- Sequential following 20261031000013_head_only_current_month_enquiry_removal
-- ============================================================================
-- PURPOSE:
-- 1. Tighten service proof SELECT access on public.enquiry_service_proofs and
--    storage.objects ('enquiry-service-proofs' bucket):
--    - Superadmin / Head: can view proofs and generate signed URLs for all enquiries.
--    - Assigned employee: can view proofs only for enquiries currently assigned to them (auth.uid() = assigned_employee_id / assigned_to).
--    - Peer / unassigned admin/employee: strictly blocked from viewing proofs and generating signed URLs.
--    - Inventory staff & anonymous: strictly blocked.
-- 2. Add dedicated, reliable customer contact columns to public.enquiries:
--    - customer_email TEXT NULL
--    - customer_phone TEXT NULL
--    - customer_address TEXT NULL
-- 3. Ensure assignment columns (assigned_to, assigned_employee_email, assigned_engineer_aadhaar)
--    exist on public.enquiries so that assign_enquiry_employee and self_assign_enquiry RPCs
--    and dispatch functions execute and persist engineer metadata without runtime schema errors.
-- 4. Backfill customer_email, customer_phone, and customer_address safely
--    from service_details where structured service request data exists.
-- 5. Maintain complete backward-compatibility with all existing enquiries.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD DEDICATED CUSTOMER & ASSIGNMENT COLUMNS TO public.enquiries
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS customer_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_email TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_address TEXT NULL,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_employee_email TEXT NULL,
  ADD COLUMN IF NOT EXISTS assigned_engineer_aadhaar TEXT NULL;

-- Backfill customer fields safely from existing columns and structured service_details
UPDATE public.enquiries
SET
  customer_name = COALESCE(customer_name, name, service_details->>'customer_name'),
  customer_email = COALESCE(customer_email, service_details->>'email'),
  customer_phone = COALESCE(customer_phone, service_details->>'mobile_number'),
  customer_address = COALESCE(customer_address, service_details->>'site_address')
WHERE customer_name IS NULL OR customer_email IS NULL OR customer_phone IS NULL OR customer_address IS NULL;

-- Backfill customer_phone and customer_email from contact_info where structured details were missing
UPDATE public.enquiries
SET
  customer_phone = COALESCE(customer_phone, CASE WHEN contact_info ~ '^[0-9+ -]{7,15}$' THEN trim(contact_info) ELSE NULL END),
  customer_email = COALESCE(customer_email, CASE WHEN contact_info ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN lower(trim(contact_info)) ELSE NULL END)
WHERE customer_phone IS NULL OR customer_email IS NULL;

-- Backfill assigned_to from assigned_employee_id where available
UPDATE public.enquiries
SET assigned_to = COALESCE(assigned_to, assigned_employee_id)
WHERE assigned_employee_id IS NOT NULL;

-- Backfill assigned_employee_email from admin_users where assigned
UPDATE public.enquiries e
SET assigned_employee_email = u.email
FROM public.admin_users u
WHERE (e.assigned_employee_id = u.id OR e.assigned_to = u.id)
  AND e.assigned_employee_email IS NULL;

-- Sync assigned_engineer_aadhaar with assigned_employee_aadhaar for dual compatibility
UPDATE public.enquiries
SET assigned_engineer_aadhaar = COALESCE(assigned_engineer_aadhaar, assigned_employee_aadhaar)
WHERE assigned_employee_aadhaar IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. TIGHTEN RLS POLICIES ON public.enquiry_service_proofs
-- Superadmin: can view all proofs.
-- Assigned Employee: can view proofs only for enquiries assigned to them.
-- Peer Admins & Employees: blocked from reading metadata.
-- ----------------------------------------------------------------------------
ALTER TABLE public.enquiry_service_proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view enquiry service proofs" ON public.enquiry_service_proofs;
DROP POLICY IF EXISTS "Authorized staff can view enquiry service proofs" ON public.enquiry_service_proofs;

CREATE POLICY "Authorized staff can view enquiry service proofs"
  ON public.enquiry_service_proofs
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin() AND
    (
      public.is_superadmin() OR
      EXISTS (
        SELECT 1 FROM public.enquiries e
        WHERE e.id = enquiry_service_proofs.enquiry_id
          AND (e.assigned_employee_id = auth.uid() OR e.assigned_to = auth.uid())
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 3. TIGHTEN STORAGE RLS POLICY ON storage.objects FOR 'enquiry-service-proofs'
-- Enforces that createSignedUrl and storage SELECT succeed ONLY for Head or
-- the currently assigned employee. Peer employees are blocked at storage layer.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN

    DROP POLICY IF EXISTS "Admins can view enquiry service proof objects" ON storage.objects;
    DROP POLICY IF EXISTS "Authorized staff can view enquiry service proof objects" ON storage.objects;

    CREATE POLICY "Authorized staff can view enquiry service proof objects"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'enquiry-service-proofs' AND
        public.is_admin() AND
        (
          public.is_superadmin() OR
          EXISTS (
            SELECT 1 FROM public.enquiries e
            WHERE e.id::text = split_part(storage.objects.name, '/', 1)
              AND (e.assigned_employee_id = auth.uid() OR e.assigned_to = auth.uid())
          )
        )
      );

  END IF;
END $$;
