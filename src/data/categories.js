import { PRODUCT_IMAGES } from './productImages.js'

export const CATEGORIES = [
  // ==========================================================================
  // Category 1: Computer / Laptop (13 Individual Products)
  // ==========================================================================
  {
    id: 'computer-laptop',
    slug: 'computer-laptop',
    title: 'Computer / Laptop',
    shortTitle: 'Computer / Laptop',
    tagline: 'High-performance Desktops, Custom PCs & Laptops',
    description: 'Distinct business laptops, dedicated gaming notebooks, custom-assembled liquid-cooled desktop rigs, and enterprise CAD workstations.',
    icon: '💻',
    badge: 'Popular',
    products: [
      // --- Laptops ---
      {
        slug: 'dell-latitude-business-laptop',
        name: 'Dell Latitude Business Laptop',
        brand: 'Dell',
        model: 'Latitude Series',
        spec: 'Intel Core i5, 16GB RAM, 512GB SSD (Contact us to confirm configuration)',
        description: 'Commercial-grade Dell Latitude series business laptop featuring a durable matte black chassis, precision touchpad, and enterprise security management. Built for corporate office workflows, business travel, and administrative workloads.',
        isGeneric: false,
        images: PRODUCT_IMAGES['dell-latitude-business-laptop'] || []
      },
      {
        slug: 'lenovo-commercial-office-laptop',
        name: 'Lenovo Commercial Office Laptop',
        brand: 'Lenovo',
        model: 'Commercial Series',
        spec: 'Ergonomic Island Keyboard with TrackPoint (Contact us to confirm configuration)',
        description: 'Lenovo commercial business laptop designed for high typing comfort and long-hour reliability. Features an ergonomic keyboard, robust hinge mechanism, and matte anti-glare display for office productivity.',
        isGeneric: false,
        images: PRODUCT_IMAGES['lenovo-commercial-office-laptop'] || []
      },
      {
        slug: 'hp-elitebook-corporate-laptop',
        name: 'HP EliteBook Corporate Laptop',
        brand: 'HP',
        model: 'EliteBook Series',
        spec: 'Precision Aluminum Chassis, Multi-Port Connectivity (Contact us to confirm configuration)',
        description: 'HP EliteBook premium corporate laptop housed in a sleek silver-metallic chassis. Engineered for enterprise executives and business professionals requiring durability, crisp display output, and dependable performance.',
        isGeneric: false,
        images: PRODUCT_IMAGES['hp-elitebook-corporate-laptop'] || []
      },
      {
        slug: 'asus-tuf-gaming-laptop',
        name: 'ASUS TUF High-Performance Gaming Laptop',
        brand: 'ASUS',
        model: 'TUF Gaming Series',
        spec: 'Dedicated NVIDIA GeForce GPU, High Refresh-Rate Screen (Contact us to confirm configuration)',
        description: 'ASUS TUF high-performance laptop featuring a military-grade reinforced chassis, dual cooling fans, and dedicated graphics hardware for esports, content creation, and 3D rendering tasks.',
        isGeneric: false,
        images: PRODUCT_IMAGES['asus-tuf-gaming-laptop'] || []
      },
      {
        slug: 'dell-inspiron-business-laptop',
        name: 'Dell Inspiron Sleek Business Laptop',
        brand: 'Dell',
        model: 'Inspiron Series',
        spec: 'Narrow Border FHD Display, Ergonomic Lift Hinge (Contact us to confirm configuration)',
        description: 'Dell Inspiron portable laptop with narrow border display, ergonomic typing angle, and full-size island keyboard. Excellent for business multitasking, student computing, and everyday office requirements.',
        isGeneric: false,
        images: PRODUCT_IMAGES['dell-inspiron-business-laptop'] || []
      },
      {
        slug: 'hp-probook-commercial-laptop',
        name: 'HP ProBook Commercial Laptop',
        brand: 'HP',
        model: 'ProBook Series',
        spec: 'Commercial Workload Chassis, Spill-Resistant Keyboard (Contact us to confirm configuration)',
        description: 'HP ProBook business laptop built with reinforced hinges and security options for growing enterprises. Designed to handle continuous office workloads with versatile expansion ports.',
        isGeneric: false,
        images: PRODUCT_IMAGES['hp-probook-commercial-laptop'] || []
      },
      {
        slug: 'acer-performance-laptop',
        name: 'Acer High-Performance Laptop',
        brand: 'Acer',
        model: 'Performance Series',
        spec: 'Enhanced Thermal Dissipation, Multi-Core Processing (Contact us to confirm configuration)',
        description: 'Acer performance notebook equipped with dedicated thermal exhaust vents and high-efficiency multi-core processing architecture for intensive multi-application workflows and design software.',
        isGeneric: false,
        images: PRODUCT_IMAGES['acer-performance-laptop'] || []
      },
      {
        slug: 'ultra-slim-metallic-notebook',
        name: 'Ultra-Slim Metallic Notebook',
        brand: null,
        model: 'Slim Ultrabook Form Factor',
        spec: 'Lightweight Aluminum Unibody, Thin Bezel Display (Contact us to confirm configuration)',
        description: 'Ultra-slim lightweight notebook featuring an aluminum metallic finish and minimal bezels for maximum portability. Suitable for consultants, on-the-go professionals, and daily web conferencing.',
        isGeneric: true,
        images: PRODUCT_IMAGES['ultra-slim-metallic-notebook'] || []
      },
      {
        slug: 'hp-pavilion-silver-slim-laptop',
        name: 'HP Pavilion Silver Slim Laptop',
        brand: 'HP',
        model: 'Pavilion Series',
        spec: 'Full-Size Island Keyboard, Integrated Webcam & Mic (Contact us to confirm configuration)',
        description: 'HP Pavilion slim notebook finished in natural silver with numeric keypad and micro-edge anti-glare screen. A versatile choice for home office, accounting, and general commercial computing.',
        isGeneric: false,
        images: PRODUCT_IMAGES['hp-pavilion-silver-slim-laptop'] || []
      },

      // --- Desktops, Workstations & All-in-Ones ---
      {
        slug: 'custom-gaming-studio-workstation-setup',
        name: 'Custom Gaming Studio Workstation Setup',
        brand: 'Custom Built',
        model: 'Studio Desk Setup',
        spec: 'Curved Gaming Display + RGB Desktop Tower + Backlit Peripherals',
        description: 'Complete custom gaming and studio desktop setup incorporating a curved immersion monitor, dedicated RGB desktop tower, illuminated mechanical keyboard, and precision optical mouse for gaming and media production.',
        isGeneric: true,
        images: PRODUCT_IMAGES['custom-gaming-studio-workstation-setup'] || []
      },
      {
        slug: 'custom-liquid-cooled-gaming-rig',
        name: 'Custom Liquid-Cooled Gaming Desktop Rig',
        brand: 'Custom Built',
        model: 'Liquid-Cooled Edition',
        spec: 'Tempered Glass Panoramic Chassis, Closed-Loop Liquid Cooling, ARGB Fans',
        description: 'Custom-assembled high-end gaming desktop computer housed in a dual-chamber tempered glass chassis with integrated liquid CPU cooling loop and synchronized addressable RGB airflow fans.',
        isGeneric: true,
        images: PRODUCT_IMAGES['custom-liquid-cooled-gaming-rig'] || []
      },
      {
        slug: 'commercial-slim-all-in-one-pc',
        name: 'Commercial Slim All-in-One Desktop PC',
        brand: null,
        model: 'Slim AIO PC',
        spec: 'Integrated 24" Anti-Glare Screen, Ergonomic Metallic Arc Stand',
        description: 'Space-saving All-in-One desktop PC integrating processor, motherboard, and vibrant display into a single ultra-slim chassis with an elegant metallic arc stand. Ideal for reception desks and executive suites.',
        isGeneric: true,
        images: PRODUCT_IMAGES['commercial-slim-all-in-one-pc'] || []
      },
      {
        slug: 'enterprise-matte-all-in-one-pc',
        name: 'Enterprise Matte All-in-One Desktop Computer',
        brand: null,
        model: 'Matte Commercial AIO',
        spec: 'Wide-Viewing Angle Anti-Glare Screen, Internal Stereo Speakers',
        description: 'Commercial matte All-in-One desktop computer built for high-uptime office workstations, billing desks, and administrative counters without cluttered cable wiring.',
        isGeneric: true,
        images: PRODUCT_IMAGES['enterprise-matte-all-in-one-pc'] || []
      }
    ]
  },

  // ==========================================================================
  // Category 2: CCTV (6 Individual Products)
  // ==========================================================================
  {
    id: 'cctv',
    slug: 'cctv',
    title: 'CCTV',
    shortTitle: 'CCTV',
    tagline: 'HD Surveillance & Smart Monitoring Systems',
    description: 'High-definition dome and bullet IP cameras, full-color ColorVu night vision, motorized PTZ surveillance, and standalone video recorders.',
    icon: '📹',
    badge: 'Security',
    products: [
      {
        slug: 'hikvision-full-hd-dome-camera',
        name: 'Hikvision Full HD Dome Security Camera',
        brand: 'Hikvision',
        model: 'Full HD Dome Camera',
        spec: 'Indoor Ceiling Mount, Infrared Night Vision, Wide-Angle Lens',
        description: 'Hikvision Full HD indoor dome surveillance camera with integrated infrared night vision LEDs and vandal-resistant housing for office, retail, and home ceiling surveillance.',
        isGeneric: false,
        images: PRODUCT_IMAGES['hikvision-full-hd-dome-camera'] || []
      },
      {
        slug: 'cp-plus-full-hd-dome-camera',
        name: 'CP PLUS Full HD Dome Security Camera',
        brand: 'CP PLUS',
        model: 'HD Dome Series',
        spec: 'High-Sensitivity Sensor, IR Cut Filter, Compact Enclosure',
        description: 'CP PLUS Full HD dome security camera featuring automatic IR cut switching and high-sensitivity optical sensor for crisp surveillance monitoring in residential and commercial premises.',
        isGeneric: false,
        images: PRODUCT_IMAGES['cp-plus-full-hd-dome-camera'] || []
      },
      {
        slug: 'smart-outdoor-wifi-bullet-camera',
        name: 'Smart Outdoor Wi-Fi Bullet Security Camera',
        brand: null,
        model: 'Smart Wi-Fi Bullet',
        spec: 'Dual High-Gain Wireless Antennas, Weatherproof Wall Mount Bracket',
        description: 'Weatherproof outdoor bullet security camera equipped with dual high-gain external Wi-Fi antennas, motion detection alerts, and remote smartphone surveillance capability.',
        isGeneric: true,
        images: PRODUCT_IMAGES['smart-outdoor-wifi-bullet-camera'] || []
      },
      {
        slug: 'hikvision-colorvu-4k-bullet-camera',
        name: 'Hikvision ColorVu 4K Full-Color Night Bullet Camera',
        brand: 'Hikvision',
        model: 'ColorVu 4K Series',
        spec: '24/7 Full-Color Imaging, F1.0 Super Aperture, Weatherproof Enclosure',
        description: 'Hikvision ColorVu 4K bullet surveillance camera delivering 24/7 full-color video even in pitch-black darkness using an advanced F1.0 large aperture lens and supplemental warm lighting.',
        isGeneric: false,
        images: PRODUCT_IMAGES['hikvision-colorvu-4k-bullet-camera'] || []
      },
      {
        slug: 'multi-channel-cctv-dvr-nvr-recorder',
        name: 'Multi-Channel CCTV Network Video Recorder (DVR/NVR)',
        brand: null,
        model: 'Multi-Channel Standalone Recorder',
        spec: 'HDMI & VGA Dual Output, Multi-Drive SATA Storage Support',
        description: 'Standalone multi-channel CCTV surveillance video recorder (DVR/NVR) providing synchronous multi-camera recording, local monitor playback via HDMI/VGA, and network streaming support.',
        isGeneric: true,
        images: PRODUCT_IMAGES['multi-channel-cctv-dvr-nvr-recorder'] || []
      },
      {
        slug: 'cp-plus-360-ptz-smart-camera',
        name: 'CP PLUS 360° Pan-Tilt Smart Wi-Fi Camera',
        brand: 'CP PLUS',
        model: '360 Pan-Tilt Series',
        spec: 'Motorized 360° Horizontal Pan, Motion Tracking, Two-Way Audio',
        description: 'CP PLUS motorized smart Wi-Fi camera providing panoramic 360° room coverage, auto-motion tracking, two-way audio intercom, and mobile app monitoring.',
        isGeneric: false,
        images: PRODUCT_IMAGES['cp-plus-360-ptz-smart-camera'] || []
      }
    ]
  },

  // ==========================================================================
  // Category 3: Printer (9 Products: 8 Physical + 1 Placeholder)
  // ==========================================================================
  {
    id: 'printer',
    slug: 'printer',
    title: 'Printer',
    shortTitle: 'Printer',
    tagline: 'Laser, Ink Tank & Multi-function Office Printers',
    description: 'Continuous ink tank multifunction printers, high-speed monochrome laser printers, heavy-duty color laser copiers, and POS billing units.',
    icon: '🖨️',
    badge: 'Office',
    products: [
      {
        slug: 'epson-ecotank-ink-tank-printer',
        name: 'Epson EcoTank All-in-One Ink Tank Printer',
        brand: 'Epson',
        model: 'EcoTank Series',
        spec: 'Integrated Front-Facing Refillable Ink Tanks, Wi-Fi Direct',
        description: 'Epson EcoTank multifunction all-in-one printer engineered for ultra-low cost per page printing, scanning, and copying with spill-free front-facing continuous ink reservoirs.',
        isGeneric: false,
        images: PRODUCT_IMAGES['epson-ecotank-ink-tank-printer'] || []
      },
      {
        slug: 'canon-pixma-ink-tank-printer',
        name: 'Canon PIXMA Continuous Ink Tank Multifunction Printer',
        brand: 'Canon',
        model: 'PIXMA G-Series',
        spec: 'High-Yield Transparent Ink Reservoirs, Borderless Photo Printing',
        description: 'Canon PIXMA continuous ink tank all-in-one printer featuring transparent ink level monitoring, sharp document text output, and borderless photo printing for home and office documentation.',
        isGeneric: false,
        images: PRODUCT_IMAGES['canon-pixma-ink-tank-printer'] || []
      },
      {
        slug: 'canon-imageclass-mono-laser-printer',
        name: 'Canon imageCLASS Monochrome Laser Printer',
        brand: 'Canon',
        model: 'imageCLASS Series',
        spec: 'High-Speed Laser Beam Printing, Quick First-Print Technology',
        description: 'Canon imageCLASS heavy-duty monochrome laser printer offering crisp monochrome document printing, quick warm-up times, and high toner efficiency for business offices and billing desks.',
        isGeneric: false,
        images: PRODUCT_IMAGES['canon-imageclass-mono-laser-printer'] || []
      },
      {
        slug: 'brother-mono-laser-printer',
        name: 'Brother High-Speed Monochrome Laser Printer',
        brand: 'Brother',
        model: 'HL-Series Mono Laser',
        spec: 'Compact Footprint, 250-Sheet Enclosed Paper Cassette Tray',
        description: 'Brother compact monochrome laser printer engineered for fast document printing, space-saving desktop footprint, and reliable paper handling for retail and legal drafting desks.',
        isGeneric: false,
        images: PRODUCT_IMAGES['brother-mono-laser-printer'] || []
      },
      {
        slug: 'compact-desktop-mono-laser-printer',
        name: 'Compact Desktop Administrative Mono Laser Printer',
        brand: null,
        model: 'Desktop Mono Laser',
        spec: 'Low Power Consumption, Easy Single-Cartridge Replacement',
        description: 'Compact personal and administrative monochrome laser printer designed for straightforward desk operation, fast black-and-white printing, and reliable USB connectivity.',
        isGeneric: true,
        images: PRODUCT_IMAGES['compact-desktop-mono-laser-printer'] || []
      },
      {
        slug: 'brother-color-mfp-copier-adf',
        name: 'Brother Multi-Function Color Laser Copier with ADF',
        brand: 'Brother',
        model: 'Color Laser MFP with ADF',
        spec: 'Automatic Document Feeder (ADF), Color Copy / Print / Scan',
        description: 'Brother enterprise color laser multifunction printer and copier featuring an Automatic Document Feeder (ADF) for unattended multi-page document scanning, copying, and duplex printing.',
        isGeneric: false,
        images: PRODUCT_IMAGES['brother-color-mfp-copier-adf'] || []
      },
      {
        slug: 'brother-commercial-color-copier',
        name: 'Brother Commercial Heavy-Duty Color Laser Copier',
        brand: 'Brother',
        model: 'Commercial Color Copier',
        spec: 'Large Flatbed Scanner Platen, Heavy Monthly Workload Duty Cycle',
        description: 'Heavy-duty commercial color laser copier equipped with high-capacity paper feeding and enterprise scanning glass for departmental workgroups and commercial print centers.',
        isGeneric: false,
        images: PRODUCT_IMAGES['brother-commercial-color-copier'] || []
      },
      {
        slug: 'hp-color-laserjet-enterprise-mfp',
        name: 'HP Color LaserJet Enterprise Departmental MFP',
        brand: 'HP',
        model: 'Color LaserJet Enterprise',
        spec: 'Enterprise Color Toner Cartridges, High-Resolution Color Print Quality',
        description: 'HP Color LaserJet Enterprise departmental printer delivering brilliant color marketing prints, enterprise networking support, and secure print job management.',
        isGeneric: false,
        images: PRODUCT_IMAGES['hp-color-laserjet-enterprise-mfp'] || []
      },
      {
        slug: 'barcode-thermal-receipt-printers',
        name: 'Thermal POS Receipt & Barcode Label Printer',
        brand: null,
        model: 'POS Thermal Series',
        spec: 'High-Speed POS Thermal Receipt & Barcode Label Printing (Contact us to confirm configuration)',
        description: 'High-speed thermal receipt and barcode label printers for retail billing counters, inventory tagging, and point-of-sale checkout systems.',
        isGeneric: true,
        images: PRODUCT_IMAGES['barcode-thermal-receipt-printers'] || []
      }
    ]
  },

  // ==========================================================================
  // Category 4: Biometric Machine (6 Products: 5 Physical + 1 Placeholder)
  // ==========================================================================
  {
    id: 'biometric-machine',
    slug: 'biometric-machine',
    title: 'Biometric Machine',
    shortTitle: 'Biometric Machine',
    tagline: 'Time-Attendance & Access Control Devices',
    description: 'AI facial recognition attendance systems, optical fingerprint sensors, RFID card punching terminals, and door access controller hardware.',
    icon: '🛡️',
    badge: 'Enterprise',
    products: [
      {
        slug: 'hikvision-minmoe-face-terminal',
        name: 'Hikvision MinMoe AI Face Recognition Terminal',
        brand: 'Hikvision',
        model: 'MinMoe Series',
        spec: 'Dual-Lens Anti-Spoofing Camera, Touchscreen Color Display',
        description: 'Hikvision MinMoe AI facial recognition attendance and access terminal equipped with binocular dual cameras to prevent photo spoofing and deliver sub-second touchless employee verification.',
        isGeneric: false,
        images: PRODUCT_IMAGES['hikvision-minmoe-face-terminal'] || []
      },
      {
        slug: 'hikvision-wall-mount-face-terminal',
        name: 'Hikvision Wall-Mount AI Face & Attendance Terminal',
        brand: 'Hikvision',
        model: 'Wall-Mount Edition',
        spec: 'Wall-Mount Access Bracket, Mask Detection & Voice Prompt',
        description: 'Hikvision wall-mounted AI facial attendance terminal with automated voice guidance, TCP/IP network synchronization, and door access controller relay interface.',
        isGeneric: false,
        images: PRODUCT_IMAGES['hikvision-wall-mount-face-terminal'] || []
      },
      {
        slug: 'mantra-optical-fingerprint-scanner',
        name: 'Mantra Optical Fingerprint Attendance Scanner',
        brand: 'Mantra',
        model: 'Optical Fingerprint Scanner',
        spec: 'Scratch-Resistant Optical Sensor Surface, USB Interface',
        description: 'High-precision Mantra optical fingerprint scanner designed for Aadhaar authentication, employee time logging, and secure digital biometric identity verification.',
        isGeneric: false,
        images: PRODUCT_IMAGES['mantra-optical-fingerprint-scanner'] || []
      },
      {
        slug: 'essl-rfid-card-keypad-terminal',
        name: 'eSSL RFID Card & Keypad Attendance Terminal',
        brand: 'eSSL',
        model: 'RFID & Keypad Series',
        spec: 'Proximity Card Reader + 16-Key Tactile Numerical Keypad',
        description: 'eSSL commercial RFID proximity card check-in device with numerical keypad for dual-factor PIN authentication, automated attendance logging, and payroll export.',
        isGeneric: false,
        images: PRODUCT_IMAGES['essl-rfid-card-keypad-terminal'] || []
      },
      {
        slug: 'cp-plus-rfid-attendance-device',
        name: 'CP PLUS Biometric RFID Card Attendance Device',
        brand: 'CP PLUS',
        model: 'RFID Terminal Series',
        spec: 'High-Speed Proximity Sensor, Audible Verification Beeper',
        description: 'CP PLUS biometric RFID proximity card punch terminal with integrated memory for storing employee punch logs during network disconnection.',
        isGeneric: false,
        images: PRODUCT_IMAGES['cp-plus-rfid-attendance-device'] || []
      },
      {
        slug: 'electromagnetic-door-access-controllers',
        name: 'Electromagnetic Door Lock & Access Controller System',
        brand: null,
        model: 'Door Access Series',
        spec: 'Compatible with Biometric Terminals, Emergency Break-Glass (Contact us to confirm configuration)',
        description: 'Electromagnetic door locks (600lbs/1200lbs holding force), L/Z mounting brackets, exit buttons, and power controllers for biometric-controlled security doors.',
        isGeneric: true,
        images: PRODUCT_IMAGES['electromagnetic-door-access-controllers'] || []
      }
    ]
  },

  // ==========================================================================
  // Category 5: Accessories (35 Products: 33 Physical + 2 Placeholders)
  // ==========================================================================
  {
    id: 'accessories',
    slug: 'accessories',
    title: 'Accessories',
    shortTitle: 'Accessories',
    tagline: 'Keyboards, Storage, Components & Cables',
    description: 'Individual solid-state drives, hard drives, RAM modules, cooling components, power supplies, keyboards, mice, and connectivity cables.',
    icon: '🔌',
    badge: 'Essentials',
    products: [
      // --- Storage & Memory Components ---
      {
        slug: 'samsung-870-evo-sata-ssd',
        name: 'Samsung 870 EVO 2.5-Inch SATA Solid-State Drive',
        brand: 'Samsung',
        model: '870 EVO Series',
        spec: '2.5" SATA III 6Gbps Interface, V-NAND Technology',
        description: 'Genuine Samsung 870 EVO 2.5-inch SATA III solid-state drive for upgrading laptop and desktop system responsiveness, boot times, and application loading.',
        isGeneric: false,
        images: PRODUCT_IMAGES['samsung-870-evo-sata-ssd'] || []
      },
      {
        slug: 'seagate-barracuda-3-5-inch-hdd',
        name: 'Seagate BarraCuda 3.5-Inch Internal Hard Drive',
        brand: 'Seagate',
        model: 'BarraCuda Series',
        spec: '3.5" Desktop & Surveillance SATA Hard Drive, High-Capacity Storage',
        description: 'Seagate BarraCuda 3.5-inch high-capacity internal hard disk drive designed for desktop mass storage, CCTV surveillance archiving, and secondary system backup.',
        isGeneric: false,
        images: PRODUCT_IMAGES['seagate-barracuda-3-5-inch-hdd'] || []
      },
      {
        slug: 'corsair-vengeance-lpx-ddr4-ram',
        name: 'Corsair Vengeance LPX High-Performance DDR4 RAM',
        brand: 'Corsair',
        model: 'Vengeance LPX Series',
        spec: 'Pure Aluminum Low-Profile Heat Spreader, High-Speed DDR4',
        description: 'Corsair Vengeance LPX DDR4 desktop memory kit featuring a pure aluminum low-profile heat spreader for faster heat dissipation and optimal gaming motherboard compatibility.',
        isGeneric: false,
        images: PRODUCT_IMAGES['corsair-vengeance-lpx-ddr4-ram'] || []
      },
      {
        slug: 'kingston-desktop-ddr-ram-module',
        name: 'Kingston Desktop DDR Memory Module',
        brand: 'Kingston',
        model: 'Desktop DDR Module',
        spec: 'Standard JEDEC Compliance, 288-Pin Desktop DIMM',
        description: 'Kingston reliable desktop DDR RAM memory module engineered and tested to standard industry specifications for commercial and office desktop upgrades.',
        isGeneric: false,
        images: PRODUCT_IMAGES['kingston-desktop-ddr-ram-module'] || []
      },
      {
        slug: 'high-speed-nvme-m2-ssds-external-drives',
        name: 'High-Speed NVMe PCIe Gen4 M.2 SSDs',
        brand: null,
        model: 'NVMe Gen4 Series',
        spec: 'Gen 4x4 Speeds up to 7400MB/s, 500GB - 4TB (Contact us to confirm configuration)',
        description: 'Ultra-fast PCIe Gen4 x4 NVMe M.2 internal solid-state drives and high-speed portable USB-C external storage drives for extreme data throughput.',
        isGeneric: true,
        images: PRODUCT_IMAGES['high-speed-nvme-m2-ssds-external-drives'] || []
      },

      // --- PC Components, Power & Cooling ---
      {
        slug: 'high-performance-thermal-paste-compound',
        name: 'High-Performance Thermal Interface Compound Paste',
        brand: null,
        model: 'Thermal Compound Syringe',
        spec: 'High Thermal Conductivity, Non-Electrically Conductive Formula',
        description: 'High-grade thermal interface paste compound syringe for desktop CPU and GPU heatsink installations, ensuring optimal heat transfer and low operating temperatures.',
        isGeneric: true,
        images: PRODUCT_IMAGES['high-performance-thermal-paste-compound'] || []
      },
      {
        slug: 'cooler-master-rgb-cpu-cooler',
        name: 'Cooler Master RGB Air Cooler for Desktop CPU',
        brand: 'Cooler Master',
        model: 'RGB CPU Cooler Series',
        spec: 'Direct-Contact Copper Heatpipes, RGB PWM Airflow Fan',
        description: 'Cooler Master desktop CPU heatsink and cooling fan equipped with direct-contact copper heatpipes and synchronized RGB lighting for enhanced cooling efficiency.',
        isGeneric: false,
        images: PRODUCT_IMAGES['cooler-master-rgb-cpu-cooler'] || []
      },
      {
        slug: 'corsair-modular-atx-smps-power-supply',
        name: 'Corsair High-Efficiency Modular ATX Power Supply (SMPS)',
        brand: 'Corsair',
        model: 'RM Series Modular ATX SMPS',
        spec: '80 PLUS Certified High Efficiency, Fully Modular Cable System',
        description: 'Corsair commercial and gaming modular ATX power supply unit delivering clean, steady DC power with silent fan curve and energy-efficient 80 PLUS certification.',
        isGeneric: false,
        images: PRODUCT_IMAGES['corsair-modular-atx-smps-power-supply'] || []
      },
      {
        slug: 'nvidia-geforce-dedicated-graphics-card',
        name: 'NVIDIA GeForce Dedicated Graphics Card',
        brand: 'NVIDIA',
        model: 'GeForce RTX Series',
        spec: 'Ray Tracing Cores, Dedicated GDDR VRAM, Multi-Display Outputs',
        description: 'NVIDIA GeForce dedicated graphics card engineered for gaming, 3D modeling, video rendering, and multi-monitor workstations.',
        isGeneric: false,
        images: PRODUCT_IMAGES['nvidia-geforce-dedicated-graphics-card'] || []
      },
      {
        slug: 'asus-desktop-motherboard',
        name: 'ASUS Commercial / Gaming Desktop Motherboard',
        brand: 'ASUS',
        model: 'Desktop Motherboard Series',
        spec: 'Solid Power Stages, Dual M.2 Slots, PCIe 4.0 / 5.0 Ready',
        description: 'ASUS desktop motherboard offering robust power delivery, comprehensive cooling heatsinks, and extensive expansion slots for custom PC builds.',
        isGeneric: false,
        images: PRODUCT_IMAGES['asus-desktop-motherboard'] || []
      },
      {
        slug: 'multi-channel-cctv-smps-power-supply',
        name: 'Multi-Channel Regulated CCTV Power Supply Unit (SMPS)',
        brand: null,
        model: '12V DC Multi-Channel SMPS',
        spec: '12V DC Output with Individual Channel Fuse Protection, Metal Casing',
        description: 'Heavy-duty multi-channel regulated power supply unit (SMPS) housed in a ventilated metal enclosure, engineered to safely power multiple CCTV surveillance cameras.',
        isGeneric: true,
        images: PRODUCT_IMAGES['multi-channel-cctv-smps-power-supply'] || []
      },

      // --- Commercial Desktop & Workstation Towers ---
      {
        slug: 'dell-precision-cad-workstation-tower',
        name: 'Dell Precision CAD / 3D Workstation Tower',
        brand: 'Dell',
        model: 'Precision Workstation Tower',
        spec: 'Enterprise Expansion Slots, High-Airflow Front Honeycomb Mesh',
        description: 'Heavy-duty Dell Precision enterprise workstation tower engineered for CAD modeling, architectural drafting, structural analysis, and demanding multi-threaded computing tasks.',
        isGeneric: false,
        images: PRODUCT_IMAGES['dell-precision-cad-workstation-tower'] || []
      },
      {
        slug: 'lenovo-thinkcentre-desktop-tower',
        name: 'Lenovo ThinkCentre Commercial Desktop Tower',
        brand: 'Lenovo',
        model: 'ThinkCentre Series',
        spec: 'Commercial Tool-Less Chassis, Front USB & Audio Ports',
        description: 'Lenovo ThinkCentre commercial desktop tower providing enterprise stability, easy serviceability, and reliable thermal management for business environments and financial accounting desks.',
        isGeneric: false,
        images: PRODUCT_IMAGES['lenovo-thinkcentre-desktop-tower'] || []
      },
      {
        slug: 'dell-sff-compact-workstation',
        name: 'Dell Small Form Factor (SFF) Workstation PC',
        brand: 'Dell',
        model: 'OptiPlex SFF Series',
        spec: 'Compact Small Form Factor (SFF), Dual Orientation (Horizontal / Vertical)',
        description: 'Compact Small Form Factor (SFF) desktop workstation engineered to save desk space while delivering full enterprise computing power for office and retail environments.',
        isGeneric: false,
        images: PRODUCT_IMAGES['dell-sff-compact-workstation'] || []
      },
      {
        slug: 'acer-veriton-commercial-tower',
        name: 'Acer Veriton Commercial Desktop Tower',
        brand: 'Acer',
        model: 'Veriton Series',
        spec: 'Expandable PCIe Bays, Multi-Display Output Support',
        description: 'Acer Veriton commercial workstation tower built with reliable componentry, multiple display outputs, and quiet cooling fan profiles for corporate office deployment.',
        isGeneric: false,
        images: PRODUCT_IMAGES['acer-veriton-commercial-tower'] || []
      },

      // --- Networking ---
      {
        slug: 'dual-band-wifi-6-routers-poe-gigabit-switches',
        name: 'Dual-Band Wi-Fi 6 Routers & PoE Gigabit Switches',
        brand: null,
        model: 'Gigabit Mesh Router Series',
        spec: 'High Gain Multi-Antenna, Seamless Mesh Office Coverage (Contact us to confirm configuration)',
        description: 'High-performance dual-band Wi-Fi 6 wireless routers and enterprise Power-over-Ethernet (PoE) Gigabit network switches for reliable office connectivity.',
        isGeneric: true,
        images: PRODUCT_IMAGES['dual-band-wifi-6-routers-poe-gigabit-switches'] || []
      },

      // --- Keyboards & Mice ---
      {
        slug: 'dell-km3322w-wireless-combo',
        name: 'Dell KM3322W Wireless Keyboard & Mouse Combo',
        brand: 'Dell',
        model: 'KM3322W',
        spec: '2.4GHz Wireless USB Nano Receiver, Long Battery Life',
        description: 'Dell KM3322W full-size wireless keyboard and optical mouse desktop combo featuring quiet keys, durable keycaps, and reliable 2.4GHz wireless connectivity.',
        isGeneric: false,
        images: PRODUCT_IMAGES['dell-km3322w-wireless-combo'] || []
      },
      {
        slug: 'wireless-office-keyboard-mouse-combo',
        name: 'Full-Size Wireless Office Keyboard & Mouse Combo',
        brand: null,
        model: 'Wireless Desktop Combo',
        spec: 'Full-Size Layout with Numeric Keypad, Wireless Optical Mouse',
        description: 'Full-size wireless office desktop keyboard and mouse set designed for clutter-free administrative and corporate workstations.',
        isGeneric: true,
        images: PRODUCT_IMAGES['wireless-office-keyboard-mouse-combo'] || []
      },
      {
        slug: 'hp-mechanical-rgb-keyboard',
        name: 'HP Mechanical Gaming Keyboard with Illuminated Keys',
        brand: 'HP',
        model: 'Mechanical Gaming Keyboard',
        spec: 'Tactile Mechanical Switches, Multi-Mode Key Backlighting',
        description: 'HP mechanical gaming keyboard engineered with responsive tactile mechanical switches, anti-ghosting rollover, and illuminated backlighting.',
        isGeneric: false,
        images: PRODUCT_IMAGES['hp-mechanical-rgb-keyboard'] || []
      },
      {
        slug: 'asus-desktop-keyboard-mouse-set',
        name: 'Asus Commercial Desktop Keyboard & Mouse Set',
        brand: 'Asus',
        model: 'Desktop Keyboard Set',
        spec: 'Spill-Resistant Membrane, Durable UV-Coated Keycaps',
        description: 'Asus commercial desktop keyboard and optical mouse set built for daily commercial typing, accounting, and general workstation productivity.',
        isGeneric: false,
        images: PRODUCT_IMAGES['asus-desktop-keyboard-mouse-set'] || []
      },
      {
        slug: 'hp-230-wireless-keyboard-combo',
        name: 'HP 230 Slim Wireless Keyboard & Mouse Combo',
        brand: 'HP',
        model: 'HP 230 Wireless Combo',
        spec: 'Low-Profile Chiclet Key Architecture, Ambidextrous Mouse',
        description: 'HP 230 slim wireless keyboard and optical mouse combo offering whisper-quiet low-profile chiclet typing and seamless wireless desk operation.',
        isGeneric: false,
        images: PRODUCT_IMAGES['hp-230-wireless-keyboard-combo'] || []
      },
      {
        slug: 'lenovo-300-wireless-keyboard-combo',
        name: 'Lenovo 300 Wireless Keyboard & Mouse Combo',
        brand: 'Lenovo',
        model: 'Lenovo 300 Wireless Combo',
        spec: 'Water-Resistant Drainage Casing, Island Keycaps',
        description: 'Lenovo 300 wireless desktop keyboard and mouse kit featuring an ergonomic contoured mouse and water-resistant keyboard drainage design.',
        isGeneric: false,
        images: PRODUCT_IMAGES['lenovo-300-wireless-keyboard-combo'] || []
      },
      {
        slug: 'ergonomic-full-size-wireless-combo',
        name: 'Ergonomic Full-Size Wireless Keyboard & Mouse Set',
        brand: null,
        model: 'Ergonomic Wireless Combo',
        spec: 'Plug-and-Play USB Nano Receiver, Precision Optical Tracking',
        description: 'Ergonomic full-size wireless keyboard and optical mouse package designed for business multitasking and high-comfort typing.',
        isGeneric: true,
        images: PRODUCT_IMAGES['ergonomic-full-size-wireless-combo'] || []
      },
      {
        slug: 'logitech-mx-keys-mini-keyboard',
        name: 'Logitech MX Keys Mini Compact Wireless Keyboard',
        brand: 'Logitech',
        model: 'MX Keys Mini',
        spec: 'Spherically Dished Keys, Smart Backlighting, Bluetooth / Logi Bolt',
        description: 'Logitech MX Keys Mini premium minimalist wireless keyboard engineered with spherically dished fingertip-matched keys and smart proximity illumination.',
        isGeneric: false,
        images: PRODUCT_IMAGES['logitech-mx-keys-mini-keyboard'] || []
      },
      {
        slug: 'logitech-wireless-multimedia-keyboard',
        name: 'Logitech Full-Size Wireless Multimedia Keyboard',
        brand: 'Logitech',
        model: 'Wireless Multimedia Series',
        spec: 'Dedicated One-Touch Media Hotkeys, 2.4GHz Wireless',
        description: 'Logitech full-size wireless keyboard featuring dedicated multimedia hotkeys, spill-resistant construction, and long battery autonomy.',
        isGeneric: false,
        images: PRODUCT_IMAGES['logitech-wireless-multimedia-keyboard'] || []
      },
      {
        slug: 'dell-kb216-wired-multimedia-keyboard',
        name: 'Dell KB216 Multimedia Wired Office Keyboard',
        brand: 'Dell',
        model: 'KB216',
        spec: 'Chiclet Keys with Volume Controls, USB Wired Interface',
        description: 'Dell KB216 standard commercial wired keyboard featuring low-profile chiclet keys, volume control keys, and dependable USB plug-and-play reliability.',
        isGeneric: false,
        images: PRODUCT_IMAGES['dell-kb216-wired-multimedia-keyboard'] || []
      },
      {
        slug: 'slim-chiclet-low-profile-keyboard',
        name: 'Slim Chiclet Low-Profile Desktop Keyboard',
        brand: null,
        model: 'Slim Chiclet Keyboard',
        spec: 'Ultra-Thin Profile, Scissor-Switch Action Feel',
        description: 'Slim low-profile desktop keyboard designed with minimal desktop footprint, short key travel distance, and quiet typing acoustics.',
        isGeneric: true,
        images: PRODUCT_IMAGES['slim-chiclet-low-profile-keyboard'] || []
      },
      {
        slug: 'standard-office-wired-keyboard',
        name: 'Standard Office Wired Commercial Keyboard',
        brand: null,
        model: 'Standard Office Wired',
        spec: '104-Key Standard Layout, Adjustable Tilt Legs',
        description: 'Standard 104-key commercial wired desktop keyboard equipped with sturdy adjustable tilt legs and tactile key responses for office operations.',
        isGeneric: true,
        images: PRODUCT_IMAGES['standard-office-wired-keyboard'] || []
      },
      {
        slug: 'hp-gaming-optical-mouse',
        name: 'HP Gaming Optical Mouse with Ergonomic Grip',
        brand: 'HP',
        model: 'Gaming Optical Series',
        spec: 'Adjustable DPI Optical Sensor, Textured Side Finger Grips',
        description: 'HP gaming optical wired mouse designed with textured ergonomic contours, durable microswitches, and high-precision tracking for gaming and photo editing.',
        isGeneric: false,
        images: PRODUCT_IMAGES['hp-gaming-optical-mouse'] || []
      },
      {
        slug: 'dell-ms116-usb-optical-mouse',
        name: 'Dell MS116 USB Wired Optical Mouse',
        brand: 'Dell',
        model: 'MS116',
        spec: '1000 DPI Optical Tracking, Symmetrical Ambidextrous Shape',
        description: 'Dell MS116 commercial optical wired mouse featuring 1000 DPI LED optical tracking and ambidextrous comfort for everyday office productivity.',
        isGeneric: false,
        images: PRODUCT_IMAGES['dell-ms116-usb-optical-mouse'] || []
      },
      {
        slug: 'dell-wm126-wireless-optical-mouse',
        name: 'Dell WM126 Wireless Optical Mouse',
        brand: 'Dell',
        model: 'WM126',
        spec: 'Wireless 2.4GHz RF Connection, Integrated Nano Dongle Storage',
        description: 'Dell WM126 compact wireless optical mouse with smooth curved contours, responsive tracking, and tidy internal USB receiver storage.',
        isGeneric: false,
        images: PRODUCT_IMAGES['dell-wm126-wireless-optical-mouse'] || []
      },
      {
        slug: 'lenovo-wireless-ergonomic-mouse',
        name: 'Lenovo Wireless Ergonomic Optical Mouse',
        brand: 'Lenovo',
        model: 'Wireless Ergonomic Mouse',
        spec: 'Comfort Grip Contours, Smooth Rubber Scroll Wheel',
        description: 'Lenovo wireless optical mouse featuring ergonomic palm support, smooth tactile scroll wheel, and high-accuracy optical tracking.',
        isGeneric: false,
        images: PRODUCT_IMAGES['lenovo-wireless-ergonomic-mouse'] || []
      },
      {
        slug: 'zebronics-optical-wired-mouse',
        name: 'Zebronics High-Precision Optical Wired Mouse',
        brand: 'Zebronics',
        model: 'Optical Wired Mouse',
        spec: 'High-Precision Sensor, Durable USB Cable Connection',
        description: 'Zebronics high-precision optical wired mouse providing instantaneous cursor response, textured grip, and lightweight navigation.',
        isGeneric: false,
        images: PRODUCT_IMAGES['zebronics-optical-wired-mouse'] || []
      },
      {
        slug: 'compact-portable-wireless-mouse',
        name: 'Compact Portable Wireless Optical Mouse',
        brand: null,
        model: 'Compact Wireless',
        spec: 'Pocket-Sized Minimal Form Factor, Energy-Saving Auto-Sleep',
        description: 'Compact portable wireless optical mouse engineered for travel bags, laptop sleeves, and mobile business computing.',
        isGeneric: true,
        images: PRODUCT_IMAGES['compact-portable-wireless-mouse'] || []
      },
      {
        slug: 'ergonomic-commercial-wired-mouse',
        name: 'Ergonomic Commercial Wired Optical Mouse',
        brand: null,
        model: 'Ergonomic Wired Optical',
        spec: 'Full Palm Resting Arch, Smooth Low-Friction Glide Skates',
        description: 'Ergonomic commercial wired optical mouse contoured for natural hand placement and smooth cursor control on office desks.',
        isGeneric: true,
        images: PRODUCT_IMAGES['ergonomic-commercial-wired-mouse'] || []
      },

      // --- Cables, Patch Cords & Connectors ---
      {
        slug: 'braided-4k-high-speed-hdmi-cable',
        name: 'Braided 4K Ultra HD High-Speed HDMI Cable',
        brand: null,
        model: '4K HDMI Series',
        spec: 'Gold-Plated Connectors, Nylon Braided Shielding, 4K UHD 60Hz',
        description: 'High-speed 4K Ultra HD HDMI cable featuring nylon braided exterior and heavy gold-plated contact pins for crisp digital display and TV connectivity.',
        isGeneric: true,
        images: PRODUCT_IMAGES['braided-4k-high-speed-hdmi-cable'] || []
      },
      {
        slug: 'displayport-1-4-monitor-cable',
        name: 'DisplayPort 1.4 High-Refresh Monitor Cable',
        brand: null,
        model: 'DisplayPort 1.4',
        spec: 'Latching DP Connectors, 8K/4K High Refresh-Rate Support',
        description: 'DisplayPort 1.4 monitor display cable equipped with mechanical locking latch connectors for gaming monitors and CAD workstation displays.',
        isGeneric: true,
        images: PRODUCT_IMAGES['displayport-1-4-monitor-cable'] || []
      },
      {
        slug: 'cat6-gigabit-ethernet-patch-cord',
        name: 'Cat6 Molded Gigabit Ethernet RJ45 Patch Cord',
        brand: null,
        model: 'Cat6 UTP Patch Cord',
        spec: 'Molded Snagless Boots, 1000Mbps Gigabit Network Transmission',
        description: 'Cat6 molded Gigabit Ethernet RJ45 network patch cord designed for connecting computers, IP cameras, routers, and PoE switches without signal loss.',
        isGeneric: true,
        images: PRODUCT_IMAGES['cat6-gigabit-ethernet-patch-cord'] || []
      },
      {
        slug: 'sata-6gbps-internal-drive-cable',
        name: 'High-Speed SATA 6Gbps Internal Drive Cable',
        brand: null,
        model: 'SATA III 6Gbps',
        spec: 'Locking Metal Latch, High-Speed Serial ATA 6Gbps Data Transfer',
        description: 'SATA III 6Gbps internal data cable with metallic locking latch clips for connecting 2.5" SSDs, 3.5" HDDs, and optical drives to desktop motherboards.',
        isGeneric: true,
        images: PRODUCT_IMAGES['sata-6gbps-internal-drive-cable'] || []
      },
      {
        slug: 'heavy-duty-15-pin-vga-cable',
        name: 'Heavy-Duty 15-Pin VGA Display Cable',
        brand: null,
        model: '15-Pin D-Sub VGA',
        spec: 'Dual Ferrite Noise Choke Cores, Gold-Plated Male D-Sub Pins',
        description: 'Heavy-duty 15-pin VGA analog display cable equipped with dual ferrite suppression cores to eliminate monitor flickering and ghosting.',
        isGeneric: true,
        images: PRODUCT_IMAGES['heavy-duty-15-pin-vga-cable'] || []
      },
      {
        slug: 'usb-type-c-fast-charging-data-cable',
        name: 'USB Type-C Fast-Charging & Data Sync Cable',
        brand: null,
        model: 'USB Type-C Cable',
        spec: 'Fast Charging Support, Reversible Type-C Interface, Travel Pouch',
        description: 'Braided and portable USB Type-C high-speed charging and data transfer cable suitable for laptops, external SSDs, and modern mobile devices.',
        isGeneric: true,
        images: PRODUCT_IMAGES['usb-type-c-fast-charging-data-cable'] || []
      },
      {
        slug: 'desktop-pc-monitor-3-pin-power-cord',
        name: 'Desktop PC & Monitor 3-Pin AC Power Cord',
        brand: null,
        model: '3-Pin IEC Power Cord',
        spec: 'Molded 3-Pin Indian Wall Plug to IEC C13 Socket, Heavy-Gauge Wire',
        description: 'Heavy-duty 3-pin AC power cord suitable for desktop PC power supplies, monitor displays, laser printers, and UPS backup units.',
        isGeneric: true,
        images: PRODUCT_IMAGES['desktop-pc-monitor-3-pin-power-cord'] || []
      },
      {
        slug: 'cctv-3-plus-1-coaxial-video-cable',
        name: 'CCTV 3+1 Shielded Coaxial Video Cable',
        brand: null,
        model: 'CCTV 3+1 Shielded Cable',
        spec: 'Solid Copper Video Core + 3 Power/Audio Wires, Braided Shielding',
        description: 'Shielded CCTV 3+1 combination coaxial cable delivering both video signal and DC power to surveillance cameras across long distances without interference.',
        isGeneric: true,
        images: PRODUCT_IMAGES['cctv-3-plus-1-coaxial-video-cable'] || []
      },
      {
        slug: '12v-dc-cctv-power-pigtail-connectors',
        name: '12V DC CCTV Camera Power Pigtail Connectors',
        brand: null,
        model: 'DC Power Pigtails',
        spec: 'Standard 2.1mm x 5.5mm Barrel Plugs (Male & Female Pair)',
        description: '12V DC power pigtail cable plugs for quick, secure connection between CCTV power supply lines and security camera power input jacks.',
        isGeneric: true,
        images: PRODUCT_IMAGES['12v-dc-cctv-power-pigtail-connectors'] || []
      },
      {
        slug: 'heavy-duty-bnc-compression-video-connectors',
        name: 'Heavy-Duty BNC Compression Video Connectors',
        brand: null,
        model: 'BNC Compression Connectors',
        spec: 'Gold-Plated Center Pin, Metallic Locking Collar for RG59/Coaxial',
        description: 'High-grade BNC compression video connectors engineered for CCTV coaxial video termination, providing corrosion resistance and clean video transmission.',
        isGeneric: true,
        images: PRODUCT_IMAGES['heavy-duty-bnc-compression-video-connectors'] || []
      },
      // --- Extended Accessory & Hardware Products (76 Verified Items from 102 Assets) ---
      {
        slug: 'hdmi-to-micro-hdmi-cable',
        name: 'HDMI to Micro-HDMI (Type-D) High-Speed Cable',
        brand: 'Generic',
        model: 'Type-A to Type-D High-Speed Cable',
        spec: 'Full HD / 4K Video Output, Gold-Plated Connectors, 1.5m',
        description: 'High-speed HDMI Type-A male to Micro-HDMI Type-D male cable for connecting cameras, action cams, tablets, and portable devices to monitors and TVs.',
        isGeneric: true,
        images: PRODUCT_IMAGES['hdmi-to-micro-hdmi-cable'] || []
      },
      {
        slug: 'standard-male-to-male-hdmi-cable',
        name: 'Standard High-Speed HDMI Male-to-Male Cable',
        brand: 'Generic',
        model: 'High-Speed 1080p/4K HDMI Series',
        spec: 'Gold-Plated Connectors, 4K UHD 60Hz Support, Multi-Length Shielded',
        description: 'High-speed HDMI male-to-male digital audio/video cable with gold-plated connectors and durable PVC shielding for PCs, laptops, consoles, and monitors.',
        isGeneric: true,
        images: PRODUCT_IMAGES['standard-male-to-male-hdmi-cable'] || [],
        variantSelectorLabel: 'Select Length',
        variantType: 'length',
        variants: [
          {
            id: '1-5m',
            label: '1.5m',
            spec: '1.5m High-Speed HDMI Cable, 4K UHD 60Hz, Gold-Plated Plugs',
            imageIndex: 0
          },
          {
            id: '3m',
            label: '3m',
            spec: '3m High-Speed HDMI Cable, 4K UHD 60Hz, Gold-Plated Plugs',
            imageIndex: 1
          },
          {
            id: '5m',
            label: '5m',
            spec: '5m High-Speed HDMI Cable, 4K UHD 60Hz, Gold-Plated Plugs',
            imageIndex: 2
          },
          {
            id: '10m',
            label: '10m',
            spec: '10m High-Speed HDMI Cable, 4K UHD 60Hz, Double Shielded',
            imageIndex: 3
          },
          {
            id: '20m',
            label: '20m',
            spec: '20m Long-Distance HDMI Cable, 4K UHD 60Hz, Triple Shielded Heavy-Duty',
            imageIndex: 4
          }
        ]
      },
      {
        slug: 'terabyte-hd-2-0v-premium-hdmi-cable',
        name: 'Terabyte HD 2.0V Premium High-Speed HDTV Cable 4K',
        brand: 'Terabyte',
        model: 'HD 2.0V Premium Series',
        spec: 'HDMI 2.0 4K@60Hz, 18Gbps, HDR, ARC, 2160p Deep Color Support',
        description: 'Terabyte certified high-speed HDMI 2.0 retail-packaged cable delivering 4K Ultra HD video, Audio Return Channel (ARC), and high dynamic range performance.',
        isGeneric: false,
        images: PRODUCT_IMAGES['terabyte-hd-2-0v-premium-hdmi-cable'] || [],
        variantSelectorLabel: 'Select Length',
        variantType: 'length',
        variants: [
          {
            id: '1-5m',
            label: '1.5m',
            spec: '1.5m HDMI 2.0 4K@60Hz, 18Gbps, HDR, ARC, 2160p Deep Color',
            imageIndex: 0
          },
          {
            id: '3m',
            label: '3m',
            spec: '3m HDMI 2.0 4K@60Hz, 18Gbps, HDR, ARC, 2160p Deep Color',
            imageIndex: 1
          },
          {
            id: '5m',
            label: '5m',
            spec: '5m HDMI 2.0 4K@60Hz, 18Gbps, HDR, ARC, 2160p Deep Color',
            imageIndex: 2
          }
        ]
      },
      {
        slug: 'adnet-ad-001-laptop-power-cable',
        name: 'ADNet 3-Pin Laptop Power Cable (AD-001)',
        brand: 'ADNet',
        model: 'AD-001',
        spec: '3-Pin Indian Wall Plug to C5 Cloverleaf / Mickey Connector, Copper Core',
        description: 'Genuine ADNet AD-001 3-pin laptop charger power cord with cloverleaf C5 connector, built with high-grade copper conductors for laptop adapter power delivery.',
        isGeneric: false,
        images: PRODUCT_IMAGES['adnet-ad-001-laptop-power-cable'] || [],
        variantSelectorLabel: 'Select Length',
        variantType: 'length',
        variants: [
          {
            id: '1-5m',
            label: '1.5m',
            spec: '1.5m 3-Pin Indian Wall Plug to C5 Cloverleaf / Mickey Connector',
            imageIndex: 0
          },
          {
            id: '3m',
            label: '3m',
            spec: '3m 3-Pin Indian Wall Plug to C5 Cloverleaf / Mickey Connector',
            imageIndex: 1
          }
        ]
      },
      {
        slug: 'laptop-power-cable-c5-cloverleaf',
        name: 'Universal 3-Pin C5 Cloverleaf Laptop Adapter Power Cord',
        brand: 'Generic',
        model: '3-Pin to C5 Cloverleaf Cord',
        spec: 'Molded 3-Pin Indian Plug, C5 IEC Connector, 250V 6A Rated',
        description: 'Universal replacement 3-pin power cord with C5 cloverleaf connector designed for laptop power adapters, desktop mini-PCs, and compatible electronics.',
        isGeneric: true,
        images: PRODUCT_IMAGES['laptop-power-cable-c5-cloverleaf'] || [],
        variantSelectorLabel: 'Select Length',
        variantType: 'length',
        variants: [
          {
            id: '1-5m',
            label: '1.5m',
            spec: '1.5m Molded 3-Pin Indian Plug, C5 IEC Connector, 250V 6A Rated',
            imageIndex: 0
          },
          {
            id: '3m',
            label: '3m',
            spec: '3m Molded 3-Pin Indian Plug, C5 IEC Connector, 250V 6A Rated',
            imageIndex: 1
          }
        ]
      },
      {
        slug: 'desktop-pc-monitor-iec-c13-power-cable',
        name: 'Heavy-Duty 3-Pin Desktop PC & Monitor Power Cable (IEC C13)',
        brand: 'Generic',
        model: '3-Pin to IEC C13 Power Cord',
        spec: 'Molded Indian 3-Pin Plug to Female IEC C13, 250V 10A Heavy-Duty',
        description: 'Standard 3-pin to IEC C13 heavy-duty power cable for desktop computer power supplies (SMPS), LED monitors, laser printers, and UPS connections.',
        isGeneric: true,
        images: PRODUCT_IMAGES['desktop-pc-monitor-iec-c13-power-cable'] || [],
        variantSelectorLabel: 'Select Rating / Length',
        variantType: 'length',
        variants: [
          {
            id: '1-5m-standard',
            label: '1.5m (10A)',
            spec: '1.5m Molded Indian 3-Pin Plug to Female IEC C13, 250V 10A',
            imageIndex: 0
          },
          {
            id: '3m-standard',
            label: '3m (10A)',
            spec: '3m Molded Indian 3-Pin Plug to Female IEC C13, 250V 10A',
            imageIndex: 1
          },
          {
            id: '3m-heavy-duty',
            label: '3m (16A Heavy-Duty)',
            spec: '3m Heavy-Duty 16A Indian Plug to IEC C13, Server / High-Wattage SMPS',
            imageIndex: 2
          }
        ]
      },
      {
        slug: 'usb-2-0-type-a-male-to-female-extension-cable',
        name: 'USB 2.0 Type-A Male to Female Extension Cable (White)',
        brand: 'Generic',
        model: 'USB 2.0 Extension Cable Series',
        spec: 'USB 2.0 High-Speed 480Mbps, Nickel/Gold-Plated Connectors, White Jacket',
        description: 'USB 2.0 extension cable allowing easy peripheral extension for mouse, keyboard, Wi-Fi dongles, pen drives, and printer cables.',
        isGeneric: true,
        images: PRODUCT_IMAGES['usb-2-0-type-a-male-to-female-extension-cable'] || [],
        variantSelectorLabel: 'Select Length',
        variantType: 'length',
        variants: [
          {
            id: '1-5m',
            label: '1.5m',
            spec: '1.5m USB 2.0 High-Speed 480Mbps, Nickel-Plated Connectors, White',
            imageIndex: 0
          },
          {
            id: '3m',
            label: '3m',
            spec: '3m USB 2.0 High-Speed 480Mbps, Nickel-Plated Connectors, White',
            imageIndex: 1
          },
          {
            id: '5m',
            label: '5m',
            spec: '5m USB 2.0 High-Speed 480Mbps, Signal Booster Choke, White',
            imageIndex: 2
          }
        ]
      },
      {
        slug: 'usb-2-0-type-a-to-type-b-printer-cable',
        name: 'USB 2.0 Type-A to Type-B High-Speed Printer Cable',
        brand: 'Generic',
        model: 'USB-A to USB-B Printer Cable with Ferrite Core',
        spec: 'USB 2.0 480Mbps Transmission, Dual Molded Ferrite Core Noise Suppression',
        description: 'Reliable USB Type-A to Type-B printer and scanner cable featuring integrated ferrite core suppression to protect against EMI and signal loss during printing.',
        isGeneric: true,
        images: PRODUCT_IMAGES['usb-2-0-type-a-to-type-b-printer-cable'] || [],
        variantSelectorLabel: 'Select Length',
        variantType: 'length',
        variants: [
          {
            id: '1-5m',
            label: '1.5m',
            spec: '1.5m USB 2.0 480Mbps, Molded Ferrite Core Noise Suppression',
            imageIndex: 0
          },
          {
            id: '3m',
            label: '3m',
            spec: '3m USB 2.0 480Mbps, Dual Molded Ferrite Core Noise Suppression',
            imageIndex: 1
          },
          {
            id: '5m',
            label: '5m',
            spec: '5m USB 2.0 480Mbps, Dual Molded Ferrite Core Noise Suppression',
            imageIndex: 2
          }
        ]
      },
      {
        slug: 'usb-3-0-type-a-male-to-female-extension-cable',
        name: 'USB 3.0 SuperSpeed Type-A Male to Female Extension Cable',
        brand: 'Generic',
        model: 'SuperSpeed USB 3.0 Extension Cable',
        spec: 'USB 3.0 5Gbps Transfer Rate, Blue Core Connector, Foil & Braid Shielding',
        description: 'SuperSpeed USB 3.0 extension cord offering up to 5Gbps data transfer speeds, backwards compatible with USB 2.0 for external hard drives and high-speed flash drives.',
        isGeneric: true,
        images: PRODUCT_IMAGES['usb-3-0-type-a-male-to-female-extension-cable'] || []
      },
      {
        slug: 'standard-15-pin-vga-monitor-cable-blue',
        name: 'Standard 15-Pin SVGA / VGA Male-to-Male Monitor Cable',
        brand: 'Generic',
        model: '15-Pin D-Sub VGA Cable',
        spec: '15-Pin D-Sub Male Connectors, Blue Molded Thumbscrews, 1080p Analog Video',
        description: 'Standard 15-pin VGA cable for transmitting analog video signals between computers, graphics cards, projectors, and monitors.',
        isGeneric: true,
        images: PRODUCT_IMAGES['standard-15-pin-vga-monitor-cable-blue'] || []
      },
      {
        slug: 'shielded-white-vga-cable-dual-ferrite',
        name: 'Heavy-Duty Shielded VGA Monitor Cable with Dual Ferrite Cores (White)',
        brand: 'Generic',
        model: 'White Shielded VGA Monitor Cable',
        spec: 'Dual Ferrite Choke Cores, Fully Shielded Coaxial Lines, White Molded Casing',
        description: 'High-density shielded white VGA video cable equipped with dual ferrite noise-suppression chokes for flicker-free display output on CRT and LCD displays.',
        isGeneric: true,
        images: PRODUCT_IMAGES['shielded-white-vga-cable-dual-ferrite'] || [],
        variantSelectorLabel: 'Select Length',
        variantType: 'length',
        variants: [
          {
            id: '1-5m',
            label: '1.5m',
            spec: '1.5m Dual Ferrite Choke Cores, Fully Shielded Coaxial Lines, White',
            imageIndex: 0
          },
          {
            id: '3m',
            label: '3m',
            spec: '3m Dual Ferrite Choke Cores, Fully Shielded Coaxial Lines, White',
            imageIndex: 1
          }
        ]
      },
      {
        slug: 'gold-plated-15-pin-vga-cable-black',
        name: 'Gold-Plated 15-Pin VGA Monitor Cable (Black)',
        brand: 'Generic',
        model: 'Gold-Plated 15-Pin SVGA Video Cable',
        spec: 'Corrosion-Resistant Gold-Plated Contacts, Dual Thumbscrews, 1080p FHD Support',
        description: 'Premium gold-plated 15-pin VGA video cable engineered for reliable contact conductivity and clear RGB analog display transmission.',
        isGeneric: true,
        images: PRODUCT_IMAGES['gold-plated-15-pin-vga-cable-black'] || []
      },
      {
        slug: 'dlink-cat6-utp-patch-cable-2m',
        name: 'D-Link CAT6 UTP Gigabit Network Patch Cable (2m)',
        brand: 'D-Link',
        model: 'NCB-C6UGRYR-2',
        spec: 'CAT6 UTP 24 AWG, 1000Mbps Gigabit Transfer, 250MHz Bandwidth, 2m Length',
        description: 'Genuine D-Link 2-meter Cat6 UTP network patch cord with RJ45 snagless connectors, factory verified for Gigabit ethernet speed in office and home networks.',
        isGeneric: false,
        images: PRODUCT_IMAGES['dlink-cat6-utp-patch-cable-2m'] || []
      },
      {
        slug: 'cat6-rj45-gigabit-ethernet-patch-cable-grey',
        name: 'CAT6 RJ45 Gigabit Ethernet Patch Cable (Grey)',
        brand: 'Generic',
        model: 'CAT6 UTP Patch Cord Series',
        spec: 'Unshielded Twisted Pair (UTP), Molded Strain Relief RJ45 Plugs, Gigabit Rated',
        description: 'Durable grey Cat6 RJ45 network patch cable designed for connecting routers, switches, patch panels, desktop computers, and network printers.',
        isGeneric: true,
        images: PRODUCT_IMAGES['cat6-rj45-gigabit-ethernet-patch-cable-grey'] || [],
        variantSelectorLabel: 'Select Length',
        variantType: 'length',
        variants: [
          {
            id: '1m',
            label: '1m',
            spec: '1m Length, Molded Strain Relief RJ45 Plugs, Gigabit Rated',
            imageIndex: 0
          },
          {
            id: '2m',
            label: '2m',
            spec: '2m Length, Molded Strain Relief RJ45 Plugs, Gigabit Rated',
            imageIndex: 1
          },
          {
            id: '3m',
            label: '3m',
            spec: '3m Length, Molded Strain Relief RJ45 Plugs, Gigabit Rated',
            imageIndex: 2
          },
          {
            id: '10m',
            label: '10m',
            spec: '10m Long Distance Run, Molded RJ45 Plugs, Gigabit Rated',
            imageIndex: 3
          }
        ]
      },
      {
        slug: 'usb-to-internal-5pin-terminal-data-cable',
        name: 'USB Type-A to Internal 5-Pin Terminal / Barcode Scanner Cable',
        brand: 'Generic',
        model: 'USB to 5-Pin JST Terminal Interface Cable',
        spec: 'USB 2.0 Type-A Male to 5-Pin JST Connector, 1.8m Flexible Black Cable',
        description: 'Specialized internal interface cable connecting USB Type-A host ports to internal 5-pin headers or compatible handheld POS barcode scanners.',
        isGeneric: true,
        images: PRODUCT_IMAGES['usb-to-internal-5pin-terminal-data-cable'] || []
      },
      {
        slug: 'amazonbasics-hdmi-male-to-female-extension-cable',
        name: 'AmazonBasics High-Speed HDMI Extension Cable (Male to Female)',
        brand: 'AmazonBasics',
        model: 'High-Speed HDMI Extension Series',
        spec: 'HDMI Male to HDMI Female Extender, Gold-Plated Connectors, 4K Video Support',
        description: 'Genuine AmazonBasics high-speed HDMI male-to-female extension cord for extending reach of streaming sticks, gaming consoles, and TV wall mounts.',
        isGeneric: false,
        images: PRODUCT_IMAGES['amazonbasics-hdmi-male-to-female-extension-cable'] || []
      },
            {
        slug: 'cctv-3-plus-1-coaxial-video-power-cable-roll',
        name: 'CCTV 3+1 Shielded Coaxial Video & Power Cable Roll (White)',
        brand: 'Generic',
        model: 'RG59 3+1 Surveillance Coaxial Cable Roll',
        spec: 'Solid Copper Coax Video Core, 3 Insulated Power Wires, High-Grade PVC Sheath',
        description: 'Specialized 3+1 CCTV composite cable roll designed for analogue and HD-TVI/AHD/CVI CCTV installations, delivering crystal video and camera power over a single run.',
        isGeneric: true,
        images: PRODUCT_IMAGES['cctv-3-plus-1-coaxial-video-power-cable-roll'] || []
      },
      {
        slug: 'hdmi-male-to-vga-female-adapter-with-audio',
        name: 'HDMI Male to VGA Female Converter Adapter with 3.5mm Audio',
        brand: 'Generic',
        model: 'Active HDMI to VGA Audio Converter Dongle',
        spec: 'Input HDMI Male, Output VGA Female + 3.5mm Stereo Audio Jack, 1080p Active IC',
        description: 'Active digital HDMI to analog VGA video converter adapter with separate 3.5mm audio jack, enabling modern laptops and PCs to connect to VGA monitors and projectors.',
        isGeneric: true,
        images: PRODUCT_IMAGES['hdmi-male-to-vga-female-adapter-with-audio'] || []
      },
      {
        slug: 'compact-hdmi-female-to-vga-male-adapter-converter',
        name: 'Compact HDMI Female to VGA Male Direct-Plug Adapter with Audio & Power',
        brand: 'Generic',
        model: 'Direct Plug HDMI-In to VGA-Out Converter',
        spec: 'HDMI Female Input, VGA Male Output, 3.5mm Audio Port, Micro-USB 5V Power Jack',
        description: 'Compact direct-plug video converter turning HDMI signals into VGA display input, with built-in auxiliary audio port and micro-USB 5V power support.',
        isGeneric: true,
        images: PRODUCT_IMAGES['compact-hdmi-female-to-vga-male-adapter-converter'] || [],
        variantSelectorLabel: 'Select Colour',
        variantType: 'colour',
        variants: [
          {
            id: 'black',
            label: 'Black',
            spec: 'Black Enclosure, HDMI Female to VGA Male, 3.5mm Audio Port, Micro-USB 5V',
            imageIndex: 0
          },
          {
            id: 'white',
            label: 'White',
            spec: 'White Enclosure, HDMI Female to VGA Male, 3.5mm Audio Port, Micro-USB 5V',
            imageIndex: 1
          }
        ]
      },
      {
        slug: 'usb-3-0-to-hdmi-1080p-display-adapter',
        name: 'USB 3.0 to HDMI 1080P External Graphic Card Video Adapter',
        brand: 'Generic',
        model: 'USB 3.0 Multi-Display HDMI Converter',
        spec: 'USB 3.0 5Gbps Host Interface, 1080p FHD 60Hz HDMI Output, Metal Casing',
        description: 'External USB 3.0 display graphics adapter for adding a second HDMI monitor, TV, or projector to laptops and desktop PCs without needing an internal graphics card upgrade.',
        isGeneric: true,
        images: PRODUCT_IMAGES['usb-3-0-to-hdmi-1080p-display-adapter'] || []
      },
      {
        slug: 'hdmi-female-to-female-coupler-extender',
        name: 'HDMI Female to Female Coupler Gender Changer Extender Adapter',
        brand: 'Generic',
        model: 'Gold-Plated HDMI F/F Joiner Adapter',
        spec: 'Dual HDMI Type-A Female Ports, Gold-Plated Contacts, Molded Grip Casing',
        description: 'Compact gold-plated HDMI female-to-female barrel coupler joiner designed to join two HDMI cables together for extended length without signal degradation.',
        isGeneric: true,
        images: PRODUCT_IMAGES['hdmi-female-to-female-coupler-extender'] || []
      },
      {
        slug: 'vga-1-male-to-2-female-y-splitter-cable',
        name: 'VGA 1 Male to 2 Female Dual Monitor Y-Splitter Video Cable',
        brand: 'Generic',
        model: '15-Pin VGA Screen Mirroring Y-Cable',
        spec: '1x VGA 15-Pin Male to 2x VGA 15-Pin Female, Integrated Ferrite Cores',
        description: 'VGA Y-splitter cable designed to replicate and send identical video signals from one computer VGA port to two separate VGA monitors or projectors simultaneously.',
        isGeneric: true,
        images: PRODUCT_IMAGES['vga-1-male-to-2-female-y-splitter-cable'] || []
      },
      {
        slug: 'rca-3-male-to-3-female-av-extension-cable',
        name: '3 RCA Male to 3 RCA Female Composite Audio/Video Extension Cable',
        brand: 'Generic',
        model: 'Triple RCA AV Extension Cable',
        spec: 'Yellow (Video), Red & White (Stereo Audio), Molded Strain Relief Connectors',
        description: 'Composite 3-RCA male to female audio/video extension cable for extending set-top box, DVD, CCTV monitor, and home entertainment system connections.',
        isGeneric: true,
        images: PRODUCT_IMAGES['rca-3-male-to-3-female-av-extension-cable'] || []
      },
      {
        slug: 'mini-vga-to-hdmi-1080p-video-converter-box',
        name: 'Mini VGA to HDMI 1080P Scaler Video Converter Box (VGA2HDMI)',
        brand: 'Generic',
        model: 'VGA2HDMI Mini Video Scaler Box',
        spec: 'VGA + 3.5mm Audio Input to HDMI 720p/1080p Output, USB 5V Powered',
        description: 'Mini VGA2HDMI converter box that up-scales analog PC VGA video and 3.5mm audio into pure digital HDMI output for modern smart TVs and monitors.',
        isGeneric: true,
        images: PRODUCT_IMAGES['mini-vga-to-hdmi-1080p-video-converter-box'] || []
      },
      {
        slug: 'mini-hdmi-to-av-rca-video-converter-box',
        name: 'Mini HDMI to AV RCA Composite Video Audio Converter Box (HDMI2AV)',
        brand: 'Generic',
        model: 'HDMI2AV Mini Video Converter Box',
        spec: 'HDMI Digital Input, 3-RCA Composite Output, PAL/NTSC Switch, USB 5V Powered',
        description: 'HDMI2AV converter box converting high-definition digital HDMI signals into standard composite RCA (Yellow/Red/White) for older CRT TVs and AV receivers.',
        isGeneric: true,
        images: PRODUCT_IMAGES['mini-hdmi-to-av-rca-video-converter-box'] || []
      },
      {
        slug: 'mini-av-rca-to-vga-video-converter-box',
        name: 'Mini AV RCA Composite to VGA Video Converter Box (AV2VGA)',
        brand: 'Generic',
        model: 'AV2VGA Mini Video Converter Box',
        spec: 'RCA Composite Video Input (CVBS + L/R), VGA Output, USB 5V Powered',
        description: 'Compact AV2VGA converter box allowing CCTV cameras, gaming consoles, and set-top boxes with RCA output to connect directly to standard PC VGA monitors.',
        isGeneric: true,
        images: PRODUCT_IMAGES['mini-av-rca-to-vga-video-converter-box'] || []
      },
      {
        slug: 'mini-av-rca-to-hdmi-1080p-scaler-converter-box',
        name: 'Mini AV RCA to HDMI 1080P Up Scaler Video Converter Box (AV2HDMI)',
        brand: 'Generic',
        model: 'AV2HDMI Mini Video Scaler Box',
        spec: 'Composite RCA Audio/Video Input, HDMI 720p/1080p Output, 5V USB Powered',
        description: 'Mini AV2HDMI video converter processing legacy analog composite RCA signals into crisp 1080p HDMI digital output for modern displays.',
        isGeneric: true,
        images: PRODUCT_IMAGES['mini-av-rca-to-hdmi-1080p-scaler-converter-box'] || []
      },
      {
        slug: 'hdmi-1-male-to-2-female-dual-splitter-cable',
        name: 'HDMI 1 Male to 2 Female Dual Port Splitter Adapter Cable (30cm)',
        brand: 'Generic',
        model: '1 In 2 Out HDMI Video Splitter Cable',
        spec: '1x HDMI Male to 2x HDMI Female, Gold-Plated Ports, 30cm Cable Length',
        description: 'Short HDMI dual-output splitter adapter cable designed to distribute a single HDMI video source to two connected display ports.',
        isGeneric: true,
        images: PRODUCT_IMAGES['hdmi-1-male-to-2-female-dual-splitter-cable'] || []
      },
      {
        slug: 'usb-type-c-3-in-1-multiport-adapter-silver',
        name: 'USB Type-C 3-in-1 Multiport Hub Adapter (4K HDMI + USB 3.0 + Type-C PD)',
        brand: 'Generic',
        model: 'Type-C 3-in-1 Aluminum Adapter',
        spec: '4K UHD HDMI Output, USB 3.0 5Gbps Port, USB-C 60W Power Delivery Pass-Through',
        description: 'Sleek aluminum USB-C hub offering simultaneous 4K HDMI video out, USB 3.0 flash drive connection, and fast USB-C PD device charging.',
        isGeneric: true,
        images: PRODUCT_IMAGES['usb-type-c-3-in-1-multiport-adapter-silver'] || []
      },
      {
        slug: 'fentico-displayport-male-to-vga-female-adapter',
        name: 'Fentico DisplayPort Male to VGA Female Active Converter Adapter',
        brand: 'Fentico',
        model: 'DP to VGA Active Converter',
        spec: 'Gold-Plated DisplayPort Male, 15-Pin VGA Female, 1080p FHD 60Hz Support',
        description: 'Fentico branded active DisplayPort to VGA converter adapter enabling DisplayPort-equipped desktop towers and laptops to display video on VGA monitors.',
        isGeneric: false,
        images: PRODUCT_IMAGES['fentico-displayport-male-to-vga-female-adapter'] || []
      },
      {
        slug: 'usb-type-c-to-hdmi-4k-display-adapter-silver',
        name: 'USB Type-C to HDMI 4K UHD Video Display Adapter (Silver Aluminum)',
        brand: 'Generic',
        model: 'Type-C to HDMI Video Converter Dongle',
        spec: 'USB 3.1 Type-C Input, 4K@30Hz / 1080p@60Hz HDMI Output, Aluminum Alloy Shell',
        description: 'Portable aluminum USB Type-C to HDMI converter dongle for mirroring or extending MacBook, Windows laptop, or smartphone screens to 4K displays.',
        isGeneric: true,
        images: PRODUCT_IMAGES['usb-type-c-to-hdmi-4k-display-adapter-silver'] || []
      },
      {
        slug: 'displayport-male-to-hdmi-female-adapter-cable',
        name: 'DisplayPort Male to HDMI Female Video Converter Adapter Cable',
        brand: 'Generic',
        model: 'DP Male to HDMI Female Converter Cable',
        spec: 'Latching DisplayPort Connector, HDMI Female Jack, 1080p FHD Audio/Video Pass',
        description: 'DisplayPort to HDMI adapter cable with secure latching DP plug, facilitating easy connection between PC graphics cards and standard HDMI monitor cables.',
        isGeneric: true,
        images: PRODUCT_IMAGES['displayport-male-to-hdmi-female-adapter-cable'] || []
      },
      {
        slug: 'usb-2-0-hdmi-1080p-video-capture-card-dongle',
        name: 'USB 2.0 Full HD 1080P HDMI Video Capture Card Dongle',
        brand: 'Generic',
        model: 'HDMI to USB 2.0 Video Capture Dongle',
        spec: 'HDMI Video Input (up to 4K), USB 2.0 1080p Recording Output, UVC/UAC Compliant',
        description: 'Compact USB HDMI video capture dongle for live streaming, console gameplay capture, DSLR camera web-conferencing, and medical/educational recording.',
        isGeneric: true,
        images: PRODUCT_IMAGES['usb-2-0-hdmi-1080p-video-capture-card-dongle'] || []
      },
      {
        slug: 'usb-2-0-4-port-hub-with-switches',
        name: '4-Port USB 2.0 Hub with Individual Power Switches & LED Indicators',
        brand: 'Generic',
        model: '4-Port Switched USB 2.0 Hub',
        spec: '4x USB 2.0 480Mbps Ports, Individual Toggle Switches, Power Status LEDs',
        description: 'Multi-port USB 2.0 desktop hub featuring independent on/off rocker switches and LED indicators for each port, eliminating frequent unplugging.',
        isGeneric: true,
        images: PRODUCT_IMAGES['usb-2-0-4-port-hub-with-switches'] || []
      },
      {
        slug: 'sata-2-5-inch-hdd-ssd-enclosure-black',
        name: '2.5-Inch SATA to USB External Hard Drive / SSD Enclosure Casing (Black)',
        brand: 'Generic',
        model: '2.5" SATA External HDD/SSD Enclosure',
        spec: 'SATA I/II/III Interface, USB 2.0/3.0 Connection, Tool-Free Slide Design',
        description: 'Protective black external hard drive enclosure case converting any 2.5-inch laptop SATA HDD or solid-state drive into a portable plug-and-play external drive.',
        isGeneric: true,
        images: PRODUCT_IMAGES['sata-2-5-inch-hdd-ssd-enclosure-black'] || [],
        variantSelectorLabel: 'Select Interface',
        variantType: 'interface',
        variants: [
          {
            id: 'usb-2-0',
            label: 'USB 2.0 (480Mbps)',
            spec: 'SATA I/II to USB 2.0 480Mbps Interface, Tool-Free Slide Enclosure',
            imageIndex: 0
          },
          {
            id: 'usb-3-0',
            label: 'USB 3.0 (SuperSpeed 5Gbps)',
            spec: 'SATA III to USB 3.0 5Gbps with UASP Support, Tool-Free Slide Enclosure',
            imageIndex: 2
          }
        ]
      },
      {
        slug: 'transparent-2-5-inch-sata-usb-3-0-enclosure',
        name: 'Transparent 2.5-Inch SATA to USB 3.0 Tool-Free HDD/SSD Enclosure',
        brand: 'Generic',
        model: 'Clear Acrylic 2.5" SATA Hard Drive Case',
        spec: 'SuperSpeed USB 3.0 5Gbps, Transparent PC Body, SATA III 6Gbps UASP Support',
        description: 'Crystal clear 2.5-inch SATA hard drive enclosure made of transparent shockproof polycarbonate, featuring tool-free slide installation and USB 3.0 transfer rates.',
        isGeneric: true,
        images: PRODUCT_IMAGES['transparent-2-5-inch-sata-usb-3-0-enclosure'] || []
      },
      {
        slug: 'cr2032-3v-lithium-coin-cell-batteries-pack',
        name: 'CR2032 3V Lithium Coin Cell Motherboard CMOS Batteries (Pack of 5)',
        brand: 'Generic',
        model: 'CR2032 3V Lithium Cell',
        spec: '3.0V Nominal Voltage, 220mAh Capacity, Anti-Leak Lithium Technology',
        description: 'High-reliability CR2032 3V lithium coin cell batteries ideal for desktop motherboard CMOS BIOS backup, digital weighing scales, car key fobs, and calculators.',
        isGeneric: true,
        images: PRODUCT_IMAGES['cr2032-3v-lithium-coin-cell-batteries-pack'] || []
      },
      {
        slug: 'compact-4-port-usb-hub-block-expander',
        name: 'Compact 4-Port USB 2.0 Hub Block Expander',
        brand: 'Generic',
        model: '4-Port Multi-Angle USB Expander',
        spec: '4x USB 2.0 Type-A Ports (1 Top + 3 Side), Ultra-Compact Black Block Housing',
        description: 'Ultra-compact rectangular 4-port USB 2.0 splitter hub designed to expand crowded laptop USB ports for mice, keyboards, and flash drives.',
        isGeneric: true,
        images: PRODUCT_IMAGES['compact-4-port-usb-hub-block-expander'] || []
      },
      {
        slug: 'usb-to-rs232-db9-serial-adapter-cable',
        name: 'USB 2.0 to RS232 DB9 9-Pin Serial COM Port Adapter Cable (Translucent Blue)',
        brand: 'Generic',
        model: 'USB to DB9 Serial Adapter (CH340 / HL-340)',
        spec: 'USB Type-A Male to DB9 Male Serial Port, Gold-Plated Pins, Transparent Blue Mold',
        description: 'USB to RS-232 9-pin serial COM port converter cable for connecting CNC machines, modems, barcode scanners, PLCs, and network routers to modern PCs.',
        isGeneric: true,
        images: PRODUCT_IMAGES['usb-to-rs232-db9-serial-adapter-cable'] || []
      },
      {
        slug: 'ranz-3-in-1-screen-cleaning-kit',
        name: 'Ranz 3-in-1 Screen & Laptop Cleaning Kit (Spray + Cloth + Brush)',
        brand: 'Ranz',
        model: 'Expert on Cleaning Screen 3-in-1 Kit',
        spec: 'Anti-Static Liquid Cleaner Spray, Soft Microfiber Cloth, Antistatic Keyboard Brush',
        description: 'Genuine Ranz 3-in-1 professional screen cleaning kit safely removing fingerprints, dust, and grime from laptop screens, LED monitors, and mobile displays.',
        isGeneric: false,
        images: PRODUCT_IMAGES['ranz-3-in-1-screen-cleaning-kit'] || []
      },
      {
        slug: 'super-clean-high-tech-cleaning-gel-pouch',
        name: 'Super Clean High-Tech Keyboard & Laptop Cleaning Compound Gel',
        brand: 'Super Clean',
        model: 'High-Tech Cleaning Compound Pouch',
        spec: '80g Biodegradable Dust-Absorbing Compound, Reusable Gel Formula',
        description: 'Super Clean flexible keyboard cleaning slime gel designed to reach deep inside keyboard keys, car air vents, and delicate computer equipment to capture trapped dust.',
        isGeneric: false,
        images: PRODUCT_IMAGES['super-clean-high-tech-cleaning-gel-pouch'] || []
      },
      {
        slug: 'kizma-3-in-1-super-cleaning-kit',
        name: 'Kizma 3-in-1 Super Cleaning Kit with 100ml Screen Spray',
        brand: 'Kizma',
        model: '3-in-1 Super Cleaning Kit',
        spec: '100ml Screen & Shine Spray, Large Microfiber Towel, Ergonomic Dust Brush',
        description: 'Kizma 3-in-1 multi-device cleaning kit designed for sanitizing and polishing laptop screens, television monitors, cameras, and computer keyboards.',
        isGeneric: false,
        images: PRODUCT_IMAGES['kizma-3-in-1-super-cleaning-kit'] || []
      },
      {
        slug: 'passive-hdcvi-tvi-ahd-cctv-video-balun-pair',
        name: 'Passive HDCVI / HDTVI / AHD CCTV Video Balun Transceiver Pair',
        brand: 'Generic',
        model: '1-Channel Passive HD Video Balun Pair',
        spec: 'BNC Male with Pigtail to Push-Pin Terminal, Supports AHD/CVI/TVI up to 4MP/5MP',
        description: 'Passive 1-channel HD CCTV video balun transceiver pair allowing high-definition security camera transmission over standard CAT5/CAT6 UTP cables over long distances.',
        isGeneric: true,
        images: PRODUCT_IMAGES['passive-hdcvi-tvi-ahd-cctv-video-balun-pair'] || []
      },
      {
        slug: 'wireless-n-950m-mini-usb-wifi-adapter',
        name: '802.11N 950M Wireless-N Mini USB Wi-Fi Nano Adapter',
        brand: 'Generic',
        model: 'OT-WUA950NM',
        spec: '802.11b/g/n 2.4GHz Band, Up to 950Mbps Theoretical Throughput, USB 2.0 Nano Dongle',
        description: 'Ultra-compact 802.11N USB Wi-Fi adapter providing wireless desktop internet connectivity and high-speed local network access with soft-AP support.',
        isGeneric: false,
        images: PRODUCT_IMAGES['wireless-n-950m-mini-usb-wifi-adapter'] || []
      },
      {
        slug: 'microfiber-cleaning-cloths-multi-color-pack',
        name: 'Soft Microfiber Cleaning & Polishing Cloths (Multi-Color Pack)',
        brand: 'Generic',
        model: 'Serrated Edge Microfiber Cleaning Cloth Pack',
        spec: 'Non-Abrasive Lint-Free Microfiber Fabric, Zigzag Edge Weave, Multi-Color Assortment',
        description: 'Premium lint-free microfiber cleaning cloths engineered for scratch-free wiping of laptop screens, smartphone glass, camera lenses, and monitor displays.',
        isGeneric: true,
        images: PRODUCT_IMAGES['microfiber-cleaning-cloths-multi-color-pack'] || []
      },
      {
        slug: 'bluetooth-5-0-usb-nano-dongle-adapter',
        name: 'Bluetooth 5.0 USB Nano Dongle Wireless Receiver Adapter',
        brand: 'Generic',
        model: 'Bluetooth 5.0 USB Dongle (V5.0)',
        spec: 'Bluetooth 5.0 + EDR, 20m Operating Range, Plug-and-Play Windows/PC Support',
        description: 'Low-latency Bluetooth 5.0 USB nano adapter enabling desktop computers and non-Bluetooth laptops to pair with wireless headphones, speakers, keyboards, and mice.',
        isGeneric: true,
        images: PRODUCT_IMAGES['bluetooth-5-0-usb-nano-dongle-adapter'] || []
      },
      {
        slug: 'cctv-bnc-male-pigtail-coaxial-cables-10pack',
        name: 'CCTV BNC Male Video Connector Coaxial Pigtail Cables (Pack of 10)',
        brand: 'Generic',
        model: 'BNC Male Coaxial Video Pigtail 10-Pack',
        spec: '10x BNC Male Plug with Pre-Stripped Copper Coax Leads, White Insulated Wire',
        description: 'Convenient 10-pack of pre-crimped BNC male video pigtail wires for quick CCTV camera repair, custom coaxial termination, and DVR board wiring.',
        isGeneric: true,
        images: PRODUCT_IMAGES['cctv-bnc-male-pigtail-coaxial-cables-10pack'] || []
      },
      {
        slug: 'intel-stock-lga115x-cpu-cooler-fan',
        name: 'Intel Stock CPU Heatsink Cooler Fan (LGA 115x Sockets)',
        brand: 'Intel',
        model: 'E97379-003 (Delta 12V DC)',
        spec: 'LGA 1150 / 1151 / 1155 / 1156 Compatible, Aluminum Core, 4-Pin PWM Fan Connector',
        description: 'Genuine Intel OEM stock heatsink cooler fan with push-pin mounting and copper/aluminum heat dissipation core for Core i3/i5/i7 desktop processors.',
        isGeneric: false,
        images: PRODUCT_IMAGES['intel-stock-lga115x-cpu-cooler-fan'] || []
      },
      {
        slug: 'dt830d-digital-multimeter-with-probes',
        name: 'DT830D Compact Digital Multimeter with Testing Probes',
        brand: 'Generic',
        model: 'DT830D',
        spec: 'AC/DC Voltage, DC Current, Resistance, Continuity Buzzer, Transistor hFE Tester',
        description: 'Essential DT830D digital multimeter with red and black probe leads for troubleshooting computer motherboards, power supplies, cables, and electronic components.',
        isGeneric: false,
        images: PRODUCT_IMAGES['dt830d-digital-multimeter-with-probes'] || []
      },
      {
        slug: 'cctv-12v-dc-male-power-pigtail-connectors-10pack',
        name: 'CCTV 12V DC Male Power Pigtail Connector Cables 2.1x5.5mm (Pack of 10)',
        brand: 'Generic',
        model: '12V DC Male Pigtail 10-Pack',
        spec: '10x 2.1mm x 5.5mm DC Barrel Male Plugs, Pre-Stripped Red/Black Wire Ends',
        description: 'Pack of 10 heavy-duty 12V DC male power pigtail cables for connecting CCTV security cameras to centralized power supply distribution boxes.',
        isGeneric: true,
        images: PRODUCT_IMAGES['cctv-12v-dc-male-power-pigtail-connectors-10pack'] || []
      },
      {
        slug: 'thermaltake-cpu-cooler-fan-lga775-115x',
        name: 'Thermaltake CPU Heatsink Cooler Fan (Screw Mount)',
        brand: 'Thermaltake',
        model: 'Silent Radial Aluminum CPU Cooler',
        spec: 'Screw-and-Spring Backplate Mounting, Aluminum Extrusion Fin Array, 12V DC Fan',
        description: 'Reliable Thermaltake radial aluminum CPU heatsink fan with heavy-duty spring screws for vibration-free processor cooling on desktop motherboards.',
        isGeneric: false,
        images: PRODUCT_IMAGES['thermaltake-cpu-cooler-fan-lga775-115x'] || []
      },
      {
        slug: 'rj45-rj11-network-cable-crimping-tool-with-stripper',
        name: '3-in-1 RJ45 / RJ11 Modular Network Cable Crimping Tool with Stripper',
        brand: 'Generic',
        model: '8P8C / 6P4C Modular Crimper',
        spec: 'Hardened Carbon Steel Jaws, Integrated Wire Cutter & Jacket Stripper, Ergonomic Grip',
        description: 'Professional 3-in-1 network crimping tool for cutting, stripping, and terminating 8P8C RJ45 and 6P4C RJ11 connectors on Ethernet and telephone cables.',
        isGeneric: true,
        images: PRODUCT_IMAGES['rj45-rj11-network-cable-crimping-tool-with-stripper'] || []
      },
      {
        slug: 'universal-sata-2nd-hdd-caddy',
        name: 'Universal SATA 2nd HDD / SSD Optical Drive Bay Caddy (9.5mm / 12.7mm)',
        brand: 'Generic',
        model: 'Second HDD Caddy Series',
        spec: 'SATA to SATA Interface, Fits 2.5" SSD/HDD, Complete with Screws & Screwdriver',
        description: 'Universal aluminum 2nd HDD caddy replacing your laptop internal DVD/CD optical drive with an additional 2.5-inch SATA solid-state drive or hard drive.',
        isGeneric: true,
        images: PRODUCT_IMAGES['universal-sata-2nd-hdd-caddy'] || [],
        variantSelectorLabel: 'Select Thickness',
        variantType: 'thickness',
        variants: [
          {
            id: '9-5mm',
            label: '9.5mm (Ultra-Slim)',
            spec: '9.5mm Optical Drive Bay Thickness, SATA to SATA, Fits 2.5" SSD/HDD',
            imageIndex: 0
          },
          {
            id: '12-7mm',
            label: '12.7mm (Standard)',
            spec: '12.7mm Optical Drive Bay Thickness, SATA to SATA, Fits 2.5" SSD/HDD',
            imageIndex: 1
          }
        ]
      },
      {
        slug: 'dc-power-adapter-9v-1a-barrel-jack',
        name: '9V 1A DC Regulated Power Supply Adapter (Indian 2-Pin Plug)',
        brand: 'Generic',
        model: '9V 1A DC Power Adapter (5.5x2.5mm / 5.5x2.1mm)',
        spec: 'Input 100-240V AC, Output 9V DC 1A Regulated, 5.5mm Barrel Connector',
        description: 'Standard 9V 1A regulated DC power supply adapter with Indian 2-pin wall plug and 5.5mm DC barrel jack, compatible with modems, optical network terminals (ONT), routers, and electronic equipment.',
        isGeneric: true,
        images: PRODUCT_IMAGES['dc-power-adapter-9v-1a-barrel-jack'] || []
      },
      {
        slug: 'dc-power-adapter-12v-2a-barrel-jack',
        name: '12V 2A DC Regulated Power Supply Adapter (Indian 2-Pin Plug)',
        brand: 'Generic',
        model: '12V 2A DC Power Adapter (5.5x2.5mm / 5.5x2.1mm)',
        spec: 'Input 100-240V AC, Output 12V DC 2A Regulated (24W), 5.5mm Barrel Connector',
        description: 'Standard 12V 2A regulated DC power adapter with Indian 2-pin wall plug and 5.5mm DC barrel connector, engineered for CCTV cameras, DVR systems, Wi-Fi routers, LED strips, and 12V peripherals.',
        isGeneric: true,
        images: PRODUCT_IMAGES['dc-power-adapter-12v-2a-barrel-jack'] || []
      },
      {
        slug: 'extended-gaming-mouse-pad-desk-mat',
        name: 'Extended Gaming Mouse Pad & Keyboard Desk Mat (Black with Blue Border)',
        brand: 'Generic',
        model: 'XL Extended Gaming Desk Mat',
        spec: 'Smooth Micro-Weave Fabric Surface, Anti-Fray Stitched Blue Border, Non-Slip Base',
        description: 'Extra-large gaming desk mat providing expansive tracking space for both keyboard and mouse, with non-slip rubber base and reinforced stitched edges.',
        isGeneric: true,
        images: PRODUCT_IMAGES['extended-gaming-mouse-pad-desk-mat'] || []
      },
      {
        slug: 'scenic-nature-printed-optical-mousepad',
        name: 'Scenic Nature Printed Optical Mousepad',
        brand: 'Generic',
        model: 'Printed Rubber Base Mousepad',
        spec: 'Vibrant High-Resolution Fabric Print, Non-Slip Rubber Base, Standard Desktop Size',
        description: 'Standard office fabric mousepad with scenic landscape print and high-traction rubber backing ensuring smooth mouse gliding and desk stability.',
        isGeneric: true,
        images: PRODUCT_IMAGES['scenic-nature-printed-optical-mousepad'] || []
      },
      {
        slug: 'logitech-retro-logo-gaming-mousepad',
        name: 'Logitech Retro Logo Non-Slip Gaming Mousepad',
        brand: 'Logitech',
        model: 'Classic Logo Series Mousepad',
        spec: 'Textured Fabric Glide Surface, Natural Rubber Anti-Skid Base, Classic Logo Graphic',
        description: 'Durable black desktop mousepad featuring classic green/orange Logitech emblem graphic, providing precise optical sensor tracking.',
        isGeneric: false,
        images: PRODUCT_IMAGES['logitech-retro-logo-gaming-mousepad'] || []
      },
      {
        slug: 'micro-wolf-hunter-l-16-gaming-mouse-pad',
        name: 'Micro Wolf Hunter Precision Gaming Mouse Pad (Model L-16)',
        brand: 'Micro Wolf',
        model: 'Hunter L-16 Silk-Gliding Series',
        spec: 'Precision Speed-Type Gaming Surface, Anti-Fray Stitched Edges, Retail Bagged',
        description: 'Micro Wolf Hunter L-16 precision gaming mousepad designed with a high-density silk-gliding textile surface for rapid mouse movements and pixel-perfect aim.',
        isGeneric: false,
        images: PRODUCT_IMAGES['micro-wolf-hunter-l-16-gaming-mouse-pad'] || []
      },
      {
        slug: 'adnet-ad-mp-02-gaming-mouse-pad',
        name: 'ADNet Gaming Mouse Pad (Model AD-MP-02)',
        brand: 'ADNet',
        model: 'AD-MP-02 Silk-Gliding Series',
        spec: 'Avengers Superhero Graphic Print, Silk-Gliding Surface, Anti-Slip Base',
        description: 'ADNet AD-MP-02 gaming mouse pad in sealed retail packaging, featuring vibrant superhero artwork and a silk-gliding surface for work and gaming.',
        isGeneric: false,
        images: PRODUCT_IMAGES['adnet-ad-mp-02-gaming-mouse-pad'] || []
      },
      {
        slug: 'terabyte-kubix-e-02b-multimedia-speakers',
        name: 'Terabyte Kubix E-02B 2.0 Multimedia USB-Powered Speakers',
        brand: 'Terabyte',
        model: 'Kubix E-02B',
        spec: '2.0 Channel Stereo Sound, USB 5V Powered + 3.5mm Audio Jack, Black Cube Enclosure',
        description: 'Terabyte Kubix E-02B compact 2.0 multimedia stereo speakers for desktop PCs and laptops, delivering crisp acoustics without needing an AC wall adapter.',
        isGeneric: false,
        images: PRODUCT_IMAGES['terabyte-kubix-e-02b-multimedia-speakers'] || []
      },
      {
        slug: 'terabyte-eliptic-tb-015-multimedia-speakers',
        name: 'Terabyte Eliptic TB-015 2.0 Multimedia USB-Powered Speakers',
        brand: 'Terabyte',
        model: 'Eliptic TB-015',
        spec: 'Oval Acoustic Enclosure, Red Accent Cones, USB Powered with 3.5mm AUX Audio',
        description: 'Terabyte Eliptic TB-015 stylish 2.0 USB-powered multimedia speakers featuring distinctive red driver accents and full-range sound output.',
        isGeneric: false,
        images: PRODUCT_IMAGES['terabyte-eliptic-tb-015-multimedia-speakers'] || []
      },
      {
        slug: 'terabyte-clarion-tb-008-mini-digital-speakers',
        name: 'Terabyte Clarion TB-008 Mini Digital Portable Stereo Speakers',
        brand: 'Terabyte',
        model: 'Clarion TB-008',
        spec: 'Spherical Red Orb Enclosure, USB 5V Powered + 3.5mm Stereo Audio Plug',
        description: 'Terabyte Clarion TB-008 portable mini spherical stereo speakers engineered for high-energy playback with laptops, mobile phones, and desktop computers.',
        isGeneric: false,
        images: PRODUCT_IMAGES['terabyte-clarion-tb-008-mini-digital-speakers'] || []
      },
      {
        slug: 'adnet-ad-201-optical-wired-mouse',
        name: 'ADNet AD-201 1000 DPI Optical Wired USB Mouse',
        brand: 'ADNet',
        model: 'AD-201',
        spec: '1000 DPI Optical Sensor, 3-Button with Scroll Wheel, USB 2.0 Plug-and-Play',
        description: 'ADNet AD-201 ergonomic wired optical mouse featuring high-precision 1000 DPI tracking and ambidextrous curved casing for daily office computing.',
        isGeneric: false,
        images: PRODUCT_IMAGES['adnet-ad-201-optical-wired-mouse'] || []
      },
      {
        slug: 'adjustable-ergonomic-aluminum-laptop-stand',
        name: 'Adjustable Ergonomic Aluminum Laptop Stand (Foldable Riser)',
        brand: 'Generic',
        model: 'Multi-Angle Aluminum Laptop Riser',
        spec: 'Solid Anodized Aluminum Alloy, 6-Level Height Adjustment, Anti-Slip Silicone Pads',
        description: 'Portable foldable aluminum laptop riser stand elevating screens to eye level for neck comfort and improved laptop underside cooling ventilation.',
        isGeneric: true,
        images: PRODUCT_IMAGES['adjustable-ergonomic-aluminum-laptop-stand'] || []
      },
      {
        slug: 'laptop-cooling-pad-with-blue-led-fan',
        name: 'Laptop Cooling Pad with Blue LED Silent Fan (Metal Mesh)',
        brand: 'Generic',
        model: 'Single-Fan Laptop Chill Mat Cooler',
        spec: 'Large High-Airflow Silent Fan, Blue LED Illumination, Full Aerodynamic Metal Mesh',
        description: 'Ergonomic laptop chill mat cooling pad with integrated silent blue LED fan and aerodynamic steel mesh surface to keep gaming and work laptops cool.',
        isGeneric: true,
        images: PRODUCT_IMAGES['laptop-cooling-pad-with-blue-led-fan'] || []
      },
      {
        slug: 'cctv-4-channel-12v-1a-smps-power-supply',
        name: '4-Channel 12V 1A/Channel CCTV Camera Power Supply SMPS Box',
        brand: 'Generic',
        model: '4 Channel CCTV SMPS (12V 4A / 1A per channel)',
        spec: 'Input: AC 150-290V 50/60Hz, Output: DC 12V 1A per channel (4-Channels), Terminal Screws',
        description: 'Wall-mountable 4-channel regulated 12V DC power supply SMPS with individual output terminals and power extension mode switch for 4 CCTV cameras.',
        isGeneric: true,
        images: PRODUCT_IMAGES['cctv-4-channel-12v-1a-smps-power-supply'] || []
      },
      {
        slug: 'crotomax-wall-mount-dvr-rack-cabinet',
        name: 'CROTOMAX Wall Mount DVR & Network Server Rack Cabinet (Toughened Glass Door)',
        brand: 'CROTOMAX',
        model: 'Wall Mount Security DVR Enclosure',
        spec: 'Heavy-Duty Cold Rolled Steel, Lockable Glass Front Door, Side Ventilation Louvers',
        description: 'Genuine CROTOMAX heavy-duty wall mount steel cabinet rack with lockable toughened glass door and ventilation slots to securely house DVRs, NVRs, and network switches.',
        isGeneric: false,
        images: PRODUCT_IMAGES['crotomax-wall-mount-dvr-rack-cabinet'] || [],
        variantSelectorLabel: 'Select Rack Size',
        variantType: 'size',
        variants: [
          {
            id: '2u',
            label: '2U Compact',
            spec: '2U Form Factor, Heavy-Duty Cold Rolled Steel, Lockable Glass Front Door',
            imageIndex: 0
          },
          {
            id: '4u',
            label: '4U Standard',
            spec: '4U Form Factor, Extra Depth for DVR/NVR + SMPS + Router, Glass Front Door',
            imageIndex: 1
          }
        ]
      },
      {
        slug: 'hawk-vision-stainless-steel-electronic-door-lock',
        name: 'Hawk Vision Stainless Steel Electronic Door Rim Lock (Electric Strike)',
        brand: 'Hawk Vision',
        model: 'Heavy-Duty Stainless Steel Rim Lock',
        spec: 'High-Grade Stainless Steel Casing, 12V DC Electric Release, Dual Brass Cylinders',
        description: 'Hawk Vision heavy-duty electronic rim lock compatible with biometric access control, video door phones, and security keypads for automated door locking.',
        isGeneric: false,
        images: PRODUCT_IMAGES['hawk-vision-stainless-steel-electronic-door-lock'] || []
      },
      {
        slug: 'dvi-d-to-hdmi-bi-directional-video-adapter',
        name: 'DVI-D 24+1 Male to HDMI Female Gold-Plated Bi-Directional Adapter',
        brand: 'Generic',
        model: 'DVI-D (24+1) to HDMI Video Converter',
        spec: 'DVI-D Dual Link 24+1 Male to HDMI Female, Gold-Plated Contacts, Dual Locking Screws',
        description: 'Bi-directional gold-plated DVI-D to HDMI display adapter enabling DVI graphics cards to output video to HDMI monitors or HDMI computers to DVI monitors.',
        isGeneric: true,
        images: PRODUCT_IMAGES['dvi-d-to-hdmi-bi-directional-video-adapter'] || []
      },
      {
        slug: 'swivel-tilt-monitor-tv-wall-mount-bracket',
        name: 'Adjustable Swivel & Tilt LCD/LED Monitor & TV Wall Mount Bracket (14"–27")',
        brand: 'Generic',
        model: 'VESA Swivel Wall Bracket (75x75 / 100x100mm)',
        spec: 'Heavy-Gauge Cold Steel, 180° Swivel & 15° Tilt, Supports Screens up to 27 Inches',
        description: 'Full-motion swivel and tilt wall mount bracket for computer monitors and compact LED TVs, offering adjustable viewing angles and secure VESA mounting.',
        isGeneric: true,
        images: PRODUCT_IMAGES['swivel-tilt-monitor-tv-wall-mount-bracket'] || []
      },
      {
        slug: 'compact-fixed-tv-wall-mount-bracket-14-42',
        name: 'Fixed LCD/LED Monitor & TV Wall Mount Bracket (14"–42")',
        brand: 'Generic',
        model: 'Slim Fixed Display Wall Mount Bracket (14"–42")',
        spec: 'Heavy-Gauge Cold Steel Plate, Max VESA 200x200mm, Fits 14"–42" Displays',
        description: 'Low-profile fixed cold-rolled steel wall mount bracket engineered for 14 to 42-inch computer monitors and compact LED TVs with up to 200x200mm VESA mounting.',
        isGeneric: true,
        images: PRODUCT_IMAGES['compact-fixed-tv-wall-mount-bracket-14-42'] || []
      },
      {
        slug: 'heavy-duty-fixed-tv-wall-mount-bracket',
        name: 'Heavy-Duty Fixed LCD/LED TV Wall Mount Bracket (26"–55")',
        brand: 'Generic',
        model: 'Universal Slim Fixed Wall Mount Bracket (26"–55")',
        spec: 'Heavy-Duty Reinforced Steel Plate, Max VESA 400x400mm, Fits 26"–55" Displays',
        description: 'Universal low-profile heavy-duty steel TV wall mount bracket holding 26 to 55-inch LED and LCD displays securely against the wall.',
        isGeneric: true,
        images: PRODUCT_IMAGES['heavy-duty-fixed-tv-wall-mount-bracket'] || []
      },
      {
        slug: 'dlink-cat6-rj45-modular-connectors-box',
        name: 'D-Link Cat6 RJ45 Modular Network Connector Plugs (Box of 100)',
        brand: 'D-Link',
        model: 'NPG-C61PLA451-100',
        spec: 'Cat6 8P8C Modular Plugs, 50-Micron Gold-Plated Contacts, Box of 100 Pieces',
        description: 'Box of 100 genuine D-Link Cat6 RJ45 unshielded modular plugs engineered with precision gold-plated contacts for terminating Gigabit twisted-pair network cables.',
        isGeneric: false,
        images: PRODUCT_IMAGES['dlink-cat6-rj45-modular-connectors-box'] || []
      },
      {
        slug: 'flipkart-smartbuy-electric-fan-room-heater',
        name: 'Flipkart SmartBuy Electric Fan Room Heater (1000W / 2000W)',
        brand: 'Flipkart SmartBuy',
        model: 'Electric Fan Room Heater',
        spec: 'Dual Heat Settings (1000W/2000W), Adjustable Thermostat Knob, Built-In Overheat Cutoff',
        description: 'Compact Flipkart SmartBuy electric fan room heater with dual heat dials and safety grill, ideal for quick warmth in office cabins and workstations.',
        isGeneric: false,
        images: PRODUCT_IMAGES['flipkart-smartbuy-electric-fan-room-heater'] || []
      },
      {
        slug: 'flexible-usb-led-portable-reading-lamp-2pack',
        name: 'Flexible Silicone USB LED Portable Light Lamp (Pack of 2: Blue & Green)',
        brand: 'Generic',
        model: 'Flexible Silicone USB LED Lamp',
        spec: 'Gooseneck Flexible Silicone Body, 1.2W Energy-Saving LED, Standard USB 5V Plug',
        description: 'Pack of 2 flexible USB LED portable stick lights in blue and green, ideal for illuminating laptop keyboards, bedside reading, and power bank lighting.',
        isGeneric: true,
        images: PRODUCT_IMAGES['flexible-usb-led-portable-reading-lamp-2pack'] || []
      },
      {
        slug: 'water-resistant-laptop-backpack-15-6-inch-grey',
        name: 'Grey Heather Water-Resistant Laptop Backpack (15.6-Inch)',
        brand: 'Generic',
        model: 'Slim Polyester Laptop Travel Backpack',
        spec: 'Fits up to 15.6" Laptops, Water-Repellent Heather Fabric, Padded Shoulder Straps',
        description: 'Slim and lightweight grey heather laptop travel backpack featuring a padded 15.6-inch laptop compartment, organizer pockets, and water-resistant polyester exterior.',
        isGeneric: true,
        images: PRODUCT_IMAGES['water-resistant-laptop-backpack-15-6-inch-grey'] || []
      }
    ]
  }
]
