-- ============================================================================
-- ARS Computers — Catalog Seed Data Script
-- File: supabase/seed.sql
-- ============================================================================
-- PURPOSE:
-- Repeatable seed script mapping verified category and product items from
-- the existing source data (src/data/categories.js) into the Supabase database.
--
-- SAFETY & REPEATABILITY:
-- Uses `ON CONFLICT (slug) DO UPDATE` to ensure safe, idempotent execution.
-- Rerunning this file will update existing records without creating duplicates.
--
-- BUSINESS DECISION FLAGS (UNINVENTED FIELDS):
-- In strict adherence to integrity constraints, the following fields are NOT
-- invented and are left as NULL or defaults pending real business data:
--   1. price           -> NULL (Quotation-based; pending retail price list)
--   2. cost_price      -> NULL (Strictly private; pending procurement cost data)
--   3. sku             -> NULL (Pending physical store/warehouse barcode scheme)
--   4. brand           -> NULL (Pending specific OEM brand per SKU allocation)
--   5. model           -> NULL (Pending specific manufacturer model numbers)
--   6. stock_quantity  -> 0 (Default count; pending on-site inventory audit)
--   7. images          -> ARRAY[]::TEXT[] (Pending verified showroom photos)
--   8. spec_attributes -> '{}'::jsonb (Pending structured hardware parameters)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEED CATEGORIES (5 Core Hardware & Security Categories)
-- ----------------------------------------------------------------------------

INSERT INTO public.categories (
  slug,
  title,
  short_title,
  tagline,
  description,
  icon,
  badge,
  display_order,
  is_active
)
VALUES
  (
    'computer-laptop',
    'Computer / Laptop',
    'Computer / Laptop',
    'High-performance Desktops, Custom PCs & Laptops',
    'Latest generation business & gaming laptops, custom-assembled desktop rigs, and enterprise workstations tailored to your workload.',
    '💻',
    'Popular',
    1,
    true
  ),
  (
    'cctv',
    'CCTV',
    'CCTV',
    'HD Surveillance & Smart Monitoring Systems',
    'High-definition IP cameras, dome & bullet security setups, DVR/NVR recorders, and remote mobile surveillance solutions.',
    '📹',
    'Security',
    2,
    true
  ),
  (
    'printer',
    'Printer',
    'Printer',
    'Laser, Ink Tank & Multi-function Office Printers',
    'All-in-one printers, heavy-duty laser printing equipment, wireless office multifunction systems, and genuine ink/toner solutions.',
    '🖨️',
    'Office',
    3,
    true
  ),
  (
    'biometric-machine',
    'Biometric Machine',
    'Biometric Machine',
    'Time-Attendance & Access Control Devices',
    'Fingerprint, RFID card, and AI facial recognition biometric attendance machines with automated payroll and door access integration.',
    '🛡️',
    'Enterprise',
    4,
    true
  ),
  (
    'accessories',
    'Accessories',
    'Accessories',
    'Keyboards, Storage, Routers & Cables',
    'Premium mechanical keyboards, ergonomic mice, NVMe SSDs, high-gain Wi-Fi routers, power supplies, and certified connectivity cables.',
    '🔌',
    'Essentials',
    5,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  short_title = EXCLUDED.short_title,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  badge = EXCLUDED.badge,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  updated_at = timezone('utc'::text, now());

-- ----------------------------------------------------------------------------
-- 2. SEED PRODUCTS (20 Verified Product Offerings Across 5 Categories)
-- ----------------------------------------------------------------------------

-- Category 1: Computer / Laptop (4 products)
INSERT INTO public.products (
  category_id,
  name,
  slug,
  spec_summary,
  is_featured,
  is_active
)
VALUES
  (
    (SELECT id FROM public.categories WHERE slug = 'computer-laptop'),
    'Business Laptops (Dell, HP, Lenovo, Asus)',
    'business-laptops-dell-hp-lenovo-asus',
    'Intel Core i5/i7 & Ryzen 7, 16GB RAM, 512GB SSD',
    true,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'computer-laptop'),
    'Custom Gaming & Studio Desktops',
    'custom-gaming-studio-desktops',
    'RTX 40-Series GPUs, Liquid Cooling, DDR5 memory',
    true,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'computer-laptop'),
    'Commercial All-in-One (AIO) PCs',
    'commercial-all-in-one-aio-pcs',
    '24" & 27" IPS Anti-glare displays, wireless peripherals',
    false,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'computer-laptop'),
    'Workstation Towers for CAD / 3D',
    'workstation-towers-cad-3d',
    'ECC Memory, Intel Xeon / AMD Threadripper options',
    false,
    true
  ),

-- Category 2: CCTV Surveillance (4 products)
  (
    (SELECT id FROM public.categories WHERE slug = 'cctv'),
    'Full HD Dome & Bullet IP Cameras',
    'full-hd-dome-bullet-ip-cameras',
    'Night Vision, Motion Detection, Weatherproof IP67',
    true,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'cctv'),
    '4K ColorVu / Starlight Cameras',
    '4k-colorvu-starlight-cameras',
    '24/7 Full-Color imaging in ultra low-light conditions',
    true,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'cctv'),
    'Network Video Recorders (NVR / DVR)',
    'network-video-recorders-nvr-dvr',
    '8/16/32 Channel with surveillance-grade 4TB-10TB HDDs',
    false,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'cctv'),
    'PTZ 360° Zoom Cameras',
    'ptz-360-zoom-cameras',
    'Auto-tracking, Optical zoom, 2-way audio intercom',
    false,
    true
  ),

-- Category 3: Printer (4 products)
  (
    (SELECT id FROM public.categories WHERE slug = 'printer'),
    'Continuous Ink Tank Multifunction Printers',
    'continuous-ink-tank-multifunction-printers',
    'Ultra-low cost per print, Wi-Fi Direct, Auto Duplex',
    true,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'printer'),
    'High-Speed Monochrome Laser Printers',
    'high-speed-monochrome-laser-printers',
    'Up to 40 ppm, heavy duty monthly cycle for billing',
    true,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'printer'),
    'Color Laser & Multi-function Copiers',
    'color-laser-multi-function-copiers',
    'Network printing, scanning, ADF feeder, enterprise secure',
    false,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'printer'),
    'Barcode & Thermal Receipt Printers',
    'barcode-thermal-receipt-printers',
    'High-speed POS thermal receipt & label barcode printing',
    false,
    true
  ),

-- Category 4: Biometric Machine (4 products)
  (
    (SELECT id FROM public.categories WHERE slug = 'biometric-machine'),
    'AI Face Recognition Attendance System',
    'ai-face-recognition-attendance-system',
    'Contactless high-speed verification with mask detection',
    true,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'biometric-machine'),
    'Optical Fingerprint Attendance Terminal',
    'optical-fingerprint-attendance-terminal',
    'High-precision optical sensor, USB/TCP-IP/Wi-Fi export',
    true,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'biometric-machine'),
    'RFID Proximity Card Punching Devices',
    'rfid-proximity-card-punching-devices',
    'Card + PIN dual authentication, battery backup',
    false,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'biometric-machine'),
    'Electromagnetic Door Access Controllers',
    'electromagnetic-door-access-controllers',
    'Integrated with biometric terminal & emergency override',
    false,
    true
  ),

-- Category 5: Accessories (4 products)
  (
    (SELECT id FROM public.categories WHERE slug = 'accessories'),
    'High-Speed NVMe M.2 SSDs & External Drives',
    'high-speed-nvme-m2-ssds-external-drives',
    'Gen 4x4 speeds up to 7400MB/s, 500GB - 4TB',
    true,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'accessories'),
    'Dual-Band Wi-Fi 6 Routers & PoE Gigabit Switches',
    'dual-band-wifi-6-routers-poe-gigabit-switches',
    'High gain multi-antenna, seamless mesh office coverage',
    true,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'accessories'),
    'Commercial & Mechanical Keyboards + Mice',
    'commercial-mechanical-keyboards-mice',
    'Ergonomic wired/wireless, silent keys, spill-resistant',
    false,
    true
  ),
  (
    (SELECT id FROM public.categories WHERE slug = 'accessories'),
    'Certified HDMI, DisplayPort & Cat6 Patch Cables',
    'certified-hdmi-displayport-cat6-patch-cables',
    '4K/8K shielded, heavy gold-plated connector pins',
    false,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  spec_summary = EXCLUDED.spec_summary,
  is_featured = EXCLUDED.is_featured,
  is_active = EXCLUDED.is_active,
  updated_at = timezone('utc'::text, now());
