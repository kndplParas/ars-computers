/**
 * ARS Computers — Computer & Laptop product content.
 *
 * Series-level catalogue entries are deliberately honest: the exact model,
 * processor, memory, storage and display configuration is confirmed by ARS
 * Computers sales before supply. No unverified configuration is presented as
 * a fixed specification.
 */

export const COMPUTER_CONTENT = {
  'dell-latitude-business-laptop': {
    description:
      'The Dell Latitude series is Dell\'s commercial business laptop family, built for office, field and administrative work. This listing covers the Latitude models stocked by ARS Computers; the exact processor, memory, storage and display configuration is confirmed against current stock before supply. Latitude systems are designed for daily business use, with a durable chassis, precision touchpad, anti-glare display options and Dell commercial manageability features.',
    keyFeatures: [
      'Dell Latitude commercial business laptop family',
      'Durable chassis intended for daily office and field use',
      'Intel Core processor platform (exact generation confirmed per model)',
      'Solid-state storage for fast boot and application loading',
      'Anti-glare business display options',
      'Dell commercial security and manageability features'
    ],
    specs: {
      form_factor: 'Business laptop (clamshell)',
      processor: 'Intel Core i5 class — exact model confirmed with sales',
      processor_generation: 'Configuration-dependent — confirm with sales',
      ram: '16 GB — exact configuration confirmed with sales',
      ram_type: 'Configuration-dependent — confirm with sales',
      storage: '512 GB SSD — exact configuration confirmed with sales',
      storage_type: 'SSD (interface confirmed per model)',
      display: 'Configuration-dependent — confirm screen size with sales',
      resolution: 'Configuration-dependent — confirm with sales',
      panel_type: 'Anti-glare business panel (model-dependent)',
      keyboard: 'Dell business keyboard with precision touchpad',
      camera: 'Integrated webcam (model-dependent)',
      os: 'Configuration-dependent — Windows options confirmed at order',
      ports: 'USB, HDMI and audio ports — exact set confirmed per model',
      networking: 'Wi-Fi and wired Ethernet options depend on model',
      weight: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Runs standard Windows business software, Microsoft 365, accounting packages and browser-based ERP/CRM systems. Confirm dock, monitor and peripheral compatibility for the exact model with ARS Computers sales.',
    boxContents:
      'Laptop unit, power adapter and power cable, and documentation. The exact accessory bundle is confirmed at the time of order.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Dell Latitude commercial series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.'
  },

  'lenovo-commercial-office-laptop': {
    description:
      'Lenovo commercial laptops are designed around long typing sessions, reliable everyday performance and straightforward IT management. This series listing covers the Lenovo business models available through ARS Computers. The ergonomic island keyboard, TrackPoint option, matte anti-glare display and robust hinge assembly make the range suitable for offices, back-offices and mobile administrative work. Exact configuration is confirmed per unit.',
    keyFeatures: [
      'Lenovo commercial business laptop family',
      'Ergonomic island keyboard with TrackPoint option',
      'Matte anti-glare display for reduced reflections',
      'Reinforced hinge and chassis design for daily use',
      'Business connectivity and security options',
      'Configuration confirmed against current stock'
    ],
    specs: {
      form_factor: 'Business laptop (clamshell)',
      processor: 'Configuration-dependent — confirm with sales',
      processor_generation: 'Configuration-dependent — confirm with sales',
      ram: 'Configuration-dependent — confirm with sales',
      storage: 'Configuration-dependent — confirm with sales',
      storage_type: 'SSD/HDD options depending on model',
      display: 'Configuration-dependent — confirm screen size with sales',
      resolution: 'Configuration-dependent — confirm with sales',
      panel_type: 'Matte anti-glare panel (model-dependent)',
      keyboard: 'Lenovo island keyboard with TrackPoint option',
      camera: 'Integrated webcam (model-dependent)',
      os: 'Configuration-dependent — Windows options confirmed at order',
      ports: 'USB, video and audio ports — exact set confirmed per model',
      networking: 'Wi-Fi and Ethernet options depend on model'
    },
    compatibility:
      'Suitable for Microsoft 365, Tally and other accounting software, browser-based business applications and standard office peripherals. Confirm the exact model and docking requirements with ARS Computers sales.',
    boxContents:
      'Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Lenovo commercial series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.'
  },

  'hp-elitebook-corporate-laptop': {
    description:
      'The HP EliteBook range is HP\'s premium corporate laptop family, aimed at executives, managers and professionals who need a durable, security-focused notebook. This listing represents the EliteBook models supplied by ARS Computers. The aluminium chassis, business-class keyboard and multi-port connectivity are designed for office docking, travel and collaborative work. The exact model and internal configuration are confirmed before dispatch.',
    keyFeatures: [
      'HP EliteBook premium corporate laptop family',
      'Precision aluminium chassis for business durability',
      'Business-class keyboard and precision touchpad',
      'Multi-port connectivity for docks and peripherals',
      'HP commercial security and manageability features',
      'Exact model and configuration confirmed per unit'
    ],
    specs: {
      form_factor: 'Premium corporate laptop (clamshell)',
      processor: 'Configuration-dependent — confirm with sales',
      processor_generation: 'Configuration-dependent — confirm with sales',
      ram: 'Configuration-dependent — confirm with sales',
      storage: 'Configuration-dependent — confirm with sales',
      storage_type: 'SSD (model-dependent)',
      display: 'Configuration-dependent — confirm screen size with sales',
      resolution: 'Configuration-dependent — confirm with sales',
      panel_type: 'Anti-glare or touch panel depending on model',
      keyboard: 'HP business keyboard with precision touchpad',
      camera: 'Integrated webcam (model-dependent)',
      os: 'Configuration-dependent — Windows options confirmed at order',
      ports: 'USB-C, USB-A, HDMI and audio ports — exact set confirmed per model',
      networking: 'Wi-Fi and Ethernet options depend on model',
      weight: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Designed for corporate productivity suites, video conferencing, docking stations and managed IT environments. Confirm the exact model, dock and security requirements with ARS Computers sales.',
    boxContents:
      'Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.',
    specsVerified: 'configuration_dependent',
    specSource:
      'HP EliteBook commercial series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.'
  },

  'asus-tuf-gaming-laptop': {
    description:
      'The ASUS TUF Gaming series is built for gaming, content creation and graphics-heavy coursework. This listing covers the TUF models supplied by ARS Computers. TUF systems use a reinforced chassis, dual cooling fans and dedicated NVIDIA GeForce graphics in supported configurations. The high-refresh display option improves motion clarity in games and fast-paced editing. Exact GPU, processor, memory and display configuration are confirmed per unit.',
    keyFeatures: [
      'ASUS TUF Gaming performance laptop family',
      'Dedicated NVIDIA GeForce graphics in supported configurations',
      'Dual-fan cooling with reinforced chassis',
      'High refresh-rate display options',
      'Suitable for gaming, 3D rendering and content creation',
      'Exact configuration confirmed against current stock'
    ],
    specs: {
      form_factor: 'Gaming laptop (clamshell)',
      processor: 'Configuration-dependent — confirm with sales',
      processor_generation: 'Configuration-dependent — confirm with sales',
      ram: 'Configuration-dependent — confirm with sales',
      storage: 'Configuration-dependent — confirm with sales',
      storage_type: 'SSD (model-dependent)',
      gpu: 'Dedicated NVIDIA GeForce GPU — exact model confirmed with sales',
      display: 'Configuration-dependent — confirm screen size with sales',
      resolution: 'Configuration-dependent — confirm with sales',
      panel_type: 'High refresh-rate panel on supported models',
      keyboard: 'Backlit gaming keyboard (model-dependent)',
      audio: 'Dual-speaker audio (model-dependent)',
      os: 'Configuration-dependent — Windows options confirmed at order',
      ports: 'USB, HDMI and audio ports — exact set confirmed per model',
      networking: 'Wi-Fi and Ethernet options depend on model',
      cooling: 'Dual-fan thermal design',
      weight: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Suitable for gaming, AutoCAD, Blender, Adobe creative software and general productivity. Confirm the exact GPU, power supply and display requirements for your software with ARS Computers sales.',
    boxContents:
      'Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.',
    specsVerified: 'configuration_dependent',
    specSource:
      'ASUS TUF Gaming series listing. Exact model number, GPU configuration and warranty terms are confirmed by ARS Computers at the time of sale.'
  },

  'dell-inspiron-business-laptop': {
    description:
      'The Dell Inspiron series is a practical everyday laptop family for business multitasking, students and home-office work. This listing covers the Inspiron models stocked by ARS Computers. Narrow-bezel FHD display options, a lift hinge for a comfortable typing angle and a full-size keyboard make the range easy to use for long sessions. Exact processor, memory, storage and display configuration are confirmed per unit.',
    keyFeatures: [
      'Dell Inspiron everyday business laptop',
      'Narrow-border FHD display options',
      'Ergonomic lift hinge for a comfortable typing angle',
      'Full-size island keyboard',
      'Suitable for office, student and home-office workloads',
      'Exact configuration confirmed against current stock'
    ],
    specs: {
      form_factor: 'Everyday laptop (clamshell)',
      processor: 'Configuration-dependent — confirm with sales',
      processor_generation: 'Configuration-dependent — confirm with sales',
      ram: 'Configuration-dependent — confirm with sales',
      storage: 'Configuration-dependent — confirm with sales',
      storage_type: 'SSD/HDD options depending on model',
      display: 'FHD display options — exact size confirmed with sales',
      resolution: 'Full HD on supported models',
      panel_type: 'Anti-glare panel (model-dependent)',
      keyboard: 'Full-size island keyboard',
      camera: 'Integrated webcam (model-dependent)',
      os: 'Configuration-dependent — Windows options confirmed at order',
      ports: 'USB, HDMI and audio ports — exact set confirmed per model',
      networking: 'Wi-Fi and Ethernet options depend on model'
    },
    compatibility:
      'Suitable for Microsoft 365, browsing, accounting, online classes and general office work. Confirm the exact model and peripheral requirements with ARS Computers sales.',
    boxContents:
      'Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Dell Inspiron series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.'
  },

  'hp-probook-commercial-laptop': {
    description:
      'HP ProBook laptops are commercial notebooks built for growing businesses that need dependable performance, serviceability and security without premium-tier pricing. This listing covers the ProBook models supplied by ARS Computers. Reinforced hinges, a spill-resistant keyboard option and versatile expansion ports suit continuous office workloads. Exact model, processor and configuration are confirmed per unit.',
    keyFeatures: [
      'HP ProBook commercial laptop family',
      'Reinforced hinges and business-grade chassis',
      'Spill-resistant keyboard option',
      'Versatile expansion ports for office peripherals',
      'Business security and manageability options',
      'Exact model and configuration confirmed per unit'
    ],
    specs: {
      form_factor: 'Commercial laptop (clamshell)',
      processor: 'Configuration-dependent — confirm with sales',
      processor_generation: 'Configuration-dependent — confirm with sales',
      ram: 'Configuration-dependent — confirm with sales',
      storage: 'Configuration-dependent — confirm with sales',
      storage_type: 'SSD/HDD options depending on model',
      display: 'Configuration-dependent — confirm screen size with sales',
      resolution: 'Configuration-dependent — confirm with sales',
      panel_type: 'Anti-glare business panel (model-dependent)',
      keyboard: 'HP business keyboard with spill-resistant option',
      camera: 'Integrated webcam (model-dependent)',
      os: 'Configuration-dependent — Windows options confirmed at order',
      ports: 'USB, video and audio ports — exact set confirmed per model',
      networking: 'Wi-Fi and Ethernet options depend on model'
    },
    compatibility:
      'Designed for office productivity, accounting, CRM/ERP access and standard business peripherals. Confirm the exact model and docking requirements with ARS Computers sales.',
    boxContents:
      'Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.',
    specsVerified: 'configuration_dependent',
    specSource:
      'HP ProBook commercial series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.'
  },

  'acer-performance-laptop': {
    description:
      'The Acer performance laptop range is intended for users who need more headroom than a basic office notebook, including design software, data-heavy spreadsheets and multi-application workflows. This listing covers the Acer models supplied by ARS Computers, with enhanced thermal exhaust and multi-core processing options. Exact processor, graphics, memory and display configuration are confirmed per unit.',
    keyFeatures: [
      'Acer performance notebook family',
      'Multi-core processing options for demanding workloads',
      'Enhanced thermal dissipation and exhaust venting',
      'Suitable for design, analysis and multitasking',
      'Full-size keyboard and business connectivity',
      'Exact configuration confirmed against current stock'
    ],
    specs: {
      form_factor: 'Performance laptop (clamshell)',
      processor: 'Configuration-dependent — confirm with sales',
      processor_generation: 'Configuration-dependent — confirm with sales',
      ram: 'Configuration-dependent — confirm with sales',
      storage: 'Configuration-dependent — confirm with sales',
      storage_type: 'SSD (model-dependent)',
      gpu: 'Integrated or dedicated graphics depending on model',
      display: 'Configuration-dependent — confirm screen size with sales',
      resolution: 'Configuration-dependent — confirm with sales',
      panel_type: 'Anti-glare panel (model-dependent)',
      keyboard: 'Full-size laptop keyboard',
      camera: 'Integrated webcam (model-dependent)',
      os: 'Configuration-dependent — Windows options confirmed at order',
      ports: 'USB, HDMI and audio ports — exact set confirmed per model',
      networking: 'Wi-Fi and Ethernet options depend on model',
      cooling: 'Enhanced thermal exhaust design'
    },
    compatibility:
      'Suitable for office suites, design tools, data analysis and general multitasking. Confirm the exact software and graphics requirements with ARS Computers sales.',
    boxContents:
      'Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Acer performance series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.'
  },

  'ultra-slim-metallic-notebook': {
    description:
      'This ultra-slim metallic notebook is a lightweight, travel-focused laptop configured for consultants, sales teams and mobile professionals. The aluminium-style unibody and thin-bezel display keep the footprint small, while the full-size keyboard and everyday connectivity cover web conferencing, email, documents and browser-based business applications. Because this is a multi-brand solution listing, the exact model and internal configuration are confirmed with sales.',
    keyFeatures: [
      'Lightweight aluminium-style unibody design',
      'Thin-bezel display for a compact footprint',
      'Built for travel, field work and web conferencing',
      'Everyday business connectivity',
      'Full-size keyboard for comfortable typing',
      'Exact model and configuration confirmed with sales'
    ],
    specs: {
      form_factor: 'Ultra-slim notebook',
      processor: 'Configuration-dependent — confirm with sales',
      ram: 'Configuration-dependent — confirm with sales',
      storage: 'Configuration-dependent — confirm with sales',
      storage_type: 'SSD (model-dependent)',
      display: 'Thin-bezel display — exact size confirmed with sales',
      resolution: 'Configuration-dependent — confirm with sales',
      keyboard: 'Full-size notebook keyboard',
      camera: 'Integrated webcam for video calls',
      os: 'Configuration-dependent — Windows options confirmed at order',
      ports: 'USB and video ports — exact set confirmed per model',
      networking: 'Wi-Fi and Bluetooth options depend on model',
      weight: 'Lightweight configuration — confirm exact weight with sales'
    },
    compatibility:
      'Suitable for Microsoft 365, email, video conferencing and browser-based business tools. Confirm the exact model, ports and travel accessories with ARS Computers sales.',
    boxContents:
      'Notebook unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand ultra-slim notebook solution listing. Exact model and configuration are confirmed by ARS Computers at the time of sale.'
  },

  'hp-pavilion-silver-slim-laptop': {
    description:
      'The HP Pavilion slim laptop is a versatile silver-finished notebook for home-office, accounting and general commercial computing. This listing covers the Pavilion models supplied by ARS Computers. A full-size island keyboard with numeric keypad, micro-edge anti-glare display and integrated webcam make it practical for spreadsheets, billing and video calls. Exact processor, memory, storage and display configuration are confirmed per unit.',
    keyFeatures: [
      'HP Pavilion slim laptop in a silver finish',
      'Full-size island keyboard with numeric keypad',
      'Micro-edge anti-glare display options',
      'Integrated webcam and microphone',
      'Suitable for accounting, billing and home-office work',
      'Exact configuration confirmed against current stock'
    ],
    specs: {
      form_factor: 'Slim laptop (clamshell)',
      processor: 'Configuration-dependent — confirm with sales',
      processor_generation: 'Configuration-dependent — confirm with sales',
      ram: 'Configuration-dependent — confirm with sales',
      storage: 'Configuration-dependent — confirm with sales',
      storage_type: 'SSD/HDD options depending on model',
      display: 'Micro-edge display — exact size confirmed with sales',
      resolution: 'Configuration-dependent — confirm with sales',
      panel_type: 'Anti-glare panel (model-dependent)',
      keyboard: 'Full-size island keyboard with numeric keypad',
      camera: 'Integrated webcam and microphone',
      os: 'Configuration-dependent — Windows options confirmed at order',
      ports: 'USB, HDMI and audio ports — exact set confirmed per model',
      networking: 'Wi-Fi and Ethernet options depend on model'
    },
    compatibility:
      'Suitable for Microsoft 365, Tally and accounting packages, billing software and everyday browsing. Confirm the exact model and peripheral requirements with ARS Computers sales.',
    boxContents:
      'Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.',
    specsVerified: 'configuration_dependent',
    specSource:
      'HP Pavilion series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.'
  },

  'custom-gaming-studio-workstation-setup': {
    description:
      'This custom gaming and studio workstation is assembled by ARS Computers as a complete desk setup rather than a single boxed product. It combines a curved gaming display, an RGB desktop tower and backlit peripherals for gaming, streaming, video editing and creative production. Every build is configured to the customer\'s budget and software needs, so the processor, graphics card, memory and storage are specified in the final quotation.',
    keyFeatures: [
      'Complete desk setup with curved gaming display',
      'Custom-assembled RGB desktop tower',
      'Backlit keyboard and precision optical mouse',
      'Configured for gaming, streaming and media production',
      'Assembly and component compatibility checked by ARS Computers',
      'Final specification agreed before build'
    ],
    specs: {
      form_factor: 'Custom desktop workstation and monitor bundle',
      processor: 'Configuration-dependent — agreed before build',
      ram: 'Configuration-dependent — agreed before build',
      storage: 'Configuration-dependent — agreed before build',
      gpu: 'Configuration-dependent — agreed before build',
      display: 'Curved gaming display — size and resolution confirmed with sales',
      resolution: 'Configuration-dependent — confirm with sales',
      cooling: 'Air or liquid cooling depending on build',
      peripherals: 'Backlit keyboard and optical mouse included',
      expansion: 'Configuration-dependent — confirm motherboard and case',
      power_supply: 'Configuration-dependent — sized for selected components',
      os: 'Configuration-dependent — Windows options confirmed at order'
    },
    compatibility:
      'Configured for the customer\'s chosen games, streaming software and creative applications. Confirm monitor inputs, desk space and software requirements with ARS Computers sales before the build is finalised.',
    boxContents:
      'Desktop tower, curved monitor, keyboard, mouse, power cables and display cable. Exact bundle confirmed on the quotation.',
    specsVerified: 'configuration_dependent',
    specSource:
      'ARS Computers custom build. Final component list, performance figures and warranty are confirmed in the quotation.'
  },

  'custom-liquid-cooled-gaming-rig': {
    description:
      'The custom liquid-cooled gaming rig is a hand-assembled desktop for high-end gaming, 3D rendering and content production. It uses a dual-chamber tempered-glass chassis, a closed-loop liquid CPU cooler and synchronised ARGB airflow fans. Because each rig is built to order, the processor, graphics card, memory, storage and power supply are selected for the customer\'s workload and confirmed in the final quotation.',
    keyFeatures: [
      'Dual-chamber tempered-glass chassis',
      'Closed-loop liquid CPU cooling',
      'Synchronised ARGB airflow fans',
      'Built for high-end gaming and content production',
      'Custom component selection to budget',
      'Assembly and thermal testing by ARS Computers'
    ],
    specs: {
      form_factor: 'Custom liquid-cooled desktop tower',
      processor: 'Configuration-dependent — agreed before build',
      ram: 'Configuration-dependent — agreed before build',
      storage: 'Configuration-dependent — agreed before build',
      gpu: 'Configuration-dependent — agreed before build',
      cooling: 'Closed-loop liquid CPU cooler with ARGB case fans',
      expansion: 'Configuration-dependent — confirm motherboard and case',
      power_supply: 'Configuration-dependent — sized for selected components',
      lighting: 'Synchronised ARGB lighting',
      os: 'Configuration-dependent — Windows options confirmed at order'
    },
    compatibility:
      'Configured for the customer\'s chosen games, rendering engines and creative software. Confirm graphics card length, radiator clearance and PSU requirements with ARS Computers sales before the build is finalised.',
    boxContents:
      'Desktop tower, power cable and documentation. Monitor and peripherals are included only if specified on the quotation.',
    specsVerified: 'configuration_dependent',
    specSource:
      'ARS Computers custom build. Final component list, performance figures and warranty are confirmed in the quotation.'
  },

  'commercial-slim-all-in-one-pc': {
    description:
      'This commercial slim all-in-one desktop integrates the processor, motherboard, speakers and display into a single space-saving chassis with an ergonomic metallic arc stand. It is intended for reception desks, executive cabins, billing counters and meeting areas where cable clutter and desk space matter. The 24-inch anti-glare screen and integrated components are confirmed against the selected model, since this is a multi-brand solution listing.',
    keyFeatures: [
      'Integrated all-in-one desktop design',
      '24-inch anti-glare display on the listed configuration',
      'Ergonomic metallic arc stand',
      'Space-saving footprint for reception and executive desks',
      'Integrated speakers and webcam options',
      'Exact model and configuration confirmed with sales'
    ],
    specs: {
      form_factor: 'All-in-One desktop',
      processor: 'Configuration-dependent — confirm with sales',
      ram: 'Configuration-dependent — confirm with sales',
      storage: 'Configuration-dependent — confirm with sales',
      storage_type: 'SSD/HDD options depending on model',
      display: '24-inch class anti-glare display',
      resolution: 'Configuration-dependent — confirm with sales',
      panel_type: 'Anti-glare panel',
      camera: 'Integrated webcam on supported models',
      audio: 'Integrated stereo speakers',
      os: 'Configuration-dependent — Windows options confirmed at order',
      ports: 'USB, HDMI and audio ports — exact set confirmed per model',
      networking: 'Wi-Fi and Ethernet options depend on model',
      peripherals: 'Keyboard and mouse bundle confirmed at order'
    },
    compatibility:
      'Suitable for reception, billing, office productivity and customer-facing counters. Confirm the exact model, VESA/wall-mount requirements and peripheral bundle with ARS Computers sales.',
    boxContents:
      'All-in-One unit, stand, power adapter and power cable, and documentation. Keyboard and mouse included only if specified on the quotation.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand all-in-one solution listing. Exact model, panel specification and configuration are confirmed by ARS Computers at the time of sale.'
  },

  'enterprise-matte-all-in-one-pc': {
    description:
      'The enterprise matte all-in-one is a commercial desktop for high-uptime office workstations, billing desks and administrative counters. The matte, wide-viewing-angle display reduces reflections in brightly lit offices, while integrated stereo speakers and a single-chassis design keep the desk free of separate tower and speaker clutter. This is a multi-brand solution listing, so the exact model and internal configuration are confirmed with sales.',
    keyFeatures: [
      'Matte, wide-viewing-angle commercial display',
      'Integrated stereo speakers',
      'Single-chassis design reduces cable clutter',
      'Built for billing desks and administrative counters',
      'Space-saving all-in-one form factor',
      'Exact model and configuration confirmed with sales'
    ],
    specs: {
      form_factor: 'All-in-One commercial desktop',
      processor: 'Configuration-dependent — confirm with sales',
      ram: 'Configuration-dependent — confirm with sales',
      storage: 'Configuration-dependent — confirm with sales',
      storage_type: 'SSD/HDD options depending on model',
      display: 'Matte commercial display — size confirmed with sales',
      resolution: 'Configuration-dependent — confirm with sales',
      panel_type: 'Matte wide-viewing-angle panel',
      audio: 'Integrated stereo speakers',
      os: 'Configuration-dependent — Windows options confirmed at order',
      ports: 'USB, video and audio ports — exact set confirmed per model',
      networking: 'Wi-Fi and Ethernet options depend on model',
      peripherals: 'Keyboard and mouse bundle confirmed at order'
    },
    compatibility:
      'Suitable for billing, data entry, office productivity and customer-facing counters. Confirm the exact model, display size and peripheral bundle with ARS Computers sales.',
    boxContents:
      'All-in-One unit, stand, power adapter and power cable, and documentation. Keyboard and mouse included only if specified on the quotation.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand all-in-one solution listing. Exact model, panel specification and configuration are confirmed by ARS Computers at the time of sale.'
  }
}
