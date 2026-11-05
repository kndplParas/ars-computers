-- ============================================================================
-- ARS Computers — Product description & specification seed
-- Migration: 20261105000002_product_description_seed.sql
-- ============================================================================
-- Populates the content columns added by 20261105000001_product_description_schema.sql
-- for the existing catalogue. Updates are matched strictly by slug and fail loudly
-- if a referenced product is missing. No IDs, categories, images, prices, stock,
-- RLS policies, staff accounts or Auth credentials are modified.
-- ============================================================================

UPDATE public.products SET
  description = $ars_product_content$These 12 V DC power pigtail connectors join CCTV camera power leads to a power supply or extension cable. The pair uses standard 2.1 mm x 5.5 mm barrel plugs with screw-terminal or pre-tinned tails, making field repairs and camera swaps straightforward. Exact wire length, gauge and pack quantity are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$12 V DC CCTV power pigtail pair$ars_product_content$, $ars_product_content$Standard 2.1 mm x 5.5 mm barrel plugs$ars_product_content$, $ars_product_content$Male and female connectors$ars_product_content$, $ars_product_content$Screw-terminal or pre-tinned tails$ars_product_content$, $ars_product_content$Useful for camera power repairs and extensions$ars_product_content$, $ars_product_content$Exact pack quantity confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Matches cameras and power supplies that use a standard 2.1 mm x 5.5 mm barrel jack. Confirm the polarity, plug size and pack quantity with ARS Computers sales before wiring.$ars_product_content$,
  box_contents = $ars_product_content$Male and female pigtail connectors in the selected pack quantity.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand DC pigtail solution listing. Standard 2.1 mm x 5.5 mm barrel plugs are stated by the catalogue; exact wire length and pack quantity are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "DC power pigtail connectors",
  "connector": "2.1 mm x 5.5 mm barrel plug (male and female)",
  "connector_type": "DC barrel",
  "length": "Short pigtail — exact length confirmed with sales",
  "gauge": "Configuration-dependent — confirm with sales",
  "power_rating": "12 V DC CCTV power",
  "compatibility": "CCTV cameras and 12 V DC power supplies"
}$ars_product_content$::jsonb
WHERE slug = '12v-dc-cctv-power-pigtail-connectors';

UPDATE public.products SET
  description = $ars_product_content$The Acer performance laptop range is intended for users who need more headroom than a basic office notebook, including design software, data-heavy spreadsheets and multi-application workflows. This listing covers the Acer models supplied by ARS Computers, with enhanced thermal exhaust and multi-core processing options. Exact processor, graphics, memory and display configuration are confirmed per unit.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Acer performance notebook family$ars_product_content$, $ars_product_content$Multi-core processing options for demanding workloads$ars_product_content$, $ars_product_content$Enhanced thermal dissipation and exhaust venting$ars_product_content$, $ars_product_content$Suitable for design, analysis and multitasking$ars_product_content$, $ars_product_content$Full-size keyboard and business connectivity$ars_product_content$, $ars_product_content$Exact configuration confirmed against current stock$ars_product_content$]::text[],
  compatibility = $ars_product_content$Suitable for office suites, design tools, data analysis and general multitasking. Confirm the exact software and graphics requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Acer performance series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "form_factor": "Performance laptop (clamshell)",
  "processor": "Configuration-dependent — confirm with sales",
  "processor_generation": "Configuration-dependent — confirm with sales",
  "ram": "Configuration-dependent — confirm with sales",
  "storage": "Configuration-dependent — confirm with sales",
  "storage_type": "SSD (model-dependent)",
  "gpu": "Integrated or dedicated graphics depending on model",
  "display": "Configuration-dependent — confirm screen size with sales",
  "resolution": "Configuration-dependent — confirm with sales",
  "panel_type": "Anti-glare panel (model-dependent)",
  "keyboard": "Full-size laptop keyboard",
  "camera": "Integrated webcam (model-dependent)",
  "os": "Configuration-dependent — Windows options confirmed at order",
  "ports": "USB, HDMI and audio ports — exact set confirmed per model",
  "networking": "Wi-Fi and Ethernet options depend on model",
  "cooling": "Enhanced thermal exhaust design"
}$ars_product_content$::jsonb
WHERE slug = 'acer-performance-laptop';

UPDATE public.products SET
  description = $ars_product_content$The Acer Veriton commercial tower is a business desktop for offices, schools and back-office departments that need expandable, reliable computing. PCIe expansion bays support add-in cards, and multiple display outputs allow dual-monitor productivity. This listing covers the Veriton tower models supplied by ARS Computers. Exact processor, memory, storage, graphics and warranty are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Acer Veriton commercial desktop tower$ars_product_content$, $ars_product_content$Expandable PCIe bays$ars_product_content$, $ars_product_content$Multi-display output support$ars_product_content$, $ars_product_content$Quiet cooling for office environments$ars_product_content$, $ars_product_content$Business-grade reliability$ars_product_content$, $ars_product_content$Exact configuration confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Suitable for office productivity, education, accounting and general business workloads. Confirm the exact model, display outputs, operating system and warranty with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Desktop tower, power cable and documentation. Monitor, keyboard and mouse are supplied separately unless included on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Acer Veriton tower series listing. Expandable PCIe design and multi-display support are series-level; exact model and configuration are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Commercial desktop tower",
  "processor": "Configuration-dependent — confirm with sales",
  "ram": "Configuration-dependent — confirm with sales",
  "storage": "Configuration-dependent — confirm with sales",
  "gpu": "Integrated or discrete graphics depending on model",
  "system_form_factor": "Desktop tower",
  "expansion": "PCIe slots and drive bays model-dependent",
  "system_ports": "USB, video and audio ports model-dependent",
  "networking": "Gigabit Ethernet; Wi-Fi on selected models",
  "power_supply": "Model-dependent"
}$ars_product_content$::jsonb
WHERE slug = 'acer-veriton-commercial-tower';

UPDATE public.products SET
  description = $ars_product_content$The Asus commercial desktop keyboard and mouse set is a wired input bundle for offices, schools and accounting desks. The membrane keyboard uses UV-coated keycaps for durability and a spill-resistant tray on supported models, while the optical mouse provides everyday cursor control. This listing covers the Asus wired sets supplied by ARS Computers; exact layout, cable length and mouse DPI are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Asus wired keyboard and mouse set$ars_product_content$, $ars_product_content$Spill-resistant membrane keyboard on supported models$ars_product_content$, $ars_product_content$UV-coated durable keycaps$ars_product_content$, $ars_product_content$Full-size layout with numeric keypad$ars_product_content$, $ars_product_content$Optical mouse for everyday office use$ars_product_content$, $ars_product_content$Exact model and cable length confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with desktop PCs and laptops that have USB-A ports. Confirm the exact keyboard layout, cable length and spill-resistance specification with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Wired keyboard, wired mouse and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Asus commercial desktop keyboard set listing. Membrane keys and UV-coated keycaps are series-level; exact model and mouse DPI are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wired keyboard and mouse set",
  "model_number": "Asus desktop keyboard set — exact model confirmed with sales",
  "key_layout": "Full-size with numeric keypad",
  "switch_type": "Membrane",
  "keycaps": "UV-coated keycaps",
  "connection": "USB wired",
  "dpi": "Optical mouse — DPI confirmed with sales",
  "buttons": "3-button optical mouse",
  "compatibility_os": "Windows and Linux with USB-A port"
}$ars_product_content$::jsonb
WHERE slug = 'asus-desktop-keyboard-mouse-set';

UPDATE public.products SET
  description = $ars_product_content$The ASUS desktop motherboard provides the foundation for a custom commercial or gaming build, with robust power delivery, cooling heatsinks and expansion slots. This listing covers ASUS boards across different chipsets and sockets, so the CPU generation, memory type, M.2 support and PCIe version must be matched to the build. Exact chipset, socket, form factor and connectivity are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$ASUS commercial/gaming desktop motherboard$ars_product_content$, $ars_product_content$Robust power delivery stages$ars_product_content$, $ars_product_content$Dual M.2 slots on supported models$ars_product_content$, $ars_product_content$PCIe 4.0/5.0 support depending on chipset$ars_product_content$, $ars_product_content$Cooling heatsinks over VRM and M.2 areas$ars_product_content$, $ars_product_content$Exact socket, chipset and form factor confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$The motherboard must match the CPU socket, memory generation and case form factor. Confirm the exact model, BIOS support for the intended CPU and required M.2/PCIe layout with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Motherboard, I/O shield where applicable, SATA cables, mounting hardware and documentation. Exact bundle depends on the selected model.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$ASUS desktop motherboard series listing. Power delivery, cooling and expansion features are series-level; exact socket, chipset and memory support are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Desktop motherboard",
  "socket": "Intel/AMD socket depends on model — confirm with sales",
  "chipset": "Model-dependent — confirm with sales",
  "ram": "DDR4 or DDR5 depending on model — confirm with sales",
  "expansion": "PCIe slots and dual M.2 on supported models",
  "system_form_factor": "ATX/mATX form factor depends on model",
  "system_ports": "USB, Ethernet, audio and video outputs model-dependent",
  "networking": "Gigabit/2.5G Ethernet and Wi-Fi options depending on model",
  "compatibility": "Confirm CPU generation, RAM type, case form factor and PSU"
}$ars_product_content$::jsonb
WHERE slug = 'asus-desktop-motherboard';

UPDATE public.products SET
  description = $ars_product_content$The ASUS TUF Gaming series is built for gaming, content creation and graphics-heavy coursework. This listing covers the TUF models supplied by ARS Computers. TUF systems use a reinforced chassis, dual cooling fans and dedicated NVIDIA GeForce graphics in supported configurations. The high-refresh display option improves motion clarity in games and fast-paced editing. Exact GPU, processor, memory and display configuration are confirmed per unit.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$ASUS TUF Gaming performance laptop family$ars_product_content$, $ars_product_content$Dedicated NVIDIA GeForce graphics in supported configurations$ars_product_content$, $ars_product_content$Dual-fan cooling with reinforced chassis$ars_product_content$, $ars_product_content$High refresh-rate display options$ars_product_content$, $ars_product_content$Suitable for gaming, 3D rendering and content creation$ars_product_content$, $ars_product_content$Exact configuration confirmed against current stock$ars_product_content$]::text[],
  compatibility = $ars_product_content$Suitable for gaming, AutoCAD, Blender, Adobe creative software and general productivity. Confirm the exact GPU, power supply and display requirements for your software with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$ASUS TUF Gaming series listing. Exact model number, GPU configuration and warranty terms are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "form_factor": "Gaming laptop (clamshell)",
  "processor": "Configuration-dependent — confirm with sales",
  "processor_generation": "Configuration-dependent — confirm with sales",
  "ram": "Configuration-dependent — confirm with sales",
  "storage": "Configuration-dependent — confirm with sales",
  "storage_type": "SSD (model-dependent)",
  "gpu": "Dedicated NVIDIA GeForce GPU — exact model confirmed with sales",
  "display": "Configuration-dependent — confirm screen size with sales",
  "resolution": "Configuration-dependent — confirm with sales",
  "panel_type": "High refresh-rate panel on supported models",
  "keyboard": "Backlit gaming keyboard (model-dependent)",
  "audio": "Dual-speaker audio (model-dependent)",
  "os": "Configuration-dependent — Windows options confirmed at order",
  "ports": "USB, HDMI and audio ports — exact set confirmed per model",
  "networking": "Wi-Fi and Ethernet options depend on model",
  "cooling": "Dual-fan thermal design",
  "weight": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'asus-tuf-gaming-laptop';

UPDATE public.products SET
  description = $ars_product_content$Thermal receipt and barcode label printers are used at retail billing counters, cafés, warehouses and inventory stations. Direct-thermal printing needs no ink or toner, relying on treated receipt or label paper instead. This solution listing covers POS receipt printers and barcode label printers supplied by ARS Computers. The paper width, print speed, connectivity and driver support depend on the selected model and are confirmed before supply.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Direct-thermal POS receipt and barcode label printing$ars_product_content$, $ars_product_content$No ink or toner required$ars_product_content$, $ars_product_content$High-speed printing for billing counters$ars_product_content$, $ars_product_content$USB connectivity with network options on supported models$ars_product_content$, $ars_product_content$Compact counter-friendly footprint$ars_product_content$, $ars_product_content$Exact model, paper width and interface confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Must be matched to the billing software, paper width and label stock in use. Confirm driver support for the selected POS or ERP application and whether Ethernet or Bluetooth is required with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Printer unit, power adapter, USB cable where supplied, paper roll spindle/guide and documentation. Paper rolls are supplied separately unless included on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand thermal POS solution listing. Exact model, print width, speed and interface are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "printer_type": "POS receipt and barcode label printer",
  "model_number": "Thermal POS series — exact model confirmed with sales",
  "technology": "Direct thermal (no ink or toner)",
  "print_resolution": "Configuration-dependent — confirm with sales",
  "print_speed": "High-speed POS class — exact rating confirmed with sales",
  "paper_size": "58 mm/80 mm receipt rolls and label stock — confirm model",
  "input_capacity": "Roll-fed — maximum roll diameter confirmed per model",
  "functions": "Receipt and barcode label printing",
  "connectivity": "USB; Ethernet/Bluetooth options depending on model",
  "os_support": "Windows drivers; Android/Linux support confirmed per model",
  "cartridge": "No cartridge — direct thermal media only",
  "power": "External DC power adapter"
}$ars_product_content$::jsonb
WHERE slug = 'barcode-thermal-receipt-printers';

UPDATE public.products SET
  description = $ars_product_content$This braided HDMI cable carries high-speed digital video and audio between a computer, monitor, TV, projector or console. Gold-plated connectors and nylon braiding improve durability, while the HDMI 2.0 class bandwidth supports 4K output at 60 Hz. It is a practical cable for office displays, meeting rooms and home entertainment. Available lengths are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$High-speed 4K HDMI cable$ars_product_content$, $ars_product_content$Gold-plated connectors$ars_product_content$, $ars_product_content$Nylon braided exterior$ars_product_content$, $ars_product_content$4K UHD at 60 Hz on HDMI 2.0 class cables$ars_product_content$, $ars_product_content$Supports digital audio and video$ars_product_content$, $ars_product_content$Available lengths confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with devices that have a standard HDMI Type-A port. Confirm the required length, 4K refresh rate and whether HDMI 2.1 bandwidth is needed with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$HDMI cable and documentation where supplied.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand 4K HDMI cable solution listing. Gold-plated connectors and 4K 60 Hz support are stated by the catalogue; exact length and bandwidth certification are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "HDMI audio/video cable",
  "connector": "HDMI male to HDMI male",
  "connector_type": "Standard HDMI (Type A)",
  "length": "1 m / 1.5 m / 3 m options — confirm with sales",
  "bandwidth": "18 Gbps HDMI 2.0 class",
  "resolution_support": "4K UHD at 60 Hz",
  "shielding": "Nylon braided jacket with shielded conductors",
  "compatibility": "TVs, monitors, projectors, consoles and computers with HDMI"
}$ars_product_content$::jsonb
WHERE slug = 'braided-4k-high-speed-hdmi-cable';

UPDATE public.products SET
  description = $ars_product_content$The Brother colour laser multifunction printer combines colour printing, copying and scanning in one office device. An automatic document feeder allows multi-page documents to be scanned or copied without placing each sheet on the glass, and duplex printing reduces paper use on supported models. This listing covers the Brother colour MFP models supplied by ARS Computers; exact model, speeds, paper capacity and toner codes are confirmed before supply.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Brother colour laser multifunction printer$ars_product_content$, $ars_product_content$Automatic Document Feeder for multi-page scanning and copying$ars_product_content$, $ars_product_content$Colour print, copy and scan functions$ars_product_content$, $ars_product_content$Duplex printing on supported models$ars_product_content$, $ars_product_content$Network connectivity for shared office use$ars_product_content$, $ars_product_content$Exact model and toner codes confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Uses Brother colour toner and drum units specified for the exact model. Confirm the model, toner codes, ADF capacity and network requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Printer unit, starter toner cartridges, power cable and documentation. USB cable supplied only where included by the selected model.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Brother colour laser MFP listing. Colour laser, ADF and duplex features are series-level; exact model, speeds and toner codes are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "printer_type": "Colour laser multifunction printer",
  "model_number": "Brother colour laser MFP — exact model confirmed with sales",
  "technology": "Colour laser",
  "print_resolution": "Configuration-dependent — confirm with sales",
  "print_speed": "Configuration-dependent — confirm with sales",
  "duty_cycle": "Configuration-dependent — confirm with sales",
  "duplex": "Automatic duplex on supported models",
  "paper_size": "A4, A5, Letter and legal sizes on supported models",
  "input_capacity": "Configuration-dependent — confirm with sales",
  "functions": "Print, copy, scan",
  "adf": "Automatic Document Feeder",
  "scanner": "Flatbed colour scanner with ADF",
  "connectivity": "USB, Ethernet and Wi-Fi depending on model",
  "toner": "Brother colour toner cartridges — codes confirmed per model",
  "os_support": "Windows, macOS and Linux drivers on supported models"
}$ars_product_content$::jsonb
WHERE slug = 'brother-color-mfp-copier-adf';

UPDATE public.products SET
  description = $ars_product_content$The Brother commercial colour laser copier is a heavy-duty departmental device for offices, schools and print rooms with sustained colour output. It combines a large flatbed scanner platen with high-capacity paper handling and a workgroup-grade duty cycle. This listing covers the commercial Brother colour copier models supplied by ARS Computers. Exact model, print speed, paper capacity, finishing options and toner codes are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Heavy-duty Brother colour laser copier$ars_product_content$, $ars_product_content$Large flatbed scanner platen$ars_product_content$, $ars_product_content$High monthly workload capability$ars_product_content$, $ars_product_content$High-capacity paper feeding options$ars_product_content$, $ars_product_content$Colour print, copy and scan for workgroups$ars_product_content$, $ars_product_content$Exact model and finishing options confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Intended for departmental print volumes and shared network use. Confirm the exact model, A3 requirement, finishing options and toner contract with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Copier unit, starter toner cartridges, power cable and documentation. Optional finishers, cabinets and extra trays are supplied only if specified on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Brother commercial colour copier listing. Heavy-duty colour laser and flatbed platen features are series-level; exact model, speed and capacity are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "printer_type": "Commercial colour laser copier/MFP",
  "model_number": "Brother commercial colour series — exact model confirmed with sales",
  "technology": "Colour laser",
  "print_resolution": "Configuration-dependent — confirm with sales",
  "print_speed": "Configuration-dependent — confirm with sales",
  "duty_cycle": "Heavy-duty commercial class — exact rating confirmed with sales",
  "duplex": "Automatic duplex on supported models",
  "paper_size": "A4, A3 and specialist media depending on model",
  "input_capacity": "High-capacity trays — exact capacity confirmed with sales",
  "functions": "Print, copy, scan; fax on selected models",
  "scanner": "Large flatbed platen with optional ADF",
  "connectivity": "Ethernet and USB; Wi-Fi on selected models",
  "toner": "Brother colour toner cartridges — codes confirmed per model",
  "os_support": "Windows, macOS and Linux drivers on supported models"
}$ars_product_content$::jsonb
WHERE slug = 'brother-commercial-color-copier';

UPDATE public.products SET
  description = $ars_product_content$The Brother HL-series monochrome laser printer is a compact, high-speed printer for retail counters, legal drafting desks and small offices. It uses an enclosed paper cassette to keep sheets clean and a single-component toner system for straightforward replacement. This listing covers the HL-series models supplied by ARS Computers. Exact model, print speed, duplex support, toner yield and connectivity are confirmed before supply.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Brother HL-series monochrome laser printer$ars_product_content$, $ars_product_content$Compact desktop footprint$ars_product_content$, $ars_product_content$250-sheet enclosed paper cassette on the listed series$ars_product_content$, $ars_product_content$High-speed black-and-white document printing$ars_product_content$, $ars_product_content$Straightforward single-component toner replacement$ars_product_content$, $ars_product_content$Exact model and configuration confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Uses Brother toner specified for the exact HL-series model. Confirm the model, toner code, duplex requirement and network connection with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Printer unit, starter toner cartridge, power cable and documentation. USB cable supplied only where included by the selected model.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Brother HL-series listing. Compact mono-laser design and 250-sheet cassette are series-level; exact model, speed and toner code are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "printer_type": "Monochrome laser printer",
  "model_number": "Brother HL-series — exact model confirmed with sales",
  "technology": "Monochrome laser",
  "print_resolution": "Configuration-dependent — confirm with sales",
  "print_speed": "Configuration-dependent — confirm with sales",
  "duty_cycle": "Configuration-dependent — confirm with sales",
  "duplex": "Automatic duplex on supported models",
  "paper_size": "A4, A5, Letter and legal sizes on supported models",
  "input_capacity": "250-sheet enclosed cassette on the listed series",
  "output_capacity": "Configuration-dependent — confirm with sales",
  "functions": "Print only",
  "connectivity": "USB; Ethernet/Wi-Fi depending on model",
  "toner": "Brother monochrome toner cartridge — code confirmed per model",
  "os_support": "Windows, macOS and Linux drivers on supported models"
}$ars_product_content$::jsonb
WHERE slug = 'brother-mono-laser-printer';

UPDATE public.products SET
  description = $ars_product_content$The Canon imageCLASS monochrome laser printer is a business-class black-and-white printer for offices, billing desks and document-heavy departments. Laser printing produces sharp text on plain paper, and quick first-print technology reduces waiting time. This listing covers the imageCLASS models supplied by ARS Computers. Exact model, print speed, duplex support, toner code and connectivity are confirmed against the selected unit.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Canon imageCLASS monochrome laser printer$ars_product_content$, $ars_product_content$Sharp black-and-white text output$ars_product_content$, $ars_product_content$Quick first-print warm-up on supported models$ars_product_content$, $ars_product_content$Business-duty paper handling$ars_product_content$, $ars_product_content$USB and network options depending on model$ars_product_content$, $ars_product_content$Exact model and toner code confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Uses Canon toner cartridges specified for the exact model. Confirm the model, toner code, duplex requirement and network connection with ARS Computers sales before ordering consumables.$ars_product_content$,
  box_contents = $ars_product_content$Printer unit, starter toner cartridge, power cable and documentation. USB cable supplied only where included by the selected model.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Canon imageCLASS series listing. Monochrome laser technology and quick first-print feature are series-level; exact model, speed and toner code are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "printer_type": "Monochrome laser printer",
  "model_number": "Canon imageCLASS series — exact model confirmed with sales",
  "technology": "Monochrome laser",
  "print_resolution": "Configuration-dependent — confirm with sales",
  "print_speed": "Configuration-dependent — confirm with sales",
  "duty_cycle": "Configuration-dependent — confirm with sales",
  "duplex": "Automatic duplex on supported models",
  "paper_size": "A4, A5, Letter and legal sizes on supported models",
  "input_capacity": "Configuration-dependent — confirm with sales",
  "functions": "Print only (MFP variants available separately)",
  "connectivity": "USB; Ethernet/Wi-Fi depending on model",
  "toner": "Canon monochrome toner cartridge — code confirmed per model",
  "os_support": "Windows, macOS and Linux drivers on supported models"
}$ars_product_content$::jsonb
WHERE slug = 'canon-imageclass-mono-laser-printer';

UPDATE public.products SET
  description = $ars_product_content$Canon PIXMA G-series ink-tank printers are multifunction devices for homes, small offices and document-heavy desks. Transparent reservoirs make ink levels easy to check, and the refillable system reduces the cost of everyday colour printing. Photo printing and borderless output are supported on many models. This listing covers the PIXMA G-series units supplied by ARS Computers; exact model, print resolution, paper handling and connectivity are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Canon PIXMA G-series refillable ink tanks$ars_product_content$, $ars_product_content$Print, scan and copy functions$ars_product_content$, $ars_product_content$Transparent ink reservoirs for easy level checks$ars_product_content$, $ars_product_content$Borderless photo printing on supported models$ars_product_content$, $ars_product_content$Low-cost refillable ink system$ars_product_content$, $ars_product_content$Exact model and configuration confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Uses Canon ink bottles and standard inkjet paper. Confirm the exact model, ink codes, borderless photo support and network requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Printer unit, power cable, setup ink bottles and documentation. USB cable and photo paper are supplied only where included by the selected model.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Canon PIXMA G-series listing. Refillable tank and multifunction features are series-level; exact model, speeds, capacities and connectivity are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "printer_type": "Ink tank multifunction printer",
  "model_number": "Canon PIXMA G-series — exact model confirmed with sales",
  "technology": "Inkjet",
  "print_resolution": "Configuration-dependent — confirm with sales",
  "print_speed": "Configuration-dependent — confirm with sales",
  "functions": "Print, scan, copy",
  "scanner": "Flatbed colour scanner",
  "copier": "Colour and monochrome copying",
  "paper_size": "A4, photo and envelope sizes on supported models",
  "input_capacity": "Configuration-dependent — confirm with sales",
  "duplex": "Automatic duplex on supported models",
  "connectivity": "Wi-Fi and USB; Ethernet on selected models",
  "mobile_printing": "Canon PRINT app and wireless printing on supported models",
  "ink": "Refillable transparent ink reservoirs",
  "os_support": "Windows, macOS and mobile printing — confirm per model"
}$ars_product_content$::jsonb
WHERE slug = 'canon-pixma-ink-tank-printer';

UPDATE public.products SET
  description = $ars_product_content$This Cat6 UTP patch cord connects computers, routers, switches, IP cameras and PoE devices over a gigabit Ethernet network. Molded snagless boots protect the RJ45 latch during installation and removal, and the twisted-pair construction supports reliable short-to-medium cable runs. Exact length, conductor type and colour are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Cat6 molded Gigabit Ethernet patch cord$ars_product_content$, $ars_product_content$Snagless RJ45 boots$ars_product_content$, $ars_product_content$Supports 1000 Mbps Gigabit Ethernet$ars_product_content$, $ars_product_content$Suitable for PCs, routers, switches and IP cameras$ars_product_content$, $ars_product_content$UTP twisted-pair construction$ars_product_content$, $ars_product_content$Exact length and colour confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with standard RJ45 Ethernet ports. Confirm the required length, PoE requirement and whether shielded cable is needed for the installation with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Ethernet patch cord and documentation where supplied.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand Cat6 patch cord solution listing. Molded snagless boots and Gigabit support are stated by the catalogue; exact length and conductor type are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Cat6 Ethernet patch cord",
  "connector": "RJ45 male to male",
  "connector_type": "Cat6 UTP",
  "length": "0.5 m to 20 m options — confirm with sales",
  "data_rate": "Up to 1 Gbps; 10 Gbps on short runs with suitable equipment",
  "shielding": "Unshielded twisted pair (UTP)",
  "compatibility": "Routers, switches, PCs, IP cameras and PoE devices"
}$ars_product_content$::jsonb
WHERE slug = 'cat6-gigabit-ethernet-patch-cord';

UPDATE public.products SET
  description = $ars_product_content$CCTV 3+1 cable combines one coaxial video conductor with three power/audio cores in a single jacket, simplifying camera wiring over long runs. The shielded coaxial core carries the video signal, while the additional cores can supply 12 V DC power and audio where required. It is supplied as a coil for installation with BNC and DC connectors. Exact length, conductor material and shielding are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$CCTV 3+1 combination coaxial cable$ars_product_content$, $ars_product_content$Solid copper video core plus three power/audio wires$ars_product_content$, $ars_product_content$Braided shielding for signal protection$ars_product_content$, $ars_product_content$Single jacket simplifies camera wiring$ars_product_content$, $ars_product_content$Suitable for analog CCTV installations$ars_product_content$, $ars_product_content$Exact coil length and conductor type confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Intended for analog CCTV runs with compatible BNC connectors and power pigtails. Confirm the run length, voltage drop and whether the camera requires a different cable type with ARS Computers.$ars_product_content$,
  box_contents = $ars_product_content$Cable coil and documentation where supplied. BNC connectors and power pigtails are supplied separately.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand CCTV 3+1 cable solution listing. Coaxial video plus power conductors are stated by the catalogue; exact coil length and conductor specification are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "CCTV combination coaxial cable",
  "connector": "Bare cable — BNC and DC connectors fitted on site",
  "connector_type": "3+1 coaxial",
  "length": "100 m / 305 m coil options — confirm with sales",
  "gauge": "Configuration-dependent — confirm with sales",
  "shielding": "Braided/foil shielding over the video core",
  "compatibility": "Analog CCTV cameras, DVRs and 12 V DC power distribution"
}$ars_product_content$::jsonb
WHERE slug = 'cctv-3-plus-1-coaxial-video-cable';

UPDATE public.products SET
  description = $ars_product_content$This commercial slim all-in-one desktop integrates the processor, motherboard, speakers and display into a single space-saving chassis with an ergonomic metallic arc stand. It is intended for reception desks, executive cabins, billing counters and meeting areas where cable clutter and desk space matter. The 24-inch anti-glare screen and integrated components are confirmed against the selected model, since this is a multi-brand solution listing.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Integrated all-in-one desktop design$ars_product_content$, $ars_product_content$24-inch anti-glare display on the listed configuration$ars_product_content$, $ars_product_content$Ergonomic metallic arc stand$ars_product_content$, $ars_product_content$Space-saving footprint for reception and executive desks$ars_product_content$, $ars_product_content$Integrated speakers and webcam options$ars_product_content$, $ars_product_content$Exact model and configuration confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Suitable for reception, billing, office productivity and customer-facing counters. Confirm the exact model, VESA/wall-mount requirements and peripheral bundle with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$All-in-One unit, stand, power adapter and power cable, and documentation. Keyboard and mouse included only if specified on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand all-in-one solution listing. Exact model, panel specification and configuration are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "form_factor": "All-in-One desktop",
  "processor": "Configuration-dependent — confirm with sales",
  "ram": "Configuration-dependent — confirm with sales",
  "storage": "Configuration-dependent — confirm with sales",
  "storage_type": "SSD/HDD options depending on model",
  "display": "24-inch class anti-glare display",
  "resolution": "Configuration-dependent — confirm with sales",
  "panel_type": "Anti-glare panel",
  "camera": "Integrated webcam on supported models",
  "audio": "Integrated stereo speakers",
  "os": "Configuration-dependent — Windows options confirmed at order",
  "ports": "USB, HDMI and audio ports — exact set confirmed per model",
  "networking": "Wi-Fi and Ethernet options depend on model",
  "peripherals": "Keyboard and mouse bundle confirmed at order"
}$ars_product_content$::jsonb
WHERE slug = 'commercial-slim-all-in-one-pc';

UPDATE public.products SET
  description = $ars_product_content$This compact desktop monochrome laser printer is a personal and administrative device for straightforward black-and-white printing. Its small footprint suits reception desks, accounts counters and home offices, and the single-cartridge design keeps replacement simple. Because this is a multi-brand solution listing, the exact model, print speed, toner code and connectivity are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Compact monochrome laser printer for desk use$ars_product_content$, $ars_product_content$Low power consumption$ars_product_content$, $ars_product_content$Easy single-cartridge replacement$ars_product_content$, $ars_product_content$Simple USB connectivity$ars_product_content$, $ars_product_content$Space-saving administrative footprint$ars_product_content$, $ars_product_content$Exact model and toner code confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Suitable for standard office paper and occasional to moderate print volumes. Confirm the exact model, toner code and connectivity with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Printer unit, starter toner cartridge, power cable and documentation. USB cable supplied only where included by the selected model.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand compact mono-laser solution listing. Exact model, speed, toner code and connectivity are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "printer_type": "Compact monochrome laser printer",
  "model_number": "Desktop mono laser — exact model confirmed with sales",
  "technology": "Monochrome laser",
  "print_resolution": "Configuration-dependent — confirm with sales",
  "print_speed": "Configuration-dependent — confirm with sales",
  "paper_size": "A4 and standard office sizes",
  "input_capacity": "Configuration-dependent — confirm with sales",
  "duplex": "Model-dependent — confirm with sales",
  "functions": "Print only",
  "connectivity": "USB; network options depending on model",
  "toner": "Single monochrome toner cartridge — code confirmed per model",
  "power": "Low-power desktop class — exact rating confirmed with sales",
  "os_support": "Windows and macOS drivers on supported models"
}$ars_product_content$::jsonb
WHERE slug = 'compact-desktop-mono-laser-printer';

UPDATE public.products SET
  description = $ars_product_content$This compact portable wireless mouse is designed for travel bags, laptop sleeves and mobile business use. Its small form factor takes up little desk space, and energy-saving auto-sleep helps preserve battery life when the mouse is idle. It is a practical secondary mouse for sales staff and field engineers. Exact model, DPI, receiver type and battery are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Compact portable wireless mouse$ars_product_content$, $ars_product_content$Pocket-sized minimal form factor$ars_product_content$, $ars_product_content$Energy-saving auto-sleep$ars_product_content$, $ars_product_content$2.4 GHz wireless receiver$ars_product_content$, $ars_product_content$Suitable for laptops and travel$ars_product_content$, $ars_product_content$Exact model and battery type confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Connects through a USB nano receiver to a laptop or desktop. Confirm the exact model, receiver storage and battery type with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Wireless mouse, USB receiver, battery where supplied, and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand compact wireless mouse solution listing. Portable form factor and auto-sleep are stated by the catalogue; exact model and DPI are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Compact wireless optical mouse",
  "model_number": "Compact wireless series — exact model confirmed with sales",
  "dpi": "Optical tracking — DPI confirmed with sales",
  "buttons": "3-button layout with scroll wheel",
  "connection": "2.4 GHz wireless via USB nano receiver",
  "battery_life": "Configuration-dependent — confirm with sales",
  "compatibility_os": "Windows, macOS and Linux with USB-A port",
  "wireless_range": "Typical portable wireless range — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'compact-portable-wireless-mouse';

UPDATE public.products SET
  description = $ars_product_content$The Cooler Master RGB air cooler is a desktop CPU heatsink with direct-contact copper heatpipes and an RGB PWM fan. It is intended for gaming and performance builds that need better cooling than a stock cooler while keeping the system easy to maintain. Socket support, heatpipe count, fan size and cooler height vary by model, so the exact compatibility and clearance are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Cooler Master desktop CPU air cooler$ars_product_content$, $ars_product_content$Direct-contact copper heatpipes$ars_product_content$, $ars_product_content$RGB PWM airflow fan$ars_product_content$, $ars_product_content$Suitable for gaming and performance builds$ars_product_content$, $ars_product_content$Multiple Intel/AMD socket kits on supported models$ars_product_content$, $ars_product_content$Exact model and socket support confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Confirm the CPU socket, case cooler-height clearance and RAM module height before buying. Some large air coolers overlap tall RGB memory. ARS Computers can check fitment for the selected case and motherboard.$ars_product_content$,
  box_contents = $ars_product_content$Cooler unit, fan, mounting bracket kit, thermal paste where supplied, and documentation. Exact bundle depends on the selected model.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Cooler Master RGB CPU cooler series listing. Direct-contact heatpipes and RGB PWM fan are series-level; exact model, socket support and dimensions are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Desktop CPU air cooler",
  "socket": "Intel/AMD socket support depends on model — confirm with sales",
  "heatpipes": "Direct-contact copper heatpipes",
  "fan": "RGB PWM fan — size confirmed per model",
  "lighting": "RGB lighting",
  "tdp": "Model-dependent — confirm with sales",
  "compatibility": "Confirm case clearance, RAM height and socket kit before purchase",
  "dimensions": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'cooler-master-rgb-cpu-cooler';

UPDATE public.products SET
  description = $ars_product_content$The Corsair RM-series modular ATX power supply delivers stable DC power for gaming and commercial desktop builds. A fully modular cable system lets the builder connect only the cables needed, reducing clutter and improving airflow. The 80 PLUS certification indicates efficiency at typical loads, and the fan curve is tuned for quiet operation. Wattage, efficiency level and connector count vary by model, so the exact unit is confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Corsair RM-series modular ATX power supply$ars_product_content$, $ars_product_content$80 PLUS certified efficiency$ars_product_content$, $ars_product_content$Fully modular cable system$ars_product_content$, $ars_product_content$Quiet fan curve$ars_product_content$, $ars_product_content$Suitable for gaming and commercial desktops$ars_product_content$, $ars_product_content$Exact wattage and connectors confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Confirm the graphics card power connectors, total system wattage and case clearance before purchase. ARS Computers can size the PSU for the selected CPU and GPU.$ars_product_content$,
  box_contents = $ars_product_content$Power supply unit, modular cable set, power cord where supplied, mounting screws and documentation. Exact cable set depends on the selected model.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Corsair RM-series listing. 80 PLUS certification and fully modular cabling are series-level; exact wattage, efficiency level and connectors are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "ATX desktop power supply",
  "wattage": "450–850 W options — confirm with sales",
  "efficiency": "80 PLUS certified — exact level confirmed per model",
  "modular": "Fully modular on the RM series",
  "connectors": "24-pin ATX, EPS, PCIe, SATA and Molex — count confirmed per model",
  "fan": "Quiet-profile cooling fan",
  "compatibility": "ATX cases; confirm GPU power connectors and case clearance",
  "dimensions": "Standard ATX form factor — depth confirmed per model"
}$ars_product_content$::jsonb
WHERE slug = 'corsair-modular-atx-smps-power-supply';

UPDATE public.products SET
  description = $ars_product_content$Corsair Vengeance LPX is a low-profile DDR4 desktop memory series with an aluminium heat spreader, designed to fit under large CPU air coolers and inside compact cases. It is used for gaming builds, content-creation systems and office desktops that need a memory upgrade. Capacities, speeds and timings vary by kit, so the exact kit configuration and motherboard compatibility are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Corsair Vengeance LPX DDR4 desktop memory$ars_product_content$, $ars_product_content$Pure aluminium low-profile heat spreader$ars_product_content$, $ars_product_content$Fits under large CPU air coolers$ars_product_content$, $ars_product_content$High-speed DDR4 options$ars_product_content$, $ars_product_content$Dual-channel kit options$ars_product_content$, $ars_product_content$Exact kit speed and capacity confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Requires a DDR4 desktop motherboard with the correct number of free DIMM slots. Confirm the kit capacity, speed, timings and XMP support against the motherboard QVL with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Memory kit (one or more DIMMs) and documentation. Exact module count depends on the selected kit.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Corsair Vengeance LPX series specifications. DDR4, 288-pin DIMM and aluminium heat spreader are series-level; exact kit capacity and speed are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Desktop DDR4 memory kit",
  "memory_type": "DDR4",
  "interface": "288-pin DIMM",
  "capacity": "8 GB / 16 GB / 32 GB kit options — confirm with sales",
  "memory_speed": "2400–3600 MHz options — confirm with sales",
  "compatibility": "DDR4 desktop motherboards; check motherboard QVL",
  "voltage": "1.2–1.35 V depending on kit — confirm with sales",
  "heatspreader": "Aluminium low-profile heat spreader"
}$ars_product_content$::jsonb
WHERE slug = 'corsair-vengeance-lpx-ddr4-ram';

UPDATE public.products SET
  description = $ars_product_content$The CP PLUS 360-degree pan-tilt smart Wi-Fi camera provides wide indoor coverage from a single ceiling or shelf position. Motorised horizontal pan and vertical tilt let the camera sweep a room, while motion tracking follows movement automatically. Two-way audio supports conversation through the mobile app, making the camera useful for home monitoring, childcare and small-office oversight. Exact resolution, storage and app features are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Motorised 360-degree horizontal pan$ars_product_content$, $ars_product_content$Vertical tilt and auto motion tracking$ars_product_content$, $ars_product_content$Two-way audio via the mobile app$ars_product_content$, $ars_product_content$Indoor Wi-Fi monitoring from a single camera$ars_product_content$, $ars_product_content$Mobile live view and playback$ars_product_content$, $ars_product_content$Exact model, resolution and storage confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Requires a 2.4 GHz Wi-Fi network and the CP PLUS mobile app. Confirm microSD capacity, cloud subscription options and NVR compatibility for the exact model with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Camera unit, mounting kit, power adapter (if included by the selected model) and quick-start documentation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$CP PLUS 360 pan-tilt series listing. Pan range, motion tracking and two-way audio are series-level; exact resolution, storage and app features are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "camera_type": "Indoor pan-tilt Wi-Fi camera",
  "model_number": "CP PLUS 360 Pan-Tilt series — exact model confirmed with sales",
  "resolution": "Configuration-dependent — confirm with sales",
  "sensor": "CMOS sensor (model-dependent)",
  "lens": "Fixed wide-angle lens (focal length confirmed per model)",
  "pan_range": "360-degree horizontal pan",
  "tilt_range": "Configuration-dependent — confirm with sales",
  "tracking": "Automatic motion tracking on supported models",
  "night_vision": "Infrared night vision (model-dependent)",
  "audio": "Two-way audio",
  "microphone": "Built-in microphone and speaker",
  "environment": "Indoor ceiling or shelf mount",
  "connectivity": "2.4 GHz Wi-Fi",
  "power": "5 V/12 V DC adapter (model-dependent)",
  "storage_compatibility": "microSD card and/or NVR — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'cp-plus-360-ptz-smart-camera';

UPDATE public.products SET
  description = $ars_product_content$The CP PLUS Full HD dome camera is an indoor surveillance unit for shops, offices, homes and small commercial premises. It uses a high-sensitivity sensor and automatic IR-cut switching to deliver clear colour images in daylight and infrared-assisted images in low light. The compact dome enclosure suits ceiling installation where a discreet camera is preferred. Exact model, resolution, lens and recorder compatibility are confirmed before supply.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$CP PLUS indoor dome surveillance camera$ars_product_content$, $ars_product_content$Full HD resolution on the listed series$ars_product_content$, $ars_product_content$High-sensitivity image sensor$ars_product_content$, $ars_product_content$Automatic IR-cut filter for day/night switching$ars_product_content$, $ars_product_content$Compact low-profile enclosure$ars_product_content$, $ars_product_content$Exact model and recorder compatibility confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with compatible CP PLUS or third-party DVR/NVR recorders, subject to the exact camera model. Confirm recorder channel type, power supply and cable run with ARS Computers before installation.$ars_product_content$,
  box_contents = $ars_product_content$Camera unit, mounting hardware and documentation. Power supply, cable and recorder are supplied separately unless included on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$CP PLUS HD Dome series listing. Resolution class and IR-cut feature are series-level; exact model number, lens and IR range must be confirmed with ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "camera_type": "Indoor dome camera",
  "model_number": "CP PLUS HD Dome series — exact model confirmed with sales",
  "resolution": "2 MP Full HD (1920 x 1080) on the listed series",
  "sensor": "High-sensitivity CMOS sensor (model-dependent)",
  "lens": "Fixed wide-angle lens (focal length confirmed per model)",
  "viewing_angle": "Configuration-dependent — confirm with sales",
  "night_vision": "Infrared LEDs with automatic IR-cut switching",
  "ir_range": "Configuration-dependent — confirm with sales",
  "environment": "Indoor ceiling mount",
  "connectivity": "HD analog or IP depending on model — confirm with sales",
  "power": "12 V DC or PoE depending on model — confirm with sales",
  "storage_compatibility": "DVR/NVR storage — confirm recorder model",
  "operating_temperature": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'cp-plus-full-hd-dome-camera';

UPDATE public.products SET
  description = $ars_product_content$The CP PLUS biometric RFID card attendance device is a proximity-card punch terminal for staff attendance in offices, shops and small factories. It reads RFID cards quickly, gives audible confirmation, and stores punch logs so attendance can continue during a network interruption. This listing covers the CP PLUS RFID terminal models supplied by ARS Computers. Card frequency, user capacity, connectivity and software support are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$CP PLUS RFID card attendance terminal$ars_product_content$, $ars_product_content$High-speed proximity card reader$ars_product_content$, $ars_product_content$Audible verification beeper$ars_product_content$, $ars_product_content$Offline log storage during network interruption$ars_product_content$, $ars_product_content$Compact wall-mount design$ars_product_content$, $ars_product_content$Exact model and card frequency confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Requires compatible RFID cards at the correct frequency and the matching CP PLUS attendance software. Confirm the exact model, card type and connectivity with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Terminal unit, power adapter where supplied, mounting hardware and documentation. RFID cards and software licence are supplied separately unless included on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$CP PLUS RFID terminal series listing. Proximity card reading and offline log storage are series-level; exact model, capacity and card frequency are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "device_type": "RFID card attendance terminal",
  "model_number": "CP PLUS RFID terminal series — exact model confirmed with sales",
  "auth_methods": "RFID proximity card",
  "sensor_type": "Proximity card reader",
  "recognition_speed": "High-speed card read — exact rating confirmed with sales",
  "user_capacity": "Configuration-dependent — confirm with sales",
  "card_capacity": "Configuration-dependent — confirm with sales",
  "log_capacity": "Configuration-dependent — confirm with sales",
  "display_type": "LCD display (model-dependent)",
  "connectivity": "TCP/IP or USB depending on model",
  "access_control": "Door relay output on supported models",
  "software": "CP PLUS attendance software — version confirmed with sales",
  "reporting": "Attendance reports and export via CP PLUS software",
  "power": "12 V DC adapter",
  "installation": "Wall mount"
}$ars_product_content$::jsonb
WHERE slug = 'cp-plus-rfid-attendance-device';

UPDATE public.products SET
  description = $ars_product_content$This custom gaming and studio workstation is assembled by ARS Computers as a complete desk setup rather than a single boxed product. It combines a curved gaming display, an RGB desktop tower and backlit peripherals for gaming, streaming, video editing and creative production. Every build is configured to the customer's budget and software needs, so the processor, graphics card, memory and storage are specified in the final quotation.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Complete desk setup with curved gaming display$ars_product_content$, $ars_product_content$Custom-assembled RGB desktop tower$ars_product_content$, $ars_product_content$Backlit keyboard and precision optical mouse$ars_product_content$, $ars_product_content$Configured for gaming, streaming and media production$ars_product_content$, $ars_product_content$Assembly and component compatibility checked by ARS Computers$ars_product_content$, $ars_product_content$Final specification agreed before build$ars_product_content$]::text[],
  compatibility = $ars_product_content$Configured for the customer's chosen games, streaming software and creative applications. Confirm monitor inputs, desk space and software requirements with ARS Computers sales before the build is finalised.$ars_product_content$,
  box_contents = $ars_product_content$Desktop tower, curved monitor, keyboard, mouse, power cables and display cable. Exact bundle confirmed on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$ARS Computers custom build. Final component list, performance figures and warranty are confirmed in the quotation.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "form_factor": "Custom desktop workstation and monitor bundle",
  "processor": "Configuration-dependent — agreed before build",
  "ram": "Configuration-dependent — agreed before build",
  "storage": "Configuration-dependent — agreed before build",
  "gpu": "Configuration-dependent — agreed before build",
  "display": "Curved gaming display — size and resolution confirmed with sales",
  "resolution": "Configuration-dependent — confirm with sales",
  "cooling": "Air or liquid cooling depending on build",
  "peripherals": "Backlit keyboard and optical mouse included",
  "expansion": "Configuration-dependent — confirm motherboard and case",
  "power_supply": "Configuration-dependent — sized for selected components",
  "os": "Configuration-dependent — Windows options confirmed at order"
}$ars_product_content$::jsonb
WHERE slug = 'custom-gaming-studio-workstation-setup';

UPDATE public.products SET
  description = $ars_product_content$The custom liquid-cooled gaming rig is a hand-assembled desktop for high-end gaming, 3D rendering and content production. It uses a dual-chamber tempered-glass chassis, a closed-loop liquid CPU cooler and synchronised ARGB airflow fans. Because each rig is built to order, the processor, graphics card, memory, storage and power supply are selected for the customer's workload and confirmed in the final quotation.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Dual-chamber tempered-glass chassis$ars_product_content$, $ars_product_content$Closed-loop liquid CPU cooling$ars_product_content$, $ars_product_content$Synchronised ARGB airflow fans$ars_product_content$, $ars_product_content$Built for high-end gaming and content production$ars_product_content$, $ars_product_content$Custom component selection to budget$ars_product_content$, $ars_product_content$Assembly and thermal testing by ARS Computers$ars_product_content$]::text[],
  compatibility = $ars_product_content$Configured for the customer's chosen games, rendering engines and creative software. Confirm graphics card length, radiator clearance and PSU requirements with ARS Computers sales before the build is finalised.$ars_product_content$,
  box_contents = $ars_product_content$Desktop tower, power cable and documentation. Monitor and peripherals are included only if specified on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$ARS Computers custom build. Final component list, performance figures and warranty are confirmed in the quotation.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "form_factor": "Custom liquid-cooled desktop tower",
  "processor": "Configuration-dependent — agreed before build",
  "ram": "Configuration-dependent — agreed before build",
  "storage": "Configuration-dependent — agreed before build",
  "gpu": "Configuration-dependent — agreed before build",
  "cooling": "Closed-loop liquid CPU cooler with ARGB case fans",
  "expansion": "Configuration-dependent — confirm motherboard and case",
  "power_supply": "Configuration-dependent — sized for selected components",
  "lighting": "Synchronised ARGB lighting",
  "os": "Configuration-dependent — Windows options confirmed at order"
}$ars_product_content$::jsonb
WHERE slug = 'custom-liquid-cooled-gaming-rig';

UPDATE public.products SET
  description = $ars_product_content$The Dell Inspiron series is a practical everyday laptop family for business multitasking, students and home-office work. This listing covers the Inspiron models stocked by ARS Computers. Narrow-bezel FHD display options, a lift hinge for a comfortable typing angle and a full-size keyboard make the range easy to use for long sessions. Exact processor, memory, storage and display configuration are confirmed per unit.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Dell Inspiron everyday business laptop$ars_product_content$, $ars_product_content$Narrow-border FHD display options$ars_product_content$, $ars_product_content$Ergonomic lift hinge for a comfortable typing angle$ars_product_content$, $ars_product_content$Full-size island keyboard$ars_product_content$, $ars_product_content$Suitable for office, student and home-office workloads$ars_product_content$, $ars_product_content$Exact configuration confirmed against current stock$ars_product_content$]::text[],
  compatibility = $ars_product_content$Suitable for Microsoft 365, browsing, accounting, online classes and general office work. Confirm the exact model and peripheral requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Dell Inspiron series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "form_factor": "Everyday laptop (clamshell)",
  "processor": "Configuration-dependent — confirm with sales",
  "processor_generation": "Configuration-dependent — confirm with sales",
  "ram": "Configuration-dependent — confirm with sales",
  "storage": "Configuration-dependent — confirm with sales",
  "storage_type": "SSD/HDD options depending on model",
  "display": "FHD display options — exact size confirmed with sales",
  "resolution": "Full HD on supported models",
  "panel_type": "Anti-glare panel (model-dependent)",
  "keyboard": "Full-size island keyboard",
  "camera": "Integrated webcam (model-dependent)",
  "os": "Configuration-dependent — Windows options confirmed at order",
  "ports": "USB, HDMI and audio ports — exact set confirmed per model",
  "networking": "Wi-Fi and Ethernet options depend on model"
}$ars_product_content$::jsonb
WHERE slug = 'dell-inspiron-business-laptop';

UPDATE public.products SET
  description = $ars_product_content$The Dell KB216 is a standard commercial wired keyboard with low-profile chiclet keys, multimedia and volume controls, and a dependable USB connection. It is a common choice for office fleets because it is simple to deploy, comfortable for long typing sessions and easy to replace. The full-size layout includes a numeric keypad for accounting and data entry.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Dell KB216 wired office keyboard$ars_product_content$, $ars_product_content$Low-profile chiclet keys$ars_product_content$, $ars_product_content$Multimedia and volume control keys$ars_product_content$, $ars_product_content$Full-size layout with numeric keypad$ars_product_content$, $ars_product_content$USB plug-and-play connection$ars_product_content$, $ars_product_content$Durable keycaps for daily office use$ars_product_content$]::text[],
  compatibility = $ars_product_content$Connects to any available USB-A port. Basic typing and multimedia keys work without extra software on Windows; advanced keys may require Dell drivers.$ars_product_content$,
  box_contents = $ars_product_content$Keyboard and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$verified$ars_product_content$,
  spec_source = $ars_product_content$Dell KB216 product documentation. 104-key chiclet layout, multimedia keys and USB wired interface are manufacturer specifications.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wired office keyboard",
  "model_number": "Dell KB216",
  "key_layout": "Full-size 104-key layout",
  "switch_type": "Low-profile chiclet membrane",
  "keycaps": "Durable chiclet keycaps",
  "connection": "USB wired",
  "compatibility_os": "Windows; basic support on Linux and macOS",
  "keyboard": "Multimedia and volume control keys"
}$ars_product_content$::jsonb
WHERE slug = 'dell-kb216-wired-multimedia-keyboard';

UPDATE public.products SET
  description = $ars_product_content$The Dell KM3322W is a full-size wireless keyboard and mouse combo for clean, cable-free office desks. The keyboard uses quiet, low-profile keys with a numeric keypad, and the optical mouse connects through the same 2.4 GHz USB nano receiver. It is a practical choice for reception, accounts and general business workstations where reliability and simple setup matter more than gaming features.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Dell KM3322W wireless keyboard and mouse combo$ars_product_content$, $ars_product_content$Full-size keyboard with numeric keypad$ars_product_content$, $ars_product_content$Quiet low-profile keys$ars_product_content$, $ars_product_content$2.4 GHz wireless USB nano receiver$ars_product_content$, $ars_product_content$Optical mouse with ambidextrous shape$ars_product_content$, $ars_product_content$Plug-and-play setup$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with Windows PCs and laptops with an available USB-A port. No additional driver is normally required for basic keyboard and mouse functions. Confirm layout and battery requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Wireless keyboard, wireless mouse, USB nano receiver, batteries where supplied, and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$verified$ars_product_content$,
  spec_source = $ars_product_content$Dell KM3322W product documentation. Full-size wireless layout, 2.4 GHz receiver and optical mouse are manufacturer specifications.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wireless keyboard and mouse combo",
  "model_number": "Dell KM3322W",
  "key_layout": "Full-size with numeric keypad",
  "switch_type": "Low-profile membrane",
  "keycaps": "Durable low-profile keycaps",
  "connection": "2.4 GHz wireless via USB nano receiver",
  "dpi": "Optical mouse — DPI confirmed with sales",
  "buttons": "3-button optical mouse",
  "battery_life": "Long-life batteries — exact rating confirmed with sales",
  "compatibility_os": "Windows; device with USB-A port",
  "wireless_range": "Typical desktop wireless range — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'dell-km3322w-wireless-combo';

UPDATE public.products SET
  description = $ars_product_content$The Dell Latitude series is Dell's commercial business laptop family, built for office, field and administrative work. This listing covers the Latitude models stocked by ARS Computers; the exact processor, memory, storage and display configuration is confirmed against current stock before supply. Latitude systems are designed for daily business use, with a durable chassis, precision touchpad, anti-glare display options and Dell commercial manageability features.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Dell Latitude commercial business laptop family$ars_product_content$, $ars_product_content$Durable chassis intended for daily office and field use$ars_product_content$, $ars_product_content$Intel Core processor platform (exact generation confirmed per model)$ars_product_content$, $ars_product_content$Solid-state storage for fast boot and application loading$ars_product_content$, $ars_product_content$Anti-glare business display options$ars_product_content$, $ars_product_content$Dell commercial security and manageability features$ars_product_content$]::text[],
  compatibility = $ars_product_content$Runs standard Windows business software, Microsoft 365, accounting packages and browser-based ERP/CRM systems. Confirm dock, monitor and peripheral compatibility for the exact model with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Laptop unit, power adapter and power cable, and documentation. The exact accessory bundle is confirmed at the time of order.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Dell Latitude commercial series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "form_factor": "Business laptop (clamshell)",
  "processor": "Intel Core i5 class — exact model confirmed with sales",
  "processor_generation": "Configuration-dependent — confirm with sales",
  "ram": "16 GB — exact configuration confirmed with sales",
  "ram_type": "Configuration-dependent — confirm with sales",
  "storage": "512 GB SSD — exact configuration confirmed with sales",
  "storage_type": "SSD (interface confirmed per model)",
  "display": "Configuration-dependent — confirm screen size with sales",
  "resolution": "Configuration-dependent — confirm with sales",
  "panel_type": "Anti-glare business panel (model-dependent)",
  "keyboard": "Dell business keyboard with precision touchpad",
  "camera": "Integrated webcam (model-dependent)",
  "os": "Configuration-dependent — Windows options confirmed at order",
  "ports": "USB, HDMI and audio ports — exact set confirmed per model",
  "networking": "Wi-Fi and wired Ethernet options depend on model",
  "weight": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'dell-latitude-business-laptop';

UPDATE public.products SET
  description = $ars_product_content$The Dell MS116 is a simple, reliable wired optical mouse for everyday office work. Its symmetrical ambidextrous shape suits left- and right-handed users, and the 1000 DPI sensor provides smooth cursor control on standard desk surfaces. It is a common fleet mouse for offices, reception desks and computer labs because it needs no batteries or configuration.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Dell MS116 wired optical mouse$ars_product_content$, $ars_product_content$1000 DPI optical tracking$ars_product_content$, $ars_product_content$Symmetrical ambidextrous shape$ars_product_content$, $ars_product_content$Three-button layout with scroll wheel$ars_product_content$, $ars_product_content$USB plug-and-play connection$ars_product_content$, $ars_product_content$No batteries required$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with any computer that has a USB-A port; no driver installation is normally required.$ars_product_content$,
  box_contents = $ars_product_content$Mouse and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$verified$ars_product_content$,
  spec_source = $ars_product_content$Dell MS116 product documentation. 1000 DPI optical sensor, three-button layout and USB wired interface are manufacturer specifications.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wired optical mouse",
  "model_number": "Dell MS116",
  "dpi": "1000 DPI",
  "buttons": "3 buttons including scroll wheel",
  "connection": "USB wired",
  "compatibility_os": "Windows, macOS and Linux with USB-A port",
  "cable_length": "Approx. 1.8 m — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'dell-ms116-usb-optical-mouse';

UPDATE public.products SET
  description = $ars_product_content$The Dell Precision tower is an enterprise workstation for CAD, BIM, structural analysis, 3D rendering and other compute-heavy professional workloads. It offers professional graphics options, error-correcting or high-capacity memory configurations on supported models, and expandable storage and PCIe bays. This listing covers the Precision tower models supplied by ARS Computers; the exact processor, GPU, memory and ISV certification are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Dell Precision professional workstation tower$ars_product_content$, $ars_product_content$Built for CAD, BIM and 3D rendering$ars_product_content$, $ars_product_content$Professional graphics options$ars_product_content$, $ars_product_content$Enterprise expansion slots and drive bays$ars_product_content$, $ars_product_content$High-airflow front honeycomb mesh$ars_product_content$, $ars_product_content$Exact configuration and ISV certification confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Confirm the software certification requirements, GPU model, memory capacity and storage layout with ARS Computers before ordering. Workstation performance depends on matching the configuration to the application.$ars_product_content$,
  box_contents = $ars_product_content$Workstation tower, power cable and documentation. Monitor, keyboard and mouse are supplied separately unless included on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Dell Precision tower solution listing. Workstation-class expansion and airflow features are series-level; exact model and configuration are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "CAD/3D professional workstation tower",
  "processor": "Intel Xeon/Core options — confirm with sales",
  "ram": "ECC/non-ECC memory options — confirm with sales",
  "storage": "SSD/HDD combinations — confirm with sales",
  "gpu": "Professional NVIDIA/AMD GPU options — confirm with sales",
  "system_form_factor": "Full tower workstation",
  "expansion": "PCIe slots and drive bays model-dependent",
  "system_ports": "USB, audio and display ports model-dependent",
  "power_supply": "Model-dependent — sized for the selected GPU",
  "compatibility": "CAD/BIM/3D software; ISV certifications model-dependent"
}$ars_product_content$::jsonb
WHERE slug = 'dell-precision-cad-workstation-tower';

UPDATE public.products SET
  description = $ars_product_content$The Dell OptiPlex Small Form Factor desktop delivers enterprise computing in a compact chassis that can sit horizontally under a monitor or vertically beside a desk. It is intended for offices, billing counters and retail back-offices where desk space is limited. This listing covers the OptiPlex SFF models supplied by ARS Computers. Exact processor, memory, storage, ports and warranty are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Dell OptiPlex Small Form Factor desktop$ars_product_content$, $ars_product_content$Compact chassis with horizontal or vertical orientation$ars_product_content$, $ars_product_content$Full desktop-class business performance$ars_product_content$, $ars_product_content$Space-saving design for counters and offices$ars_product_content$, $ars_product_content$Enterprise manageability features$ars_product_content$, $ars_product_content$Exact configuration confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Suited to office productivity, billing, ERP/CRM and point-of-sale use. Confirm the exact model, monitor outputs, operating system and warranty with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Desktop unit, power adapter or power cable depending on model, stand where supplied, and documentation. Monitor, keyboard and mouse are supplied separately unless included on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Dell OptiPlex SFF series listing. Compact dual-orientation chassis is series-level; exact model and configuration are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Small Form Factor commercial desktop",
  "processor": "Configuration-dependent — confirm with sales",
  "ram": "Configuration-dependent — confirm with sales",
  "storage": "Configuration-dependent — confirm with sales",
  "gpu": "Integrated or low-profile discrete graphics depending on model",
  "system_form_factor": "Small Form Factor (SFF), horizontal or vertical",
  "expansion": "Low-profile PCIe slots and drive bays model-dependent",
  "system_ports": "USB, video and audio ports model-dependent",
  "networking": "Gigabit Ethernet; Wi-Fi on selected models",
  "power_supply": "External or internal PSU depending on model"
}$ars_product_content$::jsonb
WHERE slug = 'dell-sff-compact-workstation';

UPDATE public.products SET
  description = $ars_product_content$The Dell WM126 is a compact wireless optical mouse for office laptops and desktops. The 2.4 GHz receiver stores inside the mouse for travel, and the curved shape provides comfortable everyday control. It is a practical cable-free upgrade for reception, sales and administrative desks. One AA battery powers the mouse, and the exact battery life depends on usage.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Dell WM126 wireless optical mouse$ars_product_content$, $ars_product_content$2.4 GHz RF wireless connection$ars_product_content$, $ars_product_content$Integrated nano receiver storage$ars_product_content$, $ars_product_content$1000 DPI optical tracking$ars_product_content$, $ars_product_content$Compact curved shape for travel$ars_product_content$, $ars_product_content$Battery-powered operation$ars_product_content$]::text[],
  compatibility = $ars_product_content$Connects through the supplied USB nano receiver to a computer with a USB-A port. Confirm battery and receiver requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Wireless mouse, USB nano receiver, AA battery where supplied, and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$verified$ars_product_content$,
  spec_source = $ars_product_content$Dell WM126 product documentation. 1000 DPI optical sensor, 2.4 GHz wireless and internal receiver storage are manufacturer specifications.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wireless optical mouse",
  "model_number": "Dell WM126",
  "dpi": "1000 DPI",
  "buttons": "3 buttons including scroll wheel",
  "connection": "2.4 GHz wireless via USB nano receiver",
  "battery_life": "One AA battery — life depends on usage",
  "compatibility_os": "Windows, macOS and Linux with USB-A port",
  "wireless_range": "Typical desktop wireless range — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'dell-wm126-wireless-optical-mouse';

UPDATE public.products SET
  description = $ars_product_content$This 3-pin AC power cord connects desktop PCs, monitors, laser printers and UPS units to an Indian wall socket. It uses a moulded Indian 3-pin plug at one end and an IEC C13 socket at the other, with heavy-gauge copper conductors for reliable power delivery. Exact length and current rating are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$3-pin Indian plug to IEC C13 power cord$ars_product_content$, $ars_product_content$Heavy-gauge copper conductors$ars_product_content$, $ars_product_content$Moulded connectors for durability$ars_product_content$, $ars_product_content$Suitable for PCs, monitors, printers and UPS units$ars_product_content$, $ars_product_content$Reliable grounded connection$ars_product_content$, $ars_product_content$Exact length and current rating confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Fits devices with an IEC C13 power inlet and Indian 3-pin wall sockets. Confirm the device current draw and required cable length with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Power cord and documentation where supplied.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand IEC C13 power cord solution listing. Indian 3-pin plug and C13 socket are stated by the catalogue; exact length and current rating are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "AC power cord",
  "connector": "Indian 3-pin plug to IEC C13 female",
  "connector_type": "IEC 60320 C13",
  "length": "1.5 m / 2 m / 3 m options — confirm with sales",
  "gauge": "Heavy-gauge copper conductors",
  "power_rating": "6 A/10 A/16 A depending on variant — confirm with sales",
  "compatibility": "Desktop PCs, monitors, laser printers and UPS units with IEC C13 inlet"
}$ars_product_content$::jsonb
WHERE slug = 'desktop-pc-monitor-3-pin-power-cord';

UPDATE public.products SET
  description = $ars_product_content$This DisplayPort 1.4 monitor cable is designed for high-refresh gaming monitors and CAD workstations that need more bandwidth than HDMI 2.0. Latching connectors help prevent accidental disconnection, and the cable supports 8K and high-refresh 4K modes on compatible hardware. Exact length, certification and DSC support are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$DisplayPort 1.4 monitor cable$ars_product_content$, $ars_product_content$Latching DP connectors$ars_product_content$, $ars_product_content$8K and high-refresh 4K support on compatible hardware$ars_product_content$, $ars_product_content$Suitable for gaming monitors and CAD displays$ars_product_content$, $ars_product_content$Shielded construction$ars_product_content$, $ars_product_content$Exact length and certification confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Requires DisplayPort outputs on both the graphics card and monitor. Confirm the monitor refresh rate, DSC support and required cable length with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$DisplayPort cable and documentation where supplied.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand DisplayPort 1.4 cable solution listing. Latching connectors and 1.4 bandwidth are stated by the catalogue; exact length and certification are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "DisplayPort monitor cable",
  "connector": "DisplayPort male to male",
  "connector_type": "DisplayPort 1.4 with mechanical latch",
  "length": "1 m / 2 m / 3 m options — confirm with sales",
  "bandwidth": "32.4 Gbps DisplayPort 1.4 class",
  "resolution_support": "8K and high-refresh 4K with DSC on compatible hardware",
  "shielding": "Shielded cable construction",
  "compatibility": "Monitors, graphics cards and docks with DisplayPort"
}$ars_product_content$::jsonb
WHERE slug = 'displayport-1-4-monitor-cable';

UPDATE public.products SET
  description = $ars_product_content$This networking range covers dual-band Wi-Fi 6 routers and PoE gigabit switches for offices, shops and small campuses. Wi-Fi 6 improves efficiency in dense device environments, while PoE switches carry both data and power to access points and IP cameras over a single Ethernet cable. Because the listing covers several router and switch classes, port count, PoE budget, wireless speed and mesh support are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Dual-band Wi-Fi 6 router options$ars_product_content$, $ars_product_content$PoE gigabit switch options for cameras and access points$ars_product_content$, $ars_product_content$High-gain multi-antenna wireless design$ars_product_content$, $ars_product_content$Mesh-capable coverage on supported models$ars_product_content$, $ars_product_content$Gigabit wired backbone$ars_product_content$, $ars_product_content$Exact model and PoE budget confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Confirm broadband speed, building layout, number of PoE devices and whether mesh coverage is required. ARS Computers can specify the router/switch combination and check PoE budget against cameras or access points.$ars_product_content$,
  box_contents = $ars_product_content$Router or switch unit, power adapter, antennas where removable, and documentation. Ethernet cables and mounting hardware are supplied only where included by the selected model.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand Wi-Fi 6 and PoE switch solution listing. Wireless standard and PoE capability are series-level; exact model, port count and PoE budget are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wi-Fi 6 router and PoE gigabit switch",
  "network_type": "Dual-band wireless and wired Gigabit Ethernet",
  "wifi_standard": "Wi-Fi 6 (802.11ax) on supported routers",
  "networking_speed": "Gigabit wired; AX wireless speeds model-dependent",
  "networking_ports": "Gigabit Ethernet; port count confirmed per model",
  "poe": "PoE/PoE+ on supported switch models — budget confirmed with sales",
  "coverage": "Configuration-dependent — confirm with sales",
  "power": "External adapter or internal PSU depending on model",
  "dimensions": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'dual-band-wifi-6-routers-poe-gigabit-switches';

UPDATE public.products SET
  description = $ars_product_content$This access-control package supplies the locking and exit hardware around a biometric or RFID door terminal. Electromagnetic locks hold the door closed until the controller releases them, while brackets, exit buttons and break-glass units complete the installation. The listing covers 600 lb and 1200 lb lock options and compatible accessories supplied by ARS Computers. Holding force, door type, power and controller compatibility are confirmed before installation.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Electromagnetic door lock and access-control hardware$ars_product_content$, $ars_product_content$Compatible with biometric and RFID terminals$ars_product_content$, $ars_product_content$600 lb and 1200 lb holding-force options$ars_product_content$, $ars_product_content$L/Z mounting brackets and exit devices available$ars_product_content$, $ars_product_content$Emergency break-glass option for safe exit$ars_product_content$, $ars_product_content$Exact lock and controller configuration confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Must be matched to the door material, frame type and access controller. Confirm holding force, voltage, bracket type and whether a break-glass exit is required with ARS Computers before installation.$ars_product_content$,
  box_contents = $ars_product_content$Lock unit and selected mounting hardware. Exit button, break-glass unit, power supply and controller are included only if specified on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand door access solution listing. Exact lock model, holding force and accessory bundle are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "device_type": "Electromagnetic lock and access-control kit",
  "model_number": "Door access series — exact lock model confirmed with sales",
  "auth_methods": "Works with biometric, RFID or keypad terminals (terminal supplied separately)",
  "holding_force": "600 lb or 1200 lb options — confirm with sales",
  "fail_safe": "Fail-safe release on power loss on supported locks",
  "bracket": "L/Z mounting brackets available",
  "exit_device": "Exit button and break-glass options available",
  "door_type": "Wood, metal and glass doors with the correct bracket",
  "power": "12/24 V DC, controller-dependent",
  "access_control": "Relay control from compatible access terminal",
  "installation": "Professional installation recommended"
}$ars_product_content$::jsonb
WHERE slug = 'electromagnetic-door-access-controllers';

UPDATE public.products SET
  description = $ars_product_content$The enterprise matte all-in-one is a commercial desktop for high-uptime office workstations, billing desks and administrative counters. The matte, wide-viewing-angle display reduces reflections in brightly lit offices, while integrated stereo speakers and a single-chassis design keep the desk free of separate tower and speaker clutter. This is a multi-brand solution listing, so the exact model and internal configuration are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Matte, wide-viewing-angle commercial display$ars_product_content$, $ars_product_content$Integrated stereo speakers$ars_product_content$, $ars_product_content$Single-chassis design reduces cable clutter$ars_product_content$, $ars_product_content$Built for billing desks and administrative counters$ars_product_content$, $ars_product_content$Space-saving all-in-one form factor$ars_product_content$, $ars_product_content$Exact model and configuration confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Suitable for billing, data entry, office productivity and customer-facing counters. Confirm the exact model, display size and peripheral bundle with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$All-in-One unit, stand, power adapter and power cable, and documentation. Keyboard and mouse included only if specified on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand all-in-one solution listing. Exact model, panel specification and configuration are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "form_factor": "All-in-One commercial desktop",
  "processor": "Configuration-dependent — confirm with sales",
  "ram": "Configuration-dependent — confirm with sales",
  "storage": "Configuration-dependent — confirm with sales",
  "storage_type": "SSD/HDD options depending on model",
  "display": "Matte commercial display — size confirmed with sales",
  "resolution": "Configuration-dependent — confirm with sales",
  "panel_type": "Matte wide-viewing-angle panel",
  "audio": "Integrated stereo speakers",
  "os": "Configuration-dependent — Windows options confirmed at order",
  "ports": "USB, video and audio ports — exact set confirmed per model",
  "networking": "Wi-Fi and Ethernet options depend on model",
  "peripherals": "Keyboard and mouse bundle confirmed at order"
}$ars_product_content$::jsonb
WHERE slug = 'enterprise-matte-all-in-one-pc';

UPDATE public.products SET
  description = $ars_product_content$Epson EcoTank printers are refillable ink-tank multifunction devices intended for low-cost, high-volume home and office printing. Instead of small cartridges, the printer uses front-facing reservoirs that are topped up from ink bottles. This listing covers the EcoTank models supplied by ARS Computers, with print, scan and copy functions and Wi-Fi options. Exact model, print speed, paper capacity and display size are confirmed against the selected unit.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Epson EcoTank refillable ink-tank system$ars_product_content$, $ars_product_content$Print, scan and copy functions$ars_product_content$, $ars_product_content$Front-facing spill-resistant ink reservoirs$ars_product_content$, $ars_product_content$Low cost per page for high-volume printing$ars_product_content$, $ars_product_content$Wi-Fi and Wi-Fi Direct options$ars_product_content$, $ars_product_content$Exact model and configuration confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with Epson ink bottles and standard office paper. Confirm the exact model, ink bottle codes, duplex support and network requirements with ARS Computers sales before ordering consumables.$ars_product_content$,
  box_contents = $ars_product_content$Printer unit, power cable, setup ink bottles, and documentation. USB cable and additional paper are supplied only where included by the selected model.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Epson EcoTank series listing. Refillable tank and multifunction features are series-level; exact model, speeds, capacities and connectivity are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "printer_type": "Ink tank multifunction printer",
  "model_number": "Epson EcoTank series — exact model confirmed with sales",
  "technology": "Micro Piezo inkjet",
  "print_resolution": "Configuration-dependent — confirm with sales",
  "print_speed": "Configuration-dependent — confirm with sales",
  "functions": "Print, scan, copy",
  "scanner": "Flatbed colour scanner",
  "copier": "Colour and monochrome copying",
  "paper_size": "A4, A5 and photo sizes on supported models",
  "input_capacity": "Configuration-dependent — confirm with sales",
  "duplex": "Automatic duplex on supported models",
  "connectivity": "Wi-Fi, Wi-Fi Direct and USB; Ethernet on selected models",
  "mobile_printing": "Epson Smart Panel and Wi-Fi Direct on supported models",
  "ink": "Refillable EcoTank ink reservoirs",
  "os_support": "Windows, macOS and mobile printing — confirm per model"
}$ars_product_content$::jsonb
WHERE slug = 'epson-ecotank-ink-tank-printer';

UPDATE public.products SET
  description = $ars_product_content$This ergonomic commercial wired mouse has a full palm-resting arch and low-friction glide skates for comfortable extended use. It is intended for office, billing and data-entry desks where users spend most of the day at the computer. Wired USB operation avoids batteries and charging downtime. Exact model, DPI and cable length are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Ergonomic commercial wired optical mouse$ars_product_content$, $ars_product_content$Full palm-resting arch$ars_product_content$, $ars_product_content$Low-friction glide skates$ars_product_content$, $ars_product_content$USB wired connection$ars_product_content$, $ars_product_content$No batteries or charging required$ars_product_content$, $ars_product_content$Exact model and DPI confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with computers that have a USB-A port. Confirm the exact model, hand orientation and cable length with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Mouse and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand ergonomic wired mouse solution listing. Palm support and low-friction skates are stated by the catalogue; exact model and DPI are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wired ergonomic optical mouse",
  "model_number": "Ergonomic wired series — exact model confirmed with sales",
  "dpi": "Optical tracking — DPI confirmed with sales",
  "buttons": "3-button layout with scroll wheel",
  "connection": "USB wired",
  "compatibility_os": "Windows, macOS and Linux with USB-A port",
  "cable_length": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'ergonomic-commercial-wired-mouse';

UPDATE public.products SET
  description = $ars_product_content$This ergonomic full-size wireless combo is a multi-brand bundle for comfortable everyday typing and cursor control. The keyboard includes a numeric keypad and an adjustable typing angle, while the optical mouse is shaped for extended desk sessions. It is intended for accounts, data entry and general office work. Exact model, key mechanism, DPI and battery life are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Ergonomic full-size wireless keyboard and mouse set$ars_product_content$, $ars_product_content$Numeric keypad for data entry$ars_product_content$, $ars_product_content$Comfort-focused keyboard angle$ars_product_content$, $ars_product_content$Wireless optical mouse$ars_product_content$, $ars_product_content$Plug-and-play USB nano receiver$ars_product_content$, $ars_product_content$Exact model and battery life confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with desktop PCs and laptops that have a USB-A port. Confirm the exact keyboard layout, wrist-rest design and battery requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Wireless keyboard, wireless mouse, USB receiver, batteries where supplied, and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand ergonomic wireless combo solution listing. Full-size layout and ergonomic focus are stated by the catalogue; exact model and battery life are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wireless keyboard and mouse combo",
  "model_number": "Ergonomic wireless combo — exact model confirmed with sales",
  "key_layout": "Full-size with numeric keypad",
  "switch_type": "Membrane",
  "connection": "2.4 GHz wireless via USB nano receiver",
  "dpi": "Optical mouse — DPI confirmed with sales",
  "buttons": "3-button optical mouse",
  "battery_life": "Configuration-dependent — confirm with sales",
  "compatibility_os": "Windows and macOS with USB-A port"
}$ars_product_content$::jsonb
WHERE slug = 'ergonomic-full-size-wireless-combo';

UPDATE public.products SET
  description = $ars_product_content$The eSSL RFID card and keypad terminal is an attendance and access device for offices, factories and sites that use proximity cards or PIN entry. Staff present a card or enter a PIN at the tactile keypad, and the terminal logs the event for attendance and payroll export. This listing covers the eSSL RFID/keypad models supplied by ARS Computers. Card frequency, user capacity, connectivity and software version are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$eSSL RFID card and keypad attendance terminal$ars_product_content$, $ars_product_content$Proximity card reader plus 16-key tactile keypad$ars_product_content$, $ars_product_content$Dual-factor card and PIN authentication option$ars_product_content$, $ars_product_content$Attendance logging and payroll export$ars_product_content$, $ars_product_content$Network or USB connectivity depending on model$ars_product_content$, $ars_product_content$Exact model and card frequency confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Must use compatible RFID cards at the correct frequency. Confirm the exact model, card type, connectivity and eSSL software licence with ARS Computers sales before deployment.$ars_product_content$,
  box_contents = $ars_product_content$Terminal unit, power adapter where supplied, mounting hardware and documentation. RFID cards and software licence are supplied separately unless included on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$eSSL RFID and keypad series listing. Card/keypad authentication and attendance export are series-level; exact model, capacity and card frequency are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "device_type": "RFID and keypad attendance terminal",
  "model_number": "eSSL RFID and keypad series — exact model confirmed with sales",
  "auth_methods": "RFID card and PIN keypad",
  "sensor_type": "Proximity card reader",
  "user_capacity": "Configuration-dependent — confirm with sales",
  "card_capacity": "Configuration-dependent — confirm with sales",
  "log_capacity": "Configuration-dependent — confirm with sales",
  "display_type": "LCD display (model-dependent)",
  "connectivity": "TCP/IP, USB or RS485 depending on model",
  "access_control": "Door relay output on supported models",
  "software": "eSSL attendance and payroll software — version confirmed with sales",
  "reporting": "Attendance reports and payroll export via eSSL software",
  "power": "12 V DC adapter",
  "operating_temperature": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'essl-rfid-card-keypad-terminal';

UPDATE public.products SET
  description = $ars_product_content$This heavy-duty VGA cable connects older monitors, projectors and displays to a computer using a 15-pin D-Sub analog connection. Dual ferrite cores suppress high-frequency noise that can cause flicker or ghosting, and gold-plated pins improve contact reliability. It is useful for legacy office displays, projectors and KVM setups.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Heavy-duty 15-pin VGA display cable$ars_product_content$, $ars_product_content$Dual ferrite noise choke cores$ars_product_content$, $ars_product_content$Gold-plated D-Sub pins$ars_product_content$, $ars_product_content$Screw-lock connectors$ars_product_content$, $ars_product_content$Suitable for legacy monitors and projectors$ars_product_content$, $ars_product_content$Exact length confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Requires VGA ports on both source and display. For modern digital displays, an HDMI or DisplayPort connection is preferable. Confirm the required length and resolution with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$VGA cable and documentation where supplied.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand VGA cable solution listing. Dual ferrite cores and gold-plated pins are stated by the catalogue; exact length and resolution support are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "VGA analog display cable",
  "connector": "15-pin D-Sub male to male",
  "connector_type": "VGA (DE-15)",
  "length": "1.5 m / 3 m / 5 m options — confirm with sales",
  "resolution_support": "Up to 1080p depending on source and cable length",
  "shielding": "Dual ferrite cores and shielded conductors",
  "compatibility": "Computers, monitors, projectors and KVMs with VGA ports"
}$ars_product_content$::jsonb
WHERE slug = 'heavy-duty-15-pin-vga-cable';

UPDATE public.products SET
  description = $ars_product_content$These BNC compression connectors terminate RG59-style coaxial cable for CCTV video connections. A gold-plated centre pin supports clean signal transfer, and the metallic locking collar secures the connector to the camera or DVR. Compression fittings require the correct crimp tool for reliable installation. Exact pack quantity and cable compatibility are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Heavy-duty BNC compression connectors$ars_product_content$, $ars_product_content$Gold-plated centre pin$ars_product_content$, $ars_product_content$Metallic locking collar$ars_product_content$, $ars_product_content$For RG59/coaxial CCTV cable$ars_product_content$, $ars_product_content$Corrosion-resistant construction$ars_product_content$, $ars_product_content$Exact pack quantity confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Use with the correct coaxial cable diameter and a matching compression crimp tool. Confirm the cable type, pack quantity and tool requirement with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$BNC compression connectors in the selected pack quantity.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand BNC compression connector solution listing. Gold-plated pin and RG59 compatibility are stated by the catalogue; exact pack quantity and cable match are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "BNC compression video connectors",
  "connector": "BNC male compression",
  "connector_type": "BNC",
  "compatibility": "RG59 and compatible coaxial CCTV cable",
  "shielding": "Metallic body with compression fitting",
  "power_rating": "Video signal only",
  "length": "Connector body — cable length depends on installation"
}$ars_product_content$::jsonb
WHERE slug = 'heavy-duty-bnc-compression-video-connectors';

UPDATE public.products SET
  description = $ars_product_content$Thermal interface compound fills microscopic gaps between a CPU or GPU and its heatsink, improving heat transfer and stabilising operating temperatures. This high-performance paste is non-electrically conductive, so excess material is less likely to cause a short circuit if it contacts nearby components. The listing covers thermal compound syringes supplied by ARS Computers; the exact brand, quantity and thermal conductivity are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$High-performance thermal interface compound$ars_product_content$, $ars_product_content$Non-electrically conductive formula$ars_product_content$, $ars_product_content$Improves heat transfer from CPU/GPU to heatsink$ars_product_content$, $ars_product_content$Suitable for desktop and laptop repasting$ars_product_content$, $ars_product_content$Syringe applicator$ars_product_content$, $ars_product_content$Exact brand and quantity confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Suitable for desktop and laptop CPU/GPU heatsinks, graphics-card cold plates and console repairs. Clean old paste and confirm the correct application method before use. ARS Computers can advise on quantity and application.$ars_product_content$,
  box_contents = $ars_product_content$Thermal compound syringe and applicator where supplied. Cleaning wipes and spreader are included only if specified by the selected pack.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand thermal compound solution listing. Non-conductive formulation is stated by the catalogue; exact brand, quantity and conductivity are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Thermal interface compound",
  "capacity": "Syringe quantity model-dependent — confirm with sales",
  "thermal_conductivity": "High-performance class — exact rating confirmed with sales",
  "compatibility": "CPU/GPU heatsinks and cold plates; non-electrically conductive",
  "operating_temperature": "Configuration-dependent — confirm with sales",
  "application": "Apply a thin, even layer to the processor heat spreader"
}$ars_product_content$::jsonb
WHERE slug = 'high-performance-thermal-paste-compound';

UPDATE public.products SET
  description = $ars_product_content$PCIe Gen4 NVMe M.2 drives deliver much higher sequential throughput than SATA SSDs, making them suitable for large project files, video editing, virtual machines and fast Windows boots. This listing also covers high-speed portable USB-C external drives for moving large files between machines. Because capacities, controllers and enclosure types vary, the exact drive, read/write speed and endurance are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$PCIe Gen4 x4 NVMe M.2 internal SSDs$ars_product_content$, $ars_product_content$Portable USB-C external drive options$ars_product_content$, $ars_product_content$Sequential read speeds up to 7,400 MB/s on Gen4 class drives$ars_product_content$, $ars_product_content$Capacities from 500 GB to 4 TB depending on model$ars_product_content$, $ars_product_content$Suitable for video editing, large datasets and fast boot$ars_product_content$, $ars_product_content$Exact model, capacity and endurance confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Confirm the motherboard M.2 slot key, PCIe generation and available length before buying an internal drive. For external drives, confirm the host device supports USB-C or the required USB standard. ARS Computers can check compatibility with your system.$ars_product_content$,
  box_contents = $ars_product_content$Drive unit and documentation. Mounting screws, heatsink or USB cable are included only where supplied by the selected retail pack.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand NVMe/portable SSD solution listing. Gen4 speed class is stated by the catalogue; exact model, capacity and endurance are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "NVMe M.2 SSD and portable external SSD",
  "drive_form_factor": "M.2 2280 internal / portable USB-C external — confirm variant",
  "capacity": "500 GB to 4 TB options — confirm with sales",
  "memory_type": "3D NAND flash (model-dependent)",
  "interface": "PCIe Gen4 x4 (internal) / USB-C (external)",
  "storage_speed": "Up to 7,400 MB/s sequential read on Gen4 class drives",
  "endurance": "Capacity-dependent — confirm TBW with sales",
  "compatibility": "M.2 PCIe Gen4/Gen3 slots; USB-C devices for external drives",
  "operating_temperature": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'high-speed-nvme-m2-ssds-external-drives';

UPDATE public.products SET
  description = $ars_product_content$The Hikvision ColorVu 4K bullet camera is designed for outdoor surveillance where colour detail matters at night. It combines 4K imaging with an F1.0 large-aperture lens and supplemental warm light to produce full-colour images in very low light. The bullet housing and bracket suit boundary walls, gates, driveways and commercial exteriors. Exact model number, lens, IR/warm-light range and recorder compatibility are confirmed before installation.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Hikvision ColorVu 4K outdoor bullet camera$ars_product_content$, $ars_product_content$24/7 full-colour imaging in low light$ars_product_content$, $ars_product_content$F1.0 super-aperture lens$ars_product_content$, $ars_product_content$Supplemental warm light for night colour$ars_product_content$, $ars_product_content$Weatherproof outdoor housing$ars_product_content$, $ars_product_content$Exact model and recorder compatibility confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Requires a recorder and power source matched to the exact ColorVu model. Confirm whether the selected unit is HD analog or IP, and check PoE availability, cable type and NVR channel capacity with ARS Computers.$ars_product_content$,
  box_contents = $ars_product_content$Camera unit, mounting hardware and documentation. Power supply, cable and recorder are supplied separately unless included on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Hikvision ColorVu 4K series listing. 4K resolution and F1.0 aperture are series-level; exact model number, lens and warm-light range must be confirmed with ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "camera_type": "Outdoor bullet camera",
  "model_number": "Hikvision ColorVu 4K series — exact model confirmed with sales",
  "resolution": "8 MP 4K on the listed series",
  "sensor": "High-sensitivity CMOS sensor (model-dependent)",
  "lens": "F1.0 large-aperture lens (focal length confirmed per model)",
  "viewing_angle": "Configuration-dependent — confirm with sales",
  "night_vision": "Full-colour night imaging with warm-light supplement",
  "full_color": "24/7 colour imaging on supported ColorVu models",
  "ir_range": "Warm-light range confirmed per model",
  "environment": "Outdoor wall or pole mount",
  "weather_rating": "Weatherproof housing — IP rating confirmed per model",
  "connectivity": "HD analog or IP depending on model — confirm with sales",
  "power": "12 V DC or PoE depending on model — confirm with sales",
  "storage_compatibility": "DVR/NVR storage — confirm recorder model",
  "operating_temperature": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'hikvision-colorvu-4k-bullet-camera';

UPDATE public.products SET
  description = $ars_product_content$The Hikvision Full HD dome camera is an indoor ceiling-mount surveillance camera for offices, retail floors, corridors and reception areas. The dome housing protects the lens and gives a low-profile ceiling appearance, while infrared LEDs support low-light monitoring. This listing covers the Hikvision Full HD dome models supplied by ARS Computers; the exact resolution, lens, IR range and recorder compatibility are confirmed against the selected model before installation.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Hikvision indoor ceiling-mount dome camera$ars_product_content$, $ars_product_content$Full HD resolution on the listed series$ars_product_content$, $ars_product_content$Infrared night vision LEDs$ars_product_content$, $ars_product_content$Wide-angle lens options$ars_product_content$, $ars_product_content$Low-profile dome housing for offices and retail$ars_product_content$, $ars_product_content$Exact model and recorder compatibility confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Matches Hikvision DVR/NVR recorders and standard CCTV power supplies, subject to the exact camera model. Confirm the recorder channel type (analog or IP), power method and cable run with ARS Computers before installation.$ars_product_content$,
  box_contents = $ars_product_content$Camera unit, mounting hardware and documentation. Power supply, cable and recorder are supplied separately unless included on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Hikvision Full HD dome series listing. Resolution class and infrared feature are series-level; exact model number, lens and IR range must be confirmed with ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "camera_type": "Indoor dome camera",
  "model_number": "Hikvision Full HD Dome series — exact model confirmed with sales",
  "resolution": "2 MP Full HD (1920 x 1080) on the listed series",
  "sensor": "High-sensitivity CMOS sensor (model-dependent)",
  "lens": "Fixed wide-angle lens (focal length confirmed per model)",
  "viewing_angle": "Configuration-dependent — confirm with sales",
  "night_vision": "Infrared LEDs for low-light monitoring",
  "ir_range": "Configuration-dependent — confirm with sales",
  "environment": "Indoor ceiling mount",
  "connectivity": "HD analog or IP depending on model — confirm with sales",
  "power": "12 V DC or PoE depending on model — confirm with sales",
  "storage_compatibility": "DVR/NVR storage — confirm recorder model",
  "operating_temperature": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'hikvision-full-hd-dome-camera';

UPDATE public.products SET
  description = $ars_product_content$The Hikvision MinMoe face recognition terminal provides touchless attendance and door access using AI face verification. A dual-lens camera helps reject photo and video spoofing, and the colour touchscreen gives clear on-device feedback. It is suited to offices, factories, schools and controlled entry points. This listing covers the MinMoe models supplied by ARS Computers; user capacity, firmware features, card support and software integration are confirmed per model.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Hikvision MinMoe AI face recognition terminal$ars_product_content$, $ars_product_content$Dual-lens camera with anti-spoofing protection$ars_product_content$, $ars_product_content$Touchscreen colour display$ars_product_content$, $ars_product_content$Touchless attendance and door access$ars_product_content$, $ars_product_content$Network synchronisation and relay output$ars_product_content$, $ars_product_content$Exact model and capacity confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Integrates with Hikvision access-control and attendance software and compatible door locks. Confirm the exact model, card technology, relay/Wiegand requirements and software licence with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Terminal unit, mounting bracket, power adapter where supplied, and documentation. Door lock, controller and network cabling are supplied separately unless included on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Hikvision MinMoe series listing. Dual-lens anti-spoofing, touchscreen and face recognition are series-level; exact model, capacity and firmware features are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "device_type": "AI face recognition access and attendance terminal",
  "model_number": "Hikvision MinMoe series — exact model confirmed with sales",
  "auth_methods": "Face recognition; card support on selected models",
  "sensor_type": "Dual-lens camera with anti-spoofing",
  "recognition_speed": "Sub-second class verification — exact rating confirmed with sales",
  "anti_spoofing": "Dual-lens liveness detection",
  "user_capacity": "Configuration-dependent — confirm with sales",
  "face_capacity": "Configuration-dependent — confirm with sales",
  "card_capacity": "Configuration-dependent — confirm with sales",
  "log_capacity": "Configuration-dependent — confirm with sales",
  "display_type": "Colour touchscreen",
  "connectivity": "TCP/IP; Wi-Fi on selected models",
  "access_control": "Door relay and Wiegand interface on supported models",
  "software": "Hikvision attendance/access software — version confirmed with sales",
  "power": "12 V DC or PoE depending on model"
}$ars_product_content$::jsonb
WHERE slug = 'hikvision-minmoe-face-terminal';

UPDATE public.products SET
  description = $ars_product_content$This Hikvision wall-mount face and attendance terminal is designed for entrance walls, reception areas and staff rooms where a fixed, angled viewing position is needed. It supports AI face verification, mask detection and voice prompts on supported models, and can synchronise attendance over TCP/IP. The wall bracket keeps the camera at a consistent height for reliable recognition. Exact model, capacity and access-control features are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Hikvision wall-mount AI face and attendance terminal$ars_product_content$, $ars_product_content$Wall bracket for fixed entrance mounting$ars_product_content$, $ars_product_content$Mask detection and voice prompts on supported models$ars_product_content$, $ars_product_content$Touchless face verification$ars_product_content$, $ars_product_content$TCP/IP attendance synchronisation$ars_product_content$, $ars_product_content$Exact model and capacity confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Integrates with Hikvision attendance/access software and compatible door hardware. Confirm the exact model, mask-detection firmware, relay/Wiegand requirements and mounting height with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Terminal unit, wall-mount bracket, mounting screws, power adapter where supplied, and documentation. Door lock and controller are supplied separately unless included on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Hikvision wall-mount face terminal listing. Wall mounting, mask detection and voice prompt features are series-level; exact model, capacity and firmware are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "device_type": "Wall-mount face recognition attendance terminal",
  "model_number": "Hikvision wall-mount series — exact model confirmed with sales",
  "auth_methods": "Face recognition; card support on selected models",
  "sensor_type": "Dual-lens camera with anti-spoofing on supported models",
  "recognition_speed": "Sub-second class verification — exact rating confirmed with sales",
  "anti_spoofing": "Liveness detection on supported models",
  "user_capacity": "Configuration-dependent — confirm with sales",
  "face_capacity": "Configuration-dependent — confirm with sales",
  "log_capacity": "Configuration-dependent — confirm with sales",
  "display_type": "Colour display (model-dependent)",
  "connectivity": "TCP/IP; Wi-Fi on selected models",
  "access_control": "Door relay and Wiegand interface on supported models",
  "software": "Hikvision attendance/access software — version confirmed with sales",
  "installation": "Wall-mount bracket included",
  "power": "12 V DC or PoE depending on model"
}$ars_product_content$::jsonb
WHERE slug = 'hikvision-wall-mount-face-terminal';

UPDATE public.products SET
  description = $ars_product_content$The HP 230 is a slim wireless keyboard and mouse combo with low-profile chiclet keys and a compact ambidextrous mouse. It is designed for quiet, tidy office desks where a numeric keypad is still useful. The 2.4 GHz wireless link connects through a small USB receiver. This listing covers the HP 230 combo supplied by ARS Computers; battery type, mouse DPI and regional layout are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$HP 230 slim wireless keyboard and mouse combo$ars_product_content$, $ars_product_content$Low-profile chiclet key architecture$ars_product_content$, $ars_product_content$Quiet typing for shared offices$ars_product_content$, $ars_product_content$Ambidextrous optical mouse$ars_product_content$, $ars_product_content$2.4 GHz wireless USB receiver$ars_product_content$, $ars_product_content$Full-size layout with numeric keypad$ars_product_content$]::text[],
  compatibility = $ars_product_content$Connects to a USB-A port on Windows or macOS systems. Confirm the keyboard layout, battery type and exact mouse specification with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Wireless keyboard, wireless mouse, USB receiver, batteries where supplied, and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$HP 230 wireless combo product listing. Chiclet keys, ambidextrous mouse and 2.4 GHz wireless are manufacturer-level; exact battery and DPI details are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wireless keyboard and mouse combo",
  "model_number": "HP 230 Wireless Combo",
  "key_layout": "Full-size with numeric keypad",
  "switch_type": "Low-profile chiclet membrane",
  "connection": "2.4 GHz wireless via USB receiver",
  "dpi": "Optical mouse — DPI confirmed with sales",
  "buttons": "3-button ambidextrous mouse",
  "battery_life": "Configuration-dependent — confirm with sales",
  "compatibility_os": "Windows and macOS with USB-A port",
  "wireless_range": "Typical desktop wireless range — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'hp-230-wireless-keyboard-combo';

UPDATE public.products SET
  description = $ars_product_content$The HP Color LaserJet Enterprise MFP is a departmental colour laser device for businesses that need secure, high-quality colour printing, scanning and copying on a shared network. Enterprise models typically add secure print release, usage reporting and fleet-management features. This listing covers the HP Color LaserJet Enterprise models supplied by ARS Computers; exact model, speed, paper capacity, finishing options and toner codes are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$HP Color LaserJet Enterprise departmental MFP$ars_product_content$, $ars_product_content$High-resolution colour printing$ars_product_content$, $ars_product_content$Print, copy and scan on a shared network$ars_product_content$, $ars_product_content$Enterprise security and print-management features$ars_product_content$, $ars_product_content$High-capacity paper handling on supported models$ars_product_content$, $ars_product_content$Exact model and toner codes confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Designed for managed enterprise networks and shared departmental use. Confirm the exact model, secure-print requirements, finishing options and toner codes with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$MFP unit, starter toner cartridges, power cable and documentation. Optional finishers, cabinets and extra trays are supplied only if specified on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$HP Color LaserJet Enterprise series listing. Enterprise colour laser and MFP features are series-level; exact model, speed and toner codes are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "printer_type": "Enterprise colour laser multifunction printer",
  "model_number": "HP Color LaserJet Enterprise — exact model confirmed with sales",
  "technology": "Colour laser",
  "print_resolution": "Configuration-dependent — confirm with sales",
  "print_speed": "Configuration-dependent — confirm with sales",
  "duty_cycle": "Departmental class — exact rating confirmed with sales",
  "duplex": "Automatic duplex on supported models",
  "paper_size": "A4, A5, Letter and legal sizes; A3 on selected models",
  "input_capacity": "High-capacity trays — exact capacity confirmed with sales",
  "functions": "Print, copy, scan; fax on selected models",
  "scanner": "Flatbed colour scanner with ADF on supported models",
  "connectivity": "Ethernet, USB and Wi-Fi depending on model",
  "toner": "HP Colour LaserJet toner cartridges — codes confirmed per model",
  "os_support": "Windows, macOS and Linux drivers on supported models"
}$ars_product_content$::jsonb
WHERE slug = 'hp-color-laserjet-enterprise-mfp';

UPDATE public.products SET
  description = $ars_product_content$The HP EliteBook range is HP's premium corporate laptop family, aimed at executives, managers and professionals who need a durable, security-focused notebook. This listing represents the EliteBook models supplied by ARS Computers. The aluminium chassis, business-class keyboard and multi-port connectivity are designed for office docking, travel and collaborative work. The exact model and internal configuration are confirmed before dispatch.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$HP EliteBook premium corporate laptop family$ars_product_content$, $ars_product_content$Precision aluminium chassis for business durability$ars_product_content$, $ars_product_content$Business-class keyboard and precision touchpad$ars_product_content$, $ars_product_content$Multi-port connectivity for docks and peripherals$ars_product_content$, $ars_product_content$HP commercial security and manageability features$ars_product_content$, $ars_product_content$Exact model and configuration confirmed per unit$ars_product_content$]::text[],
  compatibility = $ars_product_content$Designed for corporate productivity suites, video conferencing, docking stations and managed IT environments. Confirm the exact model, dock and security requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$HP EliteBook commercial series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "form_factor": "Premium corporate laptop (clamshell)",
  "processor": "Configuration-dependent — confirm with sales",
  "processor_generation": "Configuration-dependent — confirm with sales",
  "ram": "Configuration-dependent — confirm with sales",
  "storage": "Configuration-dependent — confirm with sales",
  "storage_type": "SSD (model-dependent)",
  "display": "Configuration-dependent — confirm screen size with sales",
  "resolution": "Configuration-dependent — confirm with sales",
  "panel_type": "Anti-glare or touch panel depending on model",
  "keyboard": "HP business keyboard with precision touchpad",
  "camera": "Integrated webcam (model-dependent)",
  "os": "Configuration-dependent — Windows options confirmed at order",
  "ports": "USB-C, USB-A, HDMI and audio ports — exact set confirmed per model",
  "networking": "Wi-Fi and Ethernet options depend on model",
  "weight": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'hp-elitebook-corporate-laptop';

UPDATE public.products SET
  description = $ars_product_content$The HP gaming optical mouse is a wired mouse with an adjustable DPI sensor, textured side grips and durable microswitches for gaming and precision editing. Its ergonomic shape supports palm or claw grip during longer sessions. This listing covers the HP gaming mouse models supplied by ARS Computers; exact DPI range, button count, lighting and cable details are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$HP wired gaming optical mouse$ars_product_content$, $ars_product_content$Adjustable DPI sensor$ars_product_content$, $ars_product_content$Textured side finger grips$ars_product_content$, $ars_product_content$Durable microswitches$ars_product_content$, $ars_product_content$Ergonomic gaming shape$ars_product_content$, $ars_product_content$Exact DPI range and button count confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Connects to a USB-A port on Windows PCs. Confirm the exact DPI range, button layout, software support and cable length with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Mouse and documentation. Software download instructions are included where supplied by the model.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$HP gaming optical mouse series listing. Adjustable DPI and textured grips are series-level; exact model, DPI range and buttons are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wired gaming optical mouse",
  "model_number": "HP gaming optical series — exact model confirmed with sales",
  "dpi": "Adjustable DPI — range confirmed with sales",
  "buttons": "Gaming button layout — count confirmed with sales",
  "connection": "USB wired",
  "lighting": "RGB lighting on supported models",
  "compatibility_os": "Windows; basic support on macOS and Linux",
  "cable_length": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'hp-gaming-optical-mouse';

UPDATE public.products SET
  description = $ars_product_content$The HP mechanical gaming keyboard uses tactile mechanical switches, anti-ghosting circuitry and multi-mode RGB backlighting for gaming, streaming and heavy typing. Its full-size layout keeps media and numeric keys within reach. This listing covers the HP mechanical keyboard models supplied by ARS Computers; switch type, rollover specification, lighting modes and cable details are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$HP mechanical gaming keyboard$ars_product_content$, $ars_product_content$Tactile mechanical switches$ars_product_content$, $ars_product_content$Multi-mode RGB illumination$ars_product_content$, $ars_product_content$Anti-ghosting key rollover on supported models$ars_product_content$, $ars_product_content$Full-size layout$ars_product_content$, $ars_product_content$Exact switch type and model confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Connects to a USB-A port on Windows PCs. Confirm the exact switch type, lighting software and rollover specification with ARS Computers sales before purchase.$ars_product_content$,
  box_contents = $ars_product_content$Keyboard, USB cable where detachable, keycap puller where supplied, and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$HP mechanical gaming keyboard series listing. Mechanical switches, RGB lighting and anti-ghosting are series-level; exact model and switch type are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Mechanical gaming keyboard",
  "model_number": "HP mechanical gaming series — exact model confirmed with sales",
  "key_layout": "Full-size",
  "switch_type": "Tactile mechanical switches",
  "keycaps": "Durable gaming keycaps",
  "lighting": "Multi-mode RGB backlighting",
  "connection": "USB wired",
  "compatibility_os": "Windows; limited macOS support depending on model",
  "keyboard": "Full-size with multimedia keys on supported models"
}$ars_product_content$::jsonb
WHERE slug = 'hp-mechanical-rgb-keyboard';

UPDATE public.products SET
  description = $ars_product_content$The HP Pavilion slim laptop is a versatile silver-finished notebook for home-office, accounting and general commercial computing. This listing covers the Pavilion models supplied by ARS Computers. A full-size island keyboard with numeric keypad, micro-edge anti-glare display and integrated webcam make it practical for spreadsheets, billing and video calls. Exact processor, memory, storage and display configuration are confirmed per unit.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$HP Pavilion slim laptop in a silver finish$ars_product_content$, $ars_product_content$Full-size island keyboard with numeric keypad$ars_product_content$, $ars_product_content$Micro-edge anti-glare display options$ars_product_content$, $ars_product_content$Integrated webcam and microphone$ars_product_content$, $ars_product_content$Suitable for accounting, billing and home-office work$ars_product_content$, $ars_product_content$Exact configuration confirmed against current stock$ars_product_content$]::text[],
  compatibility = $ars_product_content$Suitable for Microsoft 365, Tally and accounting packages, billing software and everyday browsing. Confirm the exact model and peripheral requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$HP Pavilion series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "form_factor": "Slim laptop (clamshell)",
  "processor": "Configuration-dependent — confirm with sales",
  "processor_generation": "Configuration-dependent — confirm with sales",
  "ram": "Configuration-dependent — confirm with sales",
  "storage": "Configuration-dependent — confirm with sales",
  "storage_type": "SSD/HDD options depending on model",
  "display": "Micro-edge display — exact size confirmed with sales",
  "resolution": "Configuration-dependent — confirm with sales",
  "panel_type": "Anti-glare panel (model-dependent)",
  "keyboard": "Full-size island keyboard with numeric keypad",
  "camera": "Integrated webcam and microphone",
  "os": "Configuration-dependent — Windows options confirmed at order",
  "ports": "USB, HDMI and audio ports — exact set confirmed per model",
  "networking": "Wi-Fi and Ethernet options depend on model"
}$ars_product_content$::jsonb
WHERE slug = 'hp-pavilion-silver-slim-laptop';

UPDATE public.products SET
  description = $ars_product_content$HP ProBook laptops are commercial notebooks built for growing businesses that need dependable performance, serviceability and security without premium-tier pricing. This listing covers the ProBook models supplied by ARS Computers. Reinforced hinges, a spill-resistant keyboard option and versatile expansion ports suit continuous office workloads. Exact model, processor and configuration are confirmed per unit.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$HP ProBook commercial laptop family$ars_product_content$, $ars_product_content$Reinforced hinges and business-grade chassis$ars_product_content$, $ars_product_content$Spill-resistant keyboard option$ars_product_content$, $ars_product_content$Versatile expansion ports for office peripherals$ars_product_content$, $ars_product_content$Business security and manageability options$ars_product_content$, $ars_product_content$Exact model and configuration confirmed per unit$ars_product_content$]::text[],
  compatibility = $ars_product_content$Designed for office productivity, accounting, CRM/ERP access and standard business peripherals. Confirm the exact model and docking requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$HP ProBook commercial series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "form_factor": "Commercial laptop (clamshell)",
  "processor": "Configuration-dependent — confirm with sales",
  "processor_generation": "Configuration-dependent — confirm with sales",
  "ram": "Configuration-dependent — confirm with sales",
  "storage": "Configuration-dependent — confirm with sales",
  "storage_type": "SSD/HDD options depending on model",
  "display": "Configuration-dependent — confirm screen size with sales",
  "resolution": "Configuration-dependent — confirm with sales",
  "panel_type": "Anti-glare business panel (model-dependent)",
  "keyboard": "HP business keyboard with spill-resistant option",
  "camera": "Integrated webcam (model-dependent)",
  "os": "Configuration-dependent — Windows options confirmed at order",
  "ports": "USB, video and audio ports — exact set confirmed per model",
  "networking": "Wi-Fi and Ethernet options depend on model"
}$ars_product_content$::jsonb
WHERE slug = 'hp-probook-commercial-laptop';

UPDATE public.products SET
  description = $ars_product_content$Kingston desktop memory modules are standard JEDEC-compliant DIMMs for commercial and office desktop upgrades. They are tested for compatibility with common business systems and are available in DDR3 and DDR4 generations depending on the machine. Because the listing covers multiple generations, the exact pin count, capacity and speed must be matched to the motherboard before ordering.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Kingston desktop memory module$ars_product_content$, $ars_product_content$Standard JEDEC-compliant design$ars_product_content$, $ars_product_content$DDR3 and DDR4 options depending on model$ars_product_content$, $ars_product_content$Suitable for commercial desktop upgrades$ars_product_content$, $ars_product_content$Reliable office-system memory$ars_product_content$, $ars_product_content$Exact generation and capacity confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$DDR3 and DDR4 are not interchangeable. Confirm the motherboard model, existing memory generation and maximum supported capacity with ARS Computers before purchase.$ars_product_content$,
  box_contents = $ars_product_content$Memory module and documentation. Exact module count depends on the selected pack.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Kingston desktop memory series listing. JEDEC compliance and DIMM form factor are series-level; exact generation, capacity and speed are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Desktop memory module",
  "memory_type": "DDR3 or DDR4 — confirm generation",
  "interface": "240-pin DIMM (DDR3) / 288-pin DIMM (DDR4)",
  "capacity": "4 GB / 8 GB / 16 GB options — confirm with sales",
  "memory_speed": "Standard JEDEC speed — confirm with sales",
  "compatibility": "Desktop motherboards matching the memory generation and slot type",
  "voltage": "Generation-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'kingston-desktop-ddr-ram-module';

UPDATE public.products SET
  description = $ars_product_content$The Lenovo 300 wireless combo pairs a full-size island-key keyboard with a contoured wireless mouse for everyday office work. The keyboard uses a water-resistant drainage design on supported models, helping protect it from accidental spills. It is a practical bundle for accounts, reception and general business desks. Exact model, battery life, mouse DPI and regional layout are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Lenovo 300 wireless keyboard and mouse combo$ars_product_content$, $ars_product_content$Water-resistant drainage casing on supported models$ars_product_content$, $ars_product_content$Island-style keycaps$ars_product_content$, $ars_product_content$Contoured wireless mouse$ars_product_content$, $ars_product_content$Full-size layout with numeric keypad$ars_product_content$, $ars_product_content$2.4 GHz wireless connection$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with Windows desktop PCs and laptops with a USB-A port. Confirm the exact layout, spill-resistance design and battery requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Wireless keyboard, wireless mouse, USB receiver, batteries where supplied, and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Lenovo 300 wireless combo listing. Water-resistant drainage and island keys are series-level; exact model, battery life and mouse DPI are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wireless keyboard and mouse combo",
  "model_number": "Lenovo 300 Wireless Combo",
  "key_layout": "Full-size with numeric keypad",
  "switch_type": "Island-style membrane",
  "keycaps": "Island keycaps",
  "connection": "2.4 GHz wireless via USB receiver",
  "dpi": "Optical mouse — DPI confirmed with sales",
  "buttons": "3-button optical mouse",
  "battery_life": "Configuration-dependent — confirm with sales",
  "compatibility_os": "Windows with USB-A port"
}$ars_product_content$::jsonb
WHERE slug = 'lenovo-300-wireless-keyboard-combo';

UPDATE public.products SET
  description = $ars_product_content$Lenovo commercial laptops are designed around long typing sessions, reliable everyday performance and straightforward IT management. This series listing covers the Lenovo business models available through ARS Computers. The ergonomic island keyboard, TrackPoint option, matte anti-glare display and robust hinge assembly make the range suitable for offices, back-offices and mobile administrative work. Exact configuration is confirmed per unit.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Lenovo commercial business laptop family$ars_product_content$, $ars_product_content$Ergonomic island keyboard with TrackPoint option$ars_product_content$, $ars_product_content$Matte anti-glare display for reduced reflections$ars_product_content$, $ars_product_content$Reinforced hinge and chassis design for daily use$ars_product_content$, $ars_product_content$Business connectivity and security options$ars_product_content$, $ars_product_content$Configuration confirmed against current stock$ars_product_content$]::text[],
  compatibility = $ars_product_content$Suitable for Microsoft 365, Tally and other accounting software, browser-based business applications and standard office peripherals. Confirm the exact model and docking requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Laptop unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Lenovo commercial series listing. Exact model number, configuration and warranty terms are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "form_factor": "Business laptop (clamshell)",
  "processor": "Configuration-dependent — confirm with sales",
  "processor_generation": "Configuration-dependent — confirm with sales",
  "ram": "Configuration-dependent — confirm with sales",
  "storage": "Configuration-dependent — confirm with sales",
  "storage_type": "SSD/HDD options depending on model",
  "display": "Configuration-dependent — confirm screen size with sales",
  "resolution": "Configuration-dependent — confirm with sales",
  "panel_type": "Matte anti-glare panel (model-dependent)",
  "keyboard": "Lenovo island keyboard with TrackPoint option",
  "camera": "Integrated webcam (model-dependent)",
  "os": "Configuration-dependent — Windows options confirmed at order",
  "ports": "USB, video and audio ports — exact set confirmed per model",
  "networking": "Wi-Fi and Ethernet options depend on model"
}$ars_product_content$::jsonb
WHERE slug = 'lenovo-commercial-office-laptop';

UPDATE public.products SET
  description = $ars_product_content$The Lenovo ThinkCentre commercial desktop tower is built for business stability, easy serviceability and long-term office deployment. A tool-less chassis simplifies upgrades and maintenance, and front USB/audio ports keep everyday connections within reach. This listing covers the ThinkCentre tower models supplied by ARS Computers. Processor, memory, storage, ports and warranty are confirmed against the selected model.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Lenovo ThinkCentre commercial desktop tower$ars_product_content$, $ars_product_content$Tool-less chassis for easy service access$ars_product_content$, $ars_product_content$Front USB and audio ports$ars_product_content$, $ars_product_content$Enterprise stability and manageability$ars_product_content$, $ars_product_content$Expandable storage and PCIe options$ars_product_content$, $ars_product_content$Exact configuration confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Suitable for office suites, billing, ERP/CRM and general business workloads. Confirm the exact model, operating system, warranty and peripheral requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Desktop tower, power cable and documentation. Monitor, keyboard and mouse are supplied separately unless included on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Lenovo ThinkCentre tower series listing. Tool-less chassis and front port layout are series-level; exact model and configuration are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Commercial desktop tower",
  "processor": "Configuration-dependent — confirm with sales",
  "ram": "Configuration-dependent — confirm with sales",
  "storage": "Configuration-dependent — confirm with sales",
  "gpu": "Integrated or discrete graphics depending on model",
  "system_form_factor": "Desktop tower",
  "expansion": "PCIe slots and drive bays model-dependent",
  "system_ports": "Front USB/audio; rear ports model-dependent",
  "networking": "Gigabit Ethernet; Wi-Fi on selected models",
  "power_supply": "Model-dependent"
}$ars_product_content$::jsonb
WHERE slug = 'lenovo-thinkcentre-desktop-tower';

UPDATE public.products SET
  description = $ars_product_content$The Lenovo wireless ergonomic mouse is shaped to support the palm during long office sessions, with a smooth rubber scroll wheel and high-accuracy optical tracking. It is intended for accounts, reception and general business workstations where comfort matters. This listing covers the Lenovo wireless ergonomic models supplied by ARS Computers; exact DPI, battery type and receiver details are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Lenovo wireless ergonomic optical mouse$ars_product_content$, $ars_product_content$Comfort grip contours$ars_product_content$, $ars_product_content$Smooth rubber scroll wheel$ars_product_content$, $ars_product_content$High-accuracy optical tracking$ars_product_content$, $ars_product_content$Wireless 2.4 GHz connection$ars_product_content$, $ars_product_content$Exact model and battery type confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Connects through a USB receiver to a Windows PC or laptop. Confirm the exact model, DPI and battery requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Wireless mouse, USB receiver, battery where supplied, and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Lenovo wireless ergonomic mouse series listing. Ergonomic contours and rubber scroll wheel are series-level; exact model and DPI are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wireless ergonomic optical mouse",
  "model_number": "Lenovo wireless ergonomic series — exact model confirmed with sales",
  "dpi": "Optical tracking — DPI confirmed with sales",
  "buttons": "3-button layout with scroll wheel",
  "connection": "2.4 GHz wireless via USB receiver",
  "battery_life": "Configuration-dependent — confirm with sales",
  "compatibility_os": "Windows with USB-A port",
  "wireless_range": "Typical desktop wireless range — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'lenovo-wireless-ergonomic-mouse';

UPDATE public.products SET
  description = $ars_product_content$The Logitech MX Keys Mini is a compact premium wireless keyboard for users who want a smaller desk footprint without giving up typing quality. Spherically dished keys are shaped to fingertips, smart backlighting activates as hands approach, and the keyboard can pair with multiple devices over Bluetooth or Logi Bolt. It suits designers, developers and mobile professionals who work across a laptop, tablet and desktop.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Logitech MX Keys Mini compact wireless keyboard$ars_product_content$, $ars_product_content$Spherically dished fingertip-matched keys$ars_product_content$, $ars_product_content$Smart proximity backlighting$ars_product_content$, $ars_product_content$Bluetooth Low Energy and Logi Bolt connectivity$ars_product_content$, $ars_product_content$Multi-device pairing$ars_product_content$, $ars_product_content$USB-C charging$ars_product_content$]::text[],
  compatibility = $ars_product_content$Pairs over Bluetooth with Windows, macOS, Linux, iPadOS, iOS and Android devices, or through a Logi Bolt receiver where supplied. Confirm the exact colour variant, receiver inclusion and language layout with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Keyboard, USB-C charging cable and documentation. A Logi Bolt receiver is included only in the specific retail bundle that lists it.$ars_product_content$,
  specs_verified = $ars_product_content$verified$ars_product_content$,
  spec_source = $ars_product_content$Logitech MX Keys Mini product specifications. Compact layout, dished keys, smart backlighting, battery figures and dimensions are manufacturer-published values.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Compact wireless keyboard",
  "model_number": "Logitech MX Keys Mini",
  "key_layout": "Compact 75% layout without numeric keypad",
  "switch_type": "Low-profile scissor mechanism",
  "keycaps": "Spherically dished keys",
  "connection": "Bluetooth Low Energy / Logi Bolt USB receiver",
  "wireless_range": "Up to 10 m typical wireless range",
  "battery_life": "Up to 10 days with backlighting; up to 5 months with backlighting off",
  "compatibility_os": "Windows, macOS, Linux, iPadOS, iOS and Android",
  "dimensions": "Approx. 296 x 132 x 21 mm",
  "weight": "Approx. 506 g"
}$ars_product_content$::jsonb
WHERE slug = 'logitech-mx-keys-mini-keyboard';

UPDATE public.products SET
  description = $ars_product_content$This Logitech full-size wireless multimedia keyboard is designed for comfortable office typing with dedicated media hotkeys for volume, playback and shortcuts. Spill-resistant construction and long battery life suit shared desks and home offices. This listing covers the Logitech wireless multimedia models supplied by ARS Computers; exact layout, receiver type, battery life and hotkey set are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Logitech full-size wireless multimedia keyboard$ars_product_content$, $ars_product_content$Dedicated one-touch media hotkeys$ars_product_content$, $ars_product_content$Spill-resistant construction on supported models$ars_product_content$, $ars_product_content$Long battery life$ars_product_content$, $ars_product_content$2.4 GHz wireless connection$ars_product_content$, $ars_product_content$Exact model and layout confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Connects to a USB-A port on Windows PCs. Confirm the exact model, media-key layout, receiver type and battery requirements with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Keyboard, USB receiver, batteries where supplied, and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Logitech wireless multimedia keyboard series listing. Media hotkeys and wireless operation are series-level; exact model and battery life are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wireless multimedia keyboard",
  "model_number": "Logitech wireless multimedia series — exact model confirmed with sales",
  "key_layout": "Full-size with numeric keypad",
  "switch_type": "Membrane",
  "connection": "2.4 GHz wireless via USB receiver",
  "battery_life": "Long-life battery — exact rating confirmed with sales",
  "compatibility_os": "Windows; macOS support depending on model",
  "wireless_range": "Typical desktop wireless range — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'logitech-wireless-multimedia-keyboard';

UPDATE public.products SET
  description = $ars_product_content$The Mantra optical fingerprint scanner is a USB biometric peripheral for employee attendance, identity verification and Aadhaar-style enrolment workflows. The optical sensor reads fingerprints through a scratch-resistant surface, and USB power keeps installation simple. It is typically paired with attendance or enrolment software on a Windows PC. Exact model, sensor resolution, SDK support and certification status are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Mantra optical fingerprint scanner$ars_product_content$, $ars_product_content$Scratch-resistant optical sensor surface$ars_product_content$, $ars_product_content$USB interface and bus power$ars_product_content$, $ars_product_content$Suitable for attendance and identity enrolment$ars_product_content$, $ars_product_content$Compact desktop peripheral$ars_product_content$, $ars_product_content$Exact model and SDK support confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Requires compatible Windows attendance, HR or enrolment software and the correct SDK/driver for the exact model. Confirm Aadhaar/UIDAI certification status and software integration with ARS Computers sales before purchase.$ars_product_content$,
  box_contents = $ars_product_content$Scanner unit, USB cable and documentation. Software licence and installation service are supplied only if specified on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Mantra optical fingerprint scanner listing. Optical sensor and USB interface are series-level; exact model, SDK and certification are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "device_type": "USB optical fingerprint scanner",
  "model_number": "Mantra optical fingerprint series — exact model confirmed with sales",
  "auth_methods": "Fingerprint",
  "sensor_type": "Optical fingerprint sensor",
  "recognition_speed": "Configuration-dependent — confirm with sales",
  "fingerprint_capacity": "Software-dependent — scanner stores no templates by itself",
  "connectivity": "USB",
  "software": "Windows attendance/enrolment software; SDK availability confirmed with sales",
  "power": "USB bus powered",
  "dimensions": "Configuration-dependent — confirm with sales",
  "operating_temperature": "Configuration-dependent — confirm with sales",
  "installation": "Desktop USB connection"
}$ars_product_content$::jsonb
WHERE slug = 'mantra-optical-fingerprint-scanner';

UPDATE public.products SET
  description = $ars_product_content$This multi-channel CCTV recorder is the recording and playback hub for a surveillance installation. It accepts multiple camera channels, records continuously or on schedule, and provides local HDMI and VGA output for a monitor. SATA drive bays allow internal storage, while network connectivity supports remote viewing. Because the listing covers both DVR and NVR configurations, the channel count, camera type, drive capacity and network features are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Multi-channel DVR/NVR recording platform$ars_product_content$, $ars_product_content$HDMI and VGA monitor outputs$ars_product_content$, $ars_product_content$Internal SATA storage support$ars_product_content$, $ars_product_content$Continuous, scheduled and motion-based recording options$ars_product_content$, $ars_product_content$Network viewing and playback on supported models$ars_product_content$, $ars_product_content$Channel count and camera type confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Must be matched to the camera type (HD analog, AHD, TVI, CVI or IP) and to the required channel count. Confirm hard-drive capacity, monitor resolution and remote-viewing requirements with ARS Computers before purchase.$ars_product_content$,
  box_contents = $ars_product_content$Recorder unit, power adapter, mouse/remote where supplied, and documentation. Hard drive and cameras are supplied separately unless included on the quotation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand DVR/NVR solution listing. Exact model, channel count, supported camera technology and storage capacity are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "device_type": "Standalone CCTV video recorder",
  "model_number": "Multi-channel DVR/NVR — exact model confirmed with sales",
  "channels": "4/8/16/32-channel options — confirm with sales",
  "recording_resolution": "Up to 4K/8 MP depending on model",
  "hdd_support": "1–2 internal SATA drives depending on model",
  "playback": "Local and network playback",
  "video_output": "HDMI and VGA",
  "network_interface": "RJ45 Ethernet",
  "connectivity": "Network remote viewing on supported models",
  "power": "12 V DC adapter (model-dependent)",
  "storage_compatibility": "Surveillance-grade SATA HDD — capacity confirmed with sales",
  "operating_temperature": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'multi-channel-cctv-dvr-nvr-recorder';

UPDATE public.products SET
  description = $ars_product_content$A multi-channel CCTV SMPS distributes regulated 12 V DC power to several cameras from one enclosed unit. Individual channel fuses help protect each camera circuit, and the ventilated metal casing is designed for installation near a recorder or distribution point. Channel count and current rating vary, so the exact unit must be matched to the total camera load. Installation by a qualified technician is recommended.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Multi-channel regulated 12 V DC CCTV power supply$ars_product_content$, $ars_product_content$Individual channel fuse protection$ars_product_content$, $ars_product_content$Ventilated metal enclosure$ars_product_content$, $ars_product_content$Centralised camera power distribution$ars_product_content$, $ars_product_content$Wall or shelf installation$ars_product_content$, $ars_product_content$Exact channel count and current rating confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Total camera current draw must stay within the SMPS rating. Confirm the number of cameras, cable voltage drop and whether the cameras require 12 V DC or PoE with ARS Computers before installation.$ars_product_content$,
  box_contents = $ars_product_content$SMPS unit and documentation. Power cord, output leads and fuses are included only where supplied by the selected model.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand CCTV SMPS solution listing. Regulated 12 V DC output and fused channels are stated by the catalogue; exact channel count and current rating are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Multi-channel CCTV power supply (SMPS)",
  "wattage": "4/8/16-channel and 5–30 A options — confirm with sales",
  "connectors": "12 V DC outputs with individual fuses",
  "power": "230 V AC input",
  "compatibility": "12 V DC CCTV cameras; confirm total camera load",
  "installation": "Wall or distribution-box mounting by a qualified technician",
  "dimensions": "Configuration-dependent — confirm with sales",
  "operating_temperature": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'multi-channel-cctv-smps-power-supply';

UPDATE public.products SET
  description = $ars_product_content$An NVIDIA GeForce dedicated graphics card adds GPU acceleration for gaming, 3D modelling, video rendering and multi-monitor workstations. Ray-tracing cores and dedicated GDDR memory are present on supported RTX models. Because the GeForce RTX family spans many performance tiers, the exact GPU model, VRAM capacity, power requirement and output layout are confirmed with sales before ordering.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$NVIDIA GeForce dedicated graphics card$ars_product_content$, $ars_product_content$Ray-tracing cores on supported RTX models$ars_product_content$, $ars_product_content$Dedicated GDDR video memory$ars_product_content$, $ars_product_content$Multi-display output support$ars_product_content$, $ars_product_content$Suitable for gaming, 3D rendering and video editing$ars_product_content$, $ars_product_content$Exact GPU model and VRAM confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Confirm the motherboard PCIe slot, case graphics-card length, PSU wattage and monitor connections before purchase. ARS Computers can check the card against the intended system and workload.$ars_product_content$,
  box_contents = $ars_product_content$Graphics card, support bracket where supplied, and documentation. Power cables are supplied with the PSU, not the graphics card.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$NVIDIA GeForce RTX series listing. Ray tracing and dedicated GDDR memory are series-level; exact GPU model, VRAM and power requirement are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Dedicated desktop graphics card",
  "gpu_model": "NVIDIA GeForce RTX series — exact model confirmed with sales",
  "vram": "GDDR6/GDDR6X capacity model-dependent",
  "interface": "PCIe x16 — generation model-dependent",
  "connectors": "DisplayPort/HDMI outputs model-dependent",
  "power_supply": "System PSU requirement model-dependent",
  "tdp": "Model-dependent — confirm with sales",
  "compatibility": "Desktop PCIe x16 slot; confirm PSU, case length and monitor inputs",
  "dimensions": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'nvidia-geforce-dedicated-graphics-card';

UPDATE public.products SET
  description = $ars_product_content$The Samsung 870 EVO is a 2.5-inch SATA III solid-state drive for upgrading laptops, desktops and older systems that do not have an M.2 slot. Samsung V-NAND flash and the SATA 6 Gb/s interface provide a large jump in responsiveness over a mechanical hard drive, with sequential reads up to 560 MB/s on the series. Capacities and endurance vary by model, so the stocked capacity and TBW rating are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Samsung 870 EVO 2.5-inch SATA SSD$ars_product_content$, $ars_product_content$SATA III 6 Gb/s interface$ars_product_content$, $ars_product_content$Samsung V-NAND flash technology$ars_product_content$, $ars_product_content$Up to 560 MB/s sequential read on the series$ars_product_content$, $ars_product_content$Direct replacement for 2.5-inch laptop/desktop drives$ars_product_content$, $ars_product_content$Capacity and endurance confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Fits standard 2.5-inch SATA drive bays and works with SATA II or SATA III ports (at the port speed). Confirm the required capacity, cloning requirements and warranty terms with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$SSD unit and documentation. Mounting screws, SATA cable or cloning software are not included unless specified by the retail pack.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Samsung 870 EVO series specifications. Interface, form factor and series speed are manufacturer-level; exact capacity and endurance are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "2.5-inch SATA solid-state drive",
  "drive_form_factor": "2.5-inch, 7 mm",
  "capacity": "250 GB / 500 GB / 1 TB / 2 TB / 4 TB options — confirm with sales",
  "memory_type": "Samsung V-NAND",
  "interface": "SATA III 6 Gb/s",
  "storage_speed": "Up to 560 MB/s sequential read, 530 MB/s sequential write (series)",
  "endurance": "Capacity-dependent — confirm TBW with sales",
  "compatibility": "Laptops and desktops with a 2.5-inch SATA bay; USB enclosure for external use",
  "power": "SATA power connector (desktop) / slot power (laptop)"
}$ars_product_content$::jsonb
WHERE slug = 'samsung-870-evo-sata-ssd';

UPDATE public.products SET
  description = $ars_product_content$This SATA III cable connects 2.5-inch SSDs, 3.5-inch hard drives and optical drives to a desktop motherboard. Metallic locking latches keep the connector secure during movement or service, and the shielded construction supports the 6 Gb/s SATA interface. It is a straightforward replacement or build cable for desktop systems.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$SATA III 6 Gb/s internal data cable$ars_product_content$, $ars_product_content$Locking metal latch connectors$ars_product_content$, $ars_product_content$For 2.5-inch SSDs, 3.5-inch HDDs and optical drives$ars_product_content$, $ars_product_content$Shielded construction$ars_product_content$, $ars_product_content$Straight or right-angle connector options$ars_product_content$, $ars_product_content$Exact length confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Connects a SATA drive to a motherboard SATA port. Confirm the required length and whether straight or right-angle connectors are needed for the case layout with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$SATA data cable and documentation where supplied.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand SATA III cable solution listing. Locking latch and 6 Gbps support are stated by the catalogue; exact length and connector angle are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "SATA internal data cable",
  "connector": "SATA data male to male",
  "connector_type": "SATA III",
  "length": "0.3 m / 0.5 m / 1 m options — confirm with sales",
  "data_rate": "Up to 6 Gbps",
  "shielding": "EMI shielding with locking latch",
  "compatibility": "Desktop motherboards and SATA drives"
}$ars_product_content$::jsonb
WHERE slug = 'sata-6gbps-internal-drive-cable';

UPDATE public.products SET
  description = $ars_product_content$The Seagate BarraCuda 3.5-inch hard drive provides high-capacity internal storage for desktop PCs, backup systems and surveillance recorders. It is a cost-effective choice for bulk files, archives and secondary storage alongside an SSD. Capacity, rotation speed and cache size vary across the BarraCuda family, so the exact stocked model and its suitability for continuous surveillance recording are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Seagate BarraCuda 3.5-inch internal hard drive$ars_product_content$, $ars_product_content$SATA 6 Gb/s interface$ars_product_content$, $ars_product_content$High-capacity storage for desktops and archives$ars_product_content$, $ars_product_content$Suitable for secondary storage and backup$ars_product_content$, $ars_product_content$Broad capacity range$ars_product_content$, $ars_product_content$Exact model and capacity confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Fits standard 3.5-inch desktop bays. For 24/7 CCTV recording, confirm whether a surveillance-rated drive is required instead of a desktop BarraCuda model. ARS Computers can match the drive to the recorder.$ars_product_content$,
  box_contents = $ars_product_content$Hard drive unit and documentation. SATA cable and mounting screws are not included unless specified by the retail pack.$ars_product_content$,
  specs_verified = $ars_product_content$partially_verified$ars_product_content$,
  spec_source = $ars_product_content$Seagate BarraCuda series specifications. Form factor and SATA interface are manufacturer-level; exact capacity, RPM and workload rating are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "3.5-inch internal hard disk drive",
  "drive_form_factor": "3.5-inch",
  "capacity": "1 TB to 8 TB options — confirm with sales",
  "interface": "SATA 6 Gb/s",
  "storage_speed": "7200 RPM class on supported capacities — confirm with sales",
  "endurance": "Desktop workload rating; confirm surveillance suitability with sales",
  "compatibility": "Desktop SATA bays and compatible DVR/NVR recorders",
  "power": "SATA power connector",
  "dimensions": "Standard 3.5-inch drive dimensions"
}$ars_product_content$::jsonb
WHERE slug = 'seagate-barracuda-3-5-inch-hdd';

UPDATE public.products SET
  description = $ars_product_content$This slim chiclet keyboard is a low-profile wired desktop keyboard with short key travel and quiet acoustics. It is intended for modern office desks where a minimal footprint and clean appearance matter. Because this is a multi-brand solution listing, the exact model, key mechanism, cable length and layout are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Ultra-thin low-profile desktop keyboard$ars_product_content$, $ars_product_content$Chiclet-style keys with short travel$ars_product_content$, $ars_product_content$Quiet typing acoustics$ars_product_content$, $ars_product_content$Compact desk footprint$ars_product_content$, $ars_product_content$USB wired connection$ars_product_content$, $ars_product_content$Exact model and layout confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with desktop PCs and laptops that have a USB-A port. Confirm the exact layout, cable length and key mechanism with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Keyboard and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand slim chiclet keyboard solution listing. Low-profile chiclet design is stated by the catalogue; exact model and layout are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Slim wired desktop keyboard",
  "model_number": "Slim chiclet keyboard — exact model confirmed with sales",
  "key_layout": "Full-size with numeric keypad on the listed design",
  "switch_type": "Scissor-style low-profile mechanism",
  "keycaps": "Low-profile chiclet keycaps",
  "connection": "USB wired",
  "compatibility_os": "Windows, macOS and Linux with USB-A port"
}$ars_product_content$::jsonb
WHERE slug = 'slim-chiclet-low-profile-keyboard';

UPDATE public.products SET
  description = $ars_product_content$This smart outdoor Wi-Fi bullet camera is a wireless surveillance option for gates, parking areas, compounds and building exteriors. Dual high-gain antennas support a more stable Wi-Fi link, and the weatherproof housing and wall bracket are designed for outdoor mounting. Motion detection alerts and smartphone viewing let owners monitor the site remotely. Because this is a solution listing, the exact resolution, storage method and app ecosystem are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Outdoor Wi-Fi bullet camera with weatherproof housing$ars_product_content$, $ars_product_content$Dual high-gain wireless antennas$ars_product_content$, $ars_product_content$Motion detection alerts to a smartphone app$ars_product_content$, $ars_product_content$Remote live view and playback via mobile app$ars_product_content$, $ars_product_content$Wall-mount bracket included$ars_product_content$, $ars_product_content$Exact model, resolution and storage confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Requires a 2.4 GHz Wi-Fi network and a compatible smartphone app. Confirm the exact model, microSD support, power adapter and NVR compatibility with ARS Computers sales before installation.$ars_product_content$,
  box_contents = $ars_product_content$Camera unit, wall-mount bracket, mounting screws, power adapter (if included by the selected model) and quick-start documentation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand smart Wi-Fi bullet solution listing. Exact model, resolution, IP rating and app support are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "camera_type": "Outdoor Wi-Fi bullet camera",
  "model_number": "Smart Wi-Fi Bullet series — exact model confirmed with sales",
  "resolution": "Configuration-dependent — confirm with sales",
  "sensor": "CMOS sensor (model-dependent)",
  "lens": "Fixed lens (focal length confirmed per model)",
  "viewing_angle": "Configuration-dependent — confirm with sales",
  "night_vision": "Infrared or white-light night vision depending on model",
  "environment": "Outdoor wall mount",
  "weather_rating": "Weatherproof housing — IP rating confirmed per model",
  "connectivity": "2.4 GHz Wi-Fi; wired Ethernet on supported models",
  "power": "12 V DC adapter (model-dependent)",
  "storage_compatibility": "microSD card and/or NVR — confirm with sales",
  "audio": "Two-way audio on supported models",
  "operating_temperature": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'smart-outdoor-wifi-bullet-camera';

UPDATE public.products SET
  description = $ars_product_content$This standard office wired keyboard is a 104-key commercial desktop keyboard with adjustable tilt legs and tactile membrane keys. It is a straightforward replacement or bulk-deployment keyboard for offices, schools and billing counters. Exact model, cable length, keycap finish and layout are confirmed with sales because the listing covers multiple suppliers.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Standard 104-key commercial wired keyboard$ars_product_content$, $ars_product_content$Adjustable tilt legs$ars_product_content$, $ars_product_content$Tactile membrane key response$ars_product_content$, $ars_product_content$Full-size layout with numeric keypad$ars_product_content$, $ars_product_content$USB wired connection$ars_product_content$, $ars_product_content$Exact model and cable length confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with desktop PCs and laptops that have a USB-A port. Confirm the exact layout, cable length and keycap language with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Keyboard and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand standard office keyboard solution listing. 104-key layout and tilt legs are stated by the catalogue; exact model and cable length are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wired commercial keyboard",
  "model_number": "Standard office wired — exact model confirmed with sales",
  "key_layout": "Full-size 104-key layout",
  "switch_type": "Membrane",
  "keycaps": "Standard office keycaps",
  "connection": "USB wired",
  "compatibility_os": "Windows, macOS and Linux with USB-A port",
  "keyboard": "Adjustable tilt legs"
}$ars_product_content$::jsonb
WHERE slug = 'standard-office-wired-keyboard';

UPDATE public.products SET
  description = $ars_product_content$This ultra-slim metallic notebook is a lightweight, travel-focused laptop configured for consultants, sales teams and mobile professionals. The aluminium-style unibody and thin-bezel display keep the footprint small, while the full-size keyboard and everyday connectivity cover web conferencing, email, documents and browser-based business applications. Because this is a multi-brand solution listing, the exact model and internal configuration are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Lightweight aluminium-style unibody design$ars_product_content$, $ars_product_content$Thin-bezel display for a compact footprint$ars_product_content$, $ars_product_content$Built for travel, field work and web conferencing$ars_product_content$, $ars_product_content$Everyday business connectivity$ars_product_content$, $ars_product_content$Full-size keyboard for comfortable typing$ars_product_content$, $ars_product_content$Exact model and configuration confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Suitable for Microsoft 365, email, video conferencing and browser-based business tools. Confirm the exact model, ports and travel accessories with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Notebook unit, power adapter and power cable, and documentation. Exact bundle confirmed at order.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand ultra-slim notebook solution listing. Exact model and configuration are confirmed by ARS Computers at the time of sale.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "form_factor": "Ultra-slim notebook",
  "processor": "Configuration-dependent — confirm with sales",
  "ram": "Configuration-dependent — confirm with sales",
  "storage": "Configuration-dependent — confirm with sales",
  "storage_type": "SSD (model-dependent)",
  "display": "Thin-bezel display — exact size confirmed with sales",
  "resolution": "Configuration-dependent — confirm with sales",
  "keyboard": "Full-size notebook keyboard",
  "camera": "Integrated webcam for video calls",
  "os": "Configuration-dependent — Windows options confirmed at order",
  "ports": "USB and video ports — exact set confirmed per model",
  "networking": "Wi-Fi and Bluetooth options depend on model",
  "weight": "Lightweight configuration — confirm exact weight with sales"
}$ars_product_content$::jsonb
WHERE slug = 'ultra-slim-metallic-notebook';

UPDATE public.products SET
  description = $ars_product_content$This USB Type-C cable supports charging and data transfer for modern laptops, phones, tablets and external drives. The reversible connector makes it easy to plug in, and the braided jacket is designed for daily travel use. Power rating and data speed depend on the exact cable variant, so the stocked version is confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$USB Type-C charging and data cable$ars_product_content$, $ars_product_content$Reversible Type-C connector$ars_product_content$, $ars_product_content$Braided travel-friendly jacket$ars_product_content$, $ars_product_content$Fast-charging support on compatible chargers$ars_product_content$, $ars_product_content$Data sync for phones and drives$ars_product_content$, $ars_product_content$Exact wattage and data speed confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Confirm the required connector combination, charging wattage and data speed before purchase. Not every USB-C cable supports high-wattage charging or high-speed data. ARS Computers can match the cable to the device.$ars_product_content$,
  box_contents = $ars_product_content$USB Type-C cable, travel pouch where supplied, and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand USB Type-C cable solution listing. Reversible connector and fast-charging support are stated by the catalogue; exact wattage and data speed are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "USB Type-C charging and data cable",
  "connector": "USB-C to USB-C or USB-A to USB-C — confirm variant",
  "connector_type": "USB Type-C",
  "length": "1 m / 1.5 m / 2 m options — confirm with sales",
  "data_rate": "USB 2.0 or USB 3.x depending on variant",
  "power_rating": "Fast charging up to 60 W/100 W depending on variant",
  "compatibility": "USB-C laptops, phones, tablets, external SSDs and accessories"
}$ars_product_content$::jsonb
WHERE slug = 'usb-type-c-fast-charging-data-cable';

UPDATE public.products SET
  description = $ars_product_content$This full-size wireless office combo provides a keyboard with numeric keypad and a wireless optical mouse for general business workstations. It is intended for cable-free reception desks, accounts counters and home offices where a familiar layout and reliable everyday input are the priority. Because this is a multi-brand solution listing, the exact model, key mechanism, DPI and battery life are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Full-size wireless keyboard and mouse set$ars_product_content$, $ars_product_content$Numeric keypad for accounting and data entry$ars_product_content$, $ars_product_content$Wireless optical mouse$ars_product_content$, $ars_product_content$Plug-and-play USB nano receiver$ars_product_content$, $ars_product_content$Cable-free office desk setup$ars_product_content$, $ars_product_content$Exact model and battery life confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with desktop PCs and laptops that have a USB-A port. Confirm the exact layout, receiver type and operating system support with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Wireless keyboard, wireless mouse, USB receiver, batteries where supplied, and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Multi-brand wireless desktop combo solution listing. Full-size layout and wireless operation are stated by the catalogue; exact model and battery life are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wireless keyboard and mouse combo",
  "model_number": "Wireless desktop combo — exact model confirmed with sales",
  "key_layout": "Full-size with numeric keypad",
  "switch_type": "Membrane",
  "connection": "2.4 GHz wireless via USB nano receiver",
  "dpi": "Optical mouse — DPI confirmed with sales",
  "buttons": "3-button optical mouse",
  "battery_life": "Configuration-dependent — confirm with sales",
  "compatibility_os": "Windows and macOS with USB-A port",
  "wireless_range": "Typical desktop wireless range — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'wireless-office-keyboard-mouse-combo';

UPDATE public.products SET
  description = $ars_product_content$The Zebronics optical wired mouse is a lightweight, low-cost USB mouse for everyday computer use. Its high-precision optical sensor provides responsive cursor movement, and the durable cable avoids battery replacement. It suits billing counters, schools and general office desks that need a dependable basic mouse. Exact model, DPI and cable length are confirmed with sales.$ars_product_content$,
  key_features = ARRAY[$ars_product_content$Zebronics high-precision optical wired mouse$ars_product_content$, $ars_product_content$Lightweight ergonomic shape$ars_product_content$, $ars_product_content$Durable USB cable connection$ars_product_content$, $ars_product_content$Responsive optical tracking$ars_product_content$, $ars_product_content$No batteries required$ars_product_content$, $ars_product_content$Exact model and DPI confirmed with sales$ars_product_content$]::text[],
  compatibility = $ars_product_content$Works with computers that have a USB-A port. Confirm the exact model, DPI and cable length with ARS Computers sales.$ars_product_content$,
  box_contents = $ars_product_content$Mouse and documentation.$ars_product_content$,
  specs_verified = $ars_product_content$configuration_dependent$ars_product_content$,
  spec_source = $ars_product_content$Zebronics optical wired mouse listing. Optical tracking and USB wired connection are stated by the catalogue; exact model and DPI are confirmed by ARS Computers.$ars_product_content$,
  spec_attributes = $ars_product_content${
  "product_type": "Wired optical mouse",
  "model_number": "Zebronics optical wired series — exact model confirmed with sales",
  "dpi": "High-precision optical sensor — DPI confirmed with sales",
  "buttons": "3-button layout with scroll wheel",
  "connection": "USB wired",
  "compatibility_os": "Windows, macOS and Linux with USB-A port",
  "cable_length": "Configuration-dependent — confirm with sales"
}$ars_product_content$::jsonb
WHERE slug = 'zebronics-optical-wired-mouse';

-- Verification: every expected slug must exist and be fully populated.
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
    RAISE EXCEPTION 'Product content seed: % catalogue slugs were not found', v_missing;
  END IF;

  SELECT COUNT(*) INTO v_blank
  FROM public.products p
  WHERE p.slug IN (SELECT slug FROM (VALUES ('12v-dc-cctv-power-pigtail-connectors'), ('acer-performance-laptop'), ('acer-veriton-commercial-tower'), ('asus-desktop-keyboard-mouse-set'), ('asus-desktop-motherboard'), ('asus-tuf-gaming-laptop'), ('barcode-thermal-receipt-printers'), ('braided-4k-high-speed-hdmi-cable'), ('brother-color-mfp-copier-adf'), ('brother-commercial-color-copier'), ('brother-mono-laser-printer'), ('canon-imageclass-mono-laser-printer'), ('canon-pixma-ink-tank-printer'), ('cat6-gigabit-ethernet-patch-cord'), ('cctv-3-plus-1-coaxial-video-cable'), ('commercial-slim-all-in-one-pc'), ('compact-desktop-mono-laser-printer'), ('compact-portable-wireless-mouse'), ('cooler-master-rgb-cpu-cooler'), ('corsair-modular-atx-smps-power-supply'), ('corsair-vengeance-lpx-ddr4-ram'), ('cp-plus-360-ptz-smart-camera'), ('cp-plus-full-hd-dome-camera'), ('cp-plus-rfid-attendance-device'), ('custom-gaming-studio-workstation-setup'), ('custom-liquid-cooled-gaming-rig'), ('dell-inspiron-business-laptop'), ('dell-kb216-wired-multimedia-keyboard'), ('dell-km3322w-wireless-combo'), ('dell-latitude-business-laptop'), ('dell-ms116-usb-optical-mouse'), ('dell-precision-cad-workstation-tower'), ('dell-sff-compact-workstation'), ('dell-wm126-wireless-optical-mouse'), ('desktop-pc-monitor-3-pin-power-cord'), ('displayport-1-4-monitor-cable'), ('dual-band-wifi-6-routers-poe-gigabit-switches'), ('electromagnetic-door-access-controllers'), ('enterprise-matte-all-in-one-pc'), ('epson-ecotank-ink-tank-printer'), ('ergonomic-commercial-wired-mouse'), ('ergonomic-full-size-wireless-combo'), ('essl-rfid-card-keypad-terminal'), ('heavy-duty-15-pin-vga-cable'), ('heavy-duty-bnc-compression-video-connectors'), ('high-performance-thermal-paste-compound'), ('high-speed-nvme-m2-ssds-external-drives'), ('hikvision-colorvu-4k-bullet-camera'), ('hikvision-full-hd-dome-camera'), ('hikvision-minmoe-face-terminal'), ('hikvision-wall-mount-face-terminal'), ('hp-230-wireless-keyboard-combo'), ('hp-color-laserjet-enterprise-mfp'), ('hp-elitebook-corporate-laptop'), ('hp-gaming-optical-mouse'), ('hp-mechanical-rgb-keyboard'), ('hp-pavilion-silver-slim-laptop'), ('hp-probook-commercial-laptop'), ('kingston-desktop-ddr-ram-module'), ('lenovo-300-wireless-keyboard-combo'), ('lenovo-commercial-office-laptop'), ('lenovo-thinkcentre-desktop-tower'), ('lenovo-wireless-ergonomic-mouse'), ('logitech-mx-keys-mini-keyboard'), ('logitech-wireless-multimedia-keyboard'), ('mantra-optical-fingerprint-scanner'), ('multi-channel-cctv-dvr-nvr-recorder'), ('multi-channel-cctv-smps-power-supply'), ('nvidia-geforce-dedicated-graphics-card'), ('samsung-870-evo-sata-ssd'), ('sata-6gbps-internal-drive-cable'), ('seagate-barracuda-3-5-inch-hdd'), ('slim-chiclet-low-profile-keyboard'), ('smart-outdoor-wifi-bullet-camera'), ('standard-office-wired-keyboard'), ('ultra-slim-metallic-notebook'), ('usb-type-c-fast-charging-data-cable'), ('wireless-office-keyboard-mouse-combo'), ('zebronics-optical-wired-mouse')) AS v(slug))
    AND (p.description IS NULL OR btrim(p.description) = '' OR p.key_features = '{}'::text[]);

  IF v_blank > 0 THEN
    RAISE EXCEPTION 'Product content seed: % catalogue products were left without description/key features', v_blank;
  END IF;
END;
$$;
