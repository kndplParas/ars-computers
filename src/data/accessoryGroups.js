/**
 * ARS Computers — Accessories Product Grouping Definition
 *
 * Defines logical customer-facing sub-headings for the 122 Accessories catalog products
 * on the unified Accessories page (/category/accessories).
 */

export const ACCESSORY_GROUPS = [
  {
    id: 'ram-ssd-storage',
    title: 'RAM, SSD & Storage',
    description: 'High-speed internal NVMe PCIe Gen4 & SATA solid-state drives, desktop DDR memory modules, internal hard drives, external drive enclosures, and optical bay caddies.',
    icon: '💾',
    match: (p) => {
      const s = (p.slug || '').toLowerCase()
      const n = (p.name || '').toLowerCase()
      return (
        s.includes('ssd') || s.includes('ram') || s.includes('hdd') || s.includes('memory') ||
        s.includes('caddy') || s.includes('enclosure') ||
        (n.includes('sata') && (n.includes('drive') || n.includes('casing') || n.includes('caddy')))
      ) && !s.includes('sata-3-0-high-speed-data-cable') && !s.includes('sata-data-cable')
    }
  },
  {
    id: 'pc-components-cooling',
    title: 'PC Components, Power & Cooling',
    description: 'Desktop motherboards, dedicated graphics cards, modular ATX SMPS power supplies, CPU cooler heatsinks, high-performance thermal paste, and CMOS coin cells.',
    icon: '⚡',
    match: (p) => {
      const s = (p.slug || '').toLowerCase()
      return (
        s.includes('motherboard') || s.includes('graphics-card') || s.includes('cpu-cooler') ||
        s.includes('thermal-paste') || s.includes('atx-smps') || s.includes('cr2032')
      )
    }
  },
  {
    id: 'keyboards-mice-mats',
    title: 'Keyboards, Mice & Desk Mats',
    description: 'Precision wireless and wired keyboard-mouse desktop combos, mechanical gaming keyboards, silent optical mice, and extended anti-fray desk mats.',
    icon: '⌨️',
    match: (p) => {
      const s = (p.slug || '').toLowerCase()
      return (
        s.includes('keyboard') || s.includes('mouse') || s.includes('combo') ||
        s.includes('mousepad') || s.includes('mouse-pad') || s.includes('desk-mat')
      )
    }
  },
  {
    id: 'cables-interconnects',
    title: 'Cables & Interconnects',
    description: 'High-speed HDMI 4K/8K, DisplayPort, VGA, USB-C fast charging, USB printer, desktop & laptop 3-pin power cords, internal SATA 3.0, and stereo audio cables.',
    icon: '🔌',
    match: (p) => {
      const s = (p.slug || '').toLowerCase()
      return (
        (s.includes('cable') || s.includes('cord') || s.includes('patch-cable') || s.includes('patch-cord')) &&
        !s.includes('cat6') && !s.includes('coaxial') && !s.includes('pigtail') && !s.includes('rs232')
      ) || s.includes('sata-3-0-high-speed-data-cable')
    }
  },
  {
    id: 'adapters-converters-hubs',
    title: 'Adapters, Converters & USB Hubs',
    description: 'Display conversion adapters (HDMI-to-VGA, DVI-to-HDMI), multi-port USB 2.0/3.0 expanders, USB-to-Ethernet adapters, video capture dongles, couplers, and serial COM port converters.',
    icon: '🔄',
    match: (p) => {
      const s = (p.slug || '').toLowerCase()
      return (
        s.includes('adapter') || s.includes('converter') || s.includes('usb-hub') || s.includes('port-hub') || s.includes('-hub-') ||
        s.includes('switch-splitter') || s.includes('rs232') || s.includes('card-reader') ||
        s.includes('rj45-lan-network-adapter') || s.includes('coupler') || s.includes('capture-card')
      ) && !s.includes('power-adapter') && !s.includes('wifi-adapter') && !s.includes('dongle-adapter')
    }
  },
  {
    id: 'networking-cctv-accessories',
    title: 'Networking & CCTV Accessories',
    description: 'Dual-band Wi-Fi 6 routers, nano USB wireless adapters, Cat6 patch cables, modular RJ45 plugs, CCTV camera SMPS boxes, video baluns, BNC connectors & pigtails, and wall-mount server racks.',
    icon: '🌐',
    match: (p) => {
      const s = (p.slug || '').toLowerCase()
      return (
        s.includes('wifi') || s.includes('cat6') || s.includes('cctv') || s.includes('dvr-rack') ||
        s.includes('video-balun') || s.includes('rj45') || s.includes('pigtail') || s.includes('power-adapter') ||
        s.includes('bluetooth') || s.includes('router') || s.includes('coaxial') || s.includes('bnc')
      ) && !s.includes('rj45-rj11-network-cable-crimping-tool')
    }
  },
  {
    id: 'audio-speakers',
    title: 'Audio & Multimedia Speakers',
    description: 'Compact USB-powered stereo desktop and laptop multimedia speaker systems.',
    icon: '🔊',
    match: (p) => {
      const s = (p.slug || '').toLowerCase()
      return s.includes('speakers')
    }
  },
  {
    id: 'laptop-accessories-stands',
    title: 'Laptop Stands & Ergonomics',
    description: 'Foldable ergonomic aluminum laptop risers, multi-angle cooling pads with LED silent fans, and water-resistant protective backpacks.',
    icon: '💻',
    match: (p) => {
      const s = (p.slug || '').toLowerCase()
      return s.includes('laptop-stand') || s.includes('cooling-pad') || s.includes('backpack')
    }
  },
  {
    id: 'tv-monitor-mounts',
    title: 'Display & TV Wall Mounts',
    description: 'Heavy-duty fixed, tilt, and swivel articulation wall mount brackets for desktop monitors and LED/LCD televisions from 14" to 55".',
    icon: '📺',
    match: (p) => {
      const s = (p.slug || '').toLowerCase()
      return s.includes('wall-mount-bracket')
    }
  },
  {
    id: 'maintenance-tools-utilities',
    title: 'Maintenance, Tools & Utilities',
    description: 'Professional 3-in-1 screen cleaning sprays, precision cleaning gels, microfiber cloths, digital multimeters, cable crimping tools, electronic rim locks, and office utilities.',
    icon: '🛠️',
    match: (p) => {
      const s = (p.slug || '').toLowerCase()
      return (
        s.includes('cleaning') || s.includes('multimeter') || s.includes('crimping-tool') ||
        s.includes('door-lock') || s.includes('heater') || s.includes('reading-lamp')
      )
    }
  },
  {
    id: 'commercial-workstations',
    title: 'Commercial Workstation & Desktop Towers',
    description: 'Full commercial CAD workstations and business office desktop towers currently cataloged under hardware accessories.',
    icon: '🖥️',
    match: (p) => {
      const s = (p.slug || '').toLowerCase()
      return s.includes('workstation') || s.includes('desktop-tower') || s.includes('commercial-tower')
    }
  }
]

/**
 * Groups an array of catalog products into the defined accessory categories.
 * Only returns groups that contain at least one product.
 *
 * @param {Array} products - List of products to group
 * @returns {Array} Array of groups with matching products
 */
export function groupAccessories(products) {
  if (!Array.isArray(products) || products.length === 0) return []

  const groupBuckets = new Map()
  for (const g of ACCESSORY_GROUPS) {
    groupBuckets.set(g.id, [])
  }

  const unassigned = []

  for (const item of products) {
    let matchedId = null
    for (const g of ACCESSORY_GROUPS) {
      if (g.match(item)) {
        matchedId = g.id
        break
      }
    }
    if (matchedId) {
      groupBuckets.get(matchedId).push(item)
    } else {
      unassigned.push(item)
    }
  }

  const result = []
  for (const g of ACCESSORY_GROUPS) {
    const items = groupBuckets.get(g.id) || []
    if (items.length > 0) {
      result.push({
        id: g.id,
        title: g.title,
        description: g.description,
        icon: g.icon,
        products: items
      })
    }
  }

  // Fallback: if any unassigned items remain, attach them to a general accessories group
  if (unassigned.length > 0) {
    result.push({
      id: 'other-accessories',
      title: 'Other Hardware Accessories',
      description: 'Additional hardware accessories and components.',
      icon: '📦',
      products: unassigned
    })
  }

  return result
}
