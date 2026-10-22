/**
 * ARS Computers - Complete Individual Product Image Asset Mapping
 * 
 * Maps all 79 verified product hardware photos from src/assets to distinct, individual product slugs.
 * Ensures every individual laptop, desktop, workstation, camera, printer, biometric scanner,
 * accessory, and component has its own dedicated product entry and representative visual asset.
 * 
 * Uses standard Vite ESM imports so assets are bundled and hashed correctly.
 */

// ============================================================================
// 1. Laptops (9 Distinct Models)
// ============================================================================
import businessLaptopDell1 from '../assets/WhatsApp Image 2026-10-21 at 4.56.36 PM (1).jpeg'
import businessLaptopLenovo from '../assets/WhatsApp Image 2026-10-21 at 4.56.37 PM.jpeg'
import businessLaptopHp from '../assets/WhatsApp Image 2026-10-21 at 4.56.36 PM.jpeg'
import businessLaptopAsusTuf from '../assets/WhatsApp Image 2026-10-21 at 4.56.37 PM (1).jpeg'
import businessLaptopDell2 from '../assets/WhatsApp Image 2026-10-21 at 4.56.37 PM (2).jpeg'
import businessLaptopHpProbook from '../assets/WhatsApp Image 2026-10-20 at 3.05.20 PM (1).jpeg'
import businessLaptopAcerRgb from '../assets/WhatsApp Image 2026-10-20 at 3.05.20 PM (2).jpeg'
import businessLaptopSilverUltrabook from '../assets/WhatsApp Image 2026-10-20 at 3.05.20 PM.jpeg'
import businessLaptopHpSilverSlim from '../assets/WhatsApp Image 2026-10-20 at 3.05.21 PM.jpeg'

// ============================================================================
// 2. Desktops, Workstations & All-in-Ones (8 Distinct Systems)
// ============================================================================
import gamingDeskSetupCurved from '../assets/WhatsApp Image 2026-10-20 at 3.05.17 PM.jpeg'
import gamingRigRgbLiquid from '../assets/WhatsApp Image 2026-10-21 at 4.57.33 PM (1).jpeg'
import aioDisplaySlimArc from '../assets/WhatsApp Image 2026-10-20 at 3.05.17 PM (1).jpeg'
import aioDisplayCommercialMatte from '../assets/WhatsApp Image 2026-10-20 at 3.05.18 PM.jpeg'
import workstationDellTower from '../assets/WhatsApp Image 2026-10-21 at 4.57.32 PM (1).jpeg'
import workstationLenovoThinkcentre from '../assets/WhatsApp Image 2026-10-21 at 4.57.32 PM.jpeg'
import workstationDellSff from '../assets/WhatsApp Image 2026-10-21 at 4.57.32 PM (2).jpeg'
import workstationAcerTower from '../assets/WhatsApp Image 2026-10-21 at 4.57.33 PM.jpeg'

// ============================================================================
// 3. CCTV Cameras & Recorders (6 Distinct Devices)
// ============================================================================
import cctvHikvisionDome from '../assets/WhatsApp Image 2026-10-21 at 4.57.13 PM (1).jpeg'
import cctvCpPlusDome from '../assets/WhatsApp Image 2026-10-21 at 4.57.14 PM (2).jpeg'
import cctvWifiBullet from '../assets/WhatsApp Image 2026-10-21 at 4.57.14 PM (1).jpeg'
import cctvHikvision4kBullet from '../assets/WhatsApp Image 2026-10-21 at 4.57.13 PM.jpeg'
import cctvDvr4Ch from '../assets/WhatsApp Image 2026-10-21 at 5.20.14 PM.jpeg'
import cctvPtzCpPlus360 from '../assets/WhatsApp Image 2026-10-21 at 4.57.14 PM.jpeg'

// ============================================================================
// 4. Printers & Copiers (8 Distinct Devices)
// ============================================================================
import printerEpsonEcoTank from '../assets/WhatsApp Image 2026-10-21 at 4.53.09 PM (1).jpeg'
import printerCanonPixmaInkTank from '../assets/WhatsApp Image 2026-10-20 at 3.05.19 PM (1).jpeg'
import printerCanonMonoLaser from '../assets/WhatsApp Image 2026-10-21 at 4.53.09 PM.jpeg'
import printerBrotherMonoLaser from '../assets/WhatsApp Image 2026-10-21 at 4.53.10 PM.jpeg'
import printerDesktopMonoLaser from '../assets/WhatsApp Image 2026-10-20 at 3.05.19 PM.jpeg'
import printerBrotherMfpAdf from '../assets/WhatsApp Image 2026-10-21 at 4.53.10 PM (2).jpeg'
import printerBrotherColorCopierAdf from '../assets/WhatsApp Image 2026-10-20 at 3.05.18 PM (1).jpeg'
import printerHpColorLaserJet from '../assets/WhatsApp Image 2026-10-21 at 4.53.10 PM (1).jpeg'

// ============================================================================
// 5. Biometric Attendance & Access Devices (5 Distinct Hardware Units)
// ============================================================================
import bioHikvisionFaceTerminal from '../assets/WhatsApp Image 2026-10-21 at 4.53.48 PM (2).jpeg'
import bioHikvisionFaceWall from '../assets/WhatsApp Image 2026-10-21 at 4.53.48 PM.jpeg'
import bioMantraFingerprint from '../assets/WhatsApp Image 2026-10-21 at 4.53.47 PM.jpeg'
import bioEsslX990RfidKeypad from '../assets/WhatsApp Image 2026-10-21 at 4.53.48 PM (3).jpeg'
import bioCpPlusTerminal from '../assets/WhatsApp Image 2026-10-21 at 4.53.48 PM (1).jpeg'

// ============================================================================
// 6. Accessories: Storage & Memory (4 Distinct Hardware Products)
// ============================================================================
import accSamsungSsd870 from '../assets/WhatsApp Image 2026-10-21 at 5.20.12 PM.jpeg'
import accSeagateBarracudaHdd from '../assets/WhatsApp Image 2026-10-21 at 5.20.15 PM.jpeg'
import accSeagateHddPlatter from '../assets/WhatsApp Image 2026-10-21 at 5.20.10 PM (1).jpeg'
import gamingRamCorsairLpx from '../assets/WhatsApp Image 2026-10-21 at 5.20.14 PM (2).jpeg'
import accKingstonDdrRam from '../assets/WhatsApp Image 2026-10-21 at 5.20.09 PM.jpeg'

// ============================================================================
// 7. Accessories: Components, Power & Cooling (6 Distinct Products)
// ============================================================================
import gamingThermalPaste from '../assets/WhatsApp Image 2026-10-21 at 5.20.09 PM (1).jpeg'
import gamingCpuCoolerRgb from '../assets/WhatsApp Image 2026-10-21 at 5.20.10 PM.jpeg'
import gamingSmpsCorsair from '../assets/WhatsApp Image 2026-10-21 at 5.20.09 PM (2).jpeg'
import gamingGpuNvidia from '../assets/WhatsApp Image 2026-10-21 at 5.20.09 PM (3).jpeg'
import gamingMotherboardAsus from '../assets/WhatsApp Image 2026-10-21 at 5.20.10 PM (2).jpeg'
import cctvSmpsSupply from '../assets/WhatsApp Image 2026-10-21 at 5.20.13 PM (1).jpeg'

// ============================================================================
// 8. Accessories: Keyboards, Mice & Combos (19 Distinct Products)
// ============================================================================
import accDellKm3322wCombo from '../assets/WhatsApp Image 2026-10-21 at 4.59.34 PM.jpeg'
import accWirelessKbdMouseCombo2 from '../assets/WhatsApp Image 2026-10-20 at 3.05.21 PM (1).jpeg'
import accHpMechRgbKeyboard from '../assets/WhatsApp Image 2026-10-21 at 5.00.57 PM.jpeg'
import accAsusKeyboardCombo from '../assets/WhatsApp Image 2026-10-21 at 4.59.33 PM.jpeg'
import accHp230Combo from '../assets/WhatsApp Image 2026-10-21 at 4.59.34 PM (1).jpeg'
import accLenovo300Combo from '../assets/WhatsApp Image 2026-10-21 at 4.59.34 PM (2).jpeg'
import accWirelessComboBox from '../assets/WhatsApp Image 2026-10-21 at 4.59.35 PM.jpeg'
import accLogitechMxKeysMini from '../assets/WhatsApp Image 2026-10-21 at 5.00.56 PM (1).jpeg'
import accLogitechWirelessKbd from '../assets/WhatsApp Image 2026-10-21 at 5.00.56 PM.jpeg'
import accDellMultimediaKbd from '../assets/WhatsApp Image 2026-10-21 at 5.00.57 PM (1).jpeg'
import accSlimChicletKbd from '../assets/WhatsApp Image 2026-10-20 at 3.05.22 PM (1).jpeg'
import accWiredOfficeKbd from '../assets/WhatsApp Image 2026-10-20 at 3.05.23 PM.jpeg'
import accHpGamingMouse from '../assets/WhatsApp Image 2026-10-21 at 5.03.10 PM.jpeg'
import accDellMs116Mouse from '../assets/WhatsApp Image 2026-10-21 at 5.03.10 PM (1).jpeg'
import accDellWm126WirelessMouse from '../assets/WhatsApp Image 2026-10-21 at 5.03.10 PM (2).jpeg'
import accLenovoWirelessMouse from '../assets/WhatsApp Image 2026-10-21 at 5.03.11 PM.jpeg'
import accZebronicsMouse from '../assets/WhatsApp Image 2026-10-21 at 5.03.11 PM (1).jpeg'
import accCompactWirelessMouse from '../assets/WhatsApp Image 2026-10-20 at 3.05.21 PM (2).jpeg'
import accTrustWiredMouse from '../assets/WhatsApp Image 2026-10-20 at 3.05.22 PM.jpeg'

// ============================================================================
// 9. Accessories: Cables & Connectors (10 Distinct Products)
// ============================================================================
import accHdmiBraided4k from '../assets/WhatsApp Image 2026-10-21 at 5.20.08 PM.jpeg'
import accDisplayPortCable from '../assets/WhatsApp Image 2026-10-21 at 5.20.03 PM.jpeg'
import accCat6EthernetPatch from '../assets/WhatsApp Image 2026-10-21 at 5.20.04 PM (1).jpeg'
import accHdmiStandardGold from '../assets/WhatsApp Image 2026-10-21 at 5.20.13 PM.jpeg'
import accSataDataCable from '../assets/WhatsApp Image 2026-10-21 at 5.20.06 PM (1).jpeg'
import accVgaCable15Pin from '../assets/WhatsApp Image 2026-10-21 at 5.20.05 PM.jpeg'
import accTypeCBraided60w from '../assets/WhatsApp Image 2026-10-21 at 5.20.06 PM.jpeg'
import accTypeCPouchCable from '../assets/WhatsApp Image 2026-10-21 at 5.20.06 PM (2).jpeg'
import accDesktopPowerCable from '../assets/WhatsApp Image 2026-10-21 at 5.20.04 PM.jpeg'
import cctvCoaxialCableBundle from '../assets/WhatsApp Image 2026-10-21 at 5.20.03 PM (1).jpeg'
import cctvCoaxialCableWhite from '../assets/WhatsApp Image 2026-10-21 at 5.20.14 PM (1).jpeg'
import cctvDcPowerPigtails from '../assets/WhatsApp Image 2026-10-21 at 5.20.11 PM.jpeg'
import cctvBncConnectors from '../assets/WhatsApp Image 2026-10-21 at 5.20.12 PM (1).jpeg'

/**
 * Mapping dictionary of verified product slugs to arrays of imported asset URLs.
 */
export const PRODUCT_IMAGES = {
  // --------------------------------------------------------------------------
  // Category 1: Computer / Laptop (17 Individual Products)
  // --------------------------------------------------------------------------
  'dell-latitude-business-laptop': [businessLaptopDell1],
  'lenovo-commercial-office-laptop': [businessLaptopLenovo],
  'hp-elitebook-corporate-laptop': [businessLaptopHp],
  'asus-tuf-gaming-laptop': [businessLaptopAsusTuf],
  'dell-inspiron-business-laptop': [businessLaptopDell2],
  'hp-probook-commercial-laptop': [businessLaptopHpProbook],
  'acer-performance-laptop': [businessLaptopAcerRgb],
  'ultra-slim-metallic-notebook': [businessLaptopSilverUltrabook],
  'hp-pavilion-silver-slim-laptop': [businessLaptopHpSilverSlim],

  'custom-gaming-studio-workstation-setup': [gamingDeskSetupCurved],
  'custom-liquid-cooled-gaming-rig': [gamingRigRgbLiquid],
  'commercial-slim-all-in-one-pc': [aioDisplaySlimArc],
  'enterprise-matte-all-in-one-pc': [aioDisplayCommercialMatte],
  'dell-precision-cad-workstation-tower': [workstationDellTower],
  'lenovo-thinkcentre-desktop-tower': [workstationLenovoThinkcentre],
  'dell-sff-compact-workstation': [workstationDellSff],
  'acer-veriton-commercial-tower': [workstationAcerTower],

  // Legacy Category 1 Slugs (Maintains backwards compatibility)
  'business-laptops-dell-hp-lenovo-asus': [businessLaptopDell1],
  'custom-gaming-studio-desktops': [gamingDeskSetupCurved],
  'commercial-all-in-one-aio-pcs': [aioDisplaySlimArc],
  'workstation-towers-cad-3d': [workstationDellTower],

  // --------------------------------------------------------------------------
  // Category 2: CCTV (6 Individual Products)
  // --------------------------------------------------------------------------
  'hikvision-full-hd-dome-camera': [cctvHikvisionDome],
  'cp-plus-full-hd-dome-camera': [cctvCpPlusDome],
  'smart-outdoor-wifi-bullet-camera': [cctvWifiBullet],
  'hikvision-colorvu-4k-bullet-camera': [cctvHikvision4kBullet],
  'multi-channel-cctv-dvr-nvr-recorder': [cctvDvr4Ch],
  'cp-plus-360-ptz-smart-camera': [cctvPtzCpPlus360],

  // Legacy Category 2 Slugs
  'full-hd-dome-bullet-ip-cameras': [cctvHikvisionDome],
  '4k-colorvu-starlight-cameras': [cctvHikvision4kBullet],
  'network-video-recorders-nvr-dvr': [cctvDvr4Ch],
  'ptz-360-zoom-cameras': [cctvPtzCpPlus360],

  // --------------------------------------------------------------------------
  // Category 3: Printer (9 Products: 8 Physical + 1 Placeholder)
  // --------------------------------------------------------------------------
  'epson-ecotank-ink-tank-printer': [printerEpsonEcoTank],
  'canon-pixma-ink-tank-printer': [printerCanonPixmaInkTank],
  'canon-imageclass-mono-laser-printer': [printerCanonMonoLaser],
  'brother-mono-laser-printer': [printerBrotherMonoLaser],
  'compact-desktop-mono-laser-printer': [printerDesktopMonoLaser],
  'brother-color-mfp-copier-adf': [printerBrotherMfpAdf],
  'brother-commercial-color-copier': [printerBrotherColorCopierAdf],
  'hp-color-laserjet-enterprise-mfp': [printerHpColorLaserJet],
  'barcode-thermal-receipt-printers': [],

  // Legacy Category 3 Slugs
  'continuous-ink-tank-multifunction-printers': [printerEpsonEcoTank],
  'high-speed-monochrome-laser-printers': [printerCanonMonoLaser],
  'color-laser-multi-function-copiers': [printerBrotherMfpAdf],

  // --------------------------------------------------------------------------
  // Category 4: Biometric Machine (6 Products: 5 Physical + 1 Placeholder)
  // --------------------------------------------------------------------------
  'hikvision-minmoe-face-terminal': [bioHikvisionFaceTerminal],
  'hikvision-wall-mount-face-terminal': [bioHikvisionFaceWall],
  'mantra-optical-fingerprint-scanner': [bioMantraFingerprint],
  'essl-rfid-card-keypad-terminal': [bioEsslX990RfidKeypad],
  'cp-plus-rfid-attendance-device': [bioCpPlusTerminal],
  'electromagnetic-door-access-controllers': [],

  // Legacy Category 4 Slugs
  'ai-face-recognition-attendance-system': [bioHikvisionFaceTerminal],
  'optical-fingerprint-attendance-terminal': [bioMantraFingerprint],
  'rfid-proximity-card-punching-devices': [bioEsslX990RfidKeypad],

  // --------------------------------------------------------------------------
  // Category 5: Accessories (31 Products: 29 Physical + 2 Placeholders)
  // --------------------------------------------------------------------------
  // Storage & Memory
  'samsung-870-evo-sata-ssd': [accSamsungSsd870],
  'seagate-barracuda-3-5-inch-hdd': [accSeagateBarracudaHdd, accSeagateHddPlatter],
  'corsair-vengeance-lpx-ddr4-ram': [gamingRamCorsairLpx],
  'kingston-desktop-ddr-ram-module': [accKingstonDdrRam],
  'high-speed-nvme-m2-ssds-external-drives': [],

  // Components, Power & Cooling
  'high-performance-thermal-paste-compound': [gamingThermalPaste],
  'cooler-master-rgb-cpu-cooler': [gamingCpuCoolerRgb],
  'corsair-modular-atx-smps-power-supply': [gamingSmpsCorsair],
  'nvidia-geforce-dedicated-graphics-card': [gamingGpuNvidia],
  'asus-desktop-motherboard': [gamingMotherboardAsus],
  'multi-channel-cctv-smps-power-supply': [cctvSmpsSupply],

  // Networking
  'dual-band-wifi-6-routers-poe-gigabit-switches': [],

  // Keyboards & Mice
  'dell-km3322w-wireless-combo': [accDellKm3322wCombo],
  'wireless-office-keyboard-mouse-combo': [accWirelessKbdMouseCombo2],
  'hp-mechanical-rgb-keyboard': [accHpMechRgbKeyboard],
  'asus-desktop-keyboard-mouse-set': [accAsusKeyboardCombo],
  'hp-230-wireless-keyboard-combo': [accHp230Combo],
  'lenovo-300-wireless-keyboard-combo': [accLenovo300Combo],
  'ergonomic-full-size-wireless-combo': [accWirelessComboBox],
  'logitech-mx-keys-mini-keyboard': [accLogitechMxKeysMini],
  'logitech-wireless-multimedia-keyboard': [accLogitechWirelessKbd],
  'dell-kb216-wired-multimedia-keyboard': [accDellMultimediaKbd],
  'slim-chiclet-low-profile-keyboard': [accSlimChicletKbd],
  'standard-office-wired-keyboard': [accWiredOfficeKbd],
  'hp-gaming-optical-mouse': [accHpGamingMouse],
  'dell-ms116-usb-optical-mouse': [accDellMs116Mouse],
  'dell-wm126-wireless-optical-mouse': [accDellWm126WirelessMouse],
  'lenovo-wireless-ergonomic-mouse': [accLenovoWirelessMouse],
  'zebronics-optical-wired-mouse': [accZebronicsMouse],
  'compact-portable-wireless-mouse': [accCompactWirelessMouse],
  'ergonomic-commercial-wired-mouse': [accTrustWiredMouse],

  // Cables & Connectors
  'braided-4k-high-speed-hdmi-cable': [accHdmiBraided4k, accHdmiStandardGold],
  'displayport-1-4-monitor-cable': [accDisplayPortCable],
  'cat6-gigabit-ethernet-patch-cord': [accCat6EthernetPatch],
  'sata-6gbps-internal-drive-cable': [accSataDataCable],
  'heavy-duty-15-pin-vga-cable': [accVgaCable15Pin],
  'usb-type-c-fast-charging-data-cable': [accTypeCBraided60w, accTypeCPouchCable],
  'desktop-pc-monitor-3-pin-power-cord': [accDesktopPowerCable],
  'cctv-3-plus-1-coaxial-video-cable': [cctvCoaxialCableBundle, cctvCoaxialCableWhite],
  '12v-dc-cctv-power-pigtail-connectors': [cctvDcPowerPigtails],
  'heavy-duty-bnc-compression-video-connectors': [cctvBncConnectors],

  // Legacy Category 5 Slugs
  'commercial-mechanical-keyboards-mice': [accDellKm3322wCombo],
  'certified-hdmi-displayport-cat6-patch-cables': [accHdmiBraided4k, accHdmiStandardGold]
}

/**
 * Image Captions Dictionary for Multi-Angle Hardware Views
 */
export const PRODUCT_IMAGE_CAPTIONS = {
  'seagate-barracuda-3-5-inch-hdd': [
    'Seagate BarraCuda 3.5" Hard Drive Front Casing',
    'Seagate Hard Drive Opened Architecture with Platter & Read/Write Arm'
  ],
  'braided-4k-high-speed-hdmi-cable': [
    'Braided 4K Ultra HD HDMI Cable (Heavy-Duty Shielded Exterior)',
    'Gold-Plated HDMI Precision Connector Plug View'
  ],
  'usb-type-c-fast-charging-data-cable': [
    'High-Speed USB Type-C Fast-Charging Braided Cable',
    'USB Type-C Data Cable in Protective Travel Pouch'
  ],
  'cctv-3-plus-1-coaxial-video-cable': [
    'CCTV 3+1 Shielded Coaxial Video Cable Bundle Roll',
    'RG59 White Coaxial Video Transmission Cable'
  ]
}
