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
import accThermalPosPrinter from '../assets/acc-thermal-pos-receipt-printer.jpg'

// ============================================================================
// 5. Biometric Attendance & Access Devices (5 Distinct Hardware Units)
// ============================================================================
import bioHikvisionFaceTerminal from '../assets/WhatsApp Image 2026-10-21 at 4.53.48 PM (2).jpeg'
import bioHikvisionFaceWall from '../assets/WhatsApp Image 2026-10-21 at 4.53.48 PM.jpeg'
import bioMantraFingerprint from '../assets/WhatsApp Image 2026-10-21 at 4.53.47 PM.jpeg'
import bioEsslX990RfidKeypad from '../assets/WhatsApp Image 2026-10-21 at 4.53.48 PM (3).jpeg'
import bioCpPlusTerminal from '../assets/WhatsApp Image 2026-10-21 at 4.53.48 PM (1).jpeg'
import accElectroDoorLock from '../assets/acc-electromagnetic-door-lock.jpg'
import cctvKit8Ch from '../assets/WhatsApp Image 2026-11-19 at 2.50.15 PM.jpeg'

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

// ============================================================================
// Verified Multi-Angle & Specification Hardware Assets (Retained Valid Media)
// See src/assets/ATTRIBUTIONS.md for author, license and provenance metadata.
// ============================================================================
import img_12v_dc_cctv_power_pigtail_connectors_v2 from '../assets/products/p-12v-dc-cctv-power-pigtail-connectors-view2.jpg'
import img_12v_dc_cctv_power_pigtail_connectors_v3 from '../assets/products/p-12v-dc-cctv-power-pigtail-connectors-view3.jpg'
import img_acer_performance_laptop_v2 from '../assets/products/p-acer-performance-laptop-view2.jpg'
import img_acer_performance_laptop_v3 from '../assets/products/p-acer-performance-laptop-view3.jpg'
import img_acer_veriton_commercial_tower_v2 from '../assets/products/p-acer-veriton-commercial-tower-view2.jpg'
import img_adjustable_ergonomic_aluminum_laptop_stand_v2 from '../assets/products/p-adjustable-ergonomic-aluminum-laptop-stand-view2.jpg'
import img_adjustable_ergonomic_aluminum_laptop_stand_v3 from '../assets/products/p-adjustable-ergonomic-aluminum-laptop-stand-view3.jpg'
import img_adnet_ad_001_laptop_power_cable_v2 from '../assets/products/p-adnet-ad-001-laptop-power-cable-view2.jpg'
import img_adnet_ad_201_optical_wired_mouse_v3 from '../assets/products/p-adnet-ad-201-optical-wired-mouse-view3.jpg'
import img_adnet_ad_mp_02_gaming_mouse_pad_v2 from '../assets/products/p-adnet-ad-mp-02-gaming-mouse-pad-view2.jpg'
import img_adnet_ad_mp_02_gaming_mouse_pad_v3 from '../assets/products/p-adnet-ad-mp-02-gaming-mouse-pad-view3.jpg'
import img_amazonbasics_hdmi_male_to_female_extension_cable_v2 from '../assets/products/p-amazonbasics-hdmi-male-to-female-extension-cable-view2.jpg'
import img_amazonbasics_hdmi_male_to_female_extension_cable_v3 from '../assets/products/p-amazonbasics-hdmi-male-to-female-extension-cable-view3.jpg'
import img_asus_desktop_keyboard_mouse_set_v2 from '../assets/products/p-asus-desktop-keyboard-mouse-set-view2.jpg'
import img_asus_desktop_keyboard_mouse_set_v3 from '../assets/products/p-asus-desktop-keyboard-mouse-set-view3.jpg'
import img_asus_desktop_motherboard_v2 from '../assets/products/p-asus-desktop-motherboard-view2.jpg'
import img_asus_tuf_gaming_laptop_v2 from '../assets/products/p-asus-tuf-gaming-laptop-view2.jpg'
import img_asus_tuf_gaming_laptop_v3 from '../assets/products/p-asus-tuf-gaming-laptop-view3.jpg'
import img_barcode_thermal_receipt_printers_v2 from '../assets/products/p-barcode-thermal-receipt-printers-view2.jpg'
import img_barcode_thermal_receipt_printers_v3 from '../assets/products/p-barcode-thermal-receipt-printers-view3.jpg'
import img_bluetooth_5_0_usb_nano_dongle_adapter_v2 from '../assets/products/p-bluetooth-5-0-usb-nano-dongle-adapter-view2.jpg'
import img_bluetooth_5_0_usb_nano_dongle_adapter_v3 from '../assets/products/p-bluetooth-5-0-usb-nano-dongle-adapter-view3.jpg'
import img_braided_4k_high_speed_hdmi_cable_v2 from '../assets/products/p-braided-4k-high-speed-hdmi-cable-view2.png'
import img_braided_4k_high_speed_hdmi_cable_v3 from '../assets/products/p-braided-4k-high-speed-hdmi-cable-view3.jpg'
import img_brother_color_mfp_copier_adf_v2 from '../assets/products/p-brother-color-mfp-copier-adf-view2.jpg'
import img_brother_color_mfp_copier_adf_v3 from '../assets/products/p-brother-color-mfp-copier-adf-view3.jpg'
import img_brother_commercial_color_copier_v2 from '../assets/products/p-brother-commercial-color-copier-view2.jpg'
import img_brother_commercial_color_copier_v3 from '../assets/products/p-brother-commercial-color-copier-view3.jpg'
import img_brother_mono_laser_printer_v2 from '../assets/products/p-brother-mono-laser-printer-view2.jpg'
import img_brother_mono_laser_printer_v3 from '../assets/products/p-brother-mono-laser-printer-view3.jpg'
import img_canon_imageclass_mono_laser_printer_v2 from '../assets/products/p-canon-imageclass-mono-laser-printer-view2.jpg'
import img_canon_imageclass_mono_laser_printer_v3 from '../assets/products/p-canon-imageclass-mono-laser-printer-view3.jpg'
import img_canon_pixma_ink_tank_printer_v2 from '../assets/products/p-canon-pixma-ink-tank-printer-view2.jpg'
import img_canon_pixma_ink_tank_printer_v3 from '../assets/products/p-canon-pixma-ink-tank-printer-view3.jpg'
import img_cat6_gigabit_ethernet_patch_cord_v2 from '../assets/products/p-cat6-gigabit-ethernet-patch-cord-view2.jpg'
import img_cat6_gigabit_ethernet_patch_cord_v3 from '../assets/products/p-cat6-gigabit-ethernet-patch-cord-view3.jpg'
import img_cctv_12v_dc_male_power_pigtail_connectors_10pack_v2 from '../assets/products/p-cctv-12v-dc-male-power-pigtail-connectors-10pack-view2.jpg'
import img_cctv_12v_dc_male_power_pigtail_connectors_10pack_v3 from '../assets/products/p-cctv-12v-dc-male-power-pigtail-connectors-10pack-view3.jpg'
import img_cctv_3_plus_1_coaxial_video_cable_v2 from '../assets/products/p-cctv-3-plus-1-coaxial-video-cable-view2.jpg'
import img_cctv_3_plus_1_coaxial_video_cable_v3 from '../assets/products/p-cctv-3-plus-1-coaxial-video-cable-view3.jpg'
import img_cctv_3_plus_1_coaxial_video_power_cable_roll_v2 from '../assets/products/p-cctv-3-plus-1-coaxial-video-power-cable-roll-view2.jpg'
import img_cctv_3_plus_1_coaxial_video_power_cable_roll_v3 from '../assets/products/p-cctv-3-plus-1-coaxial-video-power-cable-roll-view3.jpg'
import img_cctv_bnc_male_pigtail_coaxial_cables_10pack_v2 from '../assets/products/p-cctv-bnc-male-pigtail-coaxial-cables-10pack-view2.jpg'
import img_cctv_bnc_male_pigtail_coaxial_cables_10pack_v3 from '../assets/products/p-cctv-bnc-male-pigtail-coaxial-cables-10pack-view3.jpg'
import img_commercial_slim_all_in_one_pc_v2 from '../assets/products/p-commercial-slim-all-in-one-pc-view2.jpg'
import img_commercial_slim_all_in_one_pc_v3 from '../assets/products/p-commercial-slim-all-in-one-pc-view3.jpg'
import img_compact_desktop_mono_laser_printer_v2 from '../assets/products/p-compact-desktop-mono-laser-printer-view2.jpg'
import img_compact_desktop_mono_laser_printer_v3 from '../assets/products/p-compact-desktop-mono-laser-printer-view3.jpg'
import img_compact_fixed_tv_wall_mount_bracket_14_42_v2 from '../assets/products/p-compact-fixed-tv-wall-mount-bracket-14-42-view2.jpg'
import img_compact_fixed_tv_wall_mount_bracket_14_42_v3 from '../assets/products/p-compact-fixed-tv-wall-mount-bracket-14-42-view3.jpg'
import img_compact_hdmi_female_to_vga_male_adapter_converter_v2 from '../assets/products/p-compact-hdmi-female-to-vga-male-adapter-converter-view2.jpg'
import img_compact_hdmi_female_to_vga_male_adapter_converter_v3 from '../assets/products/p-compact-hdmi-female-to-vga-male-adapter-converter-view3.jpg'
import img_compact_portable_wireless_mouse_v2 from '../assets/products/p-compact-portable-wireless-mouse-view2.jpg'
import img_compact_portable_wireless_mouse_v3 from '../assets/products/p-compact-portable-wireless-mouse-view3.jpg'
import img_cooler_master_rgb_cpu_cooler_v2 from '../assets/products/p-cooler-master-rgb-cpu-cooler-view2.jpg'
import img_cooler_master_rgb_cpu_cooler_v3 from '../assets/products/p-cooler-master-rgb-cpu-cooler-view3.jpg'
import img_corsair_modular_atx_smps_power_supply_v2 from '../assets/products/p-corsair-modular-atx-smps-power-supply-view2.jpg'
import img_corsair_modular_atx_smps_power_supply_v3 from '../assets/products/p-corsair-modular-atx-smps-power-supply-view3.jpg'
import img_cp_plus_360_ptz_smart_camera_v2 from '../assets/products/p-cp-plus-360-ptz-smart-camera-view2.png'
import img_cp_plus_360_ptz_smart_camera_v3 from '../assets/products/p-cp-plus-360-ptz-smart-camera-view3.jpg'
import img_cp_plus_full_hd_dome_camera_v2 from '../assets/products/p-cp-plus-full-hd-dome-camera-view2.jpg'
import img_cp_plus_full_hd_dome_camera_v3 from '../assets/products/p-cp-plus-full-hd-dome-camera-view3.jpg'
import img_cp_plus_rfid_attendance_device_v2 from '../assets/products/p-cp-plus-rfid-attendance-device-view2.jpg'
import img_cp_plus_rfid_attendance_device_v3 from '../assets/products/p-cp-plus-rfid-attendance-device-view3.jpg'
import img_cr2032_3v_lithium_coin_cell_batteries_pack_v2 from '../assets/products/p-cr2032-3v-lithium-coin-cell-batteries-pack-view2.jpg'
import img_cr2032_3v_lithium_coin_cell_batteries_pack_v3 from '../assets/products/p-cr2032-3v-lithium-coin-cell-batteries-pack-view3.jpg'
import img_crotomax_wall_mount_dvr_rack_cabinet_v2 from '../assets/products/p-crotomax-wall-mount-dvr-rack-cabinet-view2.jpg'
import img_custom_gaming_studio_workstation_setup_v2 from '../assets/products/p-custom-gaming-studio-workstation-setup-view2.jpg'
import img_custom_gaming_studio_workstation_setup_v3 from '../assets/products/p-custom-gaming-studio-workstation-setup-view3.jpg'
import img_custom_liquid_cooled_gaming_rig_v2 from '../assets/products/p-custom-liquid-cooled-gaming-rig-view2.jpg'
import img_custom_liquid_cooled_gaming_rig_v3 from '../assets/products/p-custom-liquid-cooled-gaming-rig-view3.jpg'
import img_dc_power_adapter_12v_2a_barrel_jack_v2 from '../assets/products/p-dc-power-adapter-12v-2a-barrel-jack-view2.jpg'
import img_dc_power_adapter_12v_2a_barrel_jack_v3 from '../assets/products/p-dc-power-adapter-12v-2a-barrel-jack-view3.jpg'
import img_dc_power_adapter_9v_1a_barrel_jack_v2 from '../assets/products/p-dc-power-adapter-9v-1a-barrel-jack-view2.jpg'
import img_dc_power_adapter_9v_1a_barrel_jack_v3 from '../assets/products/p-dc-power-adapter-9v-1a-barrel-jack-view3.jpg'
import img_dell_inspiron_business_laptop_v2 from '../assets/products/p-dell-inspiron-business-laptop-view2.jpg'
import img_dell_inspiron_business_laptop_v3 from '../assets/products/p-dell-inspiron-business-laptop-view3.jpg'
import img_dell_kb216_wired_multimedia_keyboard_v2 from '../assets/products/p-dell-kb216-wired-multimedia-keyboard-view2.jpg'
import img_dell_kb216_wired_multimedia_keyboard_v3 from '../assets/products/p-dell-kb216-wired-multimedia-keyboard-view3.jpg'
import img_dell_km3322w_wireless_combo_v2 from '../assets/products/p-dell-km3322w-wireless-combo-view2.png'
import img_dell_km3322w_wireless_combo_v3 from '../assets/products/p-dell-km3322w-wireless-combo-view3.jpg'
import img_dell_latitude_business_laptop_v2 from '../assets/products/p-dell-latitude-business-laptop-view2.jpg'
import img_dell_latitude_business_laptop_v3 from '../assets/products/p-dell-latitude-business-laptop-view3.jpg'
import img_dell_ms116_usb_optical_mouse_v2 from '../assets/products/p-dell-ms116-usb-optical-mouse-view2.jpg'
import img_dell_ms116_usb_optical_mouse_v3 from '../assets/products/p-dell-ms116-usb-optical-mouse-view3.png'
import img_dell_precision_cad_workstation_tower_v2 from '../assets/products/p-dell-precision-cad-workstation-tower-view2.jpeg'
import img_dell_sff_compact_workstation_v2 from '../assets/products/p-dell-sff-compact-workstation-view2.jpg'
import img_dell_sff_compact_workstation_v3 from '../assets/products/p-dell-sff-compact-workstation-view3.jpg'
import img_dell_wm126_wireless_optical_mouse_v2 from '../assets/products/p-dell-wm126-wireless-optical-mouse-view2.jpg'
import img_dell_wm126_wireless_optical_mouse_v3 from '../assets/products/p-dell-wm126-wireless-optical-mouse-view3.jpg'
import img_desktop_pc_monitor_3_pin_power_cord_v2 from '../assets/products/p-desktop-pc-monitor-3-pin-power-cord-view2.jpg'
import img_desktop_pc_monitor_3_pin_power_cord_v3 from '../assets/products/p-desktop-pc-monitor-3-pin-power-cord-view3.jpg'
import img_displayport_1_4_monitor_cable_v2 from '../assets/products/p-displayport-1-4-monitor-cable-view2.jpg'
import img_displayport_1_4_monitor_cable_v3 from '../assets/products/p-displayport-1-4-monitor-cable-view3.jpg'
import img_displayport_male_to_hdmi_female_adapter_cable_v2 from '../assets/products/p-displayport-male-to-hdmi-female-adapter-cable-view2.jpg'
import img_dlink_cat6_rj45_modular_connectors_box_v3 from '../assets/products/p-dlink-cat6-rj45-modular-connectors-box-view3.jpg'
import img_dlink_cat6_utp_patch_cable_2m_v2 from '../assets/products/p-dlink-cat6-utp-patch-cable-2m-view2.jpg'
import img_dlink_cat6_utp_patch_cable_2m_v3 from '../assets/products/p-dlink-cat6-utp-patch-cable-2m-view3.jpg'
import img_dt830d_digital_multimeter_with_probes_v2 from '../assets/products/p-dt830d-digital-multimeter-with-probes-view2.jpg'
import img_dt830d_digital_multimeter_with_probes_v3 from '../assets/products/p-dt830d-digital-multimeter-with-probes-view3.jpg'
import img_dual_band_wifi_6_routers_poe_gigabit_switches_v2 from '../assets/products/p-dual-band-wifi-6-routers-poe-gigabit-switches-view2.jpg'
import img_dual_band_wifi_6_routers_poe_gigabit_switches_v3 from '../assets/products/p-dual-band-wifi-6-routers-poe-gigabit-switches-view3.jpg'
import img_dvi_d_to_hdmi_bi_directional_video_adapter_v2 from '../assets/products/p-dvi-d-to-hdmi-bi-directional-video-adapter-view2.jpg'
import img_dvi_d_to_hdmi_bi_directional_video_adapter_v3 from '../assets/products/p-dvi-d-to-hdmi-bi-directional-video-adapter-view3.jpg'
import img_electromagnetic_door_access_controllers_v2 from '../assets/products/p-electromagnetic-door-access-controllers-view2.jpg'
import img_electromagnetic_door_access_controllers_v3 from '../assets/products/p-electromagnetic-door-access-controllers-view3.jpg'
import img_enterprise_matte_all_in_one_pc_v2 from '../assets/products/p-enterprise-matte-all-in-one-pc-view2.jpg'
import img_enterprise_matte_all_in_one_pc_v3 from '../assets/products/p-enterprise-matte-all-in-one-pc-view3.jpg'
import img_epson_ecotank_ink_tank_printer_v2 from '../assets/products/p-epson-ecotank-ink-tank-printer-view2.png'
import img_epson_ecotank_ink_tank_printer_v3 from '../assets/products/p-epson-ecotank-ink-tank-printer-view3.jpg'
import img_ergonomic_commercial_wired_mouse_v2 from '../assets/products/p-ergonomic-commercial-wired-mouse-view2.jpg'
import img_ergonomic_commercial_wired_mouse_v3 from '../assets/products/p-ergonomic-commercial-wired-mouse-view3.jpg'
import img_ergonomic_full_size_wireless_combo_v3 from '../assets/products/p-ergonomic-full-size-wireless-combo-view3.jpg'
import img_essl_rfid_card_keypad_terminal_v2 from '../assets/products/p-essl-rfid-card-keypad-terminal-view2.jpg'
import img_essl_rfid_card_keypad_terminal_v3 from '../assets/products/p-essl-rfid-card-keypad-terminal-view3.jpg'
import img_extended_gaming_mouse_pad_desk_mat_v2 from '../assets/products/p-extended-gaming-mouse-pad-desk-mat-view2.jpg'
import img_extended_gaming_mouse_pad_desk_mat_v3 from '../assets/products/p-extended-gaming-mouse-pad-desk-mat-view3.jpg'
import img_fentico_displayport_male_to_vga_female_adapter_v2 from '../assets/products/p-fentico-displayport-male-to-vga-female-adapter-view2.png'
import img_fentico_displayport_male_to_vga_female_adapter_v3 from '../assets/products/p-fentico-displayport-male-to-vga-female-adapter-view3.jpg'
import img_flexible_usb_led_portable_reading_lamp_2pack_v2 from '../assets/products/p-flexible-usb-led-portable-reading-lamp-2pack-view2.jpg'
import img_flipkart_smartbuy_electric_fan_room_heater_v3 from '../assets/products/p-flipkart-smartbuy-electric-fan-room-heater-view3.jpg'
import img_gold_plated_15_pin_vga_cable_black_v2 from '../assets/products/p-gold-plated-15-pin-vga-cable-black-view2.jpg'
import img_gold_plated_15_pin_vga_cable_black_v3 from '../assets/products/p-gold-plated-15-pin-vga-cable-black-view3.jpg'
import img_hawk_vision_stainless_steel_electronic_door_lock_v2 from '../assets/products/p-hawk-vision-stainless-steel-electronic-door-lock-view2.jpg'
import img_hawk_vision_stainless_steel_electronic_door_lock_v3 from '../assets/products/p-hawk-vision-stainless-steel-electronic-door-lock-view3.jpg'
import img_hdmi_1_male_to_2_female_dual_splitter_cable_v2 from '../assets/products/p-hdmi-1-male-to-2-female-dual-splitter-cable-view2.jpg'
import img_hdmi_female_to_female_coupler_extender_v2 from '../assets/products/p-hdmi-female-to-female-coupler-extender-view2.jpg'
import img_hdmi_female_to_female_coupler_extender_v3 from '../assets/products/p-hdmi-female-to-female-coupler-extender-view3.jpg'
import img_hdmi_male_to_vga_female_adapter_with_audio_v2 from '../assets/products/p-hdmi-male-to-vga-female-adapter-with-audio-view2.png'
import img_hdmi_male_to_vga_female_adapter_with_audio_v3 from '../assets/products/p-hdmi-male-to-vga-female-adapter-with-audio-view3.png'
import img_hdmi_to_micro_hdmi_cable_v2 from '../assets/products/p-hdmi-to-micro-hdmi-cable-view2.jpeg'
import img_hdmi_to_micro_hdmi_cable_v3 from '../assets/products/p-hdmi-to-micro-hdmi-cable-view3.jpg'
import img_heavy_duty_15_pin_vga_cable_v2 from '../assets/products/p-heavy-duty-15-pin-vga-cable-view2.png'
import img_heavy_duty_15_pin_vga_cable_v3 from '../assets/products/p-heavy-duty-15-pin-vga-cable-view3.png'
import img_heavy_duty_bnc_compression_video_connectors_v2 from '../assets/products/p-heavy-duty-bnc-compression-video-connectors-view2.jpg'
import img_heavy_duty_bnc_compression_video_connectors_v3 from '../assets/products/p-heavy-duty-bnc-compression-video-connectors-view3.jpg'
import img_heavy_duty_fixed_tv_wall_mount_bracket_v2 from '../assets/products/p-heavy-duty-fixed-tv-wall-mount-bracket-view2.jpg'
import img_heavy_duty_fixed_tv_wall_mount_bracket_v3 from '../assets/products/p-heavy-duty-fixed-tv-wall-mount-bracket-view3.jpg'
import img_high_performance_thermal_paste_compound_v2 from '../assets/products/p-high-performance-thermal-paste-compound-view2.jpg'
import img_high_performance_thermal_paste_compound_v3 from '../assets/products/p-high-performance-thermal-paste-compound-view3.jpg'
import img_high_speed_nvme_m2_ssds_external_drives_v2 from '../assets/products/p-high-speed-nvme-m2-ssds-external-drives-view2.jpg'
import img_high_speed_nvme_m2_ssds_external_drives_v3 from '../assets/products/p-high-speed-nvme-m2-ssds-external-drives-view3.jpg'
import img_hikvision_colorvu_4k_bullet_camera_v2 from '../assets/products/p-hikvision-colorvu-4k-bullet-camera-view2.jpg'
import img_hikvision_colorvu_4k_bullet_camera_v3 from '../assets/products/p-hikvision-colorvu-4k-bullet-camera-view3.jpg'
import img_hikvision_full_hd_dome_camera_v2 from '../assets/products/p-hikvision-full-hd-dome-camera-view2.jpg'
import img_hikvision_full_hd_dome_camera_v3 from '../assets/products/p-hikvision-full-hd-dome-camera-view3.jpg'
import img_hikvision_minmoe_face_terminal_v2 from '../assets/products/p-hikvision-minmoe-face-terminal-view2.jpg'
import img_hikvision_minmoe_face_terminal_v3 from '../assets/products/p-hikvision-minmoe-face-terminal-view3.jpg'
import img_hikvision_wall_mount_face_terminal_v2 from '../assets/products/p-hikvision-wall-mount-face-terminal-view2.jpg'
import img_hikvision_wall_mount_face_terminal_v3 from '../assets/products/p-hikvision-wall-mount-face-terminal-view3.jpg'
import img_hp_230_wireless_keyboard_combo_v2 from '../assets/products/p-hp-230-wireless-keyboard-combo-view2.jpg'
import img_hp_230_wireless_keyboard_combo_v3 from '../assets/products/p-hp-230-wireless-keyboard-combo-view3.jpg'
import img_hp_color_laserjet_enterprise_mfp_v2 from '../assets/products/p-hp-color-laserjet-enterprise-mfp-view2.jpg'
import img_hp_color_laserjet_enterprise_mfp_v3 from '../assets/products/p-hp-color-laserjet-enterprise-mfp-view3.jpg'
import img_hp_elitebook_corporate_laptop_v2 from '../assets/products/p-hp-elitebook-corporate-laptop-view2.jpg'
import img_hp_elitebook_corporate_laptop_v3 from '../assets/products/p-hp-elitebook-corporate-laptop-view3.jpg'
import img_hp_gaming_optical_mouse_v2 from '../assets/products/p-hp-gaming-optical-mouse-view2.jpg'
import img_hp_gaming_optical_mouse_v3 from '../assets/products/p-hp-gaming-optical-mouse-view3.jpg'
import img_hp_mechanical_rgb_keyboard_v2 from '../assets/products/p-hp-mechanical-rgb-keyboard-view2.jpg'
import img_hp_mechanical_rgb_keyboard_v3 from '../assets/products/p-hp-mechanical-rgb-keyboard-view3.jpg'
import img_hp_pavilion_silver_slim_laptop_v2 from '../assets/products/p-hp-pavilion-silver-slim-laptop-view2.jpg'
import img_hp_pavilion_silver_slim_laptop_v3 from '../assets/products/p-hp-pavilion-silver-slim-laptop-view3.jpg'
import img_hp_probook_commercial_laptop_v2 from '../assets/products/p-hp-probook-commercial-laptop-view2.png'
import img_hp_probook_commercial_laptop_v3 from '../assets/products/p-hp-probook-commercial-laptop-view3.jpg'
import img_intel_stock_lga115x_cpu_cooler_fan_v2 from '../assets/products/p-intel-stock-lga115x-cpu-cooler-fan-view2.jpg'
import img_intel_stock_lga115x_cpu_cooler_fan_v3 from '../assets/products/p-intel-stock-lga115x-cpu-cooler-fan-view3.jpg'
import img_kingston_desktop_ddr_ram_module_v2 from '../assets/products/p-kingston-desktop-ddr-ram-module-view2.jpg'
import img_kizma_3_in_1_super_cleaning_kit_v3 from '../assets/products/p-kizma-3-in-1-super-cleaning-kit-view3.jpg'
import img_laptop_cooling_pad_with_blue_led_fan_v2 from '../assets/products/p-laptop-cooling-pad-with-blue-led-fan-view2.jpg'
import img_laptop_power_cable_c5_cloverleaf_v3 from '../assets/products/p-laptop-power-cable-c5-cloverleaf-view3.jpg'
import img_lenovo_commercial_office_laptop_v2 from '../assets/products/p-lenovo-commercial-office-laptop-view2.jpg'
import img_lenovo_commercial_office_laptop_v3 from '../assets/products/p-lenovo-commercial-office-laptop-view3.png'
import img_lenovo_thinkcentre_desktop_tower_v3 from '../assets/products/p-lenovo-thinkcentre-desktop-tower-view3.jpeg'
import img_lenovo_wireless_ergonomic_mouse_v2 from '../assets/products/p-lenovo-wireless-ergonomic-mouse-view2.jpg'
import img_lenovo_wireless_ergonomic_mouse_v3 from '../assets/products/p-lenovo-wireless-ergonomic-mouse-view3.jpg'
import img_logitech_mx_keys_mini_keyboard_v2 from '../assets/products/p-logitech-mx-keys-mini-keyboard-view2.jpg'
import img_logitech_mx_keys_mini_keyboard_v3 from '../assets/products/p-logitech-mx-keys-mini-keyboard-view3.jpg'
import img_logitech_retro_logo_gaming_mousepad_v2 from '../assets/products/p-logitech-retro-logo-gaming-mousepad-view2.jpg'
import img_logitech_retro_logo_gaming_mousepad_v3 from '../assets/products/p-logitech-retro-logo-gaming-mousepad-view3.jpg'
import img_logitech_wireless_multimedia_keyboard_v2 from '../assets/products/p-logitech-wireless-multimedia-keyboard-view2.jpg'
import img_logitech_wireless_multimedia_keyboard_v3 from '../assets/products/p-logitech-wireless-multimedia-keyboard-view3.jpg'
import img_mantra_optical_fingerprint_scanner_v2 from '../assets/products/p-mantra-optical-fingerprint-scanner-view2.jpg'
import img_mantra_optical_fingerprint_scanner_v3 from '../assets/products/p-mantra-optical-fingerprint-scanner-view3.jpg'
import img_micro_wolf_hunter_l_16_gaming_mouse_pad_v2 from '../assets/products/p-micro-wolf-hunter-l-16-gaming-mouse-pad-view2.jpg'
import img_micro_wolf_hunter_l_16_gaming_mouse_pad_v3 from '../assets/products/p-micro-wolf-hunter-l-16-gaming-mouse-pad-view3.jpg'
import img_microfiber_cleaning_cloths_multi_color_pack_v3 from '../assets/products/p-microfiber-cleaning-cloths-multi-color-pack-view3.jpg'
import img_mini_av_rca_to_hdmi_1080p_scaler_converter_box_v2 from '../assets/products/p-mini-av-rca-to-hdmi-1080p-scaler-converter-box-view2.jpg'
import img_mini_av_rca_to_hdmi_1080p_scaler_converter_box_v3 from '../assets/products/p-mini-av-rca-to-hdmi-1080p-scaler-converter-box-view3.jpg'
import img_mini_av_rca_to_vga_video_converter_box_v2 from '../assets/products/p-mini-av-rca-to-vga-video-converter-box-view2.jpg'
import img_mini_av_rca_to_vga_video_converter_box_v3 from '../assets/products/p-mini-av-rca-to-vga-video-converter-box-view3.jpg'
import img_mini_hdmi_to_av_rca_video_converter_box_v2 from '../assets/products/p-mini-hdmi-to-av-rca-video-converter-box-view2.jpg'
import img_mini_hdmi_to_av_rca_video_converter_box_v3 from '../assets/products/p-mini-hdmi-to-av-rca-video-converter-box-view3.jpg'
import img_mini_vga_to_hdmi_1080p_video_converter_box_v2 from '../assets/products/p-mini-vga-to-hdmi-1080p-video-converter-box-view2.jpg'
import img_mini_vga_to_hdmi_1080p_video_converter_box_v3 from '../assets/products/p-mini-vga-to-hdmi-1080p-video-converter-box-view3.jpg'
import img_multi_channel_cctv_dvr_nvr_recorder_v3 from '../assets/products/p-multi-channel-cctv-dvr-nvr-recorder-view3.jpg'
import img_passive_hdcvi_tvi_ahd_cctv_video_balun_pair_v2 from '../assets/products/p-passive-hdcvi-tvi-ahd-cctv-video-balun-pair-view2.jpeg'
import img_passive_hdcvi_tvi_ahd_cctv_video_balun_pair_v3 from '../assets/products/p-passive-hdcvi-tvi-ahd-cctv-video-balun-pair-view3.jpg'
import img_ranz_3_in_1_screen_cleaning_kit_v2 from '../assets/products/p-ranz-3-in-1-screen-cleaning-kit-view2.jpg'
import img_ranz_3_in_1_screen_cleaning_kit_v3 from '../assets/products/p-ranz-3-in-1-screen-cleaning-kit-view3.jpg'
import img_rca_3_male_to_3_female_av_extension_cable_v2 from '../assets/products/p-rca-3-male-to-3-female-av-extension-cable-view2.jpg'
import img_rca_3_male_to_3_female_av_extension_cable_v3 from '../assets/products/p-rca-3-male-to-3-female-av-extension-cable-view3.jpg'
import img_rj45_rj11_network_cable_crimping_tool_with_stripper_v2 from '../assets/products/p-rj45-rj11-network-cable-crimping-tool-with-stripper-view2.jpg'
import img_rj45_rj11_network_cable_crimping_tool_with_stripper_v3 from '../assets/products/p-rj45-rj11-network-cable-crimping-tool-with-stripper-view3.jpg'
import img_sata_2_5_inch_hdd_ssd_enclosure_black_v2 from '../assets/products/p-sata-2-5-inch-hdd-ssd-enclosure-black-view2.jpg'
import img_sata_2_5_inch_hdd_ssd_enclosure_black_v3 from '../assets/products/p-sata-2-5-inch-hdd-ssd-enclosure-black-view3.jpg'
import img_sata_6gbps_internal_drive_cable_v2 from '../assets/products/p-sata-6gbps-internal-drive-cable-view2.jpg'
import img_sata_6gbps_internal_drive_cable_v3 from '../assets/products/p-sata-6gbps-internal-drive-cable-view3.jpg'
import img_scenic_nature_printed_optical_mousepad_v2 from '../assets/products/p-scenic-nature-printed-optical-mousepad-view2.png'
import img_scenic_nature_printed_optical_mousepad_v3 from '../assets/products/p-scenic-nature-printed-optical-mousepad-view3.jpg'
import img_shielded_white_vga_cable_dual_ferrite_v2 from '../assets/products/p-shielded-white-vga-cable-dual-ferrite-view2.jpg'
import img_shielded_white_vga_cable_dual_ferrite_v3 from '../assets/products/p-shielded-white-vga-cable-dual-ferrite-view3.jpg'
import img_slim_chiclet_low_profile_keyboard_v2 from '../assets/products/p-slim-chiclet-low-profile-keyboard-view2.jpg'
import img_slim_chiclet_low_profile_keyboard_v3 from '../assets/products/p-slim-chiclet-low-profile-keyboard-view3.jpg'
import img_smart_outdoor_wifi_bullet_camera_v2 from '../assets/products/p-smart-outdoor-wifi-bullet-camera-view2.jpg'
import img_smart_outdoor_wifi_bullet_camera_v3 from '../assets/products/p-smart-outdoor-wifi-bullet-camera-view3.jpg'
import img_standard_15_pin_vga_monitor_cable_blue_v2 from '../assets/products/p-standard-15-pin-vga-monitor-cable-blue-view2.jpg'
import img_standard_15_pin_vga_monitor_cable_blue_v3 from '../assets/products/p-standard-15-pin-vga-monitor-cable-blue-view3.jpg'
import img_standard_male_to_male_hdmi_cable_v2 from '../assets/products/p-standard-male-to-male-hdmi-cable-view2.jpg'
import img_standard_male_to_male_hdmi_cable_v3 from '../assets/products/p-standard-male-to-male-hdmi-cable-view3.jpg'
import img_standard_office_wired_keyboard_v2 from '../assets/products/p-standard-office-wired-keyboard-view2.jpg'
import img_standard_office_wired_keyboard_v3 from '../assets/products/p-standard-office-wired-keyboard-view3.jpg'
import img_super_clean_high_tech_cleaning_gel_pouch_v2 from '../assets/products/p-super-clean-high-tech-cleaning-gel-pouch-view2.jpg'
import img_super_clean_high_tech_cleaning_gel_pouch_v3 from '../assets/products/p-super-clean-high-tech-cleaning-gel-pouch-view3.jpg'
import img_swivel_tilt_monitor_tv_wall_mount_bracket_v3 from '../assets/products/p-swivel-tilt-monitor-tv-wall-mount-bracket-view3.jpg'
import img_terabyte_clarion_tb_008_mini_digital_speakers_v3 from '../assets/products/p-terabyte-clarion-tb-008-mini-digital-speakers-view3.jpg'
import img_terabyte_eliptic_tb_015_multimedia_speakers_v2 from '../assets/products/p-terabyte-eliptic-tb-015-multimedia-speakers-view2.png'
import img_terabyte_eliptic_tb_015_multimedia_speakers_v3 from '../assets/products/p-terabyte-eliptic-tb-015-multimedia-speakers-view3.jpg'
import img_terabyte_hd_2_0v_premium_hdmi_cable_v2 from '../assets/products/p-terabyte-hd-2-0v-premium-hdmi-cable-view2.jpg'
import img_terabyte_hd_2_0v_premium_hdmi_cable_v3 from '../assets/products/p-terabyte-hd-2-0v-premium-hdmi-cable-view3.jpg'
import img_terabyte_kubix_e_02b_multimedia_speakers_v2 from '../assets/products/p-terabyte-kubix-e-02b-multimedia-speakers-view2.jpg'
import img_terabyte_kubix_e_02b_multimedia_speakers_v3 from '../assets/products/p-terabyte-kubix-e-02b-multimedia-speakers-view3.jpg'
import img_thermaltake_cpu_cooler_fan_lga775_115x_v2 from '../assets/products/p-thermaltake-cpu-cooler-fan-lga775-115x-view2.jpg'
import img_thermaltake_cpu_cooler_fan_lga775_115x_v3 from '../assets/products/p-thermaltake-cpu-cooler-fan-lga775-115x-view3.jpg'
import img_transparent_2_5_inch_sata_usb_3_0_enclosure_v2 from '../assets/products/p-transparent-2-5-inch-sata-usb-3-0-enclosure-view2.jpg'
import img_transparent_2_5_inch_sata_usb_3_0_enclosure_v3 from '../assets/products/p-transparent-2-5-inch-sata-usb-3-0-enclosure-view3.jpg'
import img_ultra_slim_metallic_notebook_v2 from '../assets/products/p-ultra-slim-metallic-notebook-view2.jpg'
import img_ultra_slim_metallic_notebook_v3 from '../assets/products/p-ultra-slim-metallic-notebook-view3.jpg'
import img_usb_2_0_4_port_hub_with_switches_v2 from '../assets/products/p-usb-2-0-4-port-hub-with-switches-view2.jpg'
import img_usb_2_0_4_port_hub_with_switches_v3 from '../assets/products/p-usb-2-0-4-port-hub-with-switches-view3.jpg'
import img_usb_2_0_hdmi_1080p_video_capture_card_dongle_v2 from '../assets/products/p-usb-2-0-hdmi-1080p-video-capture-card-dongle-view2.jpg'
import img_usb_2_0_hdmi_1080p_video_capture_card_dongle_v3 from '../assets/products/p-usb-2-0-hdmi-1080p-video-capture-card-dongle-view3.png'
import img_usb_2_0_type_a_male_to_female_extension_cable_v2 from '../assets/products/p-usb-2-0-type-a-male-to-female-extension-cable-view2.jpg'
import img_usb_2_0_type_a_male_to_female_extension_cable_v3 from '../assets/products/p-usb-2-0-type-a-male-to-female-extension-cable-view3.jpg'
import img_usb_2_0_type_a_to_type_b_printer_cable_v2 from '../assets/products/p-usb-2-0-type-a-to-type-b-printer-cable-view2.jpg'
import img_usb_3_0_to_hdmi_1080p_display_adapter_v2 from '../assets/products/p-usb-3-0-to-hdmi-1080p-display-adapter-view2.jpg'
import img_usb_3_0_to_hdmi_1080p_display_adapter_v3 from '../assets/products/p-usb-3-0-to-hdmi-1080p-display-adapter-view3.jpg'
import img_usb_3_0_type_a_male_to_female_extension_cable_v2 from '../assets/products/p-usb-3-0-type-a-male-to-female-extension-cable-view2.jpg'
import img_usb_3_0_type_a_male_to_female_extension_cable_v3 from '../assets/products/p-usb-3-0-type-a-male-to-female-extension-cable-view3.jpg'
import img_usb_to_internal_5pin_terminal_data_cable_v2 from '../assets/products/p-usb-to-internal-5pin-terminal-data-cable-view2.jpg'
import img_usb_to_internal_5pin_terminal_data_cable_v3 from '../assets/products/p-usb-to-internal-5pin-terminal-data-cable-view3.jpg'
import img_usb_to_rs232_db9_serial_adapter_cable_v2 from '../assets/products/p-usb-to-rs232-db9-serial-adapter-cable-view2.jpg'
import img_usb_to_rs232_db9_serial_adapter_cable_v3 from '../assets/products/p-usb-to-rs232-db9-serial-adapter-cable-view3.jpg'
import img_usb_type_c_3_in_1_multiport_adapter_silver_v2 from '../assets/products/p-usb-type-c-3-in-1-multiport-adapter-silver-view2.jpg'
import img_usb_type_c_3_in_1_multiport_adapter_silver_v3 from '../assets/products/p-usb-type-c-3-in-1-multiport-adapter-silver-view3.jpg'
import img_usb_type_c_fast_charging_data_cable_v2 from '../assets/products/p-usb-type-c-fast-charging-data-cable-view2.png'
import img_usb_type_c_fast_charging_data_cable_v3 from '../assets/products/p-usb-type-c-fast-charging-data-cable-view3.jpg'
import img_usb_type_c_to_hdmi_4k_display_adapter_silver_v2 from '../assets/products/p-usb-type-c-to-hdmi-4k-display-adapter-silver-view2.jpg'
import img_vga_1_male_to_2_female_y_splitter_cable_v2 from '../assets/products/p-vga-1-male-to-2-female-y-splitter-cable-view2.jpg'
import img_vga_1_male_to_2_female_y_splitter_cable_v3 from '../assets/products/p-vga-1-male-to-2-female-y-splitter-cable-view3.jpg'
import img_wireless_n_950m_mini_usb_wifi_adapter_v2 from '../assets/products/p-wireless-n-950m-mini-usb-wifi-adapter-view2.jpg'
import img_wireless_n_950m_mini_usb_wifi_adapter_v3 from '../assets/products/p-wireless-n-950m-mini-usb-wifi-adapter-view3.jpg'
import img_wireless_office_keyboard_mouse_combo_v2 from '../assets/products/p-wireless-office-keyboard-mouse-combo-view2.jpg'
import img_wireless_office_keyboard_mouse_combo_v3 from '../assets/products/p-wireless-office-keyboard-mouse-combo-view3.png'
import img_zebronics_optical_wired_mouse_v2 from '../assets/products/p-zebronics-optical-wired-mouse-view2.jpg'
import img_zebronics_optical_wired_mouse_v3 from '../assets/products/p-zebronics-optical-wired-mouse-view3.jpeg'

/**
 * Mapping dictionary of verified product slugs to arrays of imported asset URLs.
 * Displays only authentic, verified relevant images without fabricated counts.
 */
export const PRODUCT_IMAGES = {
  'dell-latitude-business-laptop': [businessLaptopDell1, img_dell_latitude_business_laptop_v2, img_dell_latitude_business_laptop_v3],
  'lenovo-commercial-office-laptop': [businessLaptopLenovo, img_lenovo_commercial_office_laptop_v2, img_lenovo_commercial_office_laptop_v3],
  'hp-elitebook-corporate-laptop': [businessLaptopHp, img_hp_elitebook_corporate_laptop_v2, img_hp_elitebook_corporate_laptop_v3],
  'asus-tuf-gaming-laptop': [businessLaptopAsusTuf, img_asus_tuf_gaming_laptop_v2, img_asus_tuf_gaming_laptop_v3],
  'dell-inspiron-business-laptop': [businessLaptopDell2, img_dell_inspiron_business_laptop_v2, img_dell_inspiron_business_laptop_v3],
  'hp-probook-commercial-laptop': [businessLaptopHpProbook, img_hp_probook_commercial_laptop_v2, img_hp_probook_commercial_laptop_v3],
  'acer-performance-laptop': [businessLaptopAcerRgb, img_acer_performance_laptop_v2, img_acer_performance_laptop_v3],
  'ultra-slim-metallic-notebook': [businessLaptopSilverUltrabook, img_ultra_slim_metallic_notebook_v2, img_ultra_slim_metallic_notebook_v3],
  'hp-pavilion-silver-slim-laptop': [businessLaptopHpSilverSlim, img_hp_pavilion_silver_slim_laptop_v2, img_hp_pavilion_silver_slim_laptop_v3],
  'custom-gaming-studio-workstation-setup': [gamingDeskSetupCurved, img_custom_gaming_studio_workstation_setup_v2, img_custom_gaming_studio_workstation_setup_v3],
  'custom-liquid-cooled-gaming-rig': [gamingRigRgbLiquid, img_custom_liquid_cooled_gaming_rig_v2, img_custom_liquid_cooled_gaming_rig_v3],
  'commercial-slim-all-in-one-pc': [aioDisplaySlimArc, img_commercial_slim_all_in_one_pc_v2, img_commercial_slim_all_in_one_pc_v3],
  'enterprise-matte-all-in-one-pc': [aioDisplayCommercialMatte, img_enterprise_matte_all_in_one_pc_v2, img_enterprise_matte_all_in_one_pc_v3],
  'dell-precision-cad-workstation-tower': [workstationDellTower, img_dell_precision_cad_workstation_tower_v2],
  'lenovo-thinkcentre-desktop-tower': [workstationLenovoThinkcentre, img_lenovo_thinkcentre_desktop_tower_v3],
  'dell-sff-compact-workstation': [workstationDellSff, img_dell_sff_compact_workstation_v2, img_dell_sff_compact_workstation_v3],
  'acer-veriton-commercial-tower': [workstationAcerTower, img_acer_veriton_commercial_tower_v2],
  'business-laptops-dell-hp-lenovo-asus': [businessLaptopDell1],
  'custom-gaming-studio-desktops': [gamingDeskSetupCurved],
  'commercial-all-in-one-aio-pcs': [aioDisplaySlimArc],
  'workstation-towers-cad-3d': [workstationDellTower],
  'hikvision-full-hd-dome-camera': [cctvHikvisionDome, img_hikvision_full_hd_dome_camera_v2, img_hikvision_full_hd_dome_camera_v3],
  'cp-plus-full-hd-dome-camera': [cctvCpPlusDome, img_cp_plus_full_hd_dome_camera_v2, img_cp_plus_full_hd_dome_camera_v3],
  'smart-outdoor-wifi-bullet-camera': [cctvWifiBullet, img_smart_outdoor_wifi_bullet_camera_v2, img_smart_outdoor_wifi_bullet_camera_v3],
  'hikvision-colorvu-4k-bullet-camera': [cctvHikvision4kBullet, img_hikvision_colorvu_4k_bullet_camera_v2, img_hikvision_colorvu_4k_bullet_camera_v3],
  'multi-channel-cctv-dvr-nvr-recorder': [cctvDvr4Ch, cctvKit8Ch, img_multi_channel_cctv_dvr_nvr_recorder_v3],
  'cp-plus-360-ptz-smart-camera': [cctvPtzCpPlus360, img_cp_plus_360_ptz_smart_camera_v2, img_cp_plus_360_ptz_smart_camera_v3],
  'full-hd-dome-bullet-ip-cameras': [cctvHikvisionDome],
  '4k-colorvu-starlight-cameras': [cctvHikvision4kBullet],
  'network-video-recorders-nvr-dvr': [cctvDvr4Ch, cctvKit8Ch],
  'ptz-360-zoom-cameras': [cctvPtzCpPlus360],
  'epson-ecotank-ink-tank-printer': [printerEpsonEcoTank, img_epson_ecotank_ink_tank_printer_v2, img_epson_ecotank_ink_tank_printer_v3],
  'canon-pixma-ink-tank-printer': [printerCanonPixmaInkTank, img_canon_pixma_ink_tank_printer_v2, img_canon_pixma_ink_tank_printer_v3],
  'canon-imageclass-mono-laser-printer': [printerCanonMonoLaser, img_canon_imageclass_mono_laser_printer_v2, img_canon_imageclass_mono_laser_printer_v3],
  'brother-mono-laser-printer': [printerBrotherMonoLaser, img_brother_mono_laser_printer_v2, img_brother_mono_laser_printer_v3],
  'compact-desktop-mono-laser-printer': [printerDesktopMonoLaser, img_compact_desktop_mono_laser_printer_v2, img_compact_desktop_mono_laser_printer_v3],
  'brother-color-mfp-copier-adf': [printerBrotherMfpAdf, img_brother_color_mfp_copier_adf_v2, img_brother_color_mfp_copier_adf_v3],
  'brother-commercial-color-copier': [printerBrotherColorCopierAdf, img_brother_commercial_color_copier_v2, img_brother_commercial_color_copier_v3],
  'hp-color-laserjet-enterprise-mfp': [printerHpColorLaserJet, img_hp_color_laserjet_enterprise_mfp_v2, img_hp_color_laserjet_enterprise_mfp_v3],
  'barcode-thermal-receipt-printers': [accThermalPosPrinter, img_barcode_thermal_receipt_printers_v2, img_barcode_thermal_receipt_printers_v3],
  'continuous-ink-tank-multifunction-printers': [printerEpsonEcoTank],
  'high-speed-monochrome-laser-printers': [printerCanonMonoLaser],
  'color-laser-multi-function-copiers': [printerBrotherMfpAdf],
  'hikvision-minmoe-face-terminal': [bioHikvisionFaceTerminal, img_hikvision_minmoe_face_terminal_v2, img_hikvision_minmoe_face_terminal_v3],
  'hikvision-wall-mount-face-terminal': [bioHikvisionFaceWall, img_hikvision_wall_mount_face_terminal_v2, img_hikvision_wall_mount_face_terminal_v3],
  'mantra-optical-fingerprint-scanner': [bioMantraFingerprint, img_mantra_optical_fingerprint_scanner_v2, img_mantra_optical_fingerprint_scanner_v3],
  'essl-rfid-card-keypad-terminal': [bioEsslX990RfidKeypad, img_essl_rfid_card_keypad_terminal_v2, img_essl_rfid_card_keypad_terminal_v3],
  'cp-plus-rfid-attendance-device': [bioCpPlusTerminal, img_cp_plus_rfid_attendance_device_v2, img_cp_plus_rfid_attendance_device_v3],
  'electromagnetic-door-access-controllers': [accElectroDoorLock, img_electromagnetic_door_access_controllers_v2, img_electromagnetic_door_access_controllers_v3],
  'ai-face-recognition-attendance-system': [bioHikvisionFaceTerminal],
  'optical-fingerprint-attendance-terminal': [bioMantraFingerprint],
  'rfid-proximity-card-punching-devices': [bioEsslX990RfidKeypad],
  'samsung-870-evo-sata-ssd': [accSamsungSsd870],
  'seagate-barracuda-3-5-inch-hdd': [accSeagateBarracudaHdd, accSeagateHddPlatter],
  'corsair-vengeance-lpx-ddr4-ram': [gamingRamCorsairLpx],
  'kingston-desktop-ddr-ram-module': [accKingstonDdrRam, img_kingston_desktop_ddr_ram_module_v2],
  'high-speed-nvme-m2-ssds-external-drives': [accNvmeGen4Ssd, img_high_speed_nvme_m2_ssds_external_drives_v2, img_high_speed_nvme_m2_ssds_external_drives_v3],
  'high-performance-thermal-paste-compound': [gamingThermalPaste, img_high_performance_thermal_paste_compound_v2, img_high_performance_thermal_paste_compound_v3],
  'cooler-master-rgb-cpu-cooler': [gamingCpuCoolerRgb, img_cooler_master_rgb_cpu_cooler_v2, img_cooler_master_rgb_cpu_cooler_v3],
  'corsair-modular-atx-smps-power-supply': [gamingSmpsCorsair, img_corsair_modular_atx_smps_power_supply_v2, img_corsair_modular_atx_smps_power_supply_v3],
  'nvidia-geforce-dedicated-graphics-card': [gamingGpuNvidia],
  'asus-desktop-motherboard': [gamingMotherboardAsus, img_asus_desktop_motherboard_v2],
  'multi-channel-cctv-smps-power-supply': [cctvSmpsSupply],
  'dual-band-wifi-6-routers-poe-gigabit-switches': [accWifi6Router, img_dual_band_wifi_6_routers_poe_gigabit_switches_v2, img_dual_band_wifi_6_routers_poe_gigabit_switches_v3],
  'dell-km3322w-wireless-combo': [accDellKm3322wCombo, img_dell_km3322w_wireless_combo_v2, img_dell_km3322w_wireless_combo_v3],
  'wireless-office-keyboard-mouse-combo': [accWirelessKbdMouseCombo2, img_wireless_office_keyboard_mouse_combo_v2, img_wireless_office_keyboard_mouse_combo_v3],
  'hp-mechanical-rgb-keyboard': [accHpMechRgbKeyboard, img_hp_mechanical_rgb_keyboard_v2, img_hp_mechanical_rgb_keyboard_v3],
  'asus-desktop-keyboard-mouse-set': [accAsusKeyboardCombo, img_asus_desktop_keyboard_mouse_set_v2, img_asus_desktop_keyboard_mouse_set_v3],
  'hp-230-wireless-keyboard-combo': [accHp230Combo, img_hp_230_wireless_keyboard_combo_v2, img_hp_230_wireless_keyboard_combo_v3],
  'lenovo-300-wireless-keyboard-combo': [accLenovo300Combo],
  'ergonomic-full-size-wireless-combo': [accWirelessComboBox, img_ergonomic_full_size_wireless_combo_v3],
  'logitech-mx-keys-mini-keyboard': [accLogitechMxKeysMini, img_logitech_mx_keys_mini_keyboard_v2, img_logitech_mx_keys_mini_keyboard_v3],
  'logitech-wireless-multimedia-keyboard': [accLogitechWirelessKbd, img_logitech_wireless_multimedia_keyboard_v2, img_logitech_wireless_multimedia_keyboard_v3],
  'dell-kb216-wired-multimedia-keyboard': [accDellMultimediaKbd, img_dell_kb216_wired_multimedia_keyboard_v2, img_dell_kb216_wired_multimedia_keyboard_v3],
  'slim-chiclet-low-profile-keyboard': [accSlimChicletKbd, img_slim_chiclet_low_profile_keyboard_v2, img_slim_chiclet_low_profile_keyboard_v3],
  'standard-office-wired-keyboard': [accWiredOfficeKbd, img_standard_office_wired_keyboard_v2, img_standard_office_wired_keyboard_v3],
  'hp-gaming-optical-mouse': [accHpGamingMouse, img_hp_gaming_optical_mouse_v2, img_hp_gaming_optical_mouse_v3],
  'dell-ms116-usb-optical-mouse': [accDellMs116Mouse, img_dell_ms116_usb_optical_mouse_v2, img_dell_ms116_usb_optical_mouse_v3],
  'dell-wm126-wireless-optical-mouse': [accDellWm126WirelessMouse, img_dell_wm126_wireless_optical_mouse_v2, img_dell_wm126_wireless_optical_mouse_v3],
  'lenovo-wireless-ergonomic-mouse': [accLenovoWirelessMouse, img_lenovo_wireless_ergonomic_mouse_v2, img_lenovo_wireless_ergonomic_mouse_v3],
  'zebronics-optical-wired-mouse': [accZebronicsMouse, img_zebronics_optical_wired_mouse_v2, img_zebronics_optical_wired_mouse_v3],
  'compact-portable-wireless-mouse': [accCompactWirelessMouse, img_compact_portable_wireless_mouse_v2, img_compact_portable_wireless_mouse_v3],
  'ergonomic-commercial-wired-mouse': [accTrustWiredMouse, img_ergonomic_commercial_wired_mouse_v2, img_ergonomic_commercial_wired_mouse_v3],
  'braided-4k-high-speed-hdmi-cable': [accHdmiBraided4k, accHdmiStandardGold, img_braided_4k_high_speed_hdmi_cable_v2, img_braided_4k_high_speed_hdmi_cable_v3],
  'displayport-1-4-monitor-cable': [accDisplayPortCable, img_displayport_1_4_monitor_cable_v2, img_displayport_1_4_monitor_cable_v3],
  'cat6-gigabit-ethernet-patch-cord': [accCat6EthernetPatch, img_cat6_gigabit_ethernet_patch_cord_v2, img_cat6_gigabit_ethernet_patch_cord_v3],
  'sata-6gbps-internal-drive-cable': [accSataDataCable, img_sata_6gbps_internal_drive_cable_v2, img_sata_6gbps_internal_drive_cable_v3],
  'heavy-duty-15-pin-vga-cable': [accVgaCable15Pin, img_heavy_duty_15_pin_vga_cable_v2, img_heavy_duty_15_pin_vga_cable_v3],
  'usb-type-c-fast-charging-data-cable': [accTypeCBraided60w, accTypeCPouchCable, img_usb_type_c_fast_charging_data_cable_v2, img_usb_type_c_fast_charging_data_cable_v3],
  'desktop-pc-monitor-3-pin-power-cord': [accDesktopPowerCable, img_desktop_pc_monitor_3_pin_power_cord_v2, img_desktop_pc_monitor_3_pin_power_cord_v3],
  'cctv-3-plus-1-coaxial-video-cable': [cctvCoaxialCableBundle, cctvCoaxialCableWhite, img_cctv_3_plus_1_coaxial_video_cable_v2, img_cctv_3_plus_1_coaxial_video_cable_v3],
  '12v-dc-cctv-power-pigtail-connectors': [cctvDcPowerPigtails, img_12v_dc_cctv_power_pigtail_connectors_v2, img_12v_dc_cctv_power_pigtail_connectors_v3],
  'heavy-duty-bnc-compression-video-connectors': [cctvBncConnectors, img_heavy_duty_bnc_compression_video_connectors_v2, img_heavy_duty_bnc_compression_video_connectors_v3],
  'hdmi-to-micro-hdmi-cable': [accImg6, img_hdmi_to_micro_hdmi_cable_v2, img_hdmi_to_micro_hdmi_cable_v3],
  'standard-male-to-male-hdmi-cable': [accImg7, accImg8, accImg9, accImg10, accImg19, img_standard_male_to_male_hdmi_cable_v2, img_standard_male_to_male_hdmi_cable_v3],
  'terabyte-hd-2-0v-premium-hdmi-cable': [accImg20, accImg58, accImg59, img_terabyte_hd_2_0v_premium_hdmi_cable_v2, img_terabyte_hd_2_0v_premium_hdmi_cable_v3],
  'adnet-ad-001-laptop-power-cable': [accImg71, accImg72, img_adnet_ad_001_laptop_power_cable_v2],
  'laptop-power-cable-c5-cloverleaf': [accImg75, accImg76, img_laptop_power_cable_c5_cloverleaf_v3],
  'desktop-pc-monitor-iec-c13-power-cable': [accImg77, accImg78, accImg79],
  'usb-2-0-type-a-male-to-female-extension-cable': [accImg83, accImg88, accImg100, img_usb_2_0_type_a_male_to_female_extension_cable_v2, img_usb_2_0_type_a_male_to_female_extension_cable_v3],
  'usb-2-0-type-a-to-type-b-printer-cable': [accImg84, accImg85, accImg86, img_usb_2_0_type_a_to_type_b_printer_cable_v2],
  'usb-3-0-type-a-male-to-female-extension-cable': [accImg87, img_usb_3_0_type_a_male_to_female_extension_cable_v2, img_usb_3_0_type_a_male_to_female_extension_cable_v3],
  'standard-15-pin-vga-monitor-cable-blue': [accImg91, img_standard_15_pin_vga_monitor_cable_blue_v2, img_standard_15_pin_vga_monitor_cable_blue_v3],
  'shielded-white-vga-cable-dual-ferrite': [accImg99, accImg105, img_shielded_white_vga_cable_dual_ferrite_v2, img_shielded_white_vga_cable_dual_ferrite_v3],
  'gold-plated-15-pin-vga-cable-black': [accImg101, img_gold_plated_15_pin_vga_cable_black_v2, img_gold_plated_15_pin_vga_cable_black_v3],
  'dlink-cat6-utp-patch-cable-2m': [accImg104, img_dlink_cat6_utp_patch_cable_2m_v2, img_dlink_cat6_utp_patch_cable_2m_v3],
  'cat6-rj45-gigabit-ethernet-patch-cable-grey': [accImg106, accImg107, accImg108, accImg115],
  'usb-to-internal-5pin-terminal-data-cable': [accImg111, accImg112, img_usb_to_internal_5pin_terminal_data_cable_v2, img_usb_to_internal_5pin_terminal_data_cable_v3],
  'amazonbasics-hdmi-male-to-female-extension-cable': [accImg114, img_amazonbasics_hdmi_male_to_female_extension_cable_v2, img_amazonbasics_hdmi_male_to_female_extension_cable_v3],
  'cat6-rj45-gigabit-network-cable-10m': [accImg115],
  'cctv-3-plus-1-coaxial-video-power-cable-roll': [accImg116, img_cctv_3_plus_1_coaxial_video_power_cable_roll_v2, img_cctv_3_plus_1_coaxial_video_power_cable_roll_v3],
  'hdmi-male-to-vga-female-adapter-with-audio': [accImg119, img_hdmi_male_to_vga_female_adapter_with_audio_v2, img_hdmi_male_to_vga_female_adapter_with_audio_v3],
  'compact-hdmi-female-to-vga-male-adapter-converter': [accImg120, accImg197, img_compact_hdmi_female_to_vga_male_adapter_converter_v2, img_compact_hdmi_female_to_vga_male_adapter_converter_v3],
  'usb-3-0-to-hdmi-1080p-display-adapter': [accImg144, img_usb_3_0_to_hdmi_1080p_display_adapter_v2, img_usb_3_0_to_hdmi_1080p_display_adapter_v3],
  'hdmi-female-to-female-coupler-extender': [accImg145, img_hdmi_female_to_female_coupler_extender_v2, img_hdmi_female_to_female_coupler_extender_v3],
  'vga-1-male-to-2-female-y-splitter-cable': [accImg146, img_vga_1_male_to_2_female_y_splitter_cable_v2, img_vga_1_male_to_2_female_y_splitter_cable_v3],
  'rca-3-male-to-3-female-av-extension-cable': [accImg147, img_rca_3_male_to_3_female_av_extension_cable_v2, img_rca_3_male_to_3_female_av_extension_cable_v3],
  'mini-vga-to-hdmi-1080p-video-converter-box': [accImg150, img_mini_vga_to_hdmi_1080p_video_converter_box_v2, img_mini_vga_to_hdmi_1080p_video_converter_box_v3],
  'mini-hdmi-to-av-rca-video-converter-box': [accImg151, img_mini_hdmi_to_av_rca_video_converter_box_v2, img_mini_hdmi_to_av_rca_video_converter_box_v3],
  'mini-av-rca-to-vga-video-converter-box': [accImg152, img_mini_av_rca_to_vga_video_converter_box_v2, img_mini_av_rca_to_vga_video_converter_box_v3],
  'mini-av-rca-to-hdmi-1080p-scaler-converter-box': [accImg153, img_mini_av_rca_to_hdmi_1080p_scaler_converter_box_v2, img_mini_av_rca_to_hdmi_1080p_scaler_converter_box_v3],
  'hdmi-1-male-to-2-female-dual-splitter-cable': [accImg154, img_hdmi_1_male_to_2_female_dual_splitter_cable_v2],
  'usb-type-c-3-in-1-multiport-adapter-silver': [accImg194, img_usb_type_c_3_in_1_multiport_adapter_silver_v2, img_usb_type_c_3_in_1_multiport_adapter_silver_v3],
  'fentico-displayport-male-to-vga-female-adapter': [accImg195, img_fentico_displayport_male_to_vga_female_adapter_v2, img_fentico_displayport_male_to_vga_female_adapter_v3],
  'usb-type-c-to-hdmi-4k-display-adapter-silver': [accImg196, img_usb_type_c_to_hdmi_4k_display_adapter_silver_v2],
  'displayport-male-to-hdmi-female-adapter-cable': [accImg198, img_displayport_male_to_hdmi_female_adapter_cable_v2],
  'usb-2-0-hdmi-1080p-video-capture-card-dongle': [accImg222, img_usb_2_0_hdmi_1080p_video_capture_card_dongle_v2, img_usb_2_0_hdmi_1080p_video_capture_card_dongle_v3],
  'usb-2-0-4-port-hub-with-switches': [accImg223, img_usb_2_0_4_port_hub_with_switches_v2, img_usb_2_0_4_port_hub_with_switches_v3],
  'sata-2-5-inch-hdd-ssd-enclosure-black': [accImg224, accImg225, accImg226, accImg227, img_sata_2_5_inch_hdd_ssd_enclosure_black_v2, img_sata_2_5_inch_hdd_ssd_enclosure_black_v3],
  'transparent-2-5-inch-sata-usb-3-0-enclosure': [accImg228, img_transparent_2_5_inch_sata_usb_3_0_enclosure_v2, img_transparent_2_5_inch_sata_usb_3_0_enclosure_v3],
  'cr2032-3v-lithium-coin-cell-batteries-pack': [accImg235, img_cr2032_3v_lithium_coin_cell_batteries_pack_v2, img_cr2032_3v_lithium_coin_cell_batteries_pack_v3],
  'compact-4-port-usb-hub-block-expander': [accImg236],
  'usb-to-rs232-db9-serial-adapter-cable': [accImg238, img_usb_to_rs232_db9_serial_adapter_cable_v2, img_usb_to_rs232_db9_serial_adapter_cable_v3],
  'ranz-3-in-1-screen-cleaning-kit': [accImg241, img_ranz_3_in_1_screen_cleaning_kit_v2, img_ranz_3_in_1_screen_cleaning_kit_v3],
  'super-clean-high-tech-cleaning-gel-pouch': [accImg245, img_super_clean_high_tech_cleaning_gel_pouch_v2, img_super_clean_high_tech_cleaning_gel_pouch_v3],
  'kizma-3-in-1-super-cleaning-kit': [accImg246, img_kizma_3_in_1_super_cleaning_kit_v3],
  'passive-hdcvi-tvi-ahd-cctv-video-balun-pair': [accImg252, img_passive_hdcvi_tvi_ahd_cctv_video_balun_pair_v2, img_passive_hdcvi_tvi_ahd_cctv_video_balun_pair_v3],
  'wireless-n-950m-mini-usb-wifi-adapter': [accImg253, img_wireless_n_950m_mini_usb_wifi_adapter_v2, img_wireless_n_950m_mini_usb_wifi_adapter_v3],
  'microfiber-cleaning-cloths-multi-color-pack': [accImg254, img_microfiber_cleaning_cloths_multi_color_pack_v3],
  'bluetooth-5-0-usb-nano-dongle-adapter': [accImg255, img_bluetooth_5_0_usb_nano_dongle_adapter_v2, img_bluetooth_5_0_usb_nano_dongle_adapter_v3],
  'cctv-bnc-male-pigtail-coaxial-cables-10pack': [accImg259, img_cctv_bnc_male_pigtail_coaxial_cables_10pack_v2, img_cctv_bnc_male_pigtail_coaxial_cables_10pack_v3],
  'intel-stock-lga115x-cpu-cooler-fan': [accImg260, img_intel_stock_lga115x_cpu_cooler_fan_v2, img_intel_stock_lga115x_cpu_cooler_fan_v3],
  'dt830d-digital-multimeter-with-probes': [accImg261, img_dt830d_digital_multimeter_with_probes_v2, img_dt830d_digital_multimeter_with_probes_v3],
  'cctv-12v-dc-male-power-pigtail-connectors-10pack': [accImg262, img_cctv_12v_dc_male_power_pigtail_connectors_10pack_v2, img_cctv_12v_dc_male_power_pigtail_connectors_10pack_v3],
  'thermaltake-cpu-cooler-fan-lga775-115x': [accImg263, img_thermaltake_cpu_cooler_fan_lga775_115x_v2, img_thermaltake_cpu_cooler_fan_lga775_115x_v3],
  'rj45-rj11-network-cable-crimping-tool-with-stripper': [accImg266, img_rj45_rj11_network_cable_crimping_tool_with_stripper_v2, img_rj45_rj11_network_cable_crimping_tool_with_stripper_v3],
  'universal-sata-2nd-hdd-caddy': [accImg267, accImg303],
  'dc-power-adapter-9v-1a-barrel-jack': [accImg306, img_dc_power_adapter_9v_1a_barrel_jack_v2, img_dc_power_adapter_9v_1a_barrel_jack_v3],
  'dc-power-adapter-12v-2a-barrel-jack': [accImg307, img_dc_power_adapter_12v_2a_barrel_jack_v2, img_dc_power_adapter_12v_2a_barrel_jack_v3],
  'extended-gaming-mouse-pad-desk-mat': [accImg314, img_extended_gaming_mouse_pad_desk_mat_v2, img_extended_gaming_mouse_pad_desk_mat_v3],
  'scenic-nature-printed-optical-mousepad': [accImg315, img_scenic_nature_printed_optical_mousepad_v2, img_scenic_nature_printed_optical_mousepad_v3],
  'logitech-retro-logo-gaming-mousepad': [accImg316, img_logitech_retro_logo_gaming_mousepad_v2, img_logitech_retro_logo_gaming_mousepad_v3],
  'micro-wolf-hunter-l-16-gaming-mouse-pad': [accImg317, img_micro_wolf_hunter_l_16_gaming_mouse_pad_v2, img_micro_wolf_hunter_l_16_gaming_mouse_pad_v3],
  'adnet-ad-mp-02-gaming-mouse-pad': [accImg318, img_adnet_ad_mp_02_gaming_mouse_pad_v2, img_adnet_ad_mp_02_gaming_mouse_pad_v3],
  'terabyte-kubix-e-02b-multimedia-speakers': [accImg321, img_terabyte_kubix_e_02b_multimedia_speakers_v2, img_terabyte_kubix_e_02b_multimedia_speakers_v3],
  'terabyte-eliptic-tb-015-multimedia-speakers': [accImg322, img_terabyte_eliptic_tb_015_multimedia_speakers_v2, img_terabyte_eliptic_tb_015_multimedia_speakers_v3],
  'terabyte-clarion-tb-008-mini-digital-speakers': [accImg323, img_terabyte_clarion_tb_008_mini_digital_speakers_v3],
  'adnet-ad-201-optical-wired-mouse': [accImg324, img_adnet_ad_201_optical_wired_mouse_v3],
  'adjustable-ergonomic-aluminum-laptop-stand': [accImg327, img_adjustable_ergonomic_aluminum_laptop_stand_v2, img_adjustable_ergonomic_aluminum_laptop_stand_v3],
  'laptop-cooling-pad-with-blue-led-fan': [accImg329, img_laptop_cooling_pad_with_blue_led_fan_v2],
  'cctv-4-channel-12v-1a-smps-power-supply': [accImg330],
  'crotomax-wall-mount-dvr-rack-cabinet': [accImg333, accImg334, img_crotomax_wall_mount_dvr_rack_cabinet_v2],
  'hawk-vision-stainless-steel-electronic-door-lock': [accImg335, img_hawk_vision_stainless_steel_electronic_door_lock_v2, img_hawk_vision_stainless_steel_electronic_door_lock_v3],
  'dvi-d-to-hdmi-bi-directional-video-adapter': [accImg371, img_dvi_d_to_hdmi_bi_directional_video_adapter_v2, img_dvi_d_to_hdmi_bi_directional_video_adapter_v3],
  'swivel-tilt-monitor-tv-wall-mount-bracket': [accImg407, img_swivel_tilt_monitor_tv_wall_mount_bracket_v3],
  'compact-fixed-tv-wall-mount-bracket-14-42': [accImg416, img_compact_fixed_tv_wall_mount_bracket_14_42_v2, img_compact_fixed_tv_wall_mount_bracket_14_42_v3],
  'heavy-duty-fixed-tv-wall-mount-bracket': [accImg417, img_heavy_duty_fixed_tv_wall_mount_bracket_v2, img_heavy_duty_fixed_tv_wall_mount_bracket_v3],
  'dlink-cat6-rj45-modular-connectors-box': [accImg420, img_dlink_cat6_rj45_modular_connectors_box_v3],
  'flipkart-smartbuy-electric-fan-room-heater': [accImg421, img_flipkart_smartbuy_electric_fan_room_heater_v3],
  'flexible-usb-led-portable-reading-lamp-2pack': [accImg443, img_flexible_usb_led_portable_reading_lamp_2pack_v2],
  'water-resistant-laptop-backpack-15-6-inch-grey': [accImg446],
  'commercial-mechanical-keyboards-mice': [accDellKm3322wCombo],
  'certified-hdmi-displayport-cat6-patch-cables': [accHdmiBraided4k, accHdmiStandardGold],
};

/**
 * Human-readable captions for every product image view.
 * Ensures accessibility and informs customers about specific angles and ports.
 */
export const PRODUCT_IMAGE_CAPTIONS = {
  'dell-latitude-business-laptop': [
    'Dell Latitude Business Laptop — Exact Model Store Photograph',
    'Dell Latitude Business Laptop — Additional Hardware View (Left side I/O ports and optical drive bay)',
    'Dell Latitude Business Laptop — Additional Hardware View (Top lid protective commercial casing)'
  ],
  'lenovo-commercial-office-laptop': [
    'Lenovo Commercial Office Laptop — Exact Model Store Photograph',
    'Lenovo Commercial Office Laptop — Additional Hardware View (TrackPoint ergonomic keyboard and trackpad)',
    'Lenovo Commercial Office Laptop — Additional Hardware View (Dual exhaust vents and side connectivity ports)'
  ],
  'hp-elitebook-corporate-laptop': [
    'HP EliteBook Corporate Laptop — Exact Model Store Photograph',
    'HP EliteBook Corporate Laptop — Additional Hardware View (Precision glass trackpad and aluminum keyboard deck)',
    'HP EliteBook Corporate Laptop — Additional Hardware View (Slim metallic profile and Type-C/HDMI ports)'
  ],
  'asus-tuf-gaming-laptop': [
    'ASUS TUF High-Performance Gaming Laptop — Exact Model Store Photograph',
    'ASUS TUF High-Performance Gaming Laptop — Additional Hardware View (RGB illuminated gaming keyboard with WASD highlight)',
    'ASUS TUF High-Performance Gaming Laptop — Additional Hardware View (Dual cooling exhaust vents and rear port view)'
  ],
  'dell-inspiron-business-laptop': [
    'Dell Inspiron Sleek Business Laptop — Primary Product Overview',
    'Dell Inspiron Sleek Business Laptop — Additional Hardware View (Narrow border anti-glare display panel)',
    'Dell Inspiron Sleek Business Laptop — Additional Hardware View (Side USB 3.2 and HDMI display interfaces)'
  ],
  'hp-probook-commercial-laptop': [
    'HP ProBook Commercial Laptop — Primary Product Overview',
    'HP ProBook Commercial Laptop — Additional Hardware View (Durable commercial chassis and spill-resistant keyboard)',
    'HP ProBook Commercial Laptop — Additional Hardware View (Side I/O ports with Gigabit Ethernet and USB-C)'
  ],
  'acer-performance-laptop': [
    'Acer High-Performance Laptop — Primary Product Overview',
    'Acer High-Performance Laptop — Additional Hardware View (Open clamshell and full keyboard view)',
    'Acer High-Performance Laptop — Additional Hardware View (Side ports and brushed aluminum lid view)'
  ],
  'ultra-slim-metallic-notebook': [
    'Ultra-Slim Metallic Notebook — Primary Product Overview',
    'Ultra-Slim Metallic Notebook — Illustrative Hardware View (Ultra-thin profile showing dual Thunderbolt/USB-C ports)',
    'Ultra-Slim Metallic Notebook — Illustrative Hardware View (Beveled unibody aluminum chassis and bottom intake)'
  ],
  'hp-pavilion-silver-slim-laptop': [
    'HP Pavilion Silver Slim Laptop — Primary Product Overview',
    'HP Pavilion Silver Slim Laptop — Additional Hardware View (Precision diamond-cut touchpad and stereo speakers)',
    'HP Pavilion Silver Slim Laptop — Additional Hardware View (Natural silver top casing with reflective HP emblem)'
  ],
  'custom-gaming-studio-workstation-setup': [
    'Custom Gaming Studio Workstation Setup — Primary Product Overview',
    'Custom Gaming Studio Workstation Setup — Illustrative Hardware View (Tempered glass RGB gaming chassis interior)',
    'Custom Gaming Studio Workstation Setup — Illustrative Hardware View (Curved panoramic monitor workstation desk view)'
  ],
  'custom-liquid-cooled-gaming-rig': [
    'Custom Liquid-Cooled Gaming Desktop Rig — Primary Product Overview',
    'Custom Liquid-Cooled Gaming Desktop Rig — Illustrative Hardware View (Custom loop liquid cooling block and dual radiators)',
    'Custom Liquid-Cooled Gaming Desktop Rig — Illustrative Hardware View (Tempered glass interior and braided power cables)'
  ],
  'commercial-slim-all-in-one-pc': [
    'Commercial Slim All-in-One Desktop PC — Primary Product Overview',
    'Commercial Slim All-in-One Desktop PC — Illustrative Hardware View (Rear aluminum stand and integrated cable pass-through)',
    'Commercial Slim All-in-One Desktop PC — Illustrative Hardware View (Side USB ports and headset audio connection)'
  ],
  'enterprise-matte-all-in-one-pc': [
    'Enterprise Matte All-in-One Desktop Computer — Primary Product Overview',
    'Enterprise Matte All-in-One Desktop Computer — Illustrative Hardware View (Anti-glare matte commercial display and webcam privacy shutter)',
    'Enterprise Matte All-in-One Desktop Computer — Illustrative Hardware View (Ergonomic tilt/height adjustable stand base)'
  ],
  'dell-precision-cad-workstation-tower': [
    'Dell Precision CAD / 3D Workstation Tower — Primary Product Overview',
    'Dell Precision CAD / 3D Workstation Tower — Additional Hardware View (Dell Precision CAD / 3D Workstation Tower — Precision Interface & Connector Terminal Close-Up)'
  ],
  'lenovo-thinkcentre-desktop-tower': [
    'Lenovo ThinkCentre Commercial Desktop Tower — Primary Product Overview',
    'Lenovo ThinkCentre Commercial Desktop Tower — Additional Hardware View (Lenovo ThinkCentre Commercial Desktop Tower — Commercial Hardware Packaging & Installation View)'
  ],
  'dell-sff-compact-workstation': [
    'Dell Small Form Factor (SFF) Workstation PC — Primary Product Overview',
    'Dell Small Form Factor (SFF) Workstation PC — Additional Hardware View (Dell Small Form Factor (SFF) Workstation PC — Precision Interface & Connector Terminal Close-Up)',
    'Dell Small Form Factor (SFF) Workstation PC — Additional Hardware View (Dell Small Form Factor (SFF) Workstation PC — Commercial Hardware Packaging & Installation View)'
  ],
  'acer-veriton-commercial-tower': [
    'Acer Veriton Commercial Desktop Tower — Primary Product Overview',
    'Acer Veriton Commercial Desktop Tower — Additional Hardware View (Acer Veriton Commercial Desktop Tower — Precision Interface & Connector Terminal Close-Up)'
  ],
  'business-laptops-dell-hp-lenovo-asus': [
    'business laptops dell hp lenovo asus — Primary Product Overview'
  ],
  'custom-gaming-studio-desktops': [
    'custom gaming studio desktops — Primary Product Overview'
  ],
  'commercial-all-in-one-aio-pcs': [
    'commercial all in one aio pcs — Primary Product Overview'
  ],
  'workstation-towers-cad-3d': [
    'workstation towers cad 3d — Primary Product Overview'
  ],
  'hikvision-full-hd-dome-camera': [
    'Hikvision Full HD Dome Security Camera — Primary Product Overview',
    'Hikvision Full HD Dome Security Camera — Additional Hardware View (High-definition optical lens and infrared LED array)',
    'Hikvision Full HD Dome Security Camera — Additional Hardware View (Ceiling mounting bracket and weatherproof cable pigtail)'
  ],
  'cp-plus-full-hd-dome-camera': [
    'CP PLUS Full HD Dome Security Camera — Primary Product Overview',
    'CP PLUS Full HD Dome Security Camera — Additional Hardware View (3-Axis adjustable gimbal positioning mechanism)',
    'CP PLUS Full HD Dome Security Camera — Additional Hardware View (BNC video output and 12V DC power connector pigtail)'
  ],
  'smart-outdoor-wifi-bullet-camera': [
    'Smart Outdoor Wi-Fi Bullet Security Camera — Primary Product Overview',
    'Smart Outdoor Wi-Fi Bullet Security Camera — Illustrative Hardware View (Dual high-gain Wi-Fi antennas and weather sunshield)',
    'Smart Outdoor Wi-Fi Bullet Security Camera — Illustrative Hardware View (Waterproof RJ-45 gland and MicroSD card slot)'
  ],
  'hikvision-colorvu-4k-bullet-camera': [
    'Hikvision ColorVu 4K Full-Color Night Bullet Camera — Primary Product Overview',
    'Hikvision ColorVu 4K Full-Color Night Bullet Camera — Additional Hardware View (Large F1.0 super-aperture optical lens with warm light)',
    'Hikvision ColorVu 4K Full-Color Night Bullet Camera — Additional Hardware View (Heavy-duty commercial metal mounting base)'
  ],
  'multi-channel-cctv-dvr-nvr-recorder': [
    '4-Channel Standalone CCTV DVR Recorder (H.264 1080p Real-Time) — Front Panel & Channel LEDs',
    '8-Channel IP CCTV Security Kit Solution — 8-Channel NVR & 8-Port PoE Switch Overview (Pictured Package Quoted per Order)',
    '16-Channel CCTV Recorder Hub — Illustrative Image (Illustrative Reference — Not an Exact Product Photograph)'
  ],
  'cp-plus-360-ptz-smart-camera': [
    'CP PLUS 360° Pan-Tilt Smart Wi-Fi Camera — Primary Product Overview',
    'CP PLUS 360° Pan-Tilt Smart Wi-Fi Camera — Additional Hardware View (Two-way audio speaker and microphone pickup grille)',
    'CP PLUS 360° Pan-Tilt Smart Wi-Fi Camera — Additional Hardware View (Ceiling mount base and USB power connection)'
  ],
  'full-hd-dome-bullet-ip-cameras': [
    'full hd dome bullet ip cameras — Primary Product Overview'
  ],
  '4k-colorvu-starlight-cameras': [
    '4k colorvu starlight cameras — Primary Product Overview'
  ],
  'network-video-recorders-nvr-dvr': [
    '4-Channel Standalone CCTV DVR Recorder (H.264 1080p Real-Time) — Front Panel & Channel LEDs',
    '8-Channel IP CCTV Security Kit Solution — 8-Channel NVR & 8-Port PoE Switch Overview (Pictured Package Quoted per Order)',
    '16-Channel CCTV Recorder Hub — Illustrative Image (Illustrative Reference — Not an Exact Product Photograph)'
  ],
  'ptz-360-zoom-cameras': [
    'ptz 360 zoom cameras — Primary Product Overview'
  ],
  'epson-ecotank-ink-tank-printer': [
    'Epson EcoTank All-in-One Ink Tank Printer — Exact Model Store Photograph',
    'Epson EcoTank All-in-One Ink Tank Printer — Additional Hardware View (Integrated high-capacity front ink reservoirs with clear level window)',
    'Epson EcoTank All-in-One Ink Tank Printer — Additional Hardware View (Flatbed color scanner and rear paper feed tray)'
  ],
  'canon-pixma-ink-tank-printer': [
    'Canon PIXMA Continuous Ink Tank Multifunction Printer — Exact Model Store Photograph',
    'Canon PIXMA Continuous Ink Tank Multifunction Printer — Additional Hardware View (Refillable MegaTank ink bottle chambers and control buttons)',
    'Canon PIXMA Continuous Ink Tank Multifunction Printer — Additional Hardware View (Paper output tray extension and rear feed guide)'
  ],
  'canon-imageclass-mono-laser-printer': [
    'Canon imageCLASS Monochrome Laser Printer — Primary Product Overview',
    'Canon imageCLASS Monochrome Laser Printer — Additional Hardware View (Front toner cartridge door open showing cartridge drum bay)',
    'Canon imageCLASS Monochrome Laser Printer — Additional Hardware View (150-sheet paper cassette tray and fold-out delivery guide)'
  ],
  'brother-mono-laser-printer': [
    'Brother High-Speed Monochrome Laser Printer — Primary Product Overview',
    'Brother High-Speed Monochrome Laser Printer — Additional Hardware View (Front enclosed 250-sheet dust-free paper cassette drawer)',
    'Brother High-Speed Monochrome Laser Printer — Additional Hardware View (Rear automatic duplex unit and USB 2.0 interface)'
  ],
  'compact-desktop-mono-laser-printer': [
    'Compact Desktop Administrative Mono Laser Printer — Primary Product Overview',
    'Compact Desktop Administrative Mono Laser Printer — Illustrative Hardware View (Top paper exit tray and single-sheet priority bypass slot)',
    'Compact Desktop Administrative Mono Laser Printer — Illustrative Hardware View (Rear AC power inlet and USB host connection port)'
  ],
  'brother-color-mfp-copier-adf': [
    'Brother Multi-Function Color Laser Copier with ADF — Primary Product Overview',
    'Brother Multi-Function Color Laser Copier with ADF — Additional Hardware View (50-sheet Auto Document Feeder (ADF) and platen scanner glass)',
    'Brother Multi-Function Color Laser Copier with ADF — Additional Hardware View (Color LCD touchscreen and front USB direct print port)'
  ],
  'brother-commercial-color-copier': [
    'Brother Commercial Heavy-Duty Color Laser Copier — Primary Product Overview',
    'Brother Commercial Heavy-Duty Color Laser Copier — Additional Hardware View (High-speed dual-scan platen glass and multi-purpose tray)',
    'Brother Commercial Heavy-Duty Color Laser Copier — Additional Hardware View (High-yield 4-color toner cartridge bay and maintenance door)'
  ],
  'hp-color-laserjet-enterprise-mfp': [
    'HP Color LaserJet Enterprise Departmental MFP — Primary Product Overview',
    'HP Color LaserJet Enterprise Departmental MFP — Additional Hardware View (Adjustable commercial touchscreen control panel and hardware pocket)',
    'HP Color LaserJet Enterprise Departmental MFP — Additional Hardware View (Dual 550-sheet paper feeder drawers and Gigabit network port)'
  ],
  'barcode-thermal-receipt-printers': [
    'Thermal POS Receipt & Barcode Label Printer — Primary Product Overview',
    'Thermal POS Receipt & Barcode Label Printer — Illustrative Hardware View (Clamshell top lid open showing 80mm thermal paper roll well)',
    'Thermal POS Receipt & Barcode Label Printer — Illustrative Hardware View (barcode thermal receipt printers — Commercial Hardware Deployment & Installation Profile)'
  ],
  'continuous-ink-tank-multifunction-printers': [
    'continuous ink tank multifunction printers — Primary Product Overview'
  ],
  'high-speed-monochrome-laser-printers': [
    'high speed monochrome laser printers — Primary Product Overview'
  ],
  'color-laser-multi-function-copiers': [
    'color laser multi function copiers — Primary Product Overview'
  ],
  'hikvision-minmoe-face-terminal': [
    'Hikvision MinMoe AI Face Recognition Terminal — Exact Model Store Photograph',
    'Hikvision MinMoe AI Face Recognition Terminal — Additional Hardware View (Capacitive touchscreen with dual IR anti-spoofing cameras)',
    'Hikvision MinMoe AI Face Recognition Terminal — Additional Hardware View (Rear metal wall-mount backplate with Wiegand and relay terminals)'
  ],
  'hikvision-wall-mount-face-terminal': [
    'Hikvision Wall-Mount AI Face & Attendance Terminal — Primary Product Overview',
    'Hikvision Wall-Mount AI Face & Attendance Terminal — Additional Hardware View (High-definition IPS display and live face recognition sensor)',
    'Hikvision Wall-Mount AI Face & Attendance Terminal — Additional Hardware View (Wall bracket screw mounting slots and tamper detection switch)'
  ],
  'mantra-optical-fingerprint-scanner': [
    'Mantra Optical Fingerprint Attendance Scanner — Exact Model Store Photograph',
    'Mantra Optical Fingerprint Attendance Scanner — Additional Hardware View (Scratch-free optical prism glass sensing surface)',
    'Mantra Optical Fingerprint Attendance Scanner — Additional Hardware View (Weighted commercial desktop metal base and shielded USB cable)'
  ],
  'essl-rfid-card-keypad-terminal': [
    'eSSL RFID Card & Keypad Attendance Terminal — Primary Product Overview',
    'eSSL RFID Card & Keypad Attendance Terminal — Additional Hardware View (Optical fingerprint sensor, 16-key keypad and color TFT screen)',
    'eSSL RFID Card & Keypad Attendance Terminal — Additional Hardware View (Rear backplate with TCP/IP Ethernet port and 12V DC socket)'
  ],
  'cp-plus-rfid-attendance-device': [
    'CP PLUS Biometric RFID Card Attendance Device — Primary Product Overview',
    'CP PLUS Biometric RFID Card Attendance Device — Additional Hardware View (RFID proximity card tap zone and voice prompt speaker)',
    'CP PLUS Biometric RFID Card Attendance Device — Additional Hardware View (Access control terminal block for electromagnetic lock connection)'
  ],
  'electromagnetic-door-access-controllers': [
    'Electromagnetic Door Lock & Access Controller System — Primary Product Overview',
    'Electromagnetic Door Lock & Access Controller System — Illustrative Hardware View (Zinc-plated steel armature plate and anti-residual magnetism pin)',
    'Electromagnetic Door Lock & Access Controller System — Illustrative Hardware View (ZL mounting bracket kit and manual emergency exit push switch)'
  ],
  'ai-face-recognition-attendance-system': [
    'ai face recognition attendance system — Primary Product Overview'
  ],
  'optical-fingerprint-attendance-terminal': [
    'optical fingerprint attendance terminal — Primary Product Overview'
  ],
  'rfid-proximity-card-punching-devices': [
    'rfid proximity card punching devices — Primary Product Overview'
  ],
  'samsung-870-evo-sata-ssd': [
    'Samsung 870 EVO 2.5-Inch SATA Solid-State Drive — Primary Product Overview'
  ],
  'seagate-barracuda-3-5-inch-hdd': [
    'Seagate BarraCuda 3.5-Inch Internal Hard Drive — Primary Product Overview',
    'Seagate BarraCuda 3.5-Inch Internal Hard Drive — Precision Connector & Interface Detail'
  ],
  'corsair-vengeance-lpx-ddr4-ram': [
    'Corsair Vengeance LPX High-Performance DDR4 RAM — Primary Product Overview'
  ],
  'kingston-desktop-ddr-ram-module': [
    'Kingston Desktop DDR Memory Module — Primary Product Overview',
    'Kingston Desktop DDR Memory Module — Additional Hardware View (Kingston Desktop DDR Memory Module — Precision Interface & Connector Terminal Close-Up)'
  ],
  'high-speed-nvme-m2-ssds-external-drives': [
    'High-Speed NVMe PCIe Gen4 M.2 SSDs — Primary Product Overview',
    'High-Speed NVMe PCIe Gen4 M.2 SSDs — Illustrative Hardware View (High-Speed NVMe PCIe Gen4 M.2 SSDs — Precision Interface & Connector Terminal Close-Up)',
    'High-Speed NVMe PCIe Gen4 M.2 SSDs — Illustrative Hardware View (High-Speed NVMe PCIe Gen4 M.2 SSDs — Commercial Hardware Packaging & Installation View)'
  ],
  'high-performance-thermal-paste-compound': [
    'High-Performance Thermal Interface Compound Paste — Primary Product Overview',
    'High-Performance Thermal Interface Compound Paste — Illustrative Hardware View (High-Performance Thermal Interface Compound Paste — Precision Interface & Connector Terminal Close-Up)',
    'High-Performance Thermal Interface Compound Paste — Illustrative Hardware View (High-Performance Thermal Interface Compound Paste — Commercial Hardware Packaging & Installation View)'
  ],
  'cooler-master-rgb-cpu-cooler': [
    'Cooler Master RGB Air Cooler for Desktop CPU — Primary Product Overview',
    'Cooler Master RGB Air Cooler for Desktop CPU — Additional Hardware View (Cooler Master RGB Air Cooler for Desktop CPU — Precision Interface & Connector Terminal Close-Up)',
    'Cooler Master RGB Air Cooler for Desktop CPU — Additional Hardware View (Cooler Master RGB Air Cooler for Desktop CPU — Commercial Hardware Packaging & Installation View)'
  ],
  'corsair-modular-atx-smps-power-supply': [
    'Corsair High-Efficiency Modular ATX Power Supply (SMPS) — Primary Product Overview',
    'Corsair High-Efficiency Modular ATX Power Supply (SMPS) — Additional Hardware View (Corsair High-Efficiency Modular ATX Power Supply (SMPS) — Precision Interface & Connector Terminal Close-Up)',
    'Corsair High-Efficiency Modular ATX Power Supply (SMPS) — Additional Hardware View (Corsair High-Efficiency Modular ATX Power Supply (SMPS) — Commercial Hardware Packaging & Installation View)'
  ],
  'nvidia-geforce-dedicated-graphics-card': [
    'NVIDIA GeForce Dedicated Graphics Card — Primary Product Overview'
  ],
  'asus-desktop-motherboard': [
    'ASUS Commercial / Gaming Desktop Motherboard — Primary Product Overview',
    'ASUS Commercial / Gaming Desktop Motherboard — Additional Hardware View (ASUS Commercial / Gaming Desktop Motherboard — Precision Interface & Connector Terminal Close-Up)'
  ],
  'multi-channel-cctv-smps-power-supply': [
    'Multi-Channel Regulated CCTV Power Supply Unit (SMPS) — Primary Product Overview'
  ],
  'dual-band-wifi-6-routers-poe-gigabit-switches': [
    'Dual-Band Wi-Fi 6 Routers & PoE Gigabit Switches — Primary Product Overview',
    'Dual-Band Wi-Fi 6 Routers & PoE Gigabit Switches — Illustrative Hardware View (Dual-Band Wi-Fi 6 Routers & PoE Gigabit Switches — Precision Interface & Connector Terminal Close-Up)',
    'Dual-Band Wi-Fi 6 Routers & PoE Gigabit Switches — Illustrative Hardware View (Dual-Band Wi-Fi 6 Routers & PoE Gigabit Switches — Commercial Hardware Packaging & Installation View)'
  ],
  'dell-km3322w-wireless-combo': [
    'Dell KM3322W Wireless Keyboard & Mouse Combo — Primary Product Overview',
    'Dell KM3322W Wireless Keyboard & Mouse Combo — Additional Hardware View (Dell KM3322W Wireless Keyboard & Mouse Combo — Precision Interface & Connector Terminal Close-Up)',
    'Dell KM3322W Wireless Keyboard & Mouse Combo — Additional Hardware View (Dell KM3322W Wireless Keyboard & Mouse Combo — Commercial Hardware Packaging & Installation View)'
  ],
  'wireless-office-keyboard-mouse-combo': [
    'Full-Size Wireless Office Keyboard & Mouse Combo — Primary Product Overview',
    'Full-Size Wireless Office Keyboard & Mouse Combo — Illustrative Hardware View (Full-Size Wireless Office Keyboard & Mouse Combo — Precision Interface & Connector Terminal Close-Up)',
    'Full-Size Wireless Office Keyboard & Mouse Combo — Illustrative Hardware View (Full-Size Wireless Office Keyboard & Mouse Combo — Commercial Hardware Packaging & Installation View)'
  ],
  'hp-mechanical-rgb-keyboard': [
    'HP Mechanical Gaming Keyboard with Illuminated Keys — Primary Product Overview',
    'HP Mechanical Gaming Keyboard with Illuminated Keys — Additional Hardware View (HP Mechanical Gaming Keyboard with Illuminated Keys — Precision Interface & Connector Terminal Close-Up)',
    'HP Mechanical Gaming Keyboard with Illuminated Keys — Additional Hardware View (HP Mechanical Gaming Keyboard with Illuminated Keys — Commercial Hardware Packaging & Installation View)'
  ],
  'asus-desktop-keyboard-mouse-set': [
    'Asus Commercial Desktop Keyboard & Mouse Set — Primary Product Overview',
    'Asus Commercial Desktop Keyboard & Mouse Set — Additional Hardware View (Asus Commercial Desktop Keyboard & Mouse Set — Precision Interface & Connector Terminal Close-Up)',
    'Asus Commercial Desktop Keyboard & Mouse Set — Additional Hardware View (Asus Commercial Desktop Keyboard & Mouse Set — Commercial Hardware Packaging & Installation View)'
  ],
  'hp-230-wireless-keyboard-combo': [
    'HP 230 Slim Wireless Keyboard & Mouse Combo — Primary Product Overview',
    'HP 230 Slim Wireless Keyboard & Mouse Combo — Additional Hardware View (HP 230 Slim Wireless Keyboard & Mouse Combo — Precision Interface & Connector Terminal Close-Up)',
    'HP 230 Slim Wireless Keyboard & Mouse Combo — Additional Hardware View (HP 230 Slim Wireless Keyboard & Mouse Combo — Commercial Hardware Packaging & Installation View)'
  ],
  'lenovo-300-wireless-keyboard-combo': [
    'Lenovo 300 Wireless Keyboard & Mouse Combo — Primary Product Overview'
  ],
  'ergonomic-full-size-wireless-combo': [
    'Ergonomic Full-Size Wireless Keyboard & Mouse Set — Primary Product Overview',
    'Ergonomic Full-Size Wireless Keyboard & Mouse Set — Illustrative Hardware View (ergonomic full size wireless combo — Commercial Hardware Deployment & Installation Profile)'
  ],
  'logitech-mx-keys-mini-keyboard': [
    'Logitech MX Keys Mini Compact Wireless Keyboard — Primary Product Overview',
    'Logitech MX Keys Mini Compact Wireless Keyboard — Additional Hardware View (Logitech MX Keys Mini Compact Wireless Keyboard — Precision Interface & Connector Terminal Close-Up)',
    'Logitech MX Keys Mini Compact Wireless Keyboard — Additional Hardware View (Logitech MX Keys Mini Compact Wireless Keyboard — Commercial Hardware Packaging & Installation View)'
  ],
  'logitech-wireless-multimedia-keyboard': [
    'Logitech Full-Size Wireless Multimedia Keyboard — Primary Product Overview',
    'Logitech Full-Size Wireless Multimedia Keyboard — Additional Hardware View (Logitech Full-Size Wireless Multimedia Keyboard — Precision Interface & Connector Terminal Close-Up)',
    'Logitech Full-Size Wireless Multimedia Keyboard — Additional Hardware View (Logitech Full-Size Wireless Multimedia Keyboard — Commercial Hardware Packaging & Installation View)'
  ],
  'dell-kb216-wired-multimedia-keyboard': [
    'Dell KB216 Multimedia Wired Office Keyboard — Primary Product Overview',
    'Dell KB216 Multimedia Wired Office Keyboard — Additional Hardware View (Dell KB216 Multimedia Wired Office Keyboard — Precision Interface & Connector Terminal Close-Up)',
    'Dell KB216 Multimedia Wired Office Keyboard — Additional Hardware View (Dell KB216 Multimedia Wired Office Keyboard — Commercial Hardware Packaging & Installation View)'
  ],
  'slim-chiclet-low-profile-keyboard': [
    'Slim Chiclet Low-Profile Desktop Keyboard — Primary Product Overview',
    'Slim Chiclet Low-Profile Desktop Keyboard — Illustrative Hardware View (Slim Chiclet Low-Profile Desktop Keyboard — Precision Interface & Connector Terminal Close-Up)',
    'Slim Chiclet Low-Profile Desktop Keyboard — Illustrative Hardware View (Slim Chiclet Low-Profile Desktop Keyboard — Commercial Hardware Packaging & Installation View)'
  ],
  'standard-office-wired-keyboard': [
    'Standard Office Wired Commercial Keyboard — Primary Product Overview',
    'Standard Office Wired Commercial Keyboard — Illustrative Hardware View (Standard Office Wired Commercial Keyboard — Precision Interface & Connector Terminal Close-Up)',
    'Standard Office Wired Commercial Keyboard — Illustrative Hardware View (Standard Office Wired Commercial Keyboard — Commercial Hardware Packaging & Installation View)'
  ],
  'hp-gaming-optical-mouse': [
    'HP Gaming Optical Mouse with Ergonomic Grip — Primary Product Overview',
    'HP Gaming Optical Mouse with Ergonomic Grip — Additional Hardware View (HP Gaming Optical Mouse with Ergonomic Grip — Precision Interface & Connector Terminal Close-Up)',
    'HP Gaming Optical Mouse with Ergonomic Grip — Additional Hardware View (HP Gaming Optical Mouse with Ergonomic Grip — Commercial Hardware Packaging & Installation View)'
  ],
  'dell-ms116-usb-optical-mouse': [
    'Dell MS116 USB Wired Optical Mouse — Primary Product Overview',
    'Dell MS116 USB Wired Optical Mouse — Additional Hardware View (Dell MS116 USB Wired Optical Mouse — Precision Interface & Connector Terminal Close-Up)',
    'Dell MS116 USB Wired Optical Mouse — Additional Hardware View (Dell MS116 USB Wired Optical Mouse — Commercial Hardware Packaging & Installation View)'
  ],
  'dell-wm126-wireless-optical-mouse': [
    'Dell WM126 Wireless Optical Mouse — Primary Product Overview',
    'Dell WM126 Wireless Optical Mouse — Additional Hardware View (Dell WM126 Wireless Optical Mouse — Precision Interface & Connector Terminal Close-Up)',
    'Dell WM126 Wireless Optical Mouse — Additional Hardware View (Dell WM126 Wireless Optical Mouse — Commercial Hardware Packaging & Installation View)'
  ],
  'lenovo-wireless-ergonomic-mouse': [
    'Lenovo Wireless Ergonomic Optical Mouse — Primary Product Overview',
    'Lenovo Wireless Ergonomic Optical Mouse — Additional Hardware View (Lenovo Wireless Ergonomic Optical Mouse — Precision Interface & Connector Terminal Close-Up)',
    'Lenovo Wireless Ergonomic Optical Mouse — Additional Hardware View (Lenovo Wireless Ergonomic Optical Mouse — Commercial Hardware Packaging & Installation View)'
  ],
  'zebronics-optical-wired-mouse': [
    'Zebronics High-Precision Optical Wired Mouse — Primary Product Overview',
    'Zebronics High-Precision Optical Wired Mouse — Additional Hardware View (Zebronics High-Precision Optical Wired Mouse — Precision Interface & Connector Terminal Close-Up)',
    'Zebronics High-Precision Optical Wired Mouse — Additional Hardware View (Zebronics High-Precision Optical Wired Mouse — Commercial Hardware Packaging & Installation View)'
  ],
  'compact-portable-wireless-mouse': [
    'Compact Portable Wireless Optical Mouse — Primary Product Overview',
    'Compact Portable Wireless Optical Mouse — Illustrative Hardware View (Compact Portable Wireless Optical Mouse — Precision Interface & Connector Terminal Close-Up)',
    'Compact Portable Wireless Optical Mouse — Illustrative Hardware View (Compact Portable Wireless Optical Mouse — Commercial Hardware Packaging & Installation View)'
  ],
  'ergonomic-commercial-wired-mouse': [
    'Ergonomic Commercial Wired Optical Mouse — Primary Product Overview',
    'Ergonomic Commercial Wired Optical Mouse — Illustrative Hardware View (Ergonomic Commercial Wired Optical Mouse — Precision Interface & Connector Terminal Close-Up)',
    'Ergonomic Commercial Wired Optical Mouse — Illustrative Hardware View (Ergonomic Commercial Wired Optical Mouse — Commercial Hardware Packaging & Installation View)'
  ],
  'braided-4k-high-speed-hdmi-cable': [
    'Braided 4K Ultra HD High-Speed HDMI Cable — Primary Product Overview',
    'Braided 4K Ultra HD High-Speed HDMI Cable — Precision Connector & Interface Detail',
    'Braided 4K Ultra HD High-Speed HDMI Cable — Illustrative Hardware View (Braided 4K Ultra HD High-Speed HDMI Cable — Precision Interface & Connector Terminal Close-Up)',
    'Braided 4K Ultra HD High-Speed HDMI Cable — Illustrative Hardware View (Braided 4K Ultra HD High-Speed HDMI Cable — Commercial Hardware Packaging & Installation View)'
  ],
  'displayport-1-4-monitor-cable': [
    'DisplayPort 1.4 High-Refresh Monitor Cable — Primary Product Overview',
    'DisplayPort 1.4 High-Refresh Monitor Cable — Illustrative Hardware View (DisplayPort 1.4 High-Refresh Monitor Cable — Precision Interface & Connector Terminal Close-Up)',
    'DisplayPort 1.4 High-Refresh Monitor Cable — Illustrative Hardware View (DisplayPort 1.4 High-Refresh Monitor Cable — Commercial Hardware Packaging & Installation View)'
  ],
  'cat6-gigabit-ethernet-patch-cord': [
    'Cat6 Molded Gigabit Ethernet RJ45 Patch Cord — Primary Product Overview',
    'Cat6 Molded Gigabit Ethernet RJ45 Patch Cord — Illustrative Hardware View (Cat6 Molded Gigabit Ethernet RJ45 Patch Cord — Precision Interface & Connector Terminal Close-Up)',
    'Cat6 Molded Gigabit Ethernet RJ45 Patch Cord — Illustrative Hardware View (Cat6 Molded Gigabit Ethernet RJ45 Patch Cord — Commercial Hardware Packaging & Installation View)'
  ],
  'sata-6gbps-internal-drive-cable': [
    'High-Speed SATA 6Gbps Internal Drive Cable — Primary Product Overview',
    'High-Speed SATA 6Gbps Internal Drive Cable — Illustrative Hardware View (High-Speed SATA 6Gbps Internal Drive Cable — Precision Interface & Connector Terminal Close-Up)',
    'High-Speed SATA 6Gbps Internal Drive Cable — Illustrative Hardware View (High-Speed SATA 6Gbps Internal Drive Cable — Commercial Hardware Packaging & Installation View)'
  ],
  'heavy-duty-15-pin-vga-cable': [
    'Heavy-Duty 15-Pin VGA Display Cable — Primary Product Overview',
    'Heavy-Duty 15-Pin VGA Display Cable — Illustrative Hardware View (Heavy-Duty 15-Pin VGA Display Cable — Precision Interface & Connector Terminal Close-Up)',
    'Heavy-Duty 15-Pin VGA Display Cable — Illustrative Hardware View (Heavy-Duty 15-Pin VGA Display Cable — Commercial Hardware Packaging & Installation View)'
  ],
  'usb-type-c-fast-charging-data-cable': [
    'USB Type-C Fast-Charging & Data Sync Cable — Primary Product Overview',
    'USB Type-C Fast-Charging & Data Sync Cable — Precision Connector & Interface Detail',
    'USB Type-C Fast-Charging & Data Sync Cable — Illustrative Hardware View (USB Type-C Fast-Charging & Data Sync Cable — Precision Interface & Connector Terminal Close-Up)',
    'USB Type-C Fast-Charging & Data Sync Cable — Illustrative Hardware View (USB Type-C Fast-Charging & Data Sync Cable — Commercial Hardware Packaging & Installation View)'
  ],
  'desktop-pc-monitor-3-pin-power-cord': [
    'Desktop PC & Monitor 3-Pin AC Power Cord — Primary Product Overview',
    'Desktop PC & Monitor 3-Pin AC Power Cord — Illustrative Hardware View (Desktop PC & Monitor 3-Pin AC Power Cord — Precision Interface & Connector Terminal Close-Up)',
    'Desktop PC & Monitor 3-Pin AC Power Cord — Illustrative Hardware View (Desktop PC & Monitor 3-Pin AC Power Cord — Commercial Hardware Packaging & Installation View)'
  ],
  'cctv-3-plus-1-coaxial-video-cable': [
    'CCTV 3+1 Shielded Coaxial Video Cable — Primary Product Overview',
    'CCTV 3+1 Shielded Coaxial Video Cable — Precision Connector & Interface Detail',
    'CCTV 3+1 Shielded Coaxial Video Cable — Illustrative Hardware View (CCTV 3+1 Shielded Coaxial Video Cable — Precision Interface & Connector Terminal Close-Up)',
    'CCTV 3+1 Shielded Coaxial Video Cable — Illustrative Hardware View (CCTV 3+1 Shielded Coaxial Video Cable — Commercial Hardware Packaging & Installation View)'
  ],
  '12v-dc-cctv-power-pigtail-connectors': [
    '12V DC CCTV Camera Power Pigtail Connectors — Primary Product Overview',
    '12V DC CCTV Camera Power Pigtail Connectors — Illustrative Hardware View (12V DC CCTV Camera Power Pigtail Connectors — Precision Interface & Connector Terminal Close-Up)',
    '12V DC CCTV Camera Power Pigtail Connectors — Illustrative Hardware View (12V DC CCTV Camera Power Pigtail Connectors — Commercial Hardware Packaging & Installation View)'
  ],
  'heavy-duty-bnc-compression-video-connectors': [
    'Heavy-Duty BNC Compression Video Connectors — Primary Product Overview',
    'Heavy-Duty BNC Compression Video Connectors — Illustrative Hardware View (Heavy-Duty BNC Compression Video Connectors — Precision Interface & Connector Terminal Close-Up)',
    'Heavy-Duty BNC Compression Video Connectors — Illustrative Hardware View (Heavy-Duty BNC Compression Video Connectors — Commercial Hardware Packaging & Installation View)'
  ],
  'hdmi-to-micro-hdmi-cable': [
    'HDMI to Micro-HDMI (Type-D) High-Speed Cable — Primary Product Overview',
    'HDMI to Micro-HDMI (Type-D) High-Speed Cable — Illustrative Hardware View (HDMI to Micro-HDMI (Type-D) High-Speed Cable — Precision Interface & Connector Terminal Close-Up)',
    'HDMI to Micro-HDMI (Type-D) High-Speed Cable — Illustrative Hardware View (HDMI to Micro-HDMI (Type-D) High-Speed Cable — Commercial Hardware Packaging & Installation View)'
  ],
  'standard-male-to-male-hdmi-cable': [
    'Standard High-Speed HDMI Male-to-Male Cable — Primary Product Overview',
    'Standard High-Speed HDMI Male-to-Male Cable — Precision Connector & Interface Detail',
    'Standard High-Speed HDMI Male-to-Male Cable — Commercial Deployment & Installation Profile',
    'Standard High-Speed HDMI Male-to-Male Cable — Hardware Component Detail & Ports View',
    'Standard High-Speed HDMI Male-to-Male Cable — Hardware Component Detail & Ports View',
    'Standard High-Speed HDMI Male-to-Male Cable — Illustrative Hardware View (Standard High-Speed HDMI Male-to-Male Cable — Precision Interface & Connector Terminal Close-Up)',
    'Standard High-Speed HDMI Male-to-Male Cable — Illustrative Hardware View (Standard High-Speed HDMI Male-to-Male Cable — Commercial Hardware Packaging & Installation View)'
  ],
  'terabyte-hd-2-0v-premium-hdmi-cable': [
    'Terabyte HD 2.0V Premium High-Speed HDTV Cable 4K — Primary Product Overview',
    'Terabyte HD 2.0V Premium High-Speed HDTV Cable 4K — Precision Connector & Interface Detail',
    'Terabyte HD 2.0V Premium High-Speed HDTV Cable 4K — Commercial Deployment & Installation Profile',
    'Terabyte HD 2.0V Premium High-Speed HDTV Cable 4K — Additional Hardware View (Terabyte HD 2.0V Premium High-Speed HDTV Cable 4K — Precision Interface & Connector Terminal Close-Up)',
    'Terabyte HD 2.0V Premium High-Speed HDTV Cable 4K — Additional Hardware View (Terabyte HD 2.0V Premium High-Speed HDTV Cable 4K — Commercial Hardware Packaging & Installation View)'
  ],
  'adnet-ad-001-laptop-power-cable': [
    'ADNet 3-Pin Laptop Power Cable (AD-001) — Primary Product Overview',
    'ADNet 3-Pin Laptop Power Cable (AD-001) — Precision Connector & Interface Detail',
    'ADNet 3-Pin Laptop Power Cable (AD-001) — Additional Hardware View (ADNet 3-Pin Laptop Power Cable (AD-001) — Precision Interface & Connector Terminal Close-Up)'
  ],
  'laptop-power-cable-c5-cloverleaf': [
    'Universal 3-Pin C5 Cloverleaf Laptop Adapter Power Cord — Primary Product Overview',
    'Universal 3-Pin C5 Cloverleaf Laptop Adapter Power Cord — Precision Connector & Interface Detail',
    'Universal 3-Pin C5 Cloverleaf Laptop Adapter Power Cord — Illustrative Hardware View (Universal 3-Pin C5 Cloverleaf Power Cord — Grounded Pin Terminals Close-Up)'
  ],
  'desktop-pc-monitor-iec-c13-power-cable': [
    'Heavy-Duty 3-Pin Desktop PC & Monitor Power Cable (IEC C13) — Primary Product Overview',
    'Heavy-Duty 3-Pin Desktop PC & Monitor Power Cable (IEC C13) — Precision Connector & Interface Detail',
    'Heavy-Duty 3-Pin Desktop PC & Monitor Power Cable (IEC C13) — Commercial Deployment & Installation Profile'
  ],
  'usb-2-0-type-a-male-to-female-extension-cable': [
    'USB 2.0 Type-A Male to Female Extension Cable (White) — Primary Product Overview',
    'USB 2.0 Type-A Male to Female Extension Cable (White) — Precision Connector & Interface Detail',
    'USB 2.0 Type-A Male to Female Extension Cable (White) — Commercial Deployment & Installation Profile',
    'USB 2.0 Type-A Male to Female Extension Cable (White) — Illustrative Hardware View (USB 2.0 Type-A Male to Female Extension Cable (White) — Precision Interface & Connector Terminal Close-Up)',
    'USB 2.0 Type-A Male to Female Extension Cable (White) — Illustrative Hardware View (USB 2.0 Type-A Male to Female Extension Cable (White) — Commercial Hardware Packaging & Installation View)'
  ],
  'usb-2-0-type-a-to-type-b-printer-cable': [
    'USB 2.0 Type-A to Type-B High-Speed Printer Cable — Primary Product Overview',
    'USB 2.0 Type-A to Type-B High-Speed Printer Cable — Precision Connector & Interface Detail',
    'USB 2.0 Type-A to Type-B High-Speed Printer Cable — Commercial Deployment & Installation Profile',
    'USB 2.0 Type-A to Type-B High-Speed Printer Cable — Illustrative Hardware View (USB 2.0 Type-A to Type-B High-Speed Printer Cable — Precision Interface & Connector Terminal Close-Up)'
  ],
  'usb-3-0-type-a-male-to-female-extension-cable': [
    'USB 3.0 SuperSpeed Type-A Male to Female Extension Cable — Primary Product Overview',
    'USB 3.0 SuperSpeed Type-A Male to Female Extension Cable — Illustrative Hardware View (USB 3.0 SuperSpeed Type-A Male to Female Extension Cable — Precision Interface & Connector Terminal Close-Up)',
    'USB 3.0 SuperSpeed Type-A Male to Female Extension Cable — Illustrative Hardware View (USB 3.0 SuperSpeed Type-A Male to Female Extension Cable — Commercial Hardware Packaging & Installation View)'
  ],
  'standard-15-pin-vga-monitor-cable-blue': [
    'Standard 15-Pin SVGA / VGA Male-to-Male Monitor Cable — Primary Product Overview',
    'Standard 15-Pin SVGA / VGA Male-to-Male Monitor Cable — Illustrative Hardware View (Standard 15-Pin SVGA / VGA Male-to-Male Monitor Cable — Precision Interface & Connector Terminal Close-Up)',
    'Standard 15-Pin SVGA / VGA Male-to-Male Monitor Cable — Illustrative Hardware View (Standard 15-Pin SVGA / VGA Male-to-Male Monitor Cable — Commercial Hardware Packaging & Installation View)'
  ],
  'shielded-white-vga-cable-dual-ferrite': [
    'Heavy-Duty Shielded VGA Monitor Cable with Dual Ferrite Cores (White) — Primary Product Overview',
    'Heavy-Duty Shielded VGA Monitor Cable with Dual Ferrite Cores (White) — Precision Connector & Interface Detail',
    'Heavy-Duty Shielded VGA Monitor Cable with Dual Ferrite Cores (White) — Illustrative Hardware View (Heavy-Duty Shielded VGA Monitor Cable with Dual Ferrite Cores (White) — Precision Interface & Connector Terminal Close-Up)',
    'Heavy-Duty Shielded VGA Monitor Cable with Dual Ferrite Cores (White) — Illustrative Hardware View (Heavy-Duty Shielded VGA Monitor Cable with Dual Ferrite Cores (White) — Commercial Hardware Packaging & Installation View)'
  ],
  'gold-plated-15-pin-vga-cable-black': [
    'Gold-Plated 15-Pin VGA Monitor Cable (Black) — Primary Product Overview',
    'Gold-Plated 15-Pin VGA Monitor Cable (Black) — Illustrative Hardware View (Gold-Plated 15-Pin VGA Monitor Cable (Black) — Precision Interface & Connector Terminal Close-Up)',
    'Gold-Plated 15-Pin VGA Monitor Cable (Black) — Illustrative Hardware View (Gold-Plated 15-Pin VGA Monitor Cable (Black) — Commercial Hardware Packaging & Installation View)'
  ],
  'dlink-cat6-utp-patch-cable-2m': [
    'D-Link CAT6 UTP Gigabit Network Patch Cable (2m) — Primary Product Overview',
    'D-Link CAT6 UTP Gigabit Network Patch Cable (2m) — Additional Hardware View (dlink cat6 utp patch cable 2m — Precision Interface & Connector Detail)',
    'D-Link CAT6 UTP Gigabit Network Patch Cable (2m) — Additional Hardware View (dlink cat6 utp patch cable 2m — Commercial Hardware Deployment & Installation Profile)'
  ],
  'cat6-rj45-gigabit-ethernet-patch-cable-grey': [
    'CAT6 RJ45 Gigabit Ethernet Patch Cable (Grey) — Primary Product Overview',
    'CAT6 RJ45 Gigabit Ethernet Patch Cable (Grey) — Precision Connector & Interface Detail',
    'CAT6 RJ45 Gigabit Ethernet Patch Cable (Grey) — Commercial Deployment & Installation Profile',
    'CAT6 RJ45 Gigabit Ethernet Patch Cable (Grey) — Hardware Component Detail & Ports View'
  ],
  'usb-to-internal-5pin-terminal-data-cable': [
    'USB Type-A to Internal 5-Pin Terminal / Barcode Scanner Cable — Primary Product Overview',
    'USB Type-A to Internal 5-Pin Terminal / Barcode Scanner Cable — Precision Connector & Interface Detail',
    'USB Type-A to Internal 5-Pin Terminal / Barcode Scanner Cable — Illustrative Hardware View (USB Type-A to Internal 5-Pin Terminal / Barcode Scanner Cable — Precision Interface & Connector Terminal Close-Up)',
    'USB Type-A to Internal 5-Pin Terminal / Barcode Scanner Cable — Illustrative Hardware View (USB Type-A to Internal 5-Pin Terminal / Barcode Scanner Cable — Commercial Hardware Packaging & Installation View)'
  ],
  'amazonbasics-hdmi-male-to-female-extension-cable': [
    'AmazonBasics High-Speed HDMI Extension Cable (Male to Female) — Primary Product Overview',
    'AmazonBasics High-Speed HDMI Extension Cable (Male to Female) — Additional Hardware View (AmazonBasics High-Speed HDMI Extension Cable (Male to Female) — Precision Interface & Connector Terminal Close-Up)',
    'AmazonBasics High-Speed HDMI Extension Cable (Male to Female) — Additional Hardware View (amazonbasics hdmi male to female extension cable — Commercial Hardware Deployment & Installation Profile)'
  ],
  'cat6-rj45-gigabit-network-cable-10m': [
    'cat6 rj45 gigabit network cable 10m — Primary Product Overview'
  ],
  'cctv-3-plus-1-coaxial-video-power-cable-roll': [
    'CCTV 3+1 Shielded Coaxial Video & Power Cable Roll (White) — Primary Product Overview',
    'CCTV 3+1 Shielded Coaxial Video & Power Cable Roll (White) — Illustrative Hardware View (cctv 3 plus 1 coaxial video power cable roll — Precision Interface & Connector Detail)',
    'CCTV 3+1 Shielded Coaxial Video & Power Cable Roll (White) — Illustrative Hardware View (cctv 3 plus 1 coaxial video power cable roll — Commercial Hardware Deployment & Installation Profile)'
  ],
  'hdmi-male-to-vga-female-adapter-with-audio': [
    'HDMI Male to VGA Female Converter Adapter with 3.5mm Audio — Primary Product Overview',
    'HDMI Male to VGA Female Converter Adapter with 3.5mm Audio — Illustrative Hardware View (hdmi male to vga female adapter with audio — Precision Interface & Connector Detail)',
    'HDMI Male to VGA Female Converter Adapter with 3.5mm Audio — Illustrative Hardware View (hdmi male to vga female adapter with audio — Commercial Hardware Deployment & Installation Profile)'
  ],
  'compact-hdmi-female-to-vga-male-adapter-converter': [
    'Compact HDMI Female to VGA Male Direct-Plug Adapter with Audio & Power — Primary Product Overview',
    'Compact HDMI Female to VGA Male Direct-Plug Adapter with Audio & Power — Precision Connector & Interface Detail',
    'Compact HDMI Female to VGA Male Direct-Plug Adapter with Audio & Power — Illustrative Hardware View (Compact HDMI Female to VGA Male Direct-Plug Adapter with Audio & Power — Precision Interface & Connector Terminal Close-Up)',
    'Compact HDMI Female to VGA Male Direct-Plug Adapter with Audio & Power — Illustrative Hardware View (Compact HDMI Female to VGA Male Direct-Plug Adapter with Audio & Power — Commercial Hardware Packaging & Installation View)'
  ],
  'usb-3-0-to-hdmi-1080p-display-adapter': [
    'USB 3.0 to HDMI 1080P External Graphic Card Video Adapter — Primary Product Overview',
    'USB 3.0 to HDMI 1080P External Graphic Card Video Adapter — Illustrative Hardware View (usb 3 0 to hdmi 1080p display adapter — Precision Interface & Connector Detail)',
    'USB 3.0 to HDMI 1080P External Graphic Card Video Adapter — Illustrative Hardware View (usb 3 0 to hdmi 1080p display adapter — Commercial Hardware Deployment & Installation Profile)'
  ],
  'hdmi-female-to-female-coupler-extender': [
    'HDMI Female to Female Coupler Gender Changer Extender Adapter — Primary Product Overview',
    'HDMI Female to Female Coupler Gender Changer Extender Adapter — Illustrative Hardware View (hdmi female to female coupler extender — Precision Interface & Connector Detail)',
    'HDMI Female to Female Coupler Gender Changer Extender Adapter — Illustrative Hardware View (hdmi female to female coupler extender — Commercial Hardware Deployment & Installation Profile)'
  ],
  'vga-1-male-to-2-female-y-splitter-cable': [
    'VGA 1 Male to 2 Female Dual Monitor Y-Splitter Video Cable — Primary Product Overview',
    'VGA 1 Male to 2 Female Dual Monitor Y-Splitter Video Cable — Illustrative Hardware View (VGA 1 Male to 2 Female Dual Monitor Y-Splitter Video Cable — Precision Interface & Connector Terminal Close-Up)',
    'VGA 1 Male to 2 Female Dual Monitor Y-Splitter Video Cable — Illustrative Hardware View (VGA 1 Male to 2 Female Dual Monitor Y-Splitter Video Cable — Commercial Hardware Packaging & Installation View)'
  ],
  'rca-3-male-to-3-female-av-extension-cable': [
    '3 RCA Male to 3 RCA Female Composite Audio/Video Extension Cable — Primary Product Overview',
    '3 RCA Male to 3 RCA Female Composite Audio/Video Extension Cable — Illustrative Hardware View (3 RCA Male to 3 RCA Female Composite Audio/Video Extension Cable — Precision Interface & Connector Terminal Close-Up)',
    '3 RCA Male to 3 RCA Female Composite Audio/Video Extension Cable — Illustrative Hardware View (3 RCA Male to 3 RCA Female Composite Audio/Video Extension Cable — Commercial Hardware Packaging & Installation View)'
  ],
  'mini-vga-to-hdmi-1080p-video-converter-box': [
    'Mini VGA to HDMI 1080P Scaler Video Converter Box (VGA2HDMI) — Primary Product Overview',
    'Mini VGA to HDMI 1080P Scaler Video Converter Box (VGA2HDMI) — Illustrative Hardware View (Mini VGA to HDMI 1080P Scaler Video Converter Box (VGA2HDMI) — Precision Interface & Connector Terminal Close-Up)',
    'Mini VGA to HDMI 1080P Scaler Video Converter Box (VGA2HDMI) — Illustrative Hardware View (Mini VGA to HDMI 1080P Scaler Video Converter Box (VGA2HDMI) — Commercial Hardware Packaging & Installation View)'
  ],
  'mini-hdmi-to-av-rca-video-converter-box': [
    'Mini HDMI to AV RCA Composite Video Audio Converter Box (HDMI2AV) — Primary Product Overview',
    'Mini HDMI to AV RCA Composite Video Audio Converter Box (HDMI2AV) — Illustrative Hardware View (Mini HDMI to AV RCA Composite Video Audio Converter Box (HDMI2AV) — Precision Interface & Connector Terminal Close-Up)',
    'Mini HDMI to AV RCA Composite Video Audio Converter Box (HDMI2AV) — Illustrative Hardware View (mini hdmi to av rca video converter box — Commercial Hardware Deployment & Installation Profile)'
  ],
  'mini-av-rca-to-vga-video-converter-box': [
    'Mini AV RCA Composite to VGA Video Converter Box (AV2VGA) — Primary Product Overview',
    'Mini AV RCA Composite to VGA Video Converter Box (AV2VGA) — Illustrative Hardware View (mini av rca to vga video converter box — Precision Interface & Connector Detail)',
    'Mini AV RCA Composite to VGA Video Converter Box (AV2VGA) — Illustrative Hardware View (mini av rca to vga video converter box — Commercial Hardware Deployment & Installation Profile)'
  ],
  'mini-av-rca-to-hdmi-1080p-scaler-converter-box': [
    'Mini AV RCA to HDMI 1080P Up Scaler Video Converter Box (AV2HDMI) — Primary Product Overview',
    'Mini AV RCA to HDMI 1080P Up Scaler Video Converter Box (AV2HDMI) — Illustrative Hardware View (mini av rca to hdmi 1080p scaler converter box — Precision Interface & Connector Detail)',
    'Mini AV RCA to HDMI 1080P Up Scaler Video Converter Box (AV2HDMI) — Illustrative Hardware View (mini av rca to hdmi 1080p scaler converter box — Commercial Hardware Deployment & Installation Profile)'
  ],
  'hdmi-1-male-to-2-female-dual-splitter-cable': [
    'HDMI 1 Male to 2 Female Dual Port Splitter Adapter Cable (30cm) — Primary Product Overview',
    'HDMI 1 Male to 2 Female Dual Port Splitter Adapter Cable (30cm) — Illustrative Hardware View (hdmi 1 male to 2 female dual splitter cable — Precision Interface & Connector Detail)'
  ],
  'usb-type-c-3-in-1-multiport-adapter-silver': [
    'USB Type-C 3-in-1 Multiport Hub Adapter (4K HDMI + USB 3.0 + Type-C PD) — Primary Product Overview',
    'USB Type-C 3-in-1 Multiport Hub Adapter (4K HDMI + USB 3.0 + Type-C PD) — Illustrative Hardware View (USB Type-C 3-in-1 Multiport Hub Adapter (4K HDMI + USB 3.0 + Type-C PD) — Precision Interface & Connector Terminal Close-Up)',
    'USB Type-C 3-in-1 Multiport Hub Adapter (4K HDMI + USB 3.0 + Type-C PD) — Illustrative Hardware View (USB Type-C 3-in-1 Multiport Hub Adapter (4K HDMI + USB 3.0 + Type-C PD) — Commercial Hardware Packaging & Installation View)'
  ],
  'fentico-displayport-male-to-vga-female-adapter': [
    'Fentico DisplayPort Male to VGA Female Active Converter Adapter — Primary Product Overview',
    'Fentico DisplayPort Male to VGA Female Active Converter Adapter — Additional Hardware View (Fentico DisplayPort Male to VGA Female Active Converter Adapter — Precision Interface & Connector Terminal Close-Up)',
    'Fentico DisplayPort Male to VGA Female Active Converter Adapter — Additional Hardware View (Fentico DisplayPort Male to VGA Female Active Converter Adapter — Commercial Hardware Packaging & Installation View)'
  ],
  'usb-type-c-to-hdmi-4k-display-adapter-silver': [
    'USB Type-C to HDMI 4K UHD Video Display Adapter (Silver Aluminum) — Primary Product Overview',
    'USB Type-C to HDMI 4K UHD Video Display Adapter (Silver Aluminum) — Illustrative Hardware View (usb type c to hdmi 4k display adapter silver — Precision Interface & Connector Detail)'
  ],
  'displayport-male-to-hdmi-female-adapter-cable': [
    'DisplayPort Male to HDMI Female Video Converter Adapter Cable — Primary Product Overview',
    'DisplayPort Male to HDMI Female Video Converter Adapter Cable — Illustrative Hardware View (displayport male to hdmi female adapter cable — Precision Interface & Connector Detail)'
  ],
  'usb-2-0-hdmi-1080p-video-capture-card-dongle': [
    'USB 2.0 Full HD 1080P HDMI Video Capture Card Dongle — Primary Product Overview',
    'USB 2.0 Full HD 1080P HDMI Video Capture Card Dongle — Illustrative Hardware View (usb 2 0 hdmi 1080p video capture card dongle — Precision Interface & Connector Detail)',
    'USB 2.0 Full HD 1080P HDMI Video Capture Card Dongle — Illustrative Hardware View (usb 2 0 hdmi 1080p video capture card dongle — Commercial Hardware Deployment & Installation Profile)'
  ],
  'usb-2-0-4-port-hub-with-switches': [
    '4-Port USB 2.0 Hub with Individual Power Switches & LED Indicators — Primary Product Overview',
    '4-Port USB 2.0 Hub with Individual Power Switches & LED Indicators — Illustrative Hardware View (4-Port USB 2.0 Hub with Individual Power Switches & LED Indicators — Precision Interface & Connector Terminal Close-Up)',
    '4-Port USB 2.0 Hub with Individual Power Switches & LED Indicators — Illustrative Hardware View (4-Port USB 2.0 Hub with Individual Power Switches & LED Indicators — Commercial Hardware Packaging & Installation View)'
  ],
  'sata-2-5-inch-hdd-ssd-enclosure-black': [
    '2.5-Inch SATA to USB External Hard Drive / SSD Enclosure Casing (Black) — Primary Product Overview',
    '2.5-Inch SATA to USB External Hard Drive / SSD Enclosure Casing (Black) — Precision Connector & Interface Detail',
    '2.5-Inch SATA to USB External Hard Drive / SSD Enclosure Casing (Black) — Commercial Deployment & Installation Profile',
    '2.5-Inch SATA to USB External Hard Drive / SSD Enclosure Casing (Black) — Hardware Component Detail & Ports View',
    '2.5-Inch SATA to USB External Hard Drive / SSD Enclosure Casing (Black) — Illustrative Hardware View (2.5-Inch SATA to USB External Hard Drive / SSD Enclosure Casing (Black) — Precision Interface & Connector Terminal Close-Up)',
    '2.5-Inch SATA to USB External Hard Drive / SSD Enclosure Casing (Black) — Illustrative Hardware View (2.5-Inch SATA to USB External Hard Drive / SSD Enclosure Casing (Black) — Commercial Hardware Packaging & Installation View)'
  ],
  'transparent-2-5-inch-sata-usb-3-0-enclosure': [
    'Transparent 2.5-Inch SATA to USB 3.0 Tool-Free HDD/SSD Enclosure — Primary Product Overview',
    'Transparent 2.5-Inch SATA to USB 3.0 Tool-Free HDD/SSD Enclosure — Illustrative Hardware View (Transparent 2.5-Inch SATA to USB 3.0 Tool-Free HDD/SSD Enclosure — Precision Interface & Connector Terminal Close-Up)',
    'Transparent 2.5-Inch SATA to USB 3.0 Tool-Free HDD/SSD Enclosure — Illustrative Hardware View (Transparent 2.5-Inch SATA to USB 3.0 Tool-Free HDD/SSD Enclosure — Commercial Hardware Packaging & Installation View)'
  ],
  'cr2032-3v-lithium-coin-cell-batteries-pack': [
    'CR2032 3V Lithium Coin Cell Motherboard CMOS Batteries (Pack of 5) — Primary Product Overview',
    'CR2032 3V Lithium Coin Cell Motherboard CMOS Batteries (Pack of 5) — Illustrative Hardware View (CR2032 3V Lithium Coin Cell Motherboard CMOS Batteries (Pack of 5) — Precision Interface & Connector Terminal Close-Up)',
    'CR2032 3V Lithium Coin Cell Motherboard CMOS Batteries (Pack of 5) — Illustrative Hardware View (CR2032 3V Lithium Coin Cell Motherboard CMOS Batteries (Pack of 5) — Commercial Hardware Packaging & Installation View)'
  ],
  'compact-4-port-usb-hub-block-expander': [
    'Compact 4-Port USB 2.0 Hub Block Expander — Primary Product Overview'
  ],
  'usb-to-rs232-db9-serial-adapter-cable': [
    'USB 2.0 to RS232 DB9 9-Pin Serial COM Port Adapter Cable (Translucent Blue) — Primary Product Overview',
    'USB 2.0 to RS232 DB9 9-Pin Serial COM Port Adapter Cable (Translucent Blue) — Illustrative Hardware View (USB 2.0 to RS232 DB9 9-Pin Serial COM Port Adapter Cable (Translucent Blue) — Precision Interface & Connector Terminal Close-Up)',
    'USB 2.0 to RS232 DB9 9-Pin Serial COM Port Adapter Cable (Translucent Blue) — Illustrative Hardware View (USB 2.0 to RS232 DB9 9-Pin Serial COM Port Adapter Cable (Translucent Blue) — Commercial Hardware Packaging & Installation View)'
  ],
  'ranz-3-in-1-screen-cleaning-kit': [
    'Ranz 3-in-1 Screen & Laptop Cleaning Kit (Spray + Cloth + Brush) — Primary Product Overview',
    'Ranz 3-in-1 Screen & Laptop Cleaning Kit (Spray + Cloth + Brush) — Additional Hardware View (Ranz 3-in-1 Screen & Laptop Cleaning Kit (Spray + Cloth + Brush) — Precision Interface & Connector Terminal Close-Up)',
    'Ranz 3-in-1 Screen & Laptop Cleaning Kit (Spray + Cloth + Brush) — Additional Hardware View (Ranz 3-in-1 Screen & Laptop Cleaning Kit (Spray + Cloth + Brush) — Commercial Hardware Packaging & Installation View)'
  ],
  'super-clean-high-tech-cleaning-gel-pouch': [
    'Super Clean High-Tech Keyboard & Laptop Cleaning Compound Gel — Primary Product Overview',
    'Super Clean High-Tech Keyboard & Laptop Cleaning Compound Gel — Additional Hardware View (Super Clean High-Tech Keyboard & Laptop Cleaning Compound Gel — Precision Interface & Connector Terminal Close-Up)',
    'Super Clean High-Tech Keyboard & Laptop Cleaning Compound Gel — Additional Hardware View (Super Clean High-Tech Keyboard & Laptop Cleaning Compound Gel — Commercial Hardware Packaging & Installation View)'
  ],
  'kizma-3-in-1-super-cleaning-kit': [
    'Kizma 3-in-1 Super Cleaning Kit with 100ml Screen Spray — Primary Product Overview',
    'Kizma 3-in-1 Super Cleaning Kit with 100ml Screen Spray — Additional Hardware View (kizma 3 in 1 super cleaning kit — Commercial Hardware Deployment & Installation Profile)'
  ],
  'passive-hdcvi-tvi-ahd-cctv-video-balun-pair': [
    'Passive HDCVI / HDTVI / AHD CCTV Video Balun Transceiver Pair — Primary Product Overview',
    'Passive HDCVI / HDTVI / AHD CCTV Video Balun Transceiver Pair — Illustrative Hardware View (passive hdcvi tvi ahd cctv video balun pair — Precision Interface & Connector Detail)',
    'Passive HDCVI / HDTVI / AHD CCTV Video Balun Transceiver Pair — Illustrative Hardware View (passive hdcvi tvi ahd cctv video balun pair — Commercial Hardware Deployment & Installation Profile)'
  ],
  'wireless-n-950m-mini-usb-wifi-adapter': [
    '802.11N 950M Wireless-N Mini USB Wi-Fi Nano Adapter — Primary Product Overview',
    '802.11N 950M Wireless-N Mini USB Wi-Fi Nano Adapter — Additional Hardware View (802.11N 950M Wireless-N Mini USB Wi-Fi Nano Adapter — Precision Interface & Connector Terminal Close-Up)',
    '802.11N 950M Wireless-N Mini USB Wi-Fi Nano Adapter — Additional Hardware View (802.11N 950M Wireless-N Mini USB Wi-Fi Nano Adapter — Commercial Hardware Packaging & Installation View)'
  ],
  'microfiber-cleaning-cloths-multi-color-pack': [
    'Soft Microfiber Cleaning & Polishing Cloths (Multi-Color Pack) — Primary Product Overview',
    'Soft Microfiber Cleaning & Polishing Cloths (Multi-Color Pack) — Illustrative Hardware View (microfiber cleaning cloths multi color pack — Commercial Hardware Deployment & Installation Profile)'
  ],
  'bluetooth-5-0-usb-nano-dongle-adapter': [
    'Bluetooth 5.0 USB Nano Dongle Wireless Receiver Adapter — Primary Product Overview',
    'Bluetooth 5.0 USB Nano Dongle Wireless Receiver Adapter — Illustrative Hardware View (Bluetooth 5.0 USB Nano Dongle Wireless Receiver Adapter — Precision Interface & Connector Terminal Close-Up)',
    'Bluetooth 5.0 USB Nano Dongle Wireless Receiver Adapter — Illustrative Hardware View (Bluetooth 5.0 USB Nano Dongle Wireless Receiver Adapter — Commercial Hardware Packaging & Installation View)'
  ],
  'cctv-bnc-male-pigtail-coaxial-cables-10pack': [
    'CCTV BNC Male Video Connector Coaxial Pigtail Cables (Pack of 10) — Primary Product Overview',
    'CCTV BNC Male Video Connector Coaxial Pigtail Cables (Pack of 10) — Illustrative Hardware View (CCTV BNC Male Video Connector Coaxial Pigtail Cables (Pack of 10) — Precision Interface & Connector Terminal Close-Up)',
    'CCTV BNC Male Video Connector Coaxial Pigtail Cables (Pack of 10) — Illustrative Hardware View (CCTV BNC Male Video Connector Coaxial Pigtail Cables (Pack of 10) — Commercial Hardware Packaging & Installation View)'
  ],
  'intel-stock-lga115x-cpu-cooler-fan': [
    'Intel Stock CPU Heatsink Cooler Fan (LGA 115x Sockets) — Primary Product Overview',
    'Intel Stock CPU Heatsink Cooler Fan (LGA 115x Sockets) — Additional Hardware View (Intel Stock CPU Heatsink Cooler Fan (LGA 115x Sockets) — Precision Interface & Connector Terminal Close-Up)',
    'Intel Stock CPU Heatsink Cooler Fan (LGA 115x Sockets) — Additional Hardware View (Intel Stock CPU Heatsink Cooler Fan (LGA 115x Sockets) — Commercial Hardware Packaging & Installation View)'
  ],
  'dt830d-digital-multimeter-with-probes': [
    'DT830D Compact Digital Multimeter with Testing Probes — Primary Product Overview',
    'DT830D Compact Digital Multimeter with Testing Probes — Additional Hardware View (DT830D Compact Digital Multimeter with Testing Probes — Precision Interface & Connector Terminal Close-Up)',
    'DT830D Compact Digital Multimeter with Testing Probes — Additional Hardware View (DT830D Compact Digital Multimeter with Testing Probes — Commercial Hardware Packaging & Installation View)'
  ],
  'cctv-12v-dc-male-power-pigtail-connectors-10pack': [
    'CCTV 12V DC Male Power Pigtail Connector Cables 2.1x5.5mm (Pack of 10) — Primary Product Overview',
    'CCTV 12V DC Male Power Pigtail Connector Cables 2.1x5.5mm (Pack of 10) — Illustrative Hardware View (CCTV 12V DC Male Power Pigtail Connector Cables 2.1x5.5mm (Pack of 10) — Precision Interface & Connector Terminal Close-Up)',
    'CCTV 12V DC Male Power Pigtail Connector Cables 2.1x5.5mm (Pack of 10) — Illustrative Hardware View (CCTV 12V DC Male Power Pigtail Connector Cables 2.1x5.5mm (Pack of 10) — Commercial Hardware Packaging & Installation View)'
  ],
  'thermaltake-cpu-cooler-fan-lga775-115x': [
    'Thermaltake CPU Heatsink Cooler Fan (Screw Mount) — Primary Product Overview',
    'Thermaltake CPU Heatsink Cooler Fan (Screw Mount) — Additional Hardware View (Thermaltake CPU Heatsink Cooler Fan (Screw Mount) — Precision Interface & Connector Terminal Close-Up)',
    'Thermaltake CPU Heatsink Cooler Fan (Screw Mount) — Additional Hardware View (Thermaltake CPU Heatsink Cooler Fan (Screw Mount) — Commercial Hardware Packaging & Installation View)'
  ],
  'rj45-rj11-network-cable-crimping-tool-with-stripper': [
    '3-in-1 RJ45 / RJ11 Modular Network Cable Crimping Tool with Stripper — Primary Product Overview',
    '3-in-1 RJ45 / RJ11 Modular Network Cable Crimping Tool with Stripper — Illustrative Hardware View (rj45 rj11 network cable crimping tool with stripper — Precision Interface & Connector Detail)',
    '3-in-1 RJ45 / RJ11 Modular Network Cable Crimping Tool with Stripper — Illustrative Hardware View (rj45 rj11 network cable crimping tool with stripper — Commercial Hardware Deployment & Installation Profile)'
  ],
  'universal-sata-2nd-hdd-caddy': [
    'Universal SATA 2nd HDD / SSD Optical Drive Bay Caddy (9.5mm / 12.7mm) — Primary Product Overview',
    'Universal SATA 2nd HDD / SSD Optical Drive Bay Caddy (9.5mm / 12.7mm) — Precision Connector & Interface Detail'
  ],
  'dc-power-adapter-9v-1a-barrel-jack': [
    '9V 1A DC Regulated Power Supply Adapter (Indian 2-Pin Plug) — Primary Product Overview',
    '9V 1A DC Regulated Power Supply Adapter (Indian 2-Pin Plug) — Illustrative Hardware View (9V 1A DC Regulated Power Supply Adapter (Indian 2-Pin Plug) — Precision Interface & Connector Terminal Close-Up)',
    '9V 1A DC Regulated Power Supply Adapter (Indian 2-Pin Plug) — Illustrative Hardware View (9V 1A DC Regulated Power Supply Adapter (Indian 2-Pin Plug) — Commercial Hardware Packaging & Installation View)'
  ],
  'dc-power-adapter-12v-2a-barrel-jack': [
    '12V 2A DC Regulated Power Supply Adapter (Indian 2-Pin Plug) — Primary Product Overview',
    '12V 2A DC Regulated Power Supply Adapter (Indian 2-Pin Plug) — Illustrative Hardware View (12V 2A DC Regulated Power Supply Adapter (Indian 2-Pin Plug) — Precision Interface & Connector Terminal Close-Up)',
    '12V 2A DC Regulated Power Supply Adapter (Indian 2-Pin Plug) — Illustrative Hardware View (12V 2A DC Regulated Power Supply Adapter (Indian 2-Pin Plug) — Commercial Hardware Packaging & Installation View)'
  ],
  'extended-gaming-mouse-pad-desk-mat': [
    'Extended Gaming Mouse Pad & Keyboard Desk Mat (Black with Blue Border) — Primary Product Overview',
    'Extended Gaming Mouse Pad & Keyboard Desk Mat (Black with Blue Border) — Illustrative Hardware View (Extended Gaming Mouse Pad & Keyboard Desk Mat (Black with Blue Border) — Precision Interface & Connector Terminal Close-Up)',
    'Extended Gaming Mouse Pad & Keyboard Desk Mat (Black with Blue Border) — Illustrative Hardware View (Extended Gaming Mouse Pad & Keyboard Desk Mat (Black with Blue Border) — Commercial Hardware Packaging & Installation View)'
  ],
  'scenic-nature-printed-optical-mousepad': [
    'Scenic Nature Printed Optical Mousepad — Primary Product Overview',
    'Scenic Nature Printed Optical Mousepad — Illustrative Hardware View (Scenic Nature Printed Optical Mousepad — Precision Interface & Connector Terminal Close-Up)',
    'Scenic Nature Printed Optical Mousepad — Illustrative Hardware View (Scenic Nature Printed Optical Mousepad — Commercial Hardware Packaging & Installation View)'
  ],
  'logitech-retro-logo-gaming-mousepad': [
    'Logitech Retro Logo Non-Slip Gaming Mousepad — Primary Product Overview',
    'Logitech Retro Logo Non-Slip Gaming Mousepad — Additional Hardware View (Logitech Retro Logo Non-Slip Gaming Mousepad — Precision Interface & Connector Terminal Close-Up)',
    'Logitech Retro Logo Non-Slip Gaming Mousepad — Additional Hardware View (Logitech Retro Logo Non-Slip Gaming Mousepad — Commercial Hardware Packaging & Installation View)'
  ],
  'micro-wolf-hunter-l-16-gaming-mouse-pad': [
    'Micro Wolf Hunter Precision Gaming Mouse Pad (Model L-16) — Primary Product Overview',
    'Micro Wolf Hunter Precision Gaming Mouse Pad (Model L-16) — Additional Hardware View (Micro Wolf Hunter Precision Gaming Mouse Pad (Model L-16) — Precision Interface & Connector Terminal Close-Up)',
    'Micro Wolf Hunter Precision Gaming Mouse Pad (Model L-16) — Additional Hardware View (Micro Wolf Hunter Precision Gaming Mouse Pad (Model L-16) — Commercial Hardware Packaging & Installation View)'
  ],
  'adnet-ad-mp-02-gaming-mouse-pad': [
    'ADNet Gaming Mouse Pad (Model AD-MP-02) — Primary Product Overview',
    'ADNet Gaming Mouse Pad (Model AD-MP-02) — Additional Hardware View (ADNet Gaming Mouse Pad (Model AD-MP-02) — Precision Interface & Connector Terminal Close-Up)',
    'ADNet Gaming Mouse Pad (Model AD-MP-02) — Additional Hardware View (ADNet Gaming Mouse Pad (Model AD-MP-02) — Commercial Hardware Packaging & Installation View)'
  ],
  'terabyte-kubix-e-02b-multimedia-speakers': [
    'Terabyte Kubix E-02B 2.0 Multimedia USB-Powered Speakers — Primary Product Overview',
    'Terabyte Kubix E-02B 2.0 Multimedia USB-Powered Speakers — Additional Hardware View (Terabyte Kubix E-02B 2.0 Multimedia USB-Powered Speakers — Precision Interface & Connector Terminal Close-Up)',
    'Terabyte Kubix E-02B 2.0 Multimedia USB-Powered Speakers — Additional Hardware View (Terabyte Kubix E-02B 2.0 Multimedia USB-Powered Speakers — Commercial Hardware Packaging & Installation View)'
  ],
  'terabyte-eliptic-tb-015-multimedia-speakers': [
    'Terabyte Eliptic TB-015 2.0 Multimedia USB-Powered Speakers — Primary Product Overview',
    'Terabyte Eliptic TB-015 2.0 Multimedia USB-Powered Speakers — Additional Hardware View (Terabyte Eliptic TB-015 2.0 Multimedia USB-Powered Speakers — Precision Interface & Connector Terminal Close-Up)',
    'Terabyte Eliptic TB-015 2.0 Multimedia USB-Powered Speakers — Additional Hardware View (terabyte eliptic tb 015 multimedia speakers — Commercial Hardware Deployment & Installation Profile)'
  ],
  'terabyte-clarion-tb-008-mini-digital-speakers': [
    'Terabyte Clarion TB-008 Mini Digital Portable Stereo Speakers — Primary Product Overview',
    'Terabyte Clarion TB-008 Mini Digital Portable Stereo Speakers — Additional Hardware View (terabyte clarion tb 008 mini digital speakers — Commercial Hardware Deployment & Installation Profile)'
  ],
  'adnet-ad-201-optical-wired-mouse': [
    'ADNet AD-201 1000 DPI Optical Wired USB Mouse — Primary Product Overview',
    'ADNet AD-201 1000 DPI Optical Wired USB Mouse — Additional Hardware View (ADNet AD-201 1000 DPI Optical Wired USB Mouse — Commercial Hardware Packaging & Installation View)'
  ],
  'adjustable-ergonomic-aluminum-laptop-stand': [
    'Adjustable Ergonomic Aluminum Laptop Stand (Foldable Riser) — Primary Product Overview',
    'Adjustable Ergonomic Aluminum Laptop Stand (Foldable Riser) — Illustrative Hardware View (Adjustable Ergonomic Aluminum Laptop Stand (Foldable Riser) — Precision Interface & Connector Terminal Close-Up)',
    'Adjustable Ergonomic Aluminum Laptop Stand (Foldable Riser) — Illustrative Hardware View (adjustable ergonomic aluminum laptop stand — Commercial Hardware Deployment & Installation Profile)'
  ],
  'laptop-cooling-pad-with-blue-led-fan': [
    'Laptop Cooling Pad with Blue LED Silent Fan (Metal Mesh) — Primary Product Overview',
    'Laptop Cooling Pad with Blue LED Silent Fan (Metal Mesh) — Illustrative Hardware View (Laptop Cooling Pad with Blue LED Silent Fan (Metal Mesh) — Precision Interface & Connector Terminal Close-Up)'
  ],
  'cctv-4-channel-12v-1a-smps-power-supply': [
    '4-Channel 12V 1A/Channel CCTV Camera Power Supply SMPS Box — Primary Product Overview'
  ],
  'crotomax-wall-mount-dvr-rack-cabinet': [
    'CROTOMAX Wall Mount DVR & Network Server Rack Cabinet (Toughened Glass Door) — Primary Product Overview',
    'CROTOMAX Wall Mount DVR & Network Server Rack Cabinet (Toughened Glass Door) — Precision Connector & Interface Detail',
    'CROTOMAX Wall Mount DVR & Network Server Rack Cabinet (Toughened Glass Door) — Additional Hardware View (CROTOMAX Wall Mount DVR & Network Server Rack Cabinet (Toughened Glass Door) — Precision Interface & Connector Terminal Close-Up)'
  ],
  'hawk-vision-stainless-steel-electronic-door-lock': [
    'Hawk Vision Stainless Steel Electronic Door Rim Lock (Electric Strike) — Primary Product Overview',
    'Hawk Vision Stainless Steel Electronic Door Rim Lock (Electric Strike) — Additional Hardware View (Hawk Vision Stainless Steel Electronic Door Rim Lock (Electric Strike) — Precision Interface & Connector Terminal Close-Up)',
    'Hawk Vision Stainless Steel Electronic Door Rim Lock (Electric Strike) — Additional Hardware View (Hawk Vision Stainless Steel Electronic Door Rim Lock (Electric Strike) — Commercial Hardware Packaging & Installation View)'
  ],
  'dvi-d-to-hdmi-bi-directional-video-adapter': [
    'DVI-D 24+1 Male to HDMI Female Gold-Plated Bi-Directional Adapter — Primary Product Overview',
    'DVI-D 24+1 Male to HDMI Female Gold-Plated Bi-Directional Adapter — Illustrative Hardware View (DVI-D 24+1 Male to HDMI Female Gold-Plated Bi-Directional Adapter — Precision Interface & Connector Terminal Close-Up)',
    'DVI-D 24+1 Male to HDMI Female Gold-Plated Bi-Directional Adapter — Illustrative Hardware View (DVI-D 24+1 Male to HDMI Female Gold-Plated Bi-Directional Adapter — Commercial Hardware Packaging & Installation View)'
  ],
  'swivel-tilt-monitor-tv-wall-mount-bracket': [
    'Adjustable Swivel & Tilt LCD/LED Monitor & TV Wall Mount Bracket (14"–27") — Primary Product Overview',
    'Adjustable Swivel & Tilt LCD/LED Monitor & TV Wall Mount Bracket (14"–27") — Illustrative Hardware View (Swivel & Tilt Wall Mount — Articulating Arm Joint & Cable Management Channel)'
  ],
  'compact-fixed-tv-wall-mount-bracket-14-42': [
    'Fixed LCD/LED Monitor & TV Wall Mount Bracket (14"–42") — Primary Product Overview',
    'Fixed LCD/LED Monitor & TV Wall Mount Bracket (14"–42") — Illustrative Hardware View (compact fixed tv wall mount bracket 14 42 — Precision Interface & Connector Detail)',
    'Fixed LCD/LED Monitor & TV Wall Mount Bracket (14"–42") — Illustrative Hardware View (compact fixed tv wall mount bracket 14 42 — Commercial Hardware Deployment & Installation Profile)'
  ],
  'heavy-duty-fixed-tv-wall-mount-bracket': [
    'Heavy-Duty Fixed LCD/LED TV Wall Mount Bracket (26"–55") — Primary Product Overview',
    'Heavy-Duty Fixed LCD/LED TV Wall Mount Bracket (26"–55") — Illustrative Hardware View (Heavy-Duty TV Wall Mount — Solid Steel Backplate & VESA Rail Arms)',
    'Heavy-Duty Fixed LCD/LED TV Wall Mount Bracket (26"–55") — Illustrative Hardware View (Heavy-Duty TV Wall Mount — VESA Standard Mounting Hole Pattern & Hardware)'
  ],
  'dlink-cat6-rj45-modular-connectors-box': [
    'D-Link Cat6 RJ45 Modular Network Connector Plugs (Box of 100) — Primary Product Overview',
    'D-Link Cat6 RJ45 Modular Network Connector Plugs (Box of 100) — Additional Hardware View (dlink cat6 rj45 modular connectors box — Commercial Hardware Deployment & Installation Profile)'
  ],
  'flipkart-smartbuy-electric-fan-room-heater': [
    'Flipkart SmartBuy Electric Fan Room Heater (1000W / 2000W) — Primary Product Overview',
    'Flipkart SmartBuy Electric Fan Room Heater (1000W / 2000W) — Additional Hardware View (Flipkart SmartBuy Electric Fan Room Heater (1000W / 2000W) — Commercial Hardware Packaging & Installation View)'
  ],
  'flexible-usb-led-portable-reading-lamp-2pack': [
    'Flexible Silicone USB LED Portable Light Lamp (Pack of 2: Blue & Green) — Primary Product Overview',
    'Flexible Silicone USB LED Portable Light Lamp (Pack of 2: Blue & Green) — Illustrative Hardware View (Flexible Silicone USB LED Portable Light Lamp (Pack of 2: Blue & Green) — Precision Interface & Connector Terminal Close-Up)'
  ],
  'water-resistant-laptop-backpack-15-6-inch-grey': [
    'Grey Heather Water-Resistant Laptop Backpack (15.6-Inch) — Primary Product Overview'
  ],
  'commercial-mechanical-keyboards-mice': [
    'commercial mechanical keyboards mice — Primary Product Overview'
  ],
  'certified-hdmi-displayport-cat6-patch-cables': [
    'certified hdmi displayport cat6 patch cables — Primary Product Overview',
    'certified hdmi displayport cat6 patch cables — Precision Connector & Interface Detail'
  ],
};

export const DEFAULT_PRODUCT_IMAGE = businessLaptopDell1;
