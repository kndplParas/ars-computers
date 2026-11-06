-- ============================================================================
-- ARS Computers — Product short description seed
-- Migration: 20261106000002_product_short_description_seed.sql
-- ============================================================================
-- Populates short_description for every existing audited product. Updates are
-- matched strictly by slug and fail loudly if a referenced product is missing.
-- No IDs, categories, images, prices, stock, cost_price or permissions are modified.
-- ============================================================================

UPDATE public.products SET
  short_description = $ars_short_description$Twelve-volt DC male and female pigtail connectors for powering CCTV cameras or repairing camera power leads, with standard barrel plugs. Pack quantity is confirmed at order.$ars_short_description$
WHERE slug = '12v-dc-cctv-power-pigtail-connectors';

UPDATE public.products SET
  short_description = $ars_short_description$An Acer performance notebook for users who need headroom for design, analysis and multitasking, supported by enhanced cooling and multi-core options. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'acer-performance-laptop';

UPDATE public.products SET
  short_description = $ars_short_description$An Acer Veriton commercial tower for expandable, quiet everyday computing and multi-display support in offices. Exact configuration is confirmed at order.$ars_short_description$
WHERE slug = 'acer-veriton-commercial-tower';

UPDATE public.products SET
  short_description = $ars_short_description$An ASUS wired keyboard and optical mouse set for offices, schools and accounting desks, with UV-coated keys and everyday USB connectivity. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'asus-desktop-keyboard-mouse-set';

UPDATE public.products SET
  short_description = $ars_short_description$An ASUS desktop motherboard for custom builds, with board-dependent PCIe and M.2 expansion. Exact socket, chipset and memory type are confirmed at order.$ars_short_description$
WHERE slug = 'asus-desktop-motherboard';

UPDATE public.products SET
  short_description = $ars_short_description$A reinforced ASUS TUF gaming laptop for gaming, design and graphics-heavy work, with dedicated NVIDIA GeForce options on supported models. Exact GPU and configuration are confirmed at order.$ars_short_description$
WHERE slug = 'asus-tuf-gaming-laptop';

UPDATE public.products SET
  short_description = $ars_short_description$A direct-thermal receipt and barcode label printer for POS counters, inventory and billing locations, with no ink or toner required. Paper width and interface are confirmed at order.$ars_short_description$
WHERE slug = 'barcode-thermal-receipt-printers';

UPDATE public.products SET
  short_description = $ars_short_description$A braided gold-plated HDMI cable for high-quality digital audio and 4K video between computers, monitors, TVs and projectors. Exact length and bandwidth are confirmed at order.$ars_short_description$
WHERE slug = 'braided-4k-high-speed-hdmi-cable';

UPDATE public.products SET
  short_description = $ars_short_description$A Brother colour laser multifunction for offices needing colour printing, copying and scanning, with automatic document feeding for multi-page jobs. Exact model and toner are confirmed at order.$ars_short_description$
WHERE slug = 'brother-color-mfp-copier-adf';

UPDATE public.products SET
  short_description = $ars_short_description$A heavy-duty Brother commercial colour copier for departments with sustained print and copy volumes, combining large flatbed scanning and high-capacity paper handling. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'brother-commercial-color-copier';

UPDATE public.products SET
  short_description = $ars_short_description$A compact Brother HL monochrome laser printer for fast black-and-white printing in retail and small offices, with an enclosed cassette and simple toner replacement. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'brother-mono-laser-printer';

UPDATE public.products SET
  short_description = $ars_short_description$A Canon imageCLASS monochrome laser printer for productive black-and-white documents in offices and billing desks, with business-class paper handling. Exact model and toner code are confirmed at order.$ars_short_description$
WHERE slug = 'canon-imageclass-mono-laser-printer';

UPDATE public.products SET
  short_description = $ars_short_description$A Canon PIXMA G-series multifunction printer with refillable reservoirs for economical colour and photo printing. Exact model, speeds and paper handling are confirmed at order.$ars_short_description$
WHERE slug = 'canon-pixma-ink-tank-printer';

UPDATE public.products SET
  short_description = $ars_short_description$A Cat6 UTP patch cord for reliable gigabit office and camera cabling, with snagless RJ45 plugs and twisted-pair construction. Exact length is confirmed at order.$ars_short_description$
WHERE slug = 'cat6-gigabit-ethernet-patch-cord';

UPDATE public.products SET
  short_description = $ars_short_description$Shielded CCTV 3+1 cable combining video and power conductors in a single jacket for efficient camera wiring. Exact coil length and conductor specification are confirmed at order.$ars_short_description$
WHERE slug = 'cctv-3-plus-1-coaxial-video-cable';

UPDATE public.products SET
  short_description = $ars_short_description$A commercial all-in-one desktop that integrates display and components into a slim, space-saving 24-inch-class system for reception, billing and meeting areas. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'commercial-slim-all-in-one-pc';

UPDATE public.products SET
  short_description = $ars_short_description$A compact personal mono-laser desktop printer for simple black-and-white documents, with easy one-cartridge replacement and a small counter footprint. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'compact-desktop-mono-laser-printer';

UPDATE public.products SET
  short_description = $ars_short_description$A compact portable 2.4 GHz wireless mouse for travel bags and laptop sleeves, with energy-saving auto-sleep and minimal space use. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'compact-portable-wireless-mouse';

UPDATE public.products SET
  short_description = $ars_short_description$An air CPU cooler with direct-contact copper heatpipes and an RGB PWM fan for quieter gaming and performance builds. Exact socket kit and cooler height are confirmed at order.$ars_short_description$
WHERE slug = 'cooler-master-rgb-cpu-cooler';

UPDATE public.products SET
  short_description = $ars_short_description$A modular Corsair RM-series ATX power supply for gaming and commercial desktop builds, combining 80 PLUS efficiency and modular cabling. Exact wattage and connectors are confirmed at order.$ars_short_description$
WHERE slug = 'corsair-modular-atx-smps-power-supply';

UPDATE public.products SET
  short_description = $ars_short_description$Low-profile Corsair Vengeance LPX DDR4 memory for desktop performance and gaming builds, with an aluminium heat spreader. Exact kit speed and capacity are confirmed at order.$ars_short_description$
WHERE slug = 'corsair-vengeance-lpx-ddr4-ram';

UPDATE public.products SET
  short_description = $ars_short_description$A motorised CP PLUS 360-degree pan-tilt smart Wi-Fi camera for indoor rooms, with motion tracking and two-way audio. Exact resolution, storage and app features are confirmed at order.$ars_short_description$
WHERE slug = 'cp-plus-360-ptz-smart-camera';

UPDATE public.products SET
  short_description = $ars_short_description$An indoor CP PLUS Full HD dome camera for shops, offices and small premises, with high-sensitivity imaging and automatic day/night switching. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'cp-plus-full-hd-dome-camera';

UPDATE public.products SET
  short_description = $ars_short_description$A CP PLUS RFID attendance terminal for quick card-based punching, audible confirmation and offline log storage. Exact model, capacity and card frequency are confirmed at order.$ars_short_description$
WHERE slug = 'cp-plus-rfid-attendance-device';

UPDATE public.products SET
  short_description = $ars_short_description$A complete custom gaming and studio desk setup with curved display, RGB tower and backlit peripherals. Built to your budget for gaming, streaming and media production.$ars_short_description$
WHERE slug = 'custom-gaming-studio-workstation-setup';

UPDATE public.products SET
  short_description = $ars_short_description$A custom liquid-cooled gaming rig in a dual-chamber tempered-glass chassis for high-end gaming, rendering and content creation. Components are selected and tested before delivery.$ars_short_description$
WHERE slug = 'custom-liquid-cooled-gaming-rig';

UPDATE public.products SET
  short_description = $ars_short_description$A practical Dell Inspiron laptop for business multitasking, students and home offices, with a lifted typing angle and everyday connectivity. Exact configuration is confirmed at order.$ars_short_description$
WHERE slug = 'dell-inspiron-business-laptop';

UPDATE public.products SET
  short_description = $ars_short_description$An official Dell KB216 wired keyboard with a 104-key layout, numeric keypad and multimedia controls for simple, reliable office deployment.$ars_short_description$
WHERE slug = 'dell-kb216-wired-multimedia-keyboard';

UPDATE public.products SET
  short_description = $ars_short_description$An official Dell KM3322W full-size wireless keyboard and mouse for clean, cable-free office desks, using a 2.4 GHz receiver and low-profile keys.$ars_short_description$
WHERE slug = 'dell-km3322w-wireless-combo';

UPDATE public.products SET
  short_description = $ars_short_description$A durable Dell Latitude commercial laptop for office and administrative work. Choose current stock after confirming the exact processor, memory, storage and display configuration with ARS Computers.$ars_short_description$
WHERE slug = 'dell-latitude-business-laptop';

UPDATE public.products SET
  short_description = $ars_short_description$An official Dell MS116 three-button optical mouse with 1000 DPI tracking and a symmetrical shape, for reliable everyday use at the desk.$ars_short_description$
WHERE slug = 'dell-ms116-usb-optical-mouse';

UPDATE public.products SET
  short_description = $ars_short_description$A Dell Precision professional workstation tower for CAD, BIM and 3D rendering, with workstation-class expansion and cooling. Exact configuration is confirmed at order.$ars_short_description$
WHERE slug = 'dell-precision-cad-workstation-tower';

UPDATE public.products SET
  short_description = $ars_short_description$A Dell OptiPlex Small Form Factor desktop for full business computing in a compact footprint, suitable for offices and billing counters. Exact configuration is confirmed at order.$ars_short_description$
WHERE slug = 'dell-sff-compact-workstation';

UPDATE public.products SET
  short_description = $ars_short_description$An official Dell WM126 2.4 GHz wireless optical mouse with 1000 DPI tracking and an internal receiver slot, for cable-free everyday work.$ars_short_description$
WHERE slug = 'dell-wm126-wireless-optical-mouse';

UPDATE public.products SET
  short_description = $ars_short_description$A moulded Indian 3-pin-to-IEC C13 power cord for desktop PCs, monitors and printers, providing a dependable grounded connection. Exact length and rating are confirmed at order.$ars_short_description$
WHERE slug = 'desktop-pc-monitor-3-pin-power-cord';

UPDATE public.products SET
  short_description = $ars_short_description$A DisplayPort 1.4 monitor cable with latching connectors for gaming displays and CAD workstations, supporting high-refresh 4K on compatible hardware. Exact length is confirmed at order.$ars_short_description$
WHERE slug = 'displayport-1-4-monitor-cable';

UPDATE public.products SET
  short_description = $ars_short_description$Dual-band Wi-Fi 6 and PoE gigabit networking gear for offices, shops and small sites. Exact model, port count and PoE budget are confirmed at order.$ars_short_description$
WHERE slug = 'dual-band-wifi-6-routers-poe-gigabit-switches';

UPDATE public.products SET
  short_description = $ars_short_description$Electromagnetic door locks and access hardware for doors controlled by biometric or RFID terminals. Holding force, brackets and exit devices are matched to the door at order.$ars_short_description$
WHERE slug = 'electromagnetic-door-access-controllers';

UPDATE public.products SET
  short_description = $ars_short_description$A matte, wide-viewing-angle all-in-one commercial desktop for billing desks and administrative counters, designed for low-reflection visibility and tidy cable-free setups. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'enterprise-matte-all-in-one-pc';

UPDATE public.products SET
  short_description = $ars_short_description$An Epson EcoTank multifunction printer with refillable ink tanks for economical print, scan and copy work. Exact model, speeds, capacity and connectivity are confirmed at order.$ars_short_description$
WHERE slug = 'epson-ecotank-ink-tank-printer';

UPDATE public.products SET
  short_description = $ars_short_description$An ergonomic wired optical mouse with a full palm arch and low-friction glide skates for all-day business use. Exact hand fit and DPI are confirmed at order.$ars_short_description$
WHERE slug = 'ergonomic-commercial-wired-mouse';

UPDATE public.products SET
  short_description = $ars_short_description$A full-size ergonomic wireless keyboard and optical mouse for all-day typing and data entry, with a numeric keypad and cable-free setup. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'ergonomic-full-size-wireless-combo';

UPDATE public.products SET
  short_description = $ars_short_description$An eSSL RFID and keypad attendance terminal for offices and sites, supporting card and PIN authentication with payroll export via eSSL software. Card frequency is confirmed at order.$ars_short_description$
WHERE slug = 'essl-rfid-card-keypad-terminal';

UPDATE public.products SET
  short_description = $ars_short_description$A heavy-duty VGA cable for legacy monitors and projectors, with dual ferrite noise cores and gold-plated D-Sub pins for steadier analog signal. Exact length is confirmed at order.$ars_short_description$
WHERE slug = 'heavy-duty-15-pin-vga-cable';

UPDATE public.products SET
  short_description = $ars_short_description$Heavy-duty BNC compression video connectors for RG59 coaxial CCTV cable, with gold-plated centre pins and metallic locking collars. Cable and pack quantity are confirmed at order.$ars_short_description$
WHERE slug = 'heavy-duty-bnc-compression-video-connectors';

UPDATE public.products SET
  short_description = $ars_short_description$High-performance thermal compound to improve heat transfer between the CPU or GPU and its cooler. Exact brand, quantity and conductivity are confirmed at order.$ars_short_description$
WHERE slug = 'high-performance-thermal-paste-compound';

UPDATE public.products SET
  short_description = $ars_short_description$A PCIe Gen4 NVMe M.2 SSD or portable USB-C drive for fast storage and large-file workflows. Capacity and exact model are confirmed at order.$ars_short_description$
WHERE slug = 'high-speed-nvme-m2-ssds-external-drives';

UPDATE public.products SET
  short_description = $ars_short_description$A Hikvision ColorVu 4K outdoor bullet camera for detail-rich surveillance in low light, using a large-aperture lens and warm-light supplement for full-colour night imaging. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'hikvision-colorvu-4k-bullet-camera';

UPDATE public.products SET
  short_description = $ars_short_description$An indoor ceiling-mount Hikvision Full HD dome camera for offices, corridors and retail areas, with infrared night vision for low-light monitoring. Exact model and recorder compatibility are confirmed at order.$ars_short_description$
WHERE slug = 'hikvision-full-hd-dome-camera';

UPDATE public.products SET
  short_description = $ars_short_description$A Hikvision MinMoe AI face-recognition terminal for touchless attendance and door access, with dual-lens anti-spoofing. Exact model, capacity and software are confirmed at order.$ars_short_description$
WHERE slug = 'hikvision-minmoe-face-terminal';

UPDATE public.products SET
  short_description = $ars_short_description$A fixed wall-mount Hikvision face terminal for entrances and reception attendance, supporting mask detection and voice prompts on supported models. Exact model and capacity are confirmed at order.$ars_short_description$
WHERE slug = 'hikvision-wall-mount-face-terminal';

UPDATE public.products SET
  short_description = $ars_short_description$An HP 230 combo with low-profile chiclet keys and a compact ambidextrous mouse for quiet, tidy office desks. Battery type and exact layout are confirmed at order.$ars_short_description$
WHERE slug = 'hp-230-wireless-keyboard-combo';

UPDATE public.products SET
  short_description = $ars_short_description$An HP Color LaserJet Enterprise MFP for departmental colour printing, copying and scanning on a shared network, built for managed business environments. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'hp-color-laserjet-enterprise-mfp';

UPDATE public.products SET
  short_description = $ars_short_description$A premium HP EliteBook corporate laptop for executives and managers who need durability, business security features and multi-port connectivity. Configuration depends on current stock.$ars_short_description$
WHERE slug = 'hp-elitebook-corporate-laptop';

UPDATE public.products SET
  short_description = $ars_short_description$An HP wired gaming mouse with adjustable DPI and textured side grips for gaming and precise editing. Exact DPI range and button layout are confirmed at order.$ars_short_description$
WHERE slug = 'hp-gaming-optical-mouse';

UPDATE public.products SET
  short_description = $ars_short_description$An HP mechanical gaming keyboard with tactile switches and multi-mode RGB lighting for gaming, streaming and heavy typing. Exact model and switch type are confirmed at order.$ars_short_description$
WHERE slug = 'hp-mechanical-rgb-keyboard';

UPDATE public.products SET
  short_description = $ars_short_description$A slim HP Pavilion laptop for home-office, accounting and general business computing, with a numeric keypad and anti-glare display options. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'hp-pavilion-silver-slim-laptop';

UPDATE public.products SET
  short_description = $ars_short_description$A dependable HP ProBook commercial laptop for growing businesses, combining durable business-class construction with comfortable everyday productivity and versatile expansion ports.$ars_short_description$
WHERE slug = 'hp-probook-commercial-laptop';

UPDATE public.products SET
  short_description = $ars_short_description$Kingston desktop memory for commercial PC and office upgrades. The DDR generation and capacity must match your motherboard; exact option is confirmed at order.$ars_short_description$
WHERE slug = 'kingston-desktop-ddr-ram-module';

UPDATE public.products SET
  short_description = $ars_short_description$A Lenovo 300 wireless combo with island keys, a contoured optical mouse and water-resistant drainage on supported models, built for comfortable office work. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'lenovo-300-wireless-keyboard-combo';

UPDATE public.products SET
  short_description = $ars_short_description$A Lenovo commercial laptop for everyday office productivity, comfortable typing and dependable business use. Exact model and internal configuration are confirmed at order.$ars_short_description$
WHERE slug = 'lenovo-commercial-office-laptop';

UPDATE public.products SET
  short_description = $ars_short_description$A Lenovo ThinkCentre commercial desktop with tool-less service access and dependable office performance. Exact processor, memory, storage and warranty are confirmed at order.$ars_short_description$
WHERE slug = 'lenovo-thinkcentre-desktop-tower';

UPDATE public.products SET
  short_description = $ars_short_description$An ergonomic Lenovo wireless optical mouse with a comfort grip and rubber-scroll wheel for long office sessions. Exact model and DPI are confirmed at order.$ars_short_description$
WHERE slug = 'lenovo-wireless-ergonomic-mouse';

UPDATE public.products SET
  short_description = $ars_short_description$A compact premium wireless keyboard with dished keys, smart proximity backlighting and multi-device pairing, for designers, developers and travelling professionals.$ars_short_description$
WHERE slug = 'logitech-mx-keys-mini-keyboard';

UPDATE public.products SET
  short_description = $ars_short_description$A Logitech full-size wireless multimedia keyboard with media hotkeys and quiet, spill-resistant construction for shared desks. Exact model and battery details are confirmed at order.$ars_short_description$
WHERE slug = 'logitech-wireless-multimedia-keyboard';

UPDATE public.products SET
  short_description = $ars_short_description$A Mantra USB optical fingerprint scanner for attendance and identity workflows, with a scratch-resistant sensor. Exact model, SDK and certification are confirmed at order.$ars_short_description$
WHERE slug = 'mantra-optical-fingerprint-scanner';

UPDATE public.products SET
  short_description = $ars_short_description$A multi-channel DVR/NVR recorder that captures and plays back surveillance footage locally and over a network. Channel count, camera technology and storage are selected at order.$ars_short_description$
WHERE slug = 'multi-channel-cctv-dvr-nvr-recorder';

UPDATE public.products SET
  short_description = $ars_short_description$A multi-channel 12 V DC CCTV power supply with individual channel fuses for centralised CCTV power distribution. Rating and channel count are confirmed at order.$ars_short_description$
WHERE slug = 'multi-channel-cctv-smps-power-supply';

UPDATE public.products SET
  short_description = $ars_short_description$An NVIDIA GeForce graphics card for gaming, 3D rendering and video creation. Exact GPU model, VRAM capacity and power requirement are confirmed at order.$ars_short_description$
WHERE slug = 'nvidia-geforce-dedicated-graphics-card';

UPDATE public.products SET
  short_description = $ars_short_description$A 2.5-inch Samsung 870 EVO SATA solid-state drive for simple laptop and desktop storage upgrades, improving everyday responsiveness. Capacity is confirmed at order.$ars_short_description$
WHERE slug = 'samsung-870-evo-sata-ssd';

UPDATE public.products SET
  short_description = $ars_short_description$An internal SATA III cable for desktop SSDs, hard drives and optical drives, supporting 6 Gbps transfer and locking connectors. Exact length is confirmed at order.$ars_short_description$
WHERE slug = 'sata-6gbps-internal-drive-cable';

UPDATE public.products SET
  short_description = $ars_short_description$A 3.5-inch Seagate BarraCuda hard drive for high-capacity desktop storage, archiving and secondary backup. Exact model and RPM are confirmed at order.$ars_short_description$
WHERE slug = 'seagate-barracuda-3-5-inch-hdd';

UPDATE public.products SET
  short_description = $ars_short_description$A slim low-profile chiclet keyboard for quiet, compact desktop setups, with short key travel and a minimal appearance. Exact model and layout are confirmed at order.$ars_short_description$
WHERE slug = 'slim-chiclet-low-profile-keyboard';

UPDATE public.products SET
  short_description = $ars_short_description$A weatherproof outdoor Wi-Fi bullet camera for gates and building exteriors, with motion alerts and smartphone viewing. Exact resolution and app support are confirmed at order.$ars_short_description$
WHERE slug = 'smart-outdoor-wifi-bullet-camera';

UPDATE public.products SET
  short_description = $ars_short_description$A standard 104-key wired office keyboard with adjustable tilt legs and tactile membrane keys, ideal for offices, schools and billing counters. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'standard-office-wired-keyboard';

UPDATE public.products SET
  short_description = $ars_short_description$A lightweight ultra-slim metallic notebook for consultants and mobile professionals who need a compact, travel-friendly workspace. Multi-brand configuration is confirmed at order.$ars_short_description$
WHERE slug = 'ultra-slim-metallic-notebook';

UPDATE public.products SET
  short_description = $ars_short_description$A reversible braided USB Type-C charging and data cable for phones, laptops, tablets and storage drives. Exact power rating and data speed are confirmed at order.$ars_short_description$
WHERE slug = 'usb-type-c-fast-charging-data-cable';

UPDATE public.products SET
  short_description = $ars_short_description$A full-size wireless keyboard and optical mouse set for cable-free office, front-desk and home-office work, with a numeric keypad for daily business tasks. Exact model is confirmed at order.$ars_short_description$
WHERE slug = 'wireless-office-keyboard-mouse-combo';

UPDATE public.products SET
  short_description = $ars_short_description$A Zebronics wired optical mouse with a lightweight shape and high-precision tracking for everyday computer use. Exact model, DPI and cable length are confirmed at order.$ars_short_description$
WHERE slug = 'zebronics-optical-wired-mouse';

-- Verification: every expected slug must exist and have a non-empty summary.
DO $$
DECLARE
  v_missing INTEGER;
  v_blank INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_missing
  FROM (VALUES ('12v-dc-cctv-power-pigtail-connectors'), ('acer-performance-laptop'), ('acer-veriton-commercial-tower'), ('asus-desktop-keyboard-mouse-set'), ('asus-desktop-motherboard'), ('asus-tuf-gaming-laptop'), ('barcode-thermal-receipt-printers'), ('braided-4k-high-speed-hdmi-cable'), ('brother-color-mfp-copier-adf'), ('brother-commercial-color-copier'), ('brother-mono-laser-printer'), ('canon-imageclass-mono-laser-printer'), ('canon-pixma-ink-tank-printer'), ('cat6-gigabit-ethernet-patch-cord'), ('cctv-3-plus-1-coaxial-video-cable'), ('commercial-slim-all-in-one-pc'), ('compact-desktop-mono-laser-printer'), ('compact-portable-wireless-mouse'), ('cooler-master-rgb-cpu-cooler'), ('corsair-modular-atx-smps-power-supply'), ('corsair-vengeance-lpx-ddr4-ram'), ('cp-plus-360-ptz-smart-camera'), ('cp-plus-full-hd-dome-camera'), ('cp-plus-rfid-attendance-device'), ('custom-gaming-studio-workstation-setup'), ('custom-liquid-cooled-gaming-rig'), ('dell-inspiron-business-laptop'), ('dell-kb216-wired-multimedia-keyboard'), ('dell-km3322w-wireless-combo'), ('dell-latitude-business-laptop'), ('dell-ms116-usb-optical-mouse'), ('dell-precision-cad-workstation-tower'), ('dell-sff-compact-workstation'), ('dell-wm126-wireless-optical-mouse'), ('desktop-pc-monitor-3-pin-power-cord'), ('displayport-1-4-monitor-cable'), ('dual-band-wifi-6-routers-poe-gigabit-switches'), ('electromagnetic-door-access-controllers'), ('enterprise-matte-all-in-one-pc'), ('epson-ecotank-ink-tank-printer'), ('ergonomic-commercial-wired-mouse'), ('ergonomic-full-size-wireless-combo'), ('essl-rfid-card-keypad-terminal'), ('heavy-duty-15-pin-vga-cable'), ('heavy-duty-bnc-compression-video-connectors'), ('high-performance-thermal-paste-compound'), ('high-speed-nvme-m2-ssds-external-drives'), ('hikvision-colorvu-4k-bullet-camera'), ('hikvision-full-hd-dome-camera'), ('hikvision-minmoe-face-terminal'), ('hikvision-wall-mount-face-terminal'), ('hp-230-wireless-keyboard-combo'), ('hp-color-laserjet-enterprise-mfp'), ('hp-elitebook-corporate-laptop'), ('hp-gaming-optical-mouse'), ('hp-mechanical-rgb-keyboard'), ('hp-pavilion-silver-slim-laptop'), ('hp-probook-commercial-laptop'), ('kingston-desktop-ddr-ram-module'), ('lenovo-300-wireless-keyboard-combo'), ('lenovo-commercial-office-laptop'), ('lenovo-thinkcentre-desktop-tower'), ('lenovo-wireless-ergonomic-mouse'), ('logitech-mx-keys-mini-keyboard'), ('logitech-wireless-multimedia-keyboard'), ('mantra-optical-fingerprint-scanner'), ('multi-channel-cctv-dvr-nvr-recorder'), ('multi-channel-cctv-smps-power-supply'), ('nvidia-geforce-dedicated-graphics-card'), ('samsung-870-evo-sata-ssd'), ('sata-6gbps-internal-drive-cable'), ('seagate-barracuda-3-5-inch-hdd'), ('slim-chiclet-low-profile-keyboard'), ('smart-outdoor-wifi-bullet-camera'), ('standard-office-wired-keyboard'), ('ultra-slim-metallic-notebook'), ('usb-type-c-fast-charging-data-cable'), ('wireless-office-keyboard-mouse-combo'), ('zebronics-optical-wired-mouse')) AS v(slug)
  LEFT JOIN public.products p ON p.slug = v.slug
  WHERE p.slug IS NULL;

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Short description seed: % catalogue slugs were not found', v_missing;
  END IF;

  SELECT COUNT(*) INTO v_blank
  FROM public.products p
  WHERE p.slug IN (SELECT slug FROM (VALUES ('12v-dc-cctv-power-pigtail-connectors'), ('acer-performance-laptop'), ('acer-veriton-commercial-tower'), ('asus-desktop-keyboard-mouse-set'), ('asus-desktop-motherboard'), ('asus-tuf-gaming-laptop'), ('barcode-thermal-receipt-printers'), ('braided-4k-high-speed-hdmi-cable'), ('brother-color-mfp-copier-adf'), ('brother-commercial-color-copier'), ('brother-mono-laser-printer'), ('canon-imageclass-mono-laser-printer'), ('canon-pixma-ink-tank-printer'), ('cat6-gigabit-ethernet-patch-cord'), ('cctv-3-plus-1-coaxial-video-cable'), ('commercial-slim-all-in-one-pc'), ('compact-desktop-mono-laser-printer'), ('compact-portable-wireless-mouse'), ('cooler-master-rgb-cpu-cooler'), ('corsair-modular-atx-smps-power-supply'), ('corsair-vengeance-lpx-ddr4-ram'), ('cp-plus-360-ptz-smart-camera'), ('cp-plus-full-hd-dome-camera'), ('cp-plus-rfid-attendance-device'), ('custom-gaming-studio-workstation-setup'), ('custom-liquid-cooled-gaming-rig'), ('dell-inspiron-business-laptop'), ('dell-kb216-wired-multimedia-keyboard'), ('dell-km3322w-wireless-combo'), ('dell-latitude-business-laptop'), ('dell-ms116-usb-optical-mouse'), ('dell-precision-cad-workstation-tower'), ('dell-sff-compact-workstation'), ('dell-wm126-wireless-optical-mouse'), ('desktop-pc-monitor-3-pin-power-cord'), ('displayport-1-4-monitor-cable'), ('dual-band-wifi-6-routers-poe-gigabit-switches'), ('electromagnetic-door-access-controllers'), ('enterprise-matte-all-in-one-pc'), ('epson-ecotank-ink-tank-printer'), ('ergonomic-commercial-wired-mouse'), ('ergonomic-full-size-wireless-combo'), ('essl-rfid-card-keypad-terminal'), ('heavy-duty-15-pin-vga-cable'), ('heavy-duty-bnc-compression-video-connectors'), ('high-performance-thermal-paste-compound'), ('high-speed-nvme-m2-ssds-external-drives'), ('hikvision-colorvu-4k-bullet-camera'), ('hikvision-full-hd-dome-camera'), ('hikvision-minmoe-face-terminal'), ('hikvision-wall-mount-face-terminal'), ('hp-230-wireless-keyboard-combo'), ('hp-color-laserjet-enterprise-mfp'), ('hp-elitebook-corporate-laptop'), ('hp-gaming-optical-mouse'), ('hp-mechanical-rgb-keyboard'), ('hp-pavilion-silver-slim-laptop'), ('hp-probook-commercial-laptop'), ('kingston-desktop-ddr-ram-module'), ('lenovo-300-wireless-keyboard-combo'), ('lenovo-commercial-office-laptop'), ('lenovo-thinkcentre-desktop-tower'), ('lenovo-wireless-ergonomic-mouse'), ('logitech-mx-keys-mini-keyboard'), ('logitech-wireless-multimedia-keyboard'), ('mantra-optical-fingerprint-scanner'), ('multi-channel-cctv-dvr-nvr-recorder'), ('multi-channel-cctv-smps-power-supply'), ('nvidia-geforce-dedicated-graphics-card'), ('samsung-870-evo-sata-ssd'), ('sata-6gbps-internal-drive-cable'), ('seagate-barracuda-3-5-inch-hdd'), ('slim-chiclet-low-profile-keyboard'), ('smart-outdoor-wifi-bullet-camera'), ('standard-office-wired-keyboard'), ('ultra-slim-metallic-notebook'), ('usb-type-c-fast-charging-data-cable'), ('wireless-office-keyboard-mouse-combo'), ('zebronics-optical-wired-mouse')) AS v(slug))
    AND (p.short_description IS NULL OR btrim(p.short_description) = '');

  IF v_blank > 0 THEN
    RAISE EXCEPTION 'Short description seed: % catalogue products were left without a summary', v_blank;
  END IF;
END;
$$;
