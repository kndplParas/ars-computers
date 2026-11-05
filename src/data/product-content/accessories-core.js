/**
 * ARS Computers — Storage, components, power and desktop accessory content.
 */

export const ACCESSORY_CORE_CONTENT = {
  'high-speed-nvme-m2-ssds-external-drives': {
    description:
      'PCIe Gen4 NVMe M.2 drives deliver much higher sequential throughput than SATA SSDs, making them suitable for large project files, video editing, virtual machines and fast Windows boots. This listing also covers high-speed portable USB-C external drives for moving large files between machines. Because capacities, controllers and enclosure types vary, the exact drive, read/write speed and endurance are confirmed with sales.',
    keyFeatures: [
      'PCIe Gen4 x4 NVMe M.2 internal SSDs',
      'Portable USB-C external drive options',
      'Sequential read speeds up to 7,400 MB/s on Gen4 class drives',
      'Capacities from 500 GB to 4 TB depending on model',
      'Suitable for video editing, large datasets and fast boot',
      'Exact model, capacity and endurance confirmed with sales'
    ],
    specs: {
      product_type: 'NVMe M.2 SSD and portable external SSD',
      drive_form_factor: 'M.2 2280 internal / portable USB-C external — confirm variant',
      capacity: '500 GB to 4 TB options — confirm with sales',
      memory_type: '3D NAND flash (model-dependent)',
      interface: 'PCIe Gen4 x4 (internal) / USB-C (external)',
      storage_speed: 'Up to 7,400 MB/s sequential read on Gen4 class drives',
      endurance: 'Capacity-dependent — confirm TBW with sales',
      compatibility: 'M.2 PCIe Gen4/Gen3 slots; USB-C devices for external drives',
      operating_temperature: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Confirm the motherboard M.2 slot key, PCIe generation and available length before buying an internal drive. For external drives, confirm the host device supports USB-C or the required USB standard. ARS Computers can check compatibility with your system.',
    boxContents:
      'Drive unit and documentation. Mounting screws, heatsink or USB cable are included only where supplied by the selected retail pack.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand NVMe/portable SSD solution listing. Gen4 speed class is stated by the catalogue; exact model, capacity and endurance are confirmed by ARS Computers.'
  },

  'dual-band-wifi-6-routers-poe-gigabit-switches': {
    description:
      'This networking range covers dual-band Wi-Fi 6 routers and PoE gigabit switches for offices, shops and small campuses. Wi-Fi 6 improves efficiency in dense device environments, while PoE switches carry both data and power to access points and IP cameras over a single Ethernet cable. Because the listing covers several router and switch classes, port count, PoE budget, wireless speed and mesh support are confirmed with sales.',
    keyFeatures: [
      'Dual-band Wi-Fi 6 router options',
      'PoE gigabit switch options for cameras and access points',
      'High-gain multi-antenna wireless design',
      'Mesh-capable coverage on supported models',
      'Gigabit wired backbone',
      'Exact model and PoE budget confirmed with sales'
    ],
    specs: {
      product_type: 'Wi-Fi 6 router and PoE gigabit switch',
      network_type: 'Dual-band wireless and wired Gigabit Ethernet',
      wifi_standard: 'Wi-Fi 6 (802.11ax) on supported routers',
      networking_speed: 'Gigabit wired; AX wireless speeds model-dependent',
      networking_ports: 'Gigabit Ethernet; port count confirmed per model',
      poe: 'PoE/PoE+ on supported switch models — budget confirmed with sales',
      coverage: 'Configuration-dependent — confirm with sales',
      power: 'External adapter or internal PSU depending on model',
      dimensions: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Confirm broadband speed, building layout, number of PoE devices and whether mesh coverage is required. ARS Computers can specify the router/switch combination and check PoE budget against cameras or access points.',
    boxContents:
      'Router or switch unit, power adapter, antennas where removable, and documentation. Ethernet cables and mounting hardware are supplied only where included by the selected model.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand Wi-Fi 6 and PoE switch solution listing. Wireless standard and PoE capability are series-level; exact model, port count and PoE budget are confirmed by ARS Computers.'
  },

  'samsung-870-evo-sata-ssd': {
    description:
      'The Samsung 870 EVO is a 2.5-inch SATA III solid-state drive for upgrading laptops, desktops and older systems that do not have an M.2 slot. Samsung V-NAND flash and the SATA 6 Gb/s interface provide a large jump in responsiveness over a mechanical hard drive, with sequential reads up to 560 MB/s on the series. Capacities and endurance vary by model, so the stocked capacity and TBW rating are confirmed with sales.',
    keyFeatures: [
      'Samsung 870 EVO 2.5-inch SATA SSD',
      'SATA III 6 Gb/s interface',
      'Samsung V-NAND flash technology',
      'Up to 560 MB/s sequential read on the series',
      'Direct replacement for 2.5-inch laptop/desktop drives',
      'Capacity and endurance confirmed with sales'
    ],
    specs: {
      product_type: '2.5-inch SATA solid-state drive',
      drive_form_factor: '2.5-inch, 7 mm',
      capacity: '250 GB / 500 GB / 1 TB / 2 TB / 4 TB options — confirm with sales',
      memory_type: 'Samsung V-NAND',
      interface: 'SATA III 6 Gb/s',
      storage_speed: 'Up to 560 MB/s sequential read, 530 MB/s sequential write (series)',
      endurance: 'Capacity-dependent — confirm TBW with sales',
      compatibility: 'Laptops and desktops with a 2.5-inch SATA bay; USB enclosure for external use',
      power: 'SATA power connector (desktop) / slot power (laptop)'
    },
    compatibility:
      'Fits standard 2.5-inch SATA drive bays and works with SATA II or SATA III ports (at the port speed). Confirm the required capacity, cloning requirements and warranty terms with ARS Computers sales.',
    boxContents:
      'SSD unit and documentation. Mounting screws, SATA cable or cloning software are not included unless specified by the retail pack.',
    specsVerified: 'partially_verified',
    specSource:
      'Samsung 870 EVO series specifications. Interface, form factor and series speed are manufacturer-level; exact capacity and endurance are confirmed by ARS Computers.'
  },

  'seagate-barracuda-3-5-inch-hdd': {
    description:
      'The Seagate BarraCuda 3.5-inch hard drive provides high-capacity internal storage for desktop PCs, backup systems and surveillance recorders. It is a cost-effective choice for bulk files, archives and secondary storage alongside an SSD. Capacity, rotation speed and cache size vary across the BarraCuda family, so the exact stocked model and its suitability for continuous surveillance recording are confirmed with sales.',
    keyFeatures: [
      'Seagate BarraCuda 3.5-inch internal hard drive',
      'SATA 6 Gb/s interface',
      'High-capacity storage for desktops and archives',
      'Suitable for secondary storage and backup',
      'Broad capacity range',
      'Exact model and capacity confirmed with sales'
    ],
    specs: {
      product_type: '3.5-inch internal hard disk drive',
      drive_form_factor: '3.5-inch',
      capacity: '1 TB to 8 TB options — confirm with sales',
      interface: 'SATA 6 Gb/s',
      storage_speed: '7200 RPM class on supported capacities — confirm with sales',
      endurance: 'Desktop workload rating; confirm surveillance suitability with sales',
      compatibility: 'Desktop SATA bays and compatible DVR/NVR recorders',
      power: 'SATA power connector',
      dimensions: 'Standard 3.5-inch drive dimensions'
    },
    compatibility:
      'Fits standard 3.5-inch desktop bays. For 24/7 CCTV recording, confirm whether a surveillance-rated drive is required instead of a desktop BarraCuda model. ARS Computers can match the drive to the recorder.',
    boxContents:
      'Hard drive unit and documentation. SATA cable and mounting screws are not included unless specified by the retail pack.',
    specsVerified: 'partially_verified',
    specSource:
      'Seagate BarraCuda series specifications. Form factor and SATA interface are manufacturer-level; exact capacity, RPM and workload rating are confirmed by ARS Computers.'
  },

  'corsair-vengeance-lpx-ddr4-ram': {
    description:
      'Corsair Vengeance LPX is a low-profile DDR4 desktop memory series with an aluminium heat spreader, designed to fit under large CPU air coolers and inside compact cases. It is used for gaming builds, content-creation systems and office desktops that need a memory upgrade. Capacities, speeds and timings vary by kit, so the exact kit configuration and motherboard compatibility are confirmed with sales.',
    keyFeatures: [
      'Corsair Vengeance LPX DDR4 desktop memory',
      'Pure aluminium low-profile heat spreader',
      'Fits under large CPU air coolers',
      'High-speed DDR4 options',
      'Dual-channel kit options',
      'Exact kit speed and capacity confirmed with sales'
    ],
    specs: {
      product_type: 'Desktop DDR4 memory kit',
      memory_type: 'DDR4',
      interface: '288-pin DIMM',
      capacity: '8 GB / 16 GB / 32 GB kit options — confirm with sales',
      memory_speed: '2400–3600 MHz options — confirm with sales',
      compatibility: 'DDR4 desktop motherboards; check motherboard QVL',
      voltage: '1.2–1.35 V depending on kit — confirm with sales',
      heatspreader: 'Aluminium low-profile heat spreader'
    },
    compatibility:
      'Requires a DDR4 desktop motherboard with the correct number of free DIMM slots. Confirm the kit capacity, speed, timings and XMP support against the motherboard QVL with ARS Computers sales.',
    boxContents:
      'Memory kit (one or more DIMMs) and documentation. Exact module count depends on the selected kit.',
    specsVerified: 'partially_verified',
    specSource:
      'Corsair Vengeance LPX series specifications. DDR4, 288-pin DIMM and aluminium heat spreader are series-level; exact kit capacity and speed are confirmed by ARS Computers.'
  },

  'kingston-desktop-ddr-ram-module': {
    description:
      'Kingston desktop memory modules are standard JEDEC-compliant DIMMs for commercial and office desktop upgrades. They are tested for compatibility with common business systems and are available in DDR3 and DDR4 generations depending on the machine. Because the listing covers multiple generations, the exact pin count, capacity and speed must be matched to the motherboard before ordering.',
    keyFeatures: [
      'Kingston desktop memory module',
      'Standard JEDEC-compliant design',
      'DDR3 and DDR4 options depending on model',
      'Suitable for commercial desktop upgrades',
      'Reliable office-system memory',
      'Exact generation and capacity confirmed with sales'
    ],
    specs: {
      product_type: 'Desktop memory module',
      memory_type: 'DDR3 or DDR4 — confirm generation',
      interface: '240-pin DIMM (DDR3) / 288-pin DIMM (DDR4)',
      capacity: '4 GB / 8 GB / 16 GB options — confirm with sales',
      memory_speed: 'Standard JEDEC speed — confirm with sales',
      compatibility: 'Desktop motherboards matching the memory generation and slot type',
      voltage: 'Generation-dependent — confirm with sales'
    },
    compatibility:
      'DDR3 and DDR4 are not interchangeable. Confirm the motherboard model, existing memory generation and maximum supported capacity with ARS Computers before purchase.',
    boxContents:
      'Memory module and documentation. Exact module count depends on the selected pack.',
    specsVerified: 'partially_verified',
    specSource:
      'Kingston desktop memory series listing. JEDEC compliance and DIMM form factor are series-level; exact generation, capacity and speed are confirmed by ARS Computers.'
  },

  'high-performance-thermal-paste-compound': {
    description:
      'Thermal interface compound fills microscopic gaps between a CPU or GPU and its heatsink, improving heat transfer and stabilising operating temperatures. This high-performance paste is non-electrically conductive, so excess material is less likely to cause a short circuit if it contacts nearby components. The listing covers thermal compound syringes supplied by ARS Computers; the exact brand, quantity and thermal conductivity are confirmed with sales.',
    keyFeatures: [
      'High-performance thermal interface compound',
      'Non-electrically conductive formula',
      'Improves heat transfer from CPU/GPU to heatsink',
      'Suitable for desktop and laptop repasting',
      'Syringe applicator',
      'Exact brand and quantity confirmed with sales'
    ],
    specs: {
      product_type: 'Thermal interface compound',
      capacity: 'Syringe quantity model-dependent — confirm with sales',
      thermal_conductivity: 'High-performance class — exact rating confirmed with sales',
      compatibility: 'CPU/GPU heatsinks and cold plates; non-electrically conductive',
      operating_temperature: 'Configuration-dependent — confirm with sales',
      application: 'Apply a thin, even layer to the processor heat spreader'
    },
    compatibility:
      'Suitable for desktop and laptop CPU/GPU heatsinks, graphics-card cold plates and console repairs. Clean old paste and confirm the correct application method before use. ARS Computers can advise on quantity and application.',
    boxContents:
      'Thermal compound syringe and applicator where supplied. Cleaning wipes and spreader are included only if specified by the selected pack.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand thermal compound solution listing. Non-conductive formulation is stated by the catalogue; exact brand, quantity and conductivity are confirmed by ARS Computers.'
  },

  'cooler-master-rgb-cpu-cooler': {
    description:
      'The Cooler Master RGB air cooler is a desktop CPU heatsink with direct-contact copper heatpipes and an RGB PWM fan. It is intended for gaming and performance builds that need better cooling than a stock cooler while keeping the system easy to maintain. Socket support, heatpipe count, fan size and cooler height vary by model, so the exact compatibility and clearance are confirmed with sales.',
    keyFeatures: [
      'Cooler Master desktop CPU air cooler',
      'Direct-contact copper heatpipes',
      'RGB PWM airflow fan',
      'Suitable for gaming and performance builds',
      'Multiple Intel/AMD socket kits on supported models',
      'Exact model and socket support confirmed with sales'
    ],
    specs: {
      product_type: 'Desktop CPU air cooler',
      socket: 'Intel/AMD socket support depends on model — confirm with sales',
      heatpipes: 'Direct-contact copper heatpipes',
      fan: 'RGB PWM fan — size confirmed per model',
      lighting: 'RGB lighting',
      tdp: 'Model-dependent — confirm with sales',
      compatibility: 'Confirm case clearance, RAM height and socket kit before purchase',
      dimensions: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Confirm the CPU socket, case cooler-height clearance and RAM module height before buying. Some large air coolers overlap tall RGB memory. ARS Computers can check fitment for the selected case and motherboard.',
    boxContents:
      'Cooler unit, fan, mounting bracket kit, thermal paste where supplied, and documentation. Exact bundle depends on the selected model.',
    specsVerified: 'partially_verified',
    specSource:
      'Cooler Master RGB CPU cooler series listing. Direct-contact heatpipes and RGB PWM fan are series-level; exact model, socket support and dimensions are confirmed by ARS Computers.'
  },

  'corsair-modular-atx-smps-power-supply': {
    description:
      'The Corsair RM-series modular ATX power supply delivers stable DC power for gaming and commercial desktop builds. A fully modular cable system lets the builder connect only the cables needed, reducing clutter and improving airflow. The 80 PLUS certification indicates efficiency at typical loads, and the fan curve is tuned for quiet operation. Wattage, efficiency level and connector count vary by model, so the exact unit is confirmed with sales.',
    keyFeatures: [
      'Corsair RM-series modular ATX power supply',
      '80 PLUS certified efficiency',
      'Fully modular cable system',
      'Quiet fan curve',
      'Suitable for gaming and commercial desktops',
      'Exact wattage and connectors confirmed with sales'
    ],
    specs: {
      product_type: 'ATX desktop power supply',
      wattage: '450–850 W options — confirm with sales',
      efficiency: '80 PLUS certified — exact level confirmed per model',
      modular: 'Fully modular on the RM series',
      connectors: '24-pin ATX, EPS, PCIe, SATA and Molex — count confirmed per model',
      fan: 'Quiet-profile cooling fan',
      compatibility: 'ATX cases; confirm GPU power connectors and case clearance',
      dimensions: 'Standard ATX form factor — depth confirmed per model'
    },
    compatibility:
      'Confirm the graphics card power connectors, total system wattage and case clearance before purchase. ARS Computers can size the PSU for the selected CPU and GPU.',
    boxContents:
      'Power supply unit, modular cable set, power cord where supplied, mounting screws and documentation. Exact cable set depends on the selected model.',
    specsVerified: 'partially_verified',
    specSource:
      'Corsair RM-series listing. 80 PLUS certification and fully modular cabling are series-level; exact wattage, efficiency level and connectors are confirmed by ARS Computers.'
  },

  'nvidia-geforce-dedicated-graphics-card': {
    description:
      'An NVIDIA GeForce dedicated graphics card adds GPU acceleration for gaming, 3D modelling, video rendering and multi-monitor workstations. Ray-tracing cores and dedicated GDDR memory are present on supported RTX models. Because the GeForce RTX family spans many performance tiers, the exact GPU model, VRAM capacity, power requirement and output layout are confirmed with sales before ordering.',
    keyFeatures: [
      'NVIDIA GeForce dedicated graphics card',
      'Ray-tracing cores on supported RTX models',
      'Dedicated GDDR video memory',
      'Multi-display output support',
      'Suitable for gaming, 3D rendering and video editing',
      'Exact GPU model and VRAM confirmed with sales'
    ],
    specs: {
      product_type: 'Dedicated desktop graphics card',
      gpu_model: 'NVIDIA GeForce RTX series — exact model confirmed with sales',
      vram: 'GDDR6/GDDR6X capacity model-dependent',
      interface: 'PCIe x16 — generation model-dependent',
      connectors: 'DisplayPort/HDMI outputs model-dependent',
      power_supply: 'System PSU requirement model-dependent',
      tdp: 'Model-dependent — confirm with sales',
      compatibility: 'Desktop PCIe x16 slot; confirm PSU, case length and monitor inputs',
      dimensions: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Confirm the motherboard PCIe slot, case graphics-card length, PSU wattage and monitor connections before purchase. ARS Computers can check the card against the intended system and workload.',
    boxContents:
      'Graphics card, support bracket where supplied, and documentation. Power cables are supplied with the PSU, not the graphics card.',
    specsVerified: 'configuration_dependent',
    specSource:
      'NVIDIA GeForce RTX series listing. Ray tracing and dedicated GDDR memory are series-level; exact GPU model, VRAM and power requirement are confirmed by ARS Computers.'
  },

  'asus-desktop-motherboard': {
    description:
      'The ASUS desktop motherboard provides the foundation for a custom commercial or gaming build, with robust power delivery, cooling heatsinks and expansion slots. This listing covers ASUS boards across different chipsets and sockets, so the CPU generation, memory type, M.2 support and PCIe version must be matched to the build. Exact chipset, socket, form factor and connectivity are confirmed with sales.',
    keyFeatures: [
      'ASUS commercial/gaming desktop motherboard',
      'Robust power delivery stages',
      'Dual M.2 slots on supported models',
      'PCIe 4.0/5.0 support depending on chipset',
      'Cooling heatsinks over VRM and M.2 areas',
      'Exact socket, chipset and form factor confirmed with sales'
    ],
    specs: {
      product_type: 'Desktop motherboard',
      socket: 'Intel/AMD socket depends on model — confirm with sales',
      chipset: 'Model-dependent — confirm with sales',
      ram: 'DDR4 or DDR5 depending on model — confirm with sales',
      expansion: 'PCIe slots and dual M.2 on supported models',
      system_form_factor: 'ATX/mATX form factor depends on model',
      system_ports: 'USB, Ethernet, audio and video outputs model-dependent',
      networking: 'Gigabit/2.5G Ethernet and Wi-Fi options depending on model',
      compatibility: 'Confirm CPU generation, RAM type, case form factor and PSU'
    },
    compatibility:
      'The motherboard must match the CPU socket, memory generation and case form factor. Confirm the exact model, BIOS support for the intended CPU and required M.2/PCIe layout with ARS Computers sales.',
    boxContents:
      'Motherboard, I/O shield where applicable, SATA cables, mounting hardware and documentation. Exact bundle depends on the selected model.',
    specsVerified: 'partially_verified',
    specSource:
      'ASUS desktop motherboard series listing. Power delivery, cooling and expansion features are series-level; exact socket, chipset and memory support are confirmed by ARS Computers.'
  },

  'multi-channel-cctv-smps-power-supply': {
    description:
      'A multi-channel CCTV SMPS distributes regulated 12 V DC power to several cameras from one enclosed unit. Individual channel fuses help protect each camera circuit, and the ventilated metal casing is designed for installation near a recorder or distribution point. Channel count and current rating vary, so the exact unit must be matched to the total camera load. Installation by a qualified technician is recommended.',
    keyFeatures: [
      'Multi-channel regulated 12 V DC CCTV power supply',
      'Individual channel fuse protection',
      'Ventilated metal enclosure',
      'Centralised camera power distribution',
      'Wall or shelf installation',
      'Exact channel count and current rating confirmed with sales'
    ],
    specs: {
      product_type: 'Multi-channel CCTV power supply (SMPS)',
      wattage: '4/8/16-channel and 5–30 A options — confirm with sales',
      connectors: '12 V DC outputs with individual fuses',
      power: '230 V AC input',
      compatibility: '12 V DC CCTV cameras; confirm total camera load',
      installation: 'Wall or distribution-box mounting by a qualified technician',
      dimensions: 'Configuration-dependent — confirm with sales',
      operating_temperature: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Total camera current draw must stay within the SMPS rating. Confirm the number of cameras, cable voltage drop and whether the cameras require 12 V DC or PoE with ARS Computers before installation.',
    boxContents:
      'SMPS unit and documentation. Power cord, output leads and fuses are included only where supplied by the selected model.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand CCTV SMPS solution listing. Regulated 12 V DC output and fused channels are stated by the catalogue; exact channel count and current rating are confirmed by ARS Computers.'
  },

  'dell-precision-cad-workstation-tower': {
    description:
      'The Dell Precision tower is an enterprise workstation for CAD, BIM, structural analysis, 3D rendering and other compute-heavy professional workloads. It offers professional graphics options, error-correcting or high-capacity memory configurations on supported models, and expandable storage and PCIe bays. This listing covers the Precision tower models supplied by ARS Computers; the exact processor, GPU, memory and ISV certification are confirmed with sales.',
    keyFeatures: [
      'Dell Precision professional workstation tower',
      'Built for CAD, BIM and 3D rendering',
      'Professional graphics options',
      'Enterprise expansion slots and drive bays',
      'High-airflow front honeycomb mesh',
      'Exact configuration and ISV certification confirmed with sales'
    ],
    specs: {
      product_type: 'CAD/3D professional workstation tower',
      processor: 'Intel Xeon/Core options — confirm with sales',
      ram: 'ECC/non-ECC memory options — confirm with sales',
      storage: 'SSD/HDD combinations — confirm with sales',
      gpu: 'Professional NVIDIA/AMD GPU options — confirm with sales',
      system_form_factor: 'Full tower workstation',
      expansion: 'PCIe slots and drive bays model-dependent',
      system_ports: 'USB, audio and display ports model-dependent',
      power_supply: 'Model-dependent — sized for the selected GPU',
      compatibility: 'CAD/BIM/3D software; ISV certifications model-dependent'
    },
    compatibility:
      'Confirm the software certification requirements, GPU model, memory capacity and storage layout with ARS Computers before ordering. Workstation performance depends on matching the configuration to the application.',
    boxContents:
      'Workstation tower, power cable and documentation. Monitor, keyboard and mouse are supplied separately unless included on the quotation.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Dell Precision tower solution listing. Workstation-class expansion and airflow features are series-level; exact model and configuration are confirmed by ARS Computers.'
  },

  'lenovo-thinkcentre-desktop-tower': {
    description:
      'The Lenovo ThinkCentre commercial desktop tower is built for business stability, easy serviceability and long-term office deployment. A tool-less chassis simplifies upgrades and maintenance, and front USB/audio ports keep everyday connections within reach. This listing covers the ThinkCentre tower models supplied by ARS Computers. Processor, memory, storage, ports and warranty are confirmed against the selected model.',
    keyFeatures: [
      'Lenovo ThinkCentre commercial desktop tower',
      'Tool-less chassis for easy service access',
      'Front USB and audio ports',
      'Enterprise stability and manageability',
      'Expandable storage and PCIe options',
      'Exact configuration confirmed with sales'
    ],
    specs: {
      product_type: 'Commercial desktop tower',
      processor: 'Configuration-dependent — confirm with sales',
      ram: 'Configuration-dependent — confirm with sales',
      storage: 'Configuration-dependent — confirm with sales',
      gpu: 'Integrated or discrete graphics depending on model',
      system_form_factor: 'Desktop tower',
      expansion: 'PCIe slots and drive bays model-dependent',
      system_ports: 'Front USB/audio; rear ports model-dependent',
      networking: 'Gigabit Ethernet; Wi-Fi on selected models',
      power_supply: 'Model-dependent'
    },
    compatibility:
      'Suitable for office suites, billing, ERP/CRM and general business workloads. Confirm the exact model, operating system, warranty and peripheral requirements with ARS Computers sales.',
    boxContents:
      'Desktop tower, power cable and documentation. Monitor, keyboard and mouse are supplied separately unless included on the quotation.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Lenovo ThinkCentre tower series listing. Tool-less chassis and front port layout are series-level; exact model and configuration are confirmed by ARS Computers.'
  },

  'dell-sff-compact-workstation': {
    description:
      'The Dell OptiPlex Small Form Factor desktop delivers enterprise computing in a compact chassis that can sit horizontally under a monitor or vertically beside a desk. It is intended for offices, billing counters and retail back-offices where desk space is limited. This listing covers the OptiPlex SFF models supplied by ARS Computers. Exact processor, memory, storage, ports and warranty are confirmed with sales.',
    keyFeatures: [
      'Dell OptiPlex Small Form Factor desktop',
      'Compact chassis with horizontal or vertical orientation',
      'Full desktop-class business performance',
      'Space-saving design for counters and offices',
      'Enterprise manageability features',
      'Exact configuration confirmed with sales'
    ],
    specs: {
      product_type: 'Small Form Factor commercial desktop',
      processor: 'Configuration-dependent — confirm with sales',
      ram: 'Configuration-dependent — confirm with sales',
      storage: 'Configuration-dependent — confirm with sales',
      gpu: 'Integrated or low-profile discrete graphics depending on model',
      system_form_factor: 'Small Form Factor (SFF), horizontal or vertical',
      expansion: 'Low-profile PCIe slots and drive bays model-dependent',
      system_ports: 'USB, video and audio ports model-dependent',
      networking: 'Gigabit Ethernet; Wi-Fi on selected models',
      power_supply: 'External or internal PSU depending on model'
    },
    compatibility:
      'Suited to office productivity, billing, ERP/CRM and point-of-sale use. Confirm the exact model, monitor outputs, operating system and warranty with ARS Computers sales.',
    boxContents:
      'Desktop unit, power adapter or power cable depending on model, stand where supplied, and documentation. Monitor, keyboard and mouse are supplied separately unless included on the quotation.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Dell OptiPlex SFF series listing. Compact dual-orientation chassis is series-level; exact model and configuration are confirmed by ARS Computers.'
  },

  'acer-veriton-commercial-tower': {
    description:
      'The Acer Veriton commercial tower is a business desktop for offices, schools and back-office departments that need expandable, reliable computing. PCIe expansion bays support add-in cards, and multiple display outputs allow dual-monitor productivity. This listing covers the Veriton tower models supplied by ARS Computers. Exact processor, memory, storage, graphics and warranty are confirmed with sales.',
    keyFeatures: [
      'Acer Veriton commercial desktop tower',
      'Expandable PCIe bays',
      'Multi-display output support',
      'Quiet cooling for office environments',
      'Business-grade reliability',
      'Exact configuration confirmed with sales'
    ],
    specs: {
      product_type: 'Commercial desktop tower',
      processor: 'Configuration-dependent — confirm with sales',
      ram: 'Configuration-dependent — confirm with sales',
      storage: 'Configuration-dependent — confirm with sales',
      gpu: 'Integrated or discrete graphics depending on model',
      system_form_factor: 'Desktop tower',
      expansion: 'PCIe slots and drive bays model-dependent',
      system_ports: 'USB, video and audio ports model-dependent',
      networking: 'Gigabit Ethernet; Wi-Fi on selected models',
      power_supply: 'Model-dependent'
    },
    compatibility:
      'Suitable for office productivity, education, accounting and general business workloads. Confirm the exact model, display outputs, operating system and warranty with ARS Computers sales.',
    boxContents:
      'Desktop tower, power cable and documentation. Monitor, keyboard and mouse are supplied separately unless included on the quotation.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Acer Veriton tower series listing. Expandable PCIe design and multi-display support are series-level; exact model and configuration are confirmed by ARS Computers.'
  }
}
