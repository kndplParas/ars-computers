/**
 * ARS Computers — Cable, connector and power accessory content.
 */

export const ACCESSORY_CABLE_CONTENT = {
  'braided-4k-high-speed-hdmi-cable': {
    description:
      'This braided HDMI cable carries high-speed digital video and audio between a computer, monitor, TV, projector or console. Gold-plated connectors and nylon braiding improve durability, while the HDMI 2.0 class bandwidth supports 4K output at 60 Hz. It is a practical cable for office displays, meeting rooms and home entertainment. Available lengths are confirmed with sales.',
    keyFeatures: [
      'High-speed 4K HDMI cable',
      'Gold-plated connectors',
      'Nylon braided exterior',
      '4K UHD at 60 Hz on HDMI 2.0 class cables',
      'Supports digital audio and video',
      'Available lengths confirmed with sales'
    ],
    specs: {
      product_type: 'HDMI audio/video cable',
      connector: 'HDMI male to HDMI male',
      connector_type: 'Standard HDMI (Type A)',
      length: '1 m / 1.5 m / 3 m options — confirm with sales',
      bandwidth: '18 Gbps HDMI 2.0 class',
      resolution_support: '4K UHD at 60 Hz',
      shielding: 'Nylon braided jacket with shielded conductors',
      compatibility: 'TVs, monitors, projectors, consoles and computers with HDMI'
    },
    compatibility:
      'Works with devices that have a standard HDMI Type-A port. Confirm the required length, 4K refresh rate and whether HDMI 2.1 bandwidth is needed with ARS Computers sales.',
    boxContents:
      'HDMI cable and documentation where supplied.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand 4K HDMI cable solution listing. Gold-plated connectors and 4K 60 Hz support are stated by the catalogue; exact length and bandwidth certification are confirmed by ARS Computers.'
  },

  'displayport-1-4-monitor-cable': {
    description:
      'This DisplayPort 1.4 monitor cable is designed for high-refresh gaming monitors and CAD workstations that need more bandwidth than HDMI 2.0. Latching connectors help prevent accidental disconnection, and the cable supports 8K and high-refresh 4K modes on compatible hardware. Exact length, certification and DSC support are confirmed with sales.',
    keyFeatures: [
      'DisplayPort 1.4 monitor cable',
      'Latching DP connectors',
      '8K and high-refresh 4K support on compatible hardware',
      'Suitable for gaming monitors and CAD displays',
      'Shielded construction',
      'Exact length and certification confirmed with sales'
    ],
    specs: {
      product_type: 'DisplayPort monitor cable',
      connector: 'DisplayPort male to male',
      connector_type: 'DisplayPort 1.4 with mechanical latch',
      length: '1 m / 2 m / 3 m options — confirm with sales',
      bandwidth: '32.4 Gbps DisplayPort 1.4 class',
      resolution_support: '8K and high-refresh 4K with DSC on compatible hardware',
      shielding: 'Shielded cable construction',
      compatibility: 'Monitors, graphics cards and docks with DisplayPort'
    },
    compatibility:
      'Requires DisplayPort outputs on both the graphics card and monitor. Confirm the monitor refresh rate, DSC support and required cable length with ARS Computers sales.',
    boxContents:
      'DisplayPort cable and documentation where supplied.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand DisplayPort 1.4 cable solution listing. Latching connectors and 1.4 bandwidth are stated by the catalogue; exact length and certification are confirmed by ARS Computers.'
  },

  'cat6-gigabit-ethernet-patch-cord': {
    description:
      'This Cat6 UTP patch cord connects computers, routers, switches, IP cameras and PoE devices over a gigabit Ethernet network. Molded snagless boots protect the RJ45 latch during installation and removal, and the twisted-pair construction supports reliable short-to-medium cable runs. Exact length, conductor type and colour are confirmed with sales.',
    keyFeatures: [
      'Cat6 molded Gigabit Ethernet patch cord',
      'Snagless RJ45 boots',
      'Supports 1000 Mbps Gigabit Ethernet',
      'Suitable for PCs, routers, switches and IP cameras',
      'UTP twisted-pair construction',
      'Exact length and colour confirmed with sales'
    ],
    specs: {
      product_type: 'Cat6 Ethernet patch cord',
      connector: 'RJ45 male to male',
      connector_type: 'Cat6 UTP',
      length: '0.5 m to 20 m options — confirm with sales',
      data_rate: 'Up to 1 Gbps; 10 Gbps on short runs with suitable equipment',
      shielding: 'Unshielded twisted pair (UTP)',
      compatibility: 'Routers, switches, PCs, IP cameras and PoE devices'
    },
    compatibility:
      'Works with standard RJ45 Ethernet ports. Confirm the required length, PoE requirement and whether shielded cable is needed for the installation with ARS Computers sales.',
    boxContents:
      'Ethernet patch cord and documentation where supplied.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand Cat6 patch cord solution listing. Molded snagless boots and Gigabit support are stated by the catalogue; exact length and conductor type are confirmed by ARS Computers.'
  },

  'sata-6gbps-internal-drive-cable': {
    description:
      'This SATA III cable connects 2.5-inch SSDs, 3.5-inch hard drives and optical drives to a desktop motherboard. Metallic locking latches keep the connector secure during movement or service, and the shielded construction supports the 6 Gb/s SATA interface. It is a straightforward replacement or build cable for desktop systems.',
    keyFeatures: [
      'SATA III 6 Gb/s internal data cable',
      'Locking metal latch connectors',
      'For 2.5-inch SSDs, 3.5-inch HDDs and optical drives',
      'Shielded construction',
      'Straight or right-angle connector options',
      'Exact length confirmed with sales'
    ],
    specs: {
      product_type: 'SATA internal data cable',
      connector: 'SATA data male to male',
      connector_type: 'SATA III',
      length: '0.3 m / 0.5 m / 1 m options — confirm with sales',
      data_rate: 'Up to 6 Gbps',
      shielding: 'EMI shielding with locking latch',
      compatibility: 'Desktop motherboards and SATA drives'
    },
    compatibility:
      'Connects a SATA drive to a motherboard SATA port. Confirm the required length and whether straight or right-angle connectors are needed for the case layout with ARS Computers sales.',
    boxContents:
      'SATA data cable and documentation where supplied.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand SATA III cable solution listing. Locking latch and 6 Gbps support are stated by the catalogue; exact length and connector angle are confirmed by ARS Computers.'
  },

  'heavy-duty-15-pin-vga-cable': {
    description:
      'This heavy-duty VGA cable connects older monitors, projectors and displays to a computer using a 15-pin D-Sub analog connection. Dual ferrite cores suppress high-frequency noise that can cause flicker or ghosting, and gold-plated pins improve contact reliability. It is useful for legacy office displays, projectors and KVM setups.',
    keyFeatures: [
      'Heavy-duty 15-pin VGA display cable',
      'Dual ferrite noise choke cores',
      'Gold-plated D-Sub pins',
      'Screw-lock connectors',
      'Suitable for legacy monitors and projectors',
      'Exact length confirmed with sales'
    ],
    specs: {
      product_type: 'VGA analog display cable',
      connector: '15-pin D-Sub male to male',
      connector_type: 'VGA (DE-15)',
      length: '1.5 m / 3 m / 5 m options — confirm with sales',
      resolution_support: 'Up to 1080p depending on source and cable length',
      shielding: 'Dual ferrite cores and shielded conductors',
      compatibility: 'Computers, monitors, projectors and KVMs with VGA ports'
    },
    compatibility:
      'Requires VGA ports on both source and display. For modern digital displays, an HDMI or DisplayPort connection is preferable. Confirm the required length and resolution with ARS Computers sales.',
    boxContents:
      'VGA cable and documentation where supplied.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand VGA cable solution listing. Dual ferrite cores and gold-plated pins are stated by the catalogue; exact length and resolution support are confirmed by ARS Computers.'
  },

  'usb-type-c-fast-charging-data-cable': {
    description:
      'This USB Type-C cable supports charging and data transfer for modern laptops, phones, tablets and external drives. The reversible connector makes it easy to plug in, and the braided jacket is designed for daily travel use. Power rating and data speed depend on the exact cable variant, so the stocked version is confirmed with sales.',
    keyFeatures: [
      'USB Type-C charging and data cable',
      'Reversible Type-C connector',
      'Braided travel-friendly jacket',
      'Fast-charging support on compatible chargers',
      'Data sync for phones and drives',
      'Exact wattage and data speed confirmed with sales'
    ],
    specs: {
      product_type: 'USB Type-C charging and data cable',
      connector: 'USB-C to USB-C or USB-A to USB-C — confirm variant',
      connector_type: 'USB Type-C',
      length: '1 m / 1.5 m / 2 m options — confirm with sales',
      data_rate: 'USB 2.0 or USB 3.x depending on variant',
      power_rating: 'Fast charging up to 60 W/100 W depending on variant',
      compatibility: 'USB-C laptops, phones, tablets, external SSDs and accessories'
    },
    compatibility:
      'Confirm the required connector combination, charging wattage and data speed before purchase. Not every USB-C cable supports high-wattage charging or high-speed data. ARS Computers can match the cable to the device.',
    boxContents:
      'USB Type-C cable, travel pouch where supplied, and documentation.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand USB Type-C cable solution listing. Reversible connector and fast-charging support are stated by the catalogue; exact wattage and data speed are confirmed by ARS Computers.'
  },

  'desktop-pc-monitor-3-pin-power-cord': {
    description:
      'This 3-pin AC power cord connects desktop PCs, monitors, laser printers and UPS units to an Indian wall socket. It uses a moulded Indian 3-pin plug at one end and an IEC C13 socket at the other, with heavy-gauge copper conductors for reliable power delivery. Exact length and current rating are confirmed with sales.',
    keyFeatures: [
      '3-pin Indian plug to IEC C13 power cord',
      'Heavy-gauge copper conductors',
      'Moulded connectors for durability',
      'Suitable for PCs, monitors, printers and UPS units',
      'Reliable grounded connection',
      'Exact length and current rating confirmed with sales'
    ],
    specs: {
      product_type: 'AC power cord',
      connector: 'Indian 3-pin plug to IEC C13 female',
      connector_type: 'IEC 60320 C13',
      length: '1.5 m / 2 m / 3 m options — confirm with sales',
      gauge: 'Heavy-gauge copper conductors',
      power_rating: '6 A/10 A/16 A depending on variant — confirm with sales',
      compatibility: 'Desktop PCs, monitors, laser printers and UPS units with IEC C13 inlet'
    },
    compatibility:
      'Fits devices with an IEC C13 power inlet and Indian 3-pin wall sockets. Confirm the device current draw and required cable length with ARS Computers sales.',
    boxContents:
      'Power cord and documentation where supplied.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand IEC C13 power cord solution listing. Indian 3-pin plug and C13 socket are stated by the catalogue; exact length and current rating are confirmed by ARS Computers.'
  },

  'cctv-3-plus-1-coaxial-video-cable': {
    description:
      'CCTV 3+1 cable combines one coaxial video conductor with three power/audio cores in a single jacket, simplifying camera wiring over long runs. The shielded coaxial core carries the video signal, while the additional cores can supply 12 V DC power and audio where required. It is supplied as a coil for installation with BNC and DC connectors. Exact length, conductor material and shielding are confirmed with sales.',
    keyFeatures: [
      'CCTV 3+1 combination coaxial cable',
      'Solid copper video core plus three power/audio wires',
      'Braided shielding for signal protection',
      'Single jacket simplifies camera wiring',
      'Suitable for analog CCTV installations',
      'Exact coil length and conductor type confirmed with sales'
    ],
    specs: {
      product_type: 'CCTV combination coaxial cable',
      connector: 'Bare cable — BNC and DC connectors fitted on site',
      connector_type: '3+1 coaxial',
      length: '100 m / 305 m coil options — confirm with sales',
      gauge: 'Configuration-dependent — confirm with sales',
      shielding: 'Braided/foil shielding over the video core',
      compatibility: 'Analog CCTV cameras, DVRs and 12 V DC power distribution'
    },
    compatibility:
      'Intended for analog CCTV runs with compatible BNC connectors and power pigtails. Confirm the run length, voltage drop and whether the camera requires a different cable type with ARS Computers.',
    boxContents:
      'Cable coil and documentation where supplied. BNC connectors and power pigtails are supplied separately.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand CCTV 3+1 cable solution listing. Coaxial video plus power conductors are stated by the catalogue; exact coil length and conductor specification are confirmed by ARS Computers.'
  },

  '12v-dc-cctv-power-pigtail-connectors': {
    description:
      'These 12 V DC power pigtail connectors join CCTV camera power leads to a power supply or extension cable. The pair uses standard 2.1 mm x 5.5 mm barrel plugs with screw-terminal or pre-tinned tails, making field repairs and camera swaps straightforward. Exact wire length, gauge and pack quantity are confirmed with sales.',
    keyFeatures: [
      '12 V DC CCTV power pigtail pair',
      'Standard 2.1 mm x 5.5 mm barrel plugs',
      'Male and female connectors',
      'Screw-terminal or pre-tinned tails',
      'Useful for camera power repairs and extensions',
      'Exact pack quantity confirmed with sales'
    ],
    specs: {
      product_type: 'DC power pigtail connectors',
      connector: '2.1 mm x 5.5 mm barrel plug (male and female)',
      connector_type: 'DC barrel',
      length: 'Short pigtail — exact length confirmed with sales',
      gauge: 'Configuration-dependent — confirm with sales',
      power_rating: '12 V DC CCTV power',
      compatibility: 'CCTV cameras and 12 V DC power supplies'
    },
    compatibility:
      'Matches cameras and power supplies that use a standard 2.1 mm x 5.5 mm barrel jack. Confirm the polarity, plug size and pack quantity with ARS Computers sales before wiring.',
    boxContents:
      'Male and female pigtail connectors in the selected pack quantity.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand DC pigtail solution listing. Standard 2.1 mm x 5.5 mm barrel plugs are stated by the catalogue; exact wire length and pack quantity are confirmed by ARS Computers.'
  },

  'heavy-duty-bnc-compression-video-connectors': {
    description:
      'These BNC compression connectors terminate RG59-style coaxial cable for CCTV video connections. A gold-plated centre pin supports clean signal transfer, and the metallic locking collar secures the connector to the camera or DVR. Compression fittings require the correct crimp tool for reliable installation. Exact pack quantity and cable compatibility are confirmed with sales.',
    keyFeatures: [
      'Heavy-duty BNC compression connectors',
      'Gold-plated centre pin',
      'Metallic locking collar',
      'For RG59/coaxial CCTV cable',
      'Corrosion-resistant construction',
      'Exact pack quantity confirmed with sales'
    ],
    specs: {
      product_type: 'BNC compression video connectors',
      connector: 'BNC male compression',
      connector_type: 'BNC',
      compatibility: 'RG59 and compatible coaxial CCTV cable',
      shielding: 'Metallic body with compression fitting',
      power_rating: 'Video signal only',
      length: 'Connector body — cable length depends on installation'
    },
    compatibility:
      'Use with the correct coaxial cable diameter and a matching compression crimp tool. Confirm the cable type, pack quantity and tool requirement with ARS Computers sales.',
    boxContents:
      'BNC compression connectors in the selected pack quantity.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand BNC compression connector solution listing. Gold-plated pin and RG59 compatibility are stated by the catalogue; exact pack quantity and cable match are confirmed by ARS Computers.'
  }
}
