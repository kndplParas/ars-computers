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

// ============================================================================
// 6. Extended Accessories & Hardware (102 New Catalog Assets)
// ============================================================================
import accImg6 from '../assets/img6.jpg'
import accImg7 from '../assets/img7.jpg'
import accImg8 from '../assets/img8.jpg'
import accImg9 from '../assets/img9.jpg'
import accImg10 from '../assets/img10.jpg'
import accImg19 from '../assets/img19.jpg'
import accImg20 from '../assets/img20.jpg'
import accImg58 from '../assets/img58.jpg'
import accImg59 from '../assets/img59.jpg'
import accImg71 from '../assets/img71.jpg'
import accImg72 from '../assets/img72.jpg'
import accImg75 from '../assets/img75.jpg'
import accImg76 from '../assets/img76.jpg'
import accImg77 from '../assets/img77.jpg'
import accImg78 from '../assets/img78.jpg'
import accImg79 from '../assets/img79.jpg'
import accImg83 from '../assets/img83.jpg'
import accImg84 from '../assets/img84.jpg'
import accImg85 from '../assets/img85.jpg'
import accImg86 from '../assets/img86.jpg'
import accImg87 from '../assets/img87.jpg'
import accImg88 from '../assets/img88.jpg'
import accImg91 from '../assets/img91.jpg'
import accImg99 from '../assets/img99.jpg'
import accImg100 from '../assets/img100.jpg'
import accImg101 from '../assets/img101.jpg'
import accImg104 from '../assets/img104.jpg'
import accImg105 from '../assets/img105.jpg'
import accImg106 from '../assets/img106.jpg'
import accImg107 from '../assets/img107.jpg'
import accImg108 from '../assets/img108.jpg'
import accImg111 from '../assets/img111.jpg'
import accImg112 from '../assets/img112.jpg'
import accImg114 from '../assets/img114.jpg'
import accImg115 from '../assets/img115.jpg'
import accImg116 from '../assets/img116.jpg'
import accImg119 from '../assets/img119.jpg'
import accImg120 from '../assets/img120.jpg'
import accImg144 from '../assets/img144.jpg'
import accImg145 from '../assets/img145.jpg'
import accImg146 from '../assets/img146.jpg'
import accImg147 from '../assets/img147.jpg'
import accImg150 from '../assets/img150.jpg'
import accImg151 from '../assets/img151.jpg'
import accImg152 from '../assets/img152.jpg'
import accImg153 from '../assets/img153.jpg'
import accImg154 from '../assets/img154.jpg'
import accImg194 from '../assets/img194.jpg'
import accImg195 from '../assets/img195.jpg'
import accImg196 from '../assets/img196.jpg'
import accImg197 from '../assets/img197.jpg'
import accImg198 from '../assets/img198.jpg'
import accImg222 from '../assets/img222.jpg'
import accImg223 from '../assets/img223.jpg'
import accImg224 from '../assets/img224.jpg'
import accImg225 from '../assets/img225.jpg'
import accImg226 from '../assets/img226.jpg'
import accImg227 from '../assets/img227.jpg'
import accImg228 from '../assets/img228.jpg'
import accImg235 from '../assets/img235.jpg'
import accImg236 from '../assets/img236.jpg'
import accImg238 from '../assets/img238.jpg'
import accImg241 from '../assets/img241.jpg'
import accImg245 from '../assets/img245.jpg'
import accImg246 from '../assets/img246.jpg'
import accImg252 from '../assets/img252.jpg'
import accImg253 from '../assets/img253.jpg'
import accImg254 from '../assets/img254.jpg'
import accImg255 from '../assets/img255.jpg'
import accImg259 from '../assets/img259.jpg'
import accImg260 from '../assets/img260.jpg'
import accImg261 from '../assets/img261.jpg'
import accImg262 from '../assets/img262.jpg'
import accImg263 from '../assets/img263.jpg'
import accImg266 from '../assets/img266.jpg'
import accImg267 from '../assets/img267.jpg'
import accImg303 from '../assets/img303.jpg'
import accImg306 from '../assets/img306.jpg'
import accImg307 from '../assets/img307.jpg'
import accImg314 from '../assets/img314.jpg'
import accImg315 from '../assets/img315.jpg'
import accImg316 from '../assets/img316.jpg'
import accImg317 from '../assets/img317.jpg'
import accImg318 from '../assets/img318.jpg'
import accImg321 from '../assets/img321.jpg'
import accImg322 from '../assets/img322.jpg'
import accImg323 from '../assets/img323.jpg'
import accImg324 from '../assets/img324.jpg'
import accImg327 from '../assets/img327.jpg'
import accImg329 from '../assets/img329.jpg'
import accImg330 from '../assets/img330.jpg'
import accImg333 from '../assets/img333.jpg'
import accImg334 from '../assets/img334.jpg'
import accImg335 from '../assets/img335.jpg'
import accImg371 from '../assets/img371.jpg'
import accImg407 from '../assets/img407.jpg'
import accImg416 from '../assets/img416.jpg'
import accImg417 from '../assets/img417.jpg'
import accImg420 from '../assets/img420.jpg'
import accImg421 from '../assets/img421.jpg'
import accImg443 from '../assets/img443.jpg'
import accImg446 from '../assets/img446.jpg'
// Verified third-party catalog assets (see src/assets/ATTRIBUTIONS.md)
// CC0 1.0 Universal - Author: User5515 (Wikimedia Commons)
import accNvmeGen4Ssd from '../assets/acc-nvme-pcie-gen4-ssd.jpg'
// CC-BY-SA 4.0 International - Author: Abhi25t (Wikimedia Commons File:TP-Link_AX1500_Wi-Fi_6_Router_Front.jpg)
import accWifi6Router from '../assets/acc-wifi6-gigabit-router.jpg'

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
  'seagate-barracuda-3-5-inch-hdd': [accSeagateBarracudaHdd],
  'corsair-vengeance-lpx-ddr4-ram': [gamingRamCorsairLpx],
  'kingston-desktop-ddr-ram-module': [accKingstonDdrRam],
  'high-speed-nvme-m2-ssds-external-drives': [accNvmeGen4Ssd],

  // Components, Power & Cooling
  'high-performance-thermal-paste-compound': [gamingThermalPaste],
  'cooler-master-rgb-cpu-cooler': [gamingCpuCoolerRgb],
  'corsair-modular-atx-smps-power-supply': [gamingSmpsCorsair],
  'nvidia-geforce-dedicated-graphics-card': [gamingGpuNvidia],
  'asus-desktop-motherboard': [gamingMotherboardAsus],
  'multi-channel-cctv-smps-power-supply': [cctvSmpsSupply],

  // Networking
  'dual-band-wifi-6-routers-poe-gigabit-switches': [accWifi6Router],

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

  // --------------------------------------------------------------------------
  // Extended Accessories Category Products (76 Unique Items from 102 Assets)
  // --------------------------------------------------------------------------
  'hdmi-to-micro-hdmi-cable': [accImg6],
  'standard-male-to-male-hdmi-cable': [accImg7, accImg8, accImg9, accImg10, accImg19],
  'terabyte-hd-2-0v-premium-hdmi-cable': [accImg20, accImg58, accImg59],
  'adnet-ad-001-laptop-power-cable': [accImg71, accImg72],
  'laptop-power-cable-c5-cloverleaf': [accImg75, accImg76],
  'desktop-pc-monitor-iec-c13-power-cable': [accImg77, accImg78, accImg79],
  'usb-2-0-type-a-male-to-female-extension-cable': [accImg83, accImg88, accImg100],
  'usb-2-0-type-a-to-type-b-printer-cable': [accImg84, accImg85, accImg86],
  'usb-3-0-type-a-male-to-female-extension-cable': [accImg87],
  'standard-15-pin-vga-monitor-cable-blue': [accImg91],
  'shielded-white-vga-cable-dual-ferrite': [accImg99, accImg105],
  'gold-plated-15-pin-vga-cable-black': [accImg101],
  'dlink-cat6-utp-patch-cable-2m': [accImg104],
  'cat6-rj45-gigabit-ethernet-patch-cable-grey': [accImg106, accImg107, accImg108, accImg115],
  'usb-to-internal-5pin-terminal-data-cable': [accImg111, accImg112],
  'amazonbasics-hdmi-male-to-female-extension-cable': [accImg114],
  'cat6-rj45-gigabit-network-cable-10m': [accImg115],
  'cctv-3-plus-1-coaxial-video-power-cable-roll': [accImg116],
  'hdmi-male-to-vga-female-adapter-with-audio': [accImg119],
  'compact-hdmi-female-to-vga-male-adapter-converter': [accImg120, accImg197],
  'usb-3-0-to-hdmi-1080p-display-adapter': [accImg144],
  'hdmi-female-to-female-coupler-extender': [accImg145],
  'vga-1-male-to-2-female-y-splitter-cable': [accImg146],
  'rca-3-male-to-3-female-av-extension-cable': [accImg147],
  'mini-vga-to-hdmi-1080p-video-converter-box': [accImg150],
  'mini-hdmi-to-av-rca-video-converter-box': [accImg151],
  'mini-av-rca-to-vga-video-converter-box': [accImg152],
  'mini-av-rca-to-hdmi-1080p-scaler-converter-box': [accImg153],
  'hdmi-1-male-to-2-female-dual-splitter-cable': [accImg154],
  'usb-type-c-3-in-1-multiport-adapter-silver': [accImg194],
  'fentico-displayport-male-to-vga-female-adapter': [accImg195],
  'usb-type-c-to-hdmi-4k-display-adapter-silver': [accImg196],
  'displayport-male-to-hdmi-female-adapter-cable': [accImg198],
  'usb-2-0-hdmi-1080p-video-capture-card-dongle': [accImg222],
  'usb-2-0-4-port-hub-with-switches': [accImg223],
  'sata-2-5-inch-hdd-ssd-enclosure-black': [accImg224, accImg225, accImg226, accImg227],
  'transparent-2-5-inch-sata-usb-3-0-enclosure': [accImg228],
  'cr2032-3v-lithium-coin-cell-batteries-pack': [accImg235],
  'compact-4-port-usb-hub-block-expander': [accImg236],
  'usb-to-rs232-db9-serial-adapter-cable': [accImg238],
  'ranz-3-in-1-screen-cleaning-kit': [accImg241],
  'super-clean-high-tech-cleaning-gel-pouch': [accImg245],
  'kizma-3-in-1-super-cleaning-kit': [accImg246],
  'passive-hdcvi-tvi-ahd-cctv-video-balun-pair': [accImg252],
  'wireless-n-950m-mini-usb-wifi-adapter': [accImg253],
  'microfiber-cleaning-cloths-multi-color-pack': [accImg254],
  'bluetooth-5-0-usb-nano-dongle-adapter': [accImg255],
  'cctv-bnc-male-pigtail-coaxial-cables-10pack': [accImg259],
  'intel-stock-lga115x-cpu-cooler-fan': [accImg260],
  'dt830d-digital-multimeter-with-probes': [accImg261],
  'cctv-12v-dc-male-power-pigtail-connectors-10pack': [accImg262],
  'thermaltake-cpu-cooler-fan-lga775-115x': [accImg263],
  'rj45-rj11-network-cable-crimping-tool-with-stripper': [accImg266],
  'universal-sata-2nd-hdd-caddy': [accImg267, accImg303],
  'dc-power-adapter-9v-1a-barrel-jack': [accImg306],
  'dc-power-adapter-12v-2a-barrel-jack': [accImg307],
  'extended-gaming-mouse-pad-desk-mat': [accImg314],
  'scenic-nature-printed-optical-mousepad': [accImg315],
  'logitech-retro-logo-gaming-mousepad': [accImg316],
  'micro-wolf-hunter-l-16-gaming-mouse-pad': [accImg317],
  'adnet-ad-mp-02-gaming-mouse-pad': [accImg318],
  'terabyte-kubix-e-02b-multimedia-speakers': [accImg321],
  'terabyte-eliptic-tb-015-multimedia-speakers': [accImg322],
  'terabyte-clarion-tb-008-mini-digital-speakers': [accImg323],
  'adnet-ad-201-optical-wired-mouse': [accImg324],
  'adjustable-ergonomic-aluminum-laptop-stand': [accImg327],
  'laptop-cooling-pad-with-blue-led-fan': [accImg329],
  'cctv-4-channel-12v-1a-smps-power-supply': [accImg330],
  'crotomax-wall-mount-dvr-rack-cabinet': [accImg333, accImg334],
  'hawk-vision-stainless-steel-electronic-door-lock': [accImg335],
  'dvi-d-to-hdmi-bi-directional-video-adapter': [accImg371],
  'swivel-tilt-monitor-tv-wall-mount-bracket': [accImg407],
  'compact-fixed-tv-wall-mount-bracket-14-42': [accImg416],
  'heavy-duty-fixed-tv-wall-mount-bracket': [accImg417],
  'dlink-cat6-rj45-modular-connectors-box': [accImg420],
  'flipkart-smartbuy-electric-fan-room-heater': [accImg421],
  'flexible-usb-led-portable-reading-lamp-2pack': [accImg443],
  'water-resistant-laptop-backpack-15-6-inch-grey': [accImg446],

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
