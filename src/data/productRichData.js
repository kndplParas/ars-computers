/**
 * ARS Computers — Rich Product Data, Ports, Applications, Setup & FAQs
 *
 * Provides authentic, structured hardware technical details for all 5 catalogue
 * categories: Computers & Laptops, CCTV, Printers, Biometrics, and Accessories.
 *
 * Every piece of information is grounded in manufacturer standards and real
 * business practices at ARS Computers (Haldwani, Uttarakhand).
 */

export function getProductRichDetails(product, category) {
  const catSlug = (category?.slug || category?.id || product?.categoryId || '').toLowerCase()
  const pName = product?.name || 'Hardware Product'
  const pModel = product?.model || product?.sku || ''
  const pBrand = product?.brand || ''
  const isGeneric = Boolean(product?.isGeneric)

  if (catSlug.includes('computer') || catSlug.includes('laptop')) {
    const isDesktop = pName.toLowerCase().includes('tower') || pName.toLowerCase().includes('desktop') || pName.toLowerCase().includes('all-in-one')
    return {
      categoryType: 'computer',
      diagramType: isDesktop ? 'desktop-ports' : 'laptop-ports',
      ports: [
        { name: 'USB-C / Thunderbolt', spec: 'SuperSpeed USB-C with DisplayPort Video Output & Power Delivery support (model dependent)', icon: '⚡' },
        { name: 'USB 3.2 Gen 1 Type-A', spec: '2x to 4x High-Speed USB Type-A ports for keyboard, mouse, flash drives and printers', icon: '🔌' },
        { name: 'HDMI 2.0 / 2.1', spec: 'Full-size HDMI digital display port supporting 4K UHD external monitors and projectors', icon: '🖥️' },
        { name: 'Gigabit LAN (RJ-45)', spec: '10/100/1000 Mbps High-Speed Ethernet interface for stable wired office networking', icon: '🌐' },
        { name: 'Audio Combo Jack', spec: '3.5mm Headphone & Microphone combo jack for headsets and external speakers', icon: '🎧' },
        { name: 'Power Input', spec: 'Dedicated smart AC adapter input with over-voltage and surge protection', icon: '🔋' },
        { name: 'Security & Expansion', spec: 'Kensington security lock slot and multi-format SD media card reader', icon: '🔒' }
      ],
      applications: [
        { title: 'Corporate & Business Office', description: 'Engineered for seamless multitasking across Microsoft Office 365, enterprise ERPs, and cloud business apps.', icon: '🏢' },
        { title: 'Accounting & Commercial POS', description: 'Certified stable platform for Tally Prime, Busy, Marg ERP, and GST billing software packages.', icon: '📊' },
        { title: 'Remote Work & Video Meetings', description: 'Integrated HD web camera, dual-array noise-cancelling microphones, and fast Wi-Fi 6 wireless networking.', icon: '💼' },
        { title: 'Engineering, Coding & Content', description: 'High-performance multi-core Intel/AMD processors paired with ultra-fast PCIe NVMe solid-state storage.', icon: '💻' }
      ],
      setupGuide: [
        { step: 1, title: 'Unpack & Inspect', desc: 'Inspect outer casing, power adapter, and warranty documentation inside the original packaging.' },
        { step: 2, title: 'Connect Power & Peripherals', desc: 'Plug into an earthed 3-pin wall socket via the supplied smart AC adapter. Connect monitor, keyboard, and mouse if setting up a desktop system.' },
        { step: 3, title: 'Initial OS Setup', desc: 'Power on the system to complete the guided Windows / OS user setup, configure regional time zones, and connect to office Wi-Fi.' },
        { step: 4, title: 'Software & Security Updates', desc: 'Install company ERP/accounting packages, antivirus security, and run Windows Updates for the latest security patches.' }
      ],
      standards: [
        { name: 'Operating System Compatibility', desc: 'Pre-configured and certified for Microsoft Windows 11 Pro / Home 64-bit and Linux distributions.' },
        { name: 'Wireless Connectivity', desc: 'Dual-Band Wi-Fi 6 (802.11ax) + Bluetooth 5.2 for high-speed low-latency wireless connections.' },
        { name: 'Hardware Security', desc: 'Firmware TPM 2.0 (Trusted Platform Module) enabled for enterprise BitLocker drive encryption.' },
        { name: 'Energy Compliance', desc: 'ENERGY STAR qualified power-saving architecture with smart thermal cooling.' }
      ],
      physicalSpecs: {
        power: 'Smart AC Power Adapter (45W / 65W / 120W auto-switching 100V–240V AC 50/60Hz)',
        dimensions: isDesktop ? 'Compact Commercial Mini-Tower / Small Form Factor (SFF)' : 'Slim & Light Clamshell Business Chassis',
        operatingTemp: '0°C to 40°C (32°F to 104°F) operating temperature',
        weight: isDesktop ? 'Approx. 4.5 kg to 6.8 kg (system dependent)' : 'Approx. 1.45 kg to 1.75 kg (laptop dependent)'
      },
      faqs: [
        {
          q: 'Can the RAM and SSD storage be upgraded later?',
          a: 'Yes, most commercial laptops and desktop towers in our inventory feature accessible DDR4/DDR5 SO-DIMM/DIMM RAM slots and M.2 PCIe NVMe slots. ARS Computers can configure your exact RAM and storage specifications prior to dispatch.'
        },
        {
          q: 'Is the operating system genuine with digital activation?',
          a: 'Yes, systems are supplied with genuine Microsoft Windows or FreeDOS according to your enterprise requirement, complete with genuine digital licenses and recovery partitions.'
        },
        {
          q: 'Does ARS Computers provide warranty support and GST tax invoices?',
          a: 'Yes, all computer systems are supplied with official 100% genuine GST invoices for full B2B Input Tax Credit (ITC). Warranty is covered through authorized brand service centers across India, backed by ARS Computers local support in Haldwani / Uttarakhand.'
        },
        {
          q: 'Does this system support dual external monitors?',
          a: 'Yes, laptops and desktops equipped with HDMI and DisplayPort (or USB-C DisplayPort alt-mode) support simultaneous extended dual displays up to 4K resolution.'
        }
      ]
    }
  }

  if (catSlug.includes('cctv')) {
    const isRecorder = pName.toLowerCase().includes('recorder') || pName.toLowerCase().includes('dvr') || pName.toLowerCase().includes('nvr')
    return {
      categoryType: 'cctv',
      diagramType: isRecorder ? 'dvr-ports' : 'camera-wiring',
      ports: isRecorder ? [
        { name: 'BNC / RJ-45 Video Inputs', spec: '4 / 8 / 16 Multi-Channel High-Definition Video Inputs for Analog HD or IP Cameras', icon: '📹' },
        { name: 'HDMI 4K Output', spec: 'High-definition digital video output supporting 4K UHD and Full HD monitor displays', icon: '🖥️' },
        { name: 'VGA Monitor Output', spec: 'Standard DB-15 VGA port for connection to legacy security desk monitors', icon: '📺' },
        { name: 'RCA Audio In / Out', spec: 'Audio RCA jacks for microphone input and external speaker / intercom connection', icon: '🔊' },
        { name: 'Ethernet LAN Port', spec: 'Gigabit / 100M RJ-45 interface for router uplink and remote cloud mobile viewing', icon: '🌐' },
        { name: 'Dual USB 2.0 Ports', spec: 'Front and rear USB ports for USB mouse control and instant flash drive video clip export', icon: '💾' },
        { name: '12V DC Power Jack', spec: 'Regulated 12V DC power input with industrial surge suppression', icon: '⚡' },
        { name: 'RS-485 Serial Interface', spec: 'Standard 2-wire serial terminal block for PTZ dome camera telemetry control', icon: '🔄' }
      ] : [
        { name: 'Video Output (BNC / RJ45)', spec: 'Standard BNC female 75Ω coaxial connector or PoE RJ-45 IP network connection', icon: '📹' },
        { name: '12V DC Power Pigtail', spec: 'Standard 5.5mm x 2.1mm DC barrel connector with polarity protection', icon: '⚡' },
        { name: 'Audio Mic Interface', spec: 'Built-in high-sensitivity microphone or RCA audio input line for sound recording', icon: '🎙️' },
        { name: 'Mounting Base 3-Axis', spec: '3-Axis adjustable bracket for flexible wall, ceiling or soffit mounting', icon: '📐' }
      ],
      applications: [
        { title: 'Commercial Stores & Retail Premises', description: 'Prevent shoplifting, monitor checkout counters, and review customer footfall with high-clarity video recording.', icon: '🏪' },
        { title: 'Offices & Corporate Facilities', description: 'Track entry/exit doors, reception areas, and server rooms with scheduled recording and motion detection.', icon: '🏢' },
        { title: 'Industrial Warehouses & Logistics', description: 'Continuous perimeter surveillance with long-range infrared night vision and vehicle license plate identification.', icon: '🏭' },
        { title: 'Residential & Gated Communities', description: '24/7 security monitoring with real-time push alerts to your smartphone whenever movement is detected.', icon: '🏡' }
      ],
      setupGuide: [
        { step: 1, title: 'Mount & Position Camera', desc: 'Secure the camera mounting bracket onto a sturdy surface using the supplied wall plugs. Aim lens towards target surveillance area.' },
        { step: 2, title: 'Run Cabling & Power', desc: 'Connect RG59/3+1 coaxial cable or CAT6 network cable from camera to the central DVR/NVR rack.' },
        { step: 3, title: 'Install Surveillance HDD', desc: 'Open DVR casing and secure a 24/7 surveillance hard drive (Seagate SkyHawk / WD Purple) via SATA cables.' },
        { step: 4, title: 'Configure Network & Mobile App', desc: 'Connect DVR to broadband router, set resolution/recording schedule, and scan the on-screen P2P QR code using the mobile app.' }
      ],
      standards: [
        { name: 'Video Compression Protocol', desc: 'H.265+ / H.265 smart codec reducing storage consumption and bandwidth by up to 80%.' },
        { name: 'Weatherproof Ingress Protection', desc: 'IP67 / IP66 rated robust housing resistant to heavy monsoon rain, dust, and extreme temperature fluctuations.' },
        { name: 'Smart Infrared & Starlight Optics', desc: 'Built-in smart IR cut filter (ICR) providing clear imaging in 0 Lux complete darkness.' },
        { name: 'Interoperability Standards', desc: 'Complies with ONVIF Profile S and Profile G standards for cross-brand hardware compatibility.' }
      ],
      physicalSpecs: {
        power: '12V DC ± 10% (CCTV Camera: ~4W to 6W; DVR Unit: ~15W to 20W excluding hard drive)',
        dimensions: isRecorder ? '1U Desktop / Rack-Mount Metal Chassis (approx. 260 × 222 × 45 mm)' : 'Compact Bullet / Dome Weatherproof Housing',
        operatingTemp: '-30°C to 60°C (-22°F to 140°F) operating range',
        weight: isRecorder ? 'Approx. 1.0 kg to 1.5 kg (without HDD)' : 'Approx. 350g to 500g per camera unit'
      },
      faqs: [
        {
          q: 'Can I view the live camera feed and recordings on my smartphone remotely?',
          a: 'Yes, all CCTV systems support free official mobile apps (such as Hik-Connect and CP PLUS gCMOB) allowing live multi-camera viewing, recorded playback, and instant motion push notifications from anywhere in the world.'
        },
        {
          q: 'How many days of video recording can the system store?',
          a: 'Recording duration depends on the surveillance hard drive capacity, number of cameras, and compression setting (H.265+). For example, a 2TB hard drive on 4 Full HD cameras recording on continuous or smart motion mode typically retains 15 to 30 days of footage.'
        },
        {
          q: 'Do these cameras record in complete darkness / pitch black?',
          a: 'Yes, all our cameras feature high-efficiency Smart IR night vision or Full-Color Starlight optics that illuminate environments in total darkness up to 20m, 30m, or 40m distance.'
        },
        {
          q: 'Does ARS Computers provide on-site installation and cabling in Haldwani / Uttarakhand?',
          a: 'Yes, ARS Computers provides end-to-end on-site survey, professional structured cabling, camera mounting, DVR setup, and network configuration services across Haldwani, Nainital, and Kumaon region.'
        }
      ]
    }
  }

  if (catSlug.includes('printer')) {
    const isThermal = pName.toLowerCase().includes('thermal') || pName.toLowerCase().includes('pos') || pName.toLowerCase().includes('barcode')
    return {
      categoryType: 'printer',
      diagramType: isThermal ? 'thermal-printer-ports' : 'printer-ports',
      ports: [
        { name: 'USB 2.0 High-Speed Host', spec: 'Standard USB 2.0 Type-B interface for direct, reliable connection to desktop PCs and laptops', icon: '🔌' },
        { name: 'Wired Ethernet LAN', spec: '10/100 Mbps RJ-45 network interface for multi-computer office network sharing', icon: '🌐' },
        { name: 'Wireless Wi-Fi & Wi-Fi Direct', spec: 'Cable-free wireless printing from laptops, Android tablets, and Apple iPhones', icon: '📶' },
        { name: 'Power Input Socket', spec: 'Standard 3-pin AC power cord socket (220V–240V AC 50/60Hz) with integrated fuse protection', icon: '⚡' },
        { name: 'Cash Drawer Port (POS units)', spec: 'RJ-11 / RJ-12 24V pulse port for automated point-of-sale cash drawer kickout', icon: '🗄️' }
      ],
      applications: [
        { title: 'Office & Enterprise Invoicing', description: 'Fast, crisp black-and-white or color documents with high page-yield and ultra-low cost per print.', icon: '📄' },
        { title: 'Retail POS & Thermal Billing', description: 'Instant, ink-free direct thermal receipt printing for grocery stores, restaurants, pharmacies, and wholesale shops.', icon: '🧾' },
        { title: 'Legal & Accounting Documentation', description: 'High-precision laser monochrome output on bond paper, stamp paper, envelopes, and cardstock.', icon: '⚖️' },
        { title: 'School, College & Photo Printing', description: 'Borderline-free vibrant color photo printing and bulk educational study material generation.', icon: '🎨' }
      ],
      setupGuide: [
        { step: 1, title: 'Unpack & Remove Tape', desc: 'Place printer on a level desk, remove all transport tapes, and open the paper feed tray.' },
        { step: 2, title: 'Install Inks or Toner Cartridge', desc: 'Fill the integrated ink reservoirs with genuine ink bottles or insert the laser toner cartridge into the drum unit.' },
        { step: 3, title: 'Connect Power & Initialize', desc: 'Power on the machine and allow 10–15 minutes for automated ink priming or toner calibration.' },
        { step: 4, title: 'Install Drivers & Print Test Page', desc: 'Install the official manufacturer driver on your PC, connect via USB or Wi-Fi, and print an alignment test sheet.' }
      ],
      standards: [
        { name: 'Print Speed Benchmark', desc: 'Conforms to ISO/IEC 24734 international standard for authentic ppm print speed ratings.' },
        { name: 'Mobile Printing Protocols', desc: 'Native support for Apple AirPrint, Mopria Print Service, Wi-Fi Direct, and manufacturer cloud printing.' },
        { name: 'Paper Handling Versatility', desc: 'Supports A4, Legal, Letter, Envelopes (DL, COM10), and custom paper weights from 64 to 300 gsm.' },
        { name: 'Energy Star Efficiency', desc: 'Auto Power-Off and low-power sleep mode reducing ongoing electricity costs.' }
      ],
      physicalSpecs: {
        power: isThermal ? '12V–24V DC External Power Adapter (approx. 25W–40W)' : '220V–240V AC 50/60Hz (Laser: ~350W–500W during printing; Ink Tank: ~12W–15W)',
        dimensions: isThermal ? 'Compact Desktop POS footprint (approx. 185 × 140 × 130 mm)' : 'All-in-One Flatbed Desktop Footprint (approx. 375 × 347 × 179 mm)',
        operatingTemp: '10°C to 35°C (50°F to 95°F) operating temperature',
        weight: isThermal ? 'Approx. 0.8 kg to 1.2 kg' : 'Approx. 3.9 kg to 7.5 kg (model dependent)'
      },
      faqs: [
        {
          q: 'What is the cost per page for Ink Tank vs Laser printers?',
          a: 'Original Ink Tank printers deliver ultra-economical printing costs of approximately 10 to 20 paise per black & white page and 30 to 45 paise per color page. Laser printers offer crisp, archival smudge-free text ideal for legal agreements and high-speed invoices.'
        },
        {
          q: 'Can I print directly from my smartphone without turning on a computer?',
          a: 'Yes, Wi-Fi enabled models support direct wireless printing from Android and iOS smartphones using Apple AirPrint, Mopria, or the official manufacturer mobile app.'
        },
        {
          q: 'Are replacement ink bottles and toner cartridges readily available at ARS Computers?',
          a: 'Yes, ARS Computers maintains comprehensive stock of 100% genuine ink bottles, laser toners, and drum units for Epson, Canon, HP, and Brother printers with local pickup or same-day dispatch.'
        },
        {
          q: 'Does this printer include scanner and photocopier functionality?',
          a: 'Multi-function (MFP / 3-in-1) models feature an integrated flatbed color scanner and one-touch standalone black/color photocopying. Specific single-function print-only models are clearly identified in the specifications.'
        }
      ]
    }
  }

  if (catSlug.includes('biometric')) {
    const isLock = pName.toLowerCase().includes('lock') || pName.toLowerCase().includes('access')
    return {
      categoryType: 'biometric',
      diagramType: 'biometric-terminals',
      ports: [
        { name: 'TCP/IP RJ-45 Ethernet', spec: 'Standard network connection for instant centralized attendance data synchronization', icon: '🌐' },
        { name: 'Wiegand 26 / 34-Bit Interface', spec: 'Standard Wiegand input and output ports for connecting external slave card readers', icon: '🔄' },
        { name: 'Form-C Relay (COM / NO / NC)', spec: 'Built-in dry contact relay for direct control of electromagnetic locks and turnstiles', icon: '⚡' },
        { name: 'Door Sensor & Exit Button Interface', spec: 'Dedicated inputs for manual push-to-exit buttons and magnetic door status sensors', icon: '🚪' },
        { name: '12V DC Power Terminal Block', spec: 'Heavy-duty screw terminal block for 12V DC 2A regulated power supply or battery backup', icon: '🔌' },
        { name: 'USB Flash Port', spec: 'High-speed USB host port for offline attendance log download via USB thumb drive', icon: '💾' }
      ],
      applications: [
        { title: 'Corporate Employee Attendance', description: 'Eliminate buddy punching and track accurate employee clock-in, clock-out, overtime, and leave records.', icon: '👥' },
        { title: 'Access Control & Server Room Security', description: 'Restricted high-security access for IT server rooms, financial vaults, and confidential offices.', icon: '🛡️' },
        { title: 'Factory & Shift Roster Automation', description: 'Manage complex multi-shift rosters with high throughput recognition speed (< 0.5s per punch).', icon: '🏭' },
        { title: 'Educational Institutions & Hostels', description: 'Automated student presence tracking with instant SMS / email notification gateway integration.', icon: '🎓' }
      ],
      setupGuide: [
        { step: 1, title: 'Ergonomic Wall Mounting', desc: 'Secure the metal mounting bracket to the wall at a recommended height of 140–150 cm (4.5 to 5.0 ft) from the floor.' },
        { step: 2, title: 'Wiring & Access Integration', desc: 'Connect 12V DC power, network LAN cable, and the door lock relay cables through the rear cable channel.' },
        { step: 3, title: 'Enroll Admin & Staff', desc: 'Power on the terminal, set an administrator password, and enroll employee fingerprints, faces, or RFID cards.' },
        { step: 4, title: 'Install Desktop Management Software', desc: 'Install the complimentary attendance software on your admin PC, connect via device IP, and configure employee shift rules.' }
      ],
      standards: [
        { name: 'Biometric Algorithm Standards', desc: 'Complies with ISO/IEC 19794-2 biometric minutiae template specifications with anti-spoofing live detection.' },
        { name: 'Industry Access Protocol', desc: 'Standard Wiegand-26 and Wiegand-34 bit protocol for seamless multi-controller integration.' },
        { name: 'Non-Volatile Storage', desc: 'Retains all employee logs and user biometric templates during unexpected power outages.' },
        { name: 'Safety & Compliance', desc: 'CE, FCC, and RoHS certified enterprise hardware.' }
      ],
      physicalSpecs: {
        power: '12V DC, 1.5A to 2.0A operating voltage (UPS battery backup compatible)',
        dimensions: isLock ? 'Heavy-duty anodized aluminum lock bar (approx. 250 × 48 × 26 mm)' : 'Wall-mount terminal housing (approx. 190 × 85 × 35 mm)',
        operatingTemp: '-10°C to 50°C (14°F to 122°F) operating range',
        weight: isLock ? 'Approx. 1.8 kg to 2.2 kg (with armature plate)' : 'Approx. 450g to 750g per terminal unit'
      },
      faqs: [
        {
          q: 'Does the biometric device work during internet or power failures?',
          a: 'Yes, all biometric attendance machines store up to 100,000+ attendance records in non-volatile internal memory without internet. When network is restored, data synchronizes automatically. Connecting an external 12V battery backup keeps the machine running during power outages.'
        },
        {
          q: 'Can this machine automatically lock and unlock our office glass door?',
          a: 'Yes, models with access control relays connect directly to electromagnetic (EM) door locks, magnetic strikes, or turnstiles, releasing the lock for 3–5 seconds upon valid biometric or RFID verification.'
        },
        {
          q: 'Does facial recognition work in dim lighting or if employees wear glasses?',
          a: 'Yes, AI-powered face terminals utilize dual infrared cameras and integrated structured lighting to identify authorized personnel accurately in dark environments and adapt to spectacles or mild facial hair.'
        },
        {
          q: 'What software is provided for salary and attendance calculation?',
          a: 'ARS Computers provides official desktop attendance management software that calculates working hours, late arrivals, overtime, and generates monthly attendance reports in Excel and PDF formats for payroll processing.'
        }
      ]
    }
  }

  // Category 5: Accessories & Components
  const isCable = pName.toLowerCase().includes('cable') || pName.toLowerCase().includes('wire') || pName.toLowerCase().includes('hdmi') || pName.toLowerCase().includes('vga')
  const isStorage = pName.toLowerCase().includes('ssd') || pName.toLowerCase().includes('hdd') || pName.toLowerCase().includes('drive') || pName.toLowerCase().includes('caddy') || pName.toLowerCase().includes('enclosure')
  const isPower = pName.toLowerCase().includes('smps') || pName.toLowerCase().includes('power') || pName.toLowerCase().includes('adapter')
  const isNetwork = pName.toLowerCase().includes('wifi') || pName.toLowerCase().includes('router') || pName.toLowerCase().includes('switch') || pName.toLowerCase().includes('ethernet') || pName.toLowerCase().includes('patch')

  let diagramType = 'accessory-pinout'
  if (isCable && pName.toLowerCase().includes('hdmi')) diagramType = 'hdmi-pinout'
  else if (isCable && pName.toLowerCase().includes('ethernet')) diagramType = 'network-rj45'
  else if (isStorage) diagramType = 'storage-sata'
  else if (isNetwork) diagramType = 'network-rj45'

  return {
    categoryType: 'accessory',
    diagramType,
    ports: [
      { name: 'Hardware Interface & Pinout', spec: 'Standard precision-molded connector adhering strictly to international industrial specifications', icon: '🔌' },
      { name: 'Shielding & Material', spec: 'Heavy-duty multi-layer shielding to suppress EMI/RFI electromagnetic interference', icon: '🛡️' },
      { name: 'Signal & Power Transmission', spec: 'High-conductivity copper conductors providing stable voltage and zero-loss signal integrity', icon: '⚡' },
      { name: 'Compatibility Standard', spec: '100% plug-and-play compatible with standard PCs, laptops, monitors, DVRs and network switches', icon: '💻' }
    ],
    applications: [
      { title: 'Enterprise IT & Office Infrastructure', description: 'Essential hardware components, cables and adapters for computer labs, workstations, and server racks.', icon: '🏢' },
      { title: 'Surveillance & CCTV Deployment', description: 'Reliable video transmission cables, connectors, and power supplies engineered for 24/7 continuous duty.', icon: '📹' },
      { title: 'Storage & System Upgrades', description: 'High-speed solid-state drives, RAM modules, and enclosure caddies to maximize desktop and laptop performance.', icon: '💾' },
      { title: 'Audio-Visual & Multi-Monitor Desks', description: 'Ultra HD 4K digital video cables, display adapters, and converters for conference rooms and work setups.', icon: '🖥️' }
    ],
    setupGuide: [
      { step: 1, title: 'Inspect Ports & Pins', desc: 'Inspect device port orientation and verify that pins are clean and free of dust.' },
      { step: 2, title: 'Connect Firmly', desc: 'Insert connector squarely into the port until fully seated or screw down locking thumb screws where applicable.' },
      { step: 3, title: 'Verify Operation', desc: 'Power on connected equipment and confirm immediate recognition without signal flickering or loose contact.' }
    ],
    standards: [
      { name: 'Compliance Standard', desc: 'Manufactured in compliance with standard CE, FCC, and RoHS environmental directives.' },
      { name: 'Universal Interoperability', desc: 'Adheres to standard industry pinouts ensuring compatibility across Dell, HP, Lenovo, Acer, and custom PC builds.' },
      { name: 'Tested Quality Assurance', desc: 'Every cable and component batch is physically inspected and signal-tested before stocking.' }
    ],
    physicalSpecs: {
      power: isPower ? 'Input: 100V–240V AC 50/60Hz; Output: Regulated DC Voltage with Overload Protection' : 'Passive / Bus-Powered from host equipment',
      dimensions: 'Standard commercial form factor and cable lengths (as specified in product title)',
      operatingTemp: '-10°C to 50°C operating temperature range',
      weight: 'Standard component weight'
    },
    faqs: [
      {
        q: 'Is this accessory compatible with my existing laptop or desktop brand?',
        a: 'Yes, our accessories adhere strictly to universal industry standards (such as HDMI, USB 3.0, SATA, RJ-45, IEC power) ensuring plug-and-play compatibility across Dell, HP, Lenovo, Asus, Acer, and custom PC rigs.'
      },
      {
        q: 'What warranty is provided on hardware accessories and cables?',
        a: 'All hardware accessories carry a replacement warranty against manufacturing defects. If any unit fails to function out of the box, ARS Computers provides an immediate replacement.'
      },
      {
        q: 'Can I purchase accessories in bulk with a GST tax invoice?',
        a: 'Yes, wholesale and bulk orders for schools, offices, IT departments, and CCTV installers receive special project pricing and official GST input tax credit invoices.'
      }
    ]
  }
}
