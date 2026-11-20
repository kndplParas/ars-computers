import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_GROUPS
} from '../src/data/mockServiceRequests.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

describe('Hardware Category Options Verification', () => {
  it('SERVICE_CATEGORIES includes CPU and all core PC components', () => {
    const requiredHardware = [
      'CPU / Processor',
      'Motherboard',
      'RAM (Memory)',
      'Storage (SSD / HDD / NVMe)',
      'Graphics Card (GPU)',
      'Power Supply (SMPS)',
      'Cabinet / PC Case',
      'CPU Cooler / Cooling Fan',
      'Monitor / Display',
      'Desktop Computer',
      'Laptop',
      'All-in-One PC (AIO)',
      'Server / Workstation',
      'CCTV Camera',
      'DVR/NVR',
      'Printer/Scanner',
      'Router/Networking',
      'UPS/Power Backup'
    ]

    for (const item of requiredHardware) {
      assert(
        SERVICE_CATEGORIES.includes(item),
        `SERVICE_CATEGORIES must include: ${item}`
      )
    }
  })

  it('SERVICE_CATEGORY_GROUPS has structured optgroups including PC Components & Hardware', () => {
    const pcGroup = SERVICE_CATEGORY_GROUPS.find(
      (g) => g.group === 'PC Components & Hardware'
    )
    assert(pcGroup, 'PC Components & Hardware group exists')
    assert(
      pcGroup.categories.includes('CPU / Processor'),
      'PC Components group includes CPU / Processor'
    )
    assert(
      pcGroup.categories.includes('Motherboard'),
      'PC Components group includes Motherboard'
    )
    assert(
      pcGroup.categories.includes('RAM (Memory)'),
      'PC Components group includes RAM (Memory)'
    )
    assert(
      pcGroup.categories.includes('Graphics Card (GPU)'),
      'PC Components group includes Graphics Card (GPU)'
    )
  })

  it('CustomerServiceRequestForm.jsx renders optgroups with category groups', () => {
    const formCode = fs.readFileSync(
      path.join(rootDir, 'src', 'components', 'CustomerServiceRequestForm.jsx'),
      'utf8'
    )
    assert(
      formCode.includes('SERVICE_CATEGORY_GROUPS.map'),
      'CustomerServiceRequestForm renders SERVICE_CATEGORY_GROUPS with optgroup'
    )
    assert(
      formCode.includes('<optgroup key={grp.group} label={grp.group}>'),
      'CustomerServiceRequestForm wraps options in semantic optgroup elements'
    )
  })

  it('CustomerServiceRequestForm.jsx activates PC diagnostics for CPU and hardware components', () => {
    const formCode = fs.readFileSync(
      path.join(rootDir, 'src', 'components', 'CustomerServiceRequestForm.jsx'),
      'utf8'
    )
    assert(
      formCode.includes("'CPU / Processor'"),
      'isComputerCategory includes CPU / Processor'
    )
    assert(
      formCode.includes("'Motherboard'"),
      'isComputerCategory includes Motherboard'
    )
    assert(
      formCode.includes("'Graphics Card (GPU)'"),
      'isComputerCategory includes Graphics Card (GPU)'
    )
  })

  it('CustomerHomePage.jsx includes PC Components in general enquiry dropdown', () => {
    const homeCode = fs.readFileSync(
      path.join(rootDir, 'src', 'pages', 'CustomerHomePage.jsx'),
      'utf8'
    )
    assert(
      homeCode.includes('PC Components &amp; Hardware (CPU, RAM, GPU, etc.)'),
      'CustomerHomePage includes PC Components in category_interest dropdown'
    )
  })
})
