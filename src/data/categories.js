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
      }
    ]
  }
]
