/**
 * ARS Computers — Printer product content.
 *
 * Printer families often contain several models with different speeds, paper
 * capacities and connectivity. Values that depend on the exact model are
 * labelled accordingly rather than copied from a similar printer.
 */

export const PRINTER_CONTENT = {
  'barcode-thermal-receipt-printers': {
    description:
      'Thermal receipt and barcode label printers are used at retail billing counters, cafés, warehouses and inventory stations. Direct-thermal printing needs no ink or toner, relying on treated receipt or label paper instead. This solution listing covers POS receipt printers and barcode label printers supplied by ARS Computers. The paper width, print speed, connectivity and driver support depend on the selected model and are confirmed before supply.',
    keyFeatures: [
      'Direct-thermal POS receipt and barcode label printing',
      'No ink or toner required',
      'High-speed printing for billing counters',
      'USB connectivity with network options on supported models',
      'Compact counter-friendly footprint',
      'Exact model, paper width and interface confirmed with sales'
    ],
    specs: {
      printer_type: 'POS receipt and barcode label printer',
      model_number: 'Thermal POS series — exact model confirmed with sales',
      technology: 'Direct thermal (no ink or toner)',
      print_resolution: 'Configuration-dependent — confirm with sales',
      print_speed: 'High-speed POS class — exact rating confirmed with sales',
      paper_size: '58 mm/80 mm receipt rolls and label stock — confirm model',
      input_capacity: 'Roll-fed — maximum roll diameter confirmed per model',
      functions: 'Receipt and barcode label printing',
      connectivity: 'USB; Ethernet/Bluetooth options depending on model',
      os_support: 'Windows drivers; Android/Linux support confirmed per model',
      cartridge: 'No cartridge — direct thermal media only',
      power: 'External DC power adapter'
    },
    compatibility:
      'Must be matched to the billing software, paper width and label stock in use. Confirm driver support for the selected POS or ERP application and whether Ethernet or Bluetooth is required with ARS Computers sales.',
    boxContents:
      'Printer unit, power adapter, USB cable where supplied, paper roll spindle/guide and documentation. Paper rolls are supplied separately unless included on the quotation.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand thermal POS solution listing. Exact model, print width, speed and interface are confirmed by ARS Computers at the time of sale.'
  },

  'epson-ecotank-ink-tank-printer': {
    description:
      'Epson EcoTank printers are refillable ink-tank multifunction devices intended for low-cost, high-volume home and office printing. Instead of small cartridges, the printer uses front-facing reservoirs that are topped up from ink bottles. This listing covers the EcoTank models supplied by ARS Computers, with print, scan and copy functions and Wi-Fi options. Exact model, print speed, paper capacity and display size are confirmed against the selected unit.',
    keyFeatures: [
      'Epson EcoTank refillable ink-tank system',
      'Print, scan and copy functions',
      'Front-facing spill-resistant ink reservoirs',
      'Low cost per page for high-volume printing',
      'Wi-Fi and Wi-Fi Direct options',
      'Exact model and configuration confirmed with sales'
    ],
    specs: {
      printer_type: 'Ink tank multifunction printer',
      model_number: 'Epson EcoTank series — exact model confirmed with sales',
      technology: 'Micro Piezo inkjet',
      print_resolution: 'Configuration-dependent — confirm with sales',
      print_speed: 'Configuration-dependent — confirm with sales',
      functions: 'Print, scan, copy',
      scanner: 'Flatbed colour scanner',
      copier: 'Colour and monochrome copying',
      paper_size: 'A4, A5 and photo sizes on supported models',
      input_capacity: 'Configuration-dependent — confirm with sales',
      duplex: 'Automatic duplex on supported models',
      connectivity: 'Wi-Fi, Wi-Fi Direct and USB; Ethernet on selected models',
      mobile_printing: 'Epson Smart Panel and Wi-Fi Direct on supported models',
      ink: 'Refillable EcoTank ink reservoirs',
      os_support: 'Windows, macOS and mobile printing — confirm per model'
    },
    compatibility:
      'Works with Epson ink bottles and standard office paper. Confirm the exact model, ink bottle codes, duplex support and network requirements with ARS Computers sales before ordering consumables.',
    boxContents:
      'Printer unit, power cable, setup ink bottles, and documentation. USB cable and additional paper are supplied only where included by the selected model.',
    specsVerified: 'partially_verified',
    specSource:
      'Epson EcoTank series listing. Refillable tank and multifunction features are series-level; exact model, speeds, capacities and connectivity are confirmed by ARS Computers.'
  },

  'canon-pixma-ink-tank-printer': {
    description:
      'Canon PIXMA G-series ink-tank printers are multifunction devices for homes, small offices and document-heavy desks. Transparent reservoirs make ink levels easy to check, and the refillable system reduces the cost of everyday colour printing. Photo printing and borderless output are supported on many models. This listing covers the PIXMA G-series units supplied by ARS Computers; exact model, print resolution, paper handling and connectivity are confirmed with sales.',
    keyFeatures: [
      'Canon PIXMA G-series refillable ink tanks',
      'Print, scan and copy functions',
      'Transparent ink reservoirs for easy level checks',
      'Borderless photo printing on supported models',
      'Low-cost refillable ink system',
      'Exact model and configuration confirmed with sales'
    ],
    specs: {
      printer_type: 'Ink tank multifunction printer',
      model_number: 'Canon PIXMA G-series — exact model confirmed with sales',
      technology: 'Inkjet',
      print_resolution: 'Configuration-dependent — confirm with sales',
      print_speed: 'Configuration-dependent — confirm with sales',
      functions: 'Print, scan, copy',
      scanner: 'Flatbed colour scanner',
      copier: 'Colour and monochrome copying',
      paper_size: 'A4, photo and envelope sizes on supported models',
      input_capacity: 'Configuration-dependent — confirm with sales',
      duplex: 'Automatic duplex on supported models',
      connectivity: 'Wi-Fi and USB; Ethernet on selected models',
      mobile_printing: 'Canon PRINT app and wireless printing on supported models',
      ink: 'Refillable transparent ink reservoirs',
      os_support: 'Windows, macOS and mobile printing — confirm per model'
    },
    compatibility:
      'Uses Canon ink bottles and standard inkjet paper. Confirm the exact model, ink codes, borderless photo support and network requirements with ARS Computers sales.',
    boxContents:
      'Printer unit, power cable, setup ink bottles and documentation. USB cable and photo paper are supplied only where included by the selected model.',
    specsVerified: 'partially_verified',
    specSource:
      'Canon PIXMA G-series listing. Refillable tank and multifunction features are series-level; exact model, speeds, capacities and connectivity are confirmed by ARS Computers.'
  },

  'canon-imageclass-mono-laser-printer': {
    description:
      'The Canon imageCLASS monochrome laser printer is a business-class black-and-white printer for offices, billing desks and document-heavy departments. Laser printing produces sharp text on plain paper, and quick first-print technology reduces waiting time. This listing covers the imageCLASS models supplied by ARS Computers. Exact model, print speed, duplex support, toner code and connectivity are confirmed against the selected unit.',
    keyFeatures: [
      'Canon imageCLASS monochrome laser printer',
      'Sharp black-and-white text output',
      'Quick first-print warm-up on supported models',
      'Business-duty paper handling',
      'USB and network options depending on model',
      'Exact model and toner code confirmed with sales'
    ],
    specs: {
      printer_type: 'Monochrome laser printer',
      model_number: 'Canon imageCLASS series — exact model confirmed with sales',
      technology: 'Monochrome laser',
      print_resolution: 'Configuration-dependent — confirm with sales',
      print_speed: 'Configuration-dependent — confirm with sales',
      duty_cycle: 'Configuration-dependent — confirm with sales',
      duplex: 'Automatic duplex on supported models',
      paper_size: 'A4, A5, Letter and legal sizes on supported models',
      input_capacity: 'Configuration-dependent — confirm with sales',
      functions: 'Print only (MFP variants available separately)',
      connectivity: 'USB; Ethernet/Wi-Fi depending on model',
      toner: 'Canon monochrome toner cartridge — code confirmed per model',
      os_support: 'Windows, macOS and Linux drivers on supported models'
    },
    compatibility:
      'Uses Canon toner cartridges specified for the exact model. Confirm the model, toner code, duplex requirement and network connection with ARS Computers sales before ordering consumables.',
    boxContents:
      'Printer unit, starter toner cartridge, power cable and documentation. USB cable supplied only where included by the selected model.',
    specsVerified: 'partially_verified',
    specSource:
      'Canon imageCLASS series listing. Monochrome laser technology and quick first-print feature are series-level; exact model, speed and toner code are confirmed by ARS Computers.'
  },

  'brother-mono-laser-printer': {
    description:
      'The Brother HL-series monochrome laser printer is a compact, high-speed printer for retail counters, legal drafting desks and small offices. It uses an enclosed paper cassette to keep sheets clean and a single-component toner system for straightforward replacement. This listing covers the HL-series models supplied by ARS Computers. Exact model, print speed, duplex support, toner yield and connectivity are confirmed before supply.',
    keyFeatures: [
      'Brother HL-series monochrome laser printer',
      'Compact desktop footprint',
      '250-sheet enclosed paper cassette on the listed series',
      'High-speed black-and-white document printing',
      'Straightforward single-component toner replacement',
      'Exact model and configuration confirmed with sales'
    ],
    specs: {
      printer_type: 'Monochrome laser printer',
      model_number: 'Brother HL-series — exact model confirmed with sales',
      technology: 'Monochrome laser',
      print_resolution: 'Configuration-dependent — confirm with sales',
      print_speed: 'Configuration-dependent — confirm with sales',
      duty_cycle: 'Configuration-dependent — confirm with sales',
      duplex: 'Automatic duplex on supported models',
      paper_size: 'A4, A5, Letter and legal sizes on supported models',
      input_capacity: '250-sheet enclosed cassette on the listed series',
      output_capacity: 'Configuration-dependent — confirm with sales',
      functions: 'Print only',
      connectivity: 'USB; Ethernet/Wi-Fi depending on model',
      toner: 'Brother monochrome toner cartridge — code confirmed per model',
      os_support: 'Windows, macOS and Linux drivers on supported models'
    },
    compatibility:
      'Uses Brother toner specified for the exact HL-series model. Confirm the model, toner code, duplex requirement and network connection with ARS Computers sales.',
    boxContents:
      'Printer unit, starter toner cartridge, power cable and documentation. USB cable supplied only where included by the selected model.',
    specsVerified: 'partially_verified',
    specSource:
      'Brother HL-series listing. Compact mono-laser design and 250-sheet cassette are series-level; exact model, speed and toner code are confirmed by ARS Computers.'
  },

  'compact-desktop-mono-laser-printer': {
    description:
      'This compact desktop monochrome laser printer is a personal and administrative device for straightforward black-and-white printing. Its small footprint suits reception desks, accounts counters and home offices, and the single-cartridge design keeps replacement simple. Because this is a multi-brand solution listing, the exact model, print speed, toner code and connectivity are confirmed with sales.',
    keyFeatures: [
      'Compact monochrome laser printer for desk use',
      'Low power consumption',
      'Easy single-cartridge replacement',
      'Simple USB connectivity',
      'Space-saving administrative footprint',
      'Exact model and toner code confirmed with sales'
    ],
    specs: {
      printer_type: 'Compact monochrome laser printer',
      model_number: 'Desktop mono laser — exact model confirmed with sales',
      technology: 'Monochrome laser',
      print_resolution: 'Configuration-dependent — confirm with sales',
      print_speed: 'Configuration-dependent — confirm with sales',
      paper_size: 'A4 and standard office sizes',
      input_capacity: 'Configuration-dependent — confirm with sales',
      duplex: 'Model-dependent — confirm with sales',
      functions: 'Print only',
      connectivity: 'USB; network options depending on model',
      toner: 'Single monochrome toner cartridge — code confirmed per model',
      power: 'Low-power desktop class — exact rating confirmed with sales',
      os_support: 'Windows and macOS drivers on supported models'
    },
    compatibility:
      'Suitable for standard office paper and occasional to moderate print volumes. Confirm the exact model, toner code and connectivity with ARS Computers sales.',
    boxContents:
      'Printer unit, starter toner cartridge, power cable and documentation. USB cable supplied only where included by the selected model.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand compact mono-laser solution listing. Exact model, speed, toner code and connectivity are confirmed by ARS Computers at the time of sale.'
  },

  'brother-color-mfp-copier-adf': {
    description:
      'The Brother colour laser multifunction printer combines colour printing, copying and scanning in one office device. An automatic document feeder allows multi-page documents to be scanned or copied without placing each sheet on the glass, and duplex printing reduces paper use on supported models. This listing covers the Brother colour MFP models supplied by ARS Computers; exact model, speeds, paper capacity and toner codes are confirmed before supply.',
    keyFeatures: [
      'Brother colour laser multifunction printer',
      'Automatic Document Feeder for multi-page scanning and copying',
      'Colour print, copy and scan functions',
      'Duplex printing on supported models',
      'Network connectivity for shared office use',
      'Exact model and toner codes confirmed with sales'
    ],
    specs: {
      printer_type: 'Colour laser multifunction printer',
      model_number: 'Brother colour laser MFP — exact model confirmed with sales',
      technology: 'Colour laser',
      print_resolution: 'Configuration-dependent — confirm with sales',
      print_speed: 'Configuration-dependent — confirm with sales',
      duty_cycle: 'Configuration-dependent — confirm with sales',
      duplex: 'Automatic duplex on supported models',
      paper_size: 'A4, A5, Letter and legal sizes on supported models',
      input_capacity: 'Configuration-dependent — confirm with sales',
      functions: 'Print, copy, scan',
      adf: 'Automatic Document Feeder',
      scanner: 'Flatbed colour scanner with ADF',
      connectivity: 'USB, Ethernet and Wi-Fi depending on model',
      toner: 'Brother colour toner cartridges — codes confirmed per model',
      os_support: 'Windows, macOS and Linux drivers on supported models'
    },
    compatibility:
      'Uses Brother colour toner and drum units specified for the exact model. Confirm the model, toner codes, ADF capacity and network requirements with ARS Computers sales.',
    boxContents:
      'Printer unit, starter toner cartridges, power cable and documentation. USB cable supplied only where included by the selected model.',
    specsVerified: 'partially_verified',
    specSource:
      'Brother colour laser MFP listing. Colour laser, ADF and duplex features are series-level; exact model, speeds and toner codes are confirmed by ARS Computers.'
  },

  'brother-commercial-color-copier': {
    description:
      'The Brother commercial colour laser copier is a heavy-duty departmental device for offices, schools and print rooms with sustained colour output. It combines a large flatbed scanner platen with high-capacity paper handling and a workgroup-grade duty cycle. This listing covers the commercial Brother colour copier models supplied by ARS Computers. Exact model, print speed, paper capacity, finishing options and toner codes are confirmed with sales.',
    keyFeatures: [
      'Heavy-duty Brother colour laser copier',
      'Large flatbed scanner platen',
      'High monthly workload capability',
      'High-capacity paper feeding options',
      'Colour print, copy and scan for workgroups',
      'Exact model and finishing options confirmed with sales'
    ],
    specs: {
      printer_type: 'Commercial colour laser copier/MFP',
      model_number: 'Brother commercial colour series — exact model confirmed with sales',
      technology: 'Colour laser',
      print_resolution: 'Configuration-dependent — confirm with sales',
      print_speed: 'Configuration-dependent — confirm with sales',
      duty_cycle: 'Heavy-duty commercial class — exact rating confirmed with sales',
      duplex: 'Automatic duplex on supported models',
      paper_size: 'A4, A3 and specialist media depending on model',
      input_capacity: 'High-capacity trays — exact capacity confirmed with sales',
      functions: 'Print, copy, scan; fax on selected models',
      scanner: 'Large flatbed platen with optional ADF',
      connectivity: 'Ethernet and USB; Wi-Fi on selected models',
      toner: 'Brother colour toner cartridges — codes confirmed per model',
      os_support: 'Windows, macOS and Linux drivers on supported models'
    },
    compatibility:
      'Intended for departmental print volumes and shared network use. Confirm the exact model, A3 requirement, finishing options and toner contract with ARS Computers sales.',
    boxContents:
      'Copier unit, starter toner cartridges, power cable and documentation. Optional finishers, cabinets and extra trays are supplied only if specified on the quotation.',
    specsVerified: 'partially_verified',
    specSource:
      'Brother commercial colour copier listing. Heavy-duty colour laser and flatbed platen features are series-level; exact model, speed and capacity are confirmed by ARS Computers.'
  },

  'hp-color-laserjet-enterprise-mfp': {
    description:
      'The HP Color LaserJet Enterprise MFP is a departmental colour laser device for businesses that need secure, high-quality colour printing, scanning and copying on a shared network. Enterprise models typically add secure print release, usage reporting and fleet-management features. This listing covers the HP Color LaserJet Enterprise models supplied by ARS Computers; exact model, speed, paper capacity, finishing options and toner codes are confirmed with sales.',
    keyFeatures: [
      'HP Color LaserJet Enterprise departmental MFP',
      'High-resolution colour printing',
      'Print, copy and scan on a shared network',
      'Enterprise security and print-management features',
      'High-capacity paper handling on supported models',
      'Exact model and toner codes confirmed with sales'
    ],
    specs: {
      printer_type: 'Enterprise colour laser multifunction printer',
      model_number: 'HP Color LaserJet Enterprise — exact model confirmed with sales',
      technology: 'Colour laser',
      print_resolution: 'Configuration-dependent — confirm with sales',
      print_speed: 'Configuration-dependent — confirm with sales',
      duty_cycle: 'Departmental class — exact rating confirmed with sales',
      duplex: 'Automatic duplex on supported models',
      paper_size: 'A4, A5, Letter and legal sizes; A3 on selected models',
      input_capacity: 'High-capacity trays — exact capacity confirmed with sales',
      functions: 'Print, copy, scan; fax on selected models',
      scanner: 'Flatbed colour scanner with ADF on supported models',
      connectivity: 'Ethernet, USB and Wi-Fi depending on model',
      toner: 'HP Colour LaserJet toner cartridges — codes confirmed per model',
      os_support: 'Windows, macOS and Linux drivers on supported models'
    },
    compatibility:
      'Designed for managed enterprise networks and shared departmental use. Confirm the exact model, secure-print requirements, finishing options and toner codes with ARS Computers sales.',
    boxContents:
      'MFP unit, starter toner cartridges, power cable and documentation. Optional finishers, cabinets and extra trays are supplied only if specified on the quotation.',
    specsVerified: 'partially_verified',
    specSource:
      'HP Color LaserJet Enterprise series listing. Enterprise colour laser and MFP features are series-level; exact model, speed and toner codes are confirmed by ARS Computers.'
  }
}
