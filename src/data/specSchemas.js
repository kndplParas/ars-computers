/**
 * ARS Computers — Category-specific specification schemas.
 *
 * The product catalogue stores specifications as a flexible JSONB object so
 * administrators can add any field. This module provides the presentation
 * contract: the fields customers should see, their labels, their order, and
 * the groupings used on the product details page.
 *
 * Keys that are not listed here are still displayed, under
 * "Additional Specifications", so admin-added fields never disappear.
 */

const SECTION_DEFS = {
  'computer-laptop': {
    label: 'Computer & Laptop Specifications',
    sections: [
      {
        title: 'Processor & Memory',
        fields: ['processor', 'processor_generation', 'processor_speed', 'ram', 'ram_type', 'ram_upgrade']
      },
      {
        title: 'Storage & Graphics',
        fields: ['storage', 'storage_type', 'storage_upgrade', 'gpu']
      },
      {
        title: 'Display, Keyboard & Audio',
        fields: ['display', 'resolution', 'panel_type', 'keyboard', 'camera', 'audio']
      },
      {
        title: 'Operating System, Battery & Connectivity',
        fields: ['os', 'battery', 'battery_life', 'ports', 'networking', 'wireless', 'dimensions', 'weight']
      },
      {
        title: 'Desktop / Workstation Hardware',
        fields: ['form_factor', 'chipset', 'expansion', 'power_supply', 'cooling', 'lighting', 'peripherals']
      }
    ]
  },
  cctv: {
    label: 'CCTV & Surveillance Specifications',
    sections: [
      {
        title: 'Device Profile',
        fields: ['device_type', 'model_number']
      },
      {
        title: 'Camera & Optics',
        fields: ['camera_type', 'resolution', 'sensor', 'lens', 'viewing_angle']
      },
      {
        title: 'Night Vision & Imaging',
        fields: ['night_vision', 'ir_range', 'full_color', 'compression', 'audio', 'microphone']
      },
      {
        title: 'Installation, Power & Connectivity',
        fields: ['environment', 'weather_rating', 'connectivity', 'power', 'storage_compatibility', 'dimensions', 'operating_temperature']
      },
      {
        title: 'Recorder Specifications',
        fields: ['channels', 'recording_resolution', 'hdd_support', 'playback', 'video_output', 'network_interface']
      },
      {
        title: 'Pan / Tilt / Zoom',
        fields: ['pan_range', 'tilt_range', 'tracking', 'zoom']
      }
    ]
  },
  printer: {
    label: 'Printer Specifications',
    sections: [
      {
        title: 'Printing Technology',
        fields: ['printer_type', 'model_number', 'technology', 'print_resolution', 'print_speed', 'duty_cycle', 'duplex']
      },
      {
        title: 'Paper Handling',
        fields: ['paper_size', 'input_capacity', 'output_capacity', 'media_types']
      },
      {
        title: 'Functions & Connectivity',
        fields: ['functions', 'scanner', 'copier', 'fax', 'adf', 'connectivity', 'os_support', 'mobile_printing']
      },
      {
        title: 'Consumables & Physical',
        fields: ['cartridge', 'toner', 'ink', 'dimensions', 'weight', 'power']
      }
    ]
  },
  'biometric-machine': {
    label: 'Biometric Device Specifications',
    sections: [
      {
        title: 'Authentication',
        fields: ['device_type', 'model_number', 'auth_methods', 'sensor_type', 'recognition_speed', 'anti_spoofing']
      },
      {
        title: 'Capacity & Logs',
        fields: ['user_capacity', 'face_capacity', 'fingerprint_capacity', 'card_capacity', 'template_capacity', 'log_capacity']
      },
      {
        title: 'Connectivity & Access Control',
        fields: ['connectivity', 'access_control', 'relay', 'wiegand', 'software', 'reporting']
      },
      {
        title: 'Power & Installation',
        fields: ['power', 'battery_backup', 'display_type', 'dimensions', 'operating_temperature', 'installation']
      },
      {
        title: 'Door Hardware',
        fields: ['holding_force', 'fail_safe', 'bracket', 'exit_device', 'door_type']
      }
    ]
  },
  accessories: {
    label: 'Accessory Specifications',
    sections: [
      {
        title: 'Identification & Compatibility',
        fields: ['product_type', 'model_number', 'compatibility', 'application']
      },
      {
        title: 'Storage & Memory',
        fields: ['drive_form_factor', 'capacity', 'memory_type', 'interface', 'storage_speed', 'memory_speed', 'endurance', 'voltage', 'heatspreader']
      },
      {
        title: 'PC Components & Power',
        fields: ['socket', 'chipset', 'tdp', 'heatpipes', 'fan', 'lighting', 'thermal_conductivity', 'wattage', 'efficiency', 'modular', 'connectors', 'gpu_model', 'vram']
      },
      {
        title: 'Keyboards & Mice',
        fields: ['key_layout', 'switch_type', 'keycaps', 'connection', 'wireless_range', 'dpi', 'buttons', 'battery_life', 'cable_length', 'compatibility_os', 'keyboard', 'dimensions', 'weight']
      },
      {
        title: 'Cables & Connectors',
        fields: ['connector', 'connector_type', 'length', 'gauge', 'shielding', 'bandwidth', 'resolution_support', 'data_rate', 'power_rating']
      },
      {
        title: 'Desktop Systems',
        fields: ['processor', 'ram', 'storage', 'gpu', 'system_form_factor', 'expansion', 'system_ports', 'networking', 'power_supply']
      },
      {
        title: 'Networking',
        fields: ['network_type', 'wifi_standard', 'networking_speed', 'networking_ports', 'coverage', 'poe']
      },
      {
        title: 'Physical & Installation',
        fields: ['power', 'dimensions', 'weight', 'installation', 'operating_temperature']
      }
    ]
  }
}

/**
 * Global field labels. These are deliberately human-readable and are also used
 * to map back from admin-entered labels to canonical keys.
 */
export const SPEC_LABELS = {
  processor: 'Processor',
  processor_generation: 'Processor Generation',
  processor_speed: 'Processor Speed',
  ram: 'Installed RAM',
  ram_type: 'RAM Type',
  ram_upgrade: 'RAM Upgrade Support',
  storage: 'Storage',
  storage_type: 'Storage Type',
  storage_upgrade: 'Storage Upgrade',
  gpu: 'Graphics / GPU',
  display: 'Display Size',
  resolution: 'Resolution',
  panel_type: 'Panel Type',
  keyboard: 'Keyboard',
  camera: 'Camera',
  audio: 'Audio',
  os: 'Operating System',
  battery: 'Battery Capacity',
  battery_life: 'Estimated Battery Backup',
  ports: 'Ports & Connectivity',
  networking: 'Networking',
  wireless: 'Wireless',
  dimensions: 'Dimensions',
  weight: 'Weight',
  form_factor: 'Form Factor',
  chipset: 'Chipset',
  expansion: 'Expansion Slots / Bays',
  power_supply: 'Power Supply',
  cooling: 'Cooling',
  peripherals: 'Included Peripherals',
  camera_type: 'Camera Type',
  model_number: 'Model / Part Number',
  sensor: 'Image Sensor',
  lens: 'Lens',
  viewing_angle: 'Viewing Angle',
  night_vision: 'Night Vision',
  ir_range: 'IR / Warm-Light Range',
  full_color: 'Full-Color Imaging',
  compression: 'Video Compression',
  microphone: 'Microphone',
  environment: 'Indoor / Outdoor',
  weather_rating: 'IP / IK Protection',
  connectivity: 'Connectivity',
  power: 'Power Requirements',
  storage_compatibility: 'Storage Compatibility',
  operating_temperature: 'Operating Temperature',
  channels: 'Channels',
  recording_resolution: 'Recording Resolution',
  hdd_support: 'HDD / Storage Support',
  playback: 'Playback',
  video_output: 'Video Output',
  network_interface: 'Network Interface',
  pan_range: 'Pan Range',
  tilt_range: 'Tilt Range',
  tracking: 'Motion Tracking',
  zoom: 'Zoom',
  printer_type: 'Printer Type',
  technology: 'Print Technology',
  print_resolution: 'Print Resolution',
  print_speed: 'Print Speed',
  duty_cycle: 'Monthly Duty Cycle',
  duplex: 'Duplex Printing',
  paper_size: 'Paper Size',
  input_capacity: 'Input Paper Capacity',
  output_capacity: 'Output Capacity',
  media_types: 'Supported Media',
  functions: 'Functions',
  scanner: 'Scanner',
  copier: 'Copier',
  fax: 'Fax',
  adf: 'Automatic Document Feeder',
  os_support: 'Supported Operating Systems',
  mobile_printing: 'Mobile Printing',
  cartridge: 'Cartridge / Toner',
  toner: 'Toner',
  ink: 'Ink System',
  device_type: 'Device Type',
  auth_methods: 'Authentication Methods',
  sensor_type: 'Sensor / Reader',
  recognition_speed: 'Verification Speed',
  anti_spoofing: 'Anti-Spoofing',
  user_capacity: 'User Capacity',
  face_capacity: 'Face Capacity',
  fingerprint_capacity: 'Fingerprint Capacity',
  card_capacity: 'Card Capacity',
  template_capacity: 'Template Capacity',
  log_capacity: 'Transaction / Log Capacity',
  access_control: 'Access-Control Features',
  relay: 'Relay Output',
  wiegand: 'Wiegand Interface',
  software: 'Software Compatibility',
  reporting: 'Reporting / Payroll Export',
  battery_backup: 'Battery Backup',
  display_type: 'Display',
  installation: 'Installation',
  holding_force: 'Holding Force',
  fail_safe: 'Fail-Safe Operation',
  bracket: 'Mounting Bracket',
  exit_device: 'Exit Device',
  door_type: 'Supported Door Types',
  product_type: 'Product Type',
  capacity: 'Capacity',
  memory_type: 'Memory Type',
  interface: 'Interface',
  drive_form_factor: 'Drive Form Factor',
  storage_speed: 'Storage Speed',
  memory_speed: 'Memory Speed',
  speed: 'Speed / Performance',
  endurance: 'Endurance',
  voltage: 'Operating Voltage',
  heatspreader: 'Heat Spreader',
  compatibility: 'Compatibility',
  socket: 'CPU Socket',
  tdp: 'Thermal Design Power',
  heatpipes: 'Heatpipes',
  fan: 'Fan',
  lighting: 'Lighting',
  thermal_conductivity: 'Thermal Conductivity',
  application: 'Application',
  wattage: 'Output Wattage',
  efficiency: 'Efficiency Rating',
  modular: 'Modularity',
  connectors: 'Connectors',
  gpu_model: 'GPU Model',
  vram: 'Video Memory',
  key_layout: 'Key Layout',
  switch_type: 'Switch Type',
  keycaps: 'Keycaps',
  connection: 'Connection',
  wireless_range: 'Wireless Range',
  cable_length: 'Cable Length',
  dpi: 'Sensor Resolution',
  buttons: 'Buttons',
  battery_life: 'Battery Life',
  compatibility_os: 'OS Compatibility',
  connector: 'Connector',
  connector_type: 'Connector Type',
  length: 'Length',
  gauge: 'Wire Gauge',
  shielding: 'Shielding',
  bandwidth: 'Bandwidth',
  resolution_support: 'Supported Resolution',
  data_rate: 'Data Rate',
  power_rating: 'Power Rating',
  network_type: 'Network Type',
  wifi_standard: 'Wi-Fi Standard',
  networking_speed: 'Network Speed',
  networking_ports: 'Network Ports',
  coverage: 'Coverage',
  poe: 'PoE Support',
  system_form_factor: 'System Form Factor',
  system_ports: 'System Ports'
}

const CATEGORY_ALIASES = {
  computer: 'computer-laptop',
  computers: 'computer-laptop',
  laptop: 'computer-laptop',
  laptops: 'computer-laptop',
  'computer-laptop': 'computer-laptop',
  cctv: 'cctv',
  camera: 'cctv',
  cameras: 'cctv',
  surveillance: 'cctv',
  printer: 'printer',
  printers: 'printer',
  printing: 'printer',
  biometric: 'biometric-machine',
  'biometric-machine': 'biometric-machine',
  biometrics: 'biometric-machine',
  attendance: 'biometric-machine',
  accessories: 'accessories',
  accessory: 'accessories'
}

export function resolveSpecCategory(category) {
  if (!category) return null
  const raw = String(
    typeof category === 'string'
      ? category
      : category.slug || category.id || category.categoryId || ''
  ).toLowerCase().trim()
  if (!raw) return null
  return CATEGORY_ALIASES[raw.replace(/\s+/g, '-')] || null
}

export function formatSpecLabel(key) {
  if (!key) return ''
  if (SPEC_LABELS[key]) return SPEC_LABELS[key]
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

/**
 * Convert an admin-entered label ("Installed RAM") or key ("ram") into the
 * canonical key used in the JSONB object.
 */
export function normalizeSpecKey(input, categoryKey = null) {
  const raw = String(input || '').trim()
  if (!raw) return ''

  const lowered = raw.toLowerCase()
  const exactKey = Object.keys(SPEC_LABELS).find((key) => key.toLowerCase() === lowered)
  if (exactKey) return exactKey

  const labelMatch = Object.entries(SPEC_LABELS).find(
    ([, label]) => label.toLowerCase() === lowered
  )
  if (labelMatch) return labelMatch[0]

  if (categoryKey) {
    const schemaFields = (SECTION_DEFS[categoryKey]?.sections || []).flatMap((section) => section.fields)
    const schemaMatch = schemaFields.find((key) => key.toLowerCase() === lowered)
    if (schemaMatch) return schemaMatch
  }

  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function hasValue(value) {
  if (value === null || value === undefined) return false
  if (Array.isArray(value)) return value.length > 0
  return String(value).trim().length > 0
}

export function formatSpecValue(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value)
}

/**
 * Build the ordered, category-specific specification table for a product.
 * Only fields with a value are returned. Any unrecognised admin keys are
 * appended under "Additional Specifications" so they are never hidden.
 */
export function getSpecTable(category, specAttributes) {
  const categoryKey = resolveSpecCategory(category)
  const attrs = specAttributes && typeof specAttributes === 'object' ? specAttributes : {}
  const schema = categoryKey ? SECTION_DEFS[categoryKey] : null

  const usedKeys = new Set()
  const sections = []

  if (schema) {
    for (const section of schema.sections) {
      const rows = section.fields
        .filter((key) => hasValue(attrs[key]))
        .map((key) => {
          usedKeys.add(key)
          return { key, label: formatSpecLabel(key), value: formatSpecValue(attrs[key]) }
        })
      if (rows.length > 0) {
        sections.push({ title: section.title, rows })
      }
    }
  }

  const additionalRows = Object.entries(attrs)
    .filter(([key, value]) => !usedKeys.has(key) && hasValue(value))
    .map(([key, value]) => ({
      key,
      label: formatSpecLabel(key),
      value: formatSpecValue(value)
    }))

  if (additionalRows.length > 0) {
    sections.push({ title: 'Additional Specifications', rows: additionalRows })
  }

  return {
    categoryKey,
    label: schema?.label || 'Technical Specifications',
    sections
  }
}

/**
 * Template lines used by the admin editor to start a category-correct
 * specification block. Labels are used so the editor stays readable; the
 * editor maps them back to canonical keys before saving.
 */
export function getSpecTemplate(category) {
  const categoryKey = resolveSpecCategory(category)
  const schema = categoryKey ? SECTION_DEFS[categoryKey] : null
  if (!schema) return ''

  return schema.sections
    .flatMap((section) => section.fields)
    .map((key) => `${formatSpecLabel(key)}: `)
    .join('\n')
}

export function getSpecFieldGuide(category) {
  const categoryKey = resolveSpecCategory(category)
  const schema = categoryKey ? SECTION_DEFS[categoryKey] : null
  return schema?.sections || []
}
