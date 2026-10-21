/**
 * ============================================================================
 * ARS Computers — Mock Service Requests & Diagnostic Presets (Demo Mode)
 * ============================================================================
 * Provides rich, realistic mock tickets for after-sales service, repair,
 * warranty verification, CCTV diagnostics, and PC hardware troubleshooting.
 * ============================================================================
 */

export const SERVICE_STATUS_META = {
  new: { label: 'New Request', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', icon: '🆕' },
  assigned: { label: 'Assigned', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', icon: '👤' },
  in_progress: { label: 'In Progress', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '⚙️' },
  waiting_customer_parts: { label: 'Waiting for Parts / Client', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '⏳' },
  resolved: { label: 'Resolved', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' },
  closed: { label: 'Closed', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', icon: '📁' }
}

export const SERVICE_PRIORITY_META = {
  urgent: { label: 'Urgent', color: '#dc2626', bg: '#fee2e2' },
  high: { label: 'High', color: '#ea580c', bg: '#ffedd5' },
  medium: { label: 'Medium', color: '#ca8a04', bg: '#fef9c3' },
  low: { label: 'Low', color: '#16a34a', bg: '#dcfce7' }
}

export const SERVICE_CATEGORIES = [
  'Desktop Computer',
  'Laptop',
  'CCTV Camera',
  'DVR/NVR',
  'CCTV Complete System',
  'Printer/Scanner',
  'Biometric Device',
  'Router/Networking',
  'UPS/Power Backup',
  'Other IT Hardware'
]

export const SERVICE_LOCATIONS = [
  'On-site',
  'Workshop',
  'Remote Support'
]

export const CUSTOMER_TYPES = [
  'Individual',
  'Business/Office',
  'School/Institution',
  'Government/Enterprise'
]

export const REQUEST_TYPES = [
  'Repair/Fault Diagnosis',
  'Warranty Support',
  'Installation/Configuration',
  'AMC/Preventive Maintenance',
  'Technical Support',
  'Upgrade/Replacement'
]

export const INITIAL_DEMO_SERVICE_REQUESTS = [
  {
    id: 'sr-001',
    ticket_number: 'ARS-SR-20261024-1001',
    customer_name: 'Rajesh Sharma',
    mobile_number: '+91 9876543210',
    email: 'rajesh.sharma@delhioffice.in',
    customer_type: 'Business/Office',
    product_category: 'CCTV Complete System',
    brand: 'CP Plus / Hikvision',
    model_number: '8-Channel HD Turbo NVR Kit',
    serial_number: 'CP-NVR-8CH-99281',
    purchase_date: '2025-11-15',
    invoice_number: 'INV-ARS-2025-0842',
    request_type: 'Repair/Fault Diagnosis',
    problem_description: '3 cameras out of 8 show black screen with "No Video" signal on the monitor. DVR remote mobile app streaming also disconnected since router was rebooted.',
    service_location: 'On-site',
    site_address: 'Plot 42, Okhla Industrial Area Phase 3, New Delhi 110020',
    preferred_visit_date: '2026-10-25',
    device_details: {
      camera_count: 8,
      dvr_nvr_details: '8-Channel 4K NVR with 4TB Surveillance HDD',
      issue_camera_offline: true,
      issue_remote_viewing: true,
      issue_recording_playback: false,
      issue_cabling: true,
      issue_power: false,
      issue_network: true
    },
    status: 'in_progress',
    priority: 'high',
    assigned_technician_id: 'tech-001',
    assigned_technician_name: 'Vikram Singh (Senior Field Tech)',
    diagnosis: 'Inspected site cabling: Balun power connector corroded at camera 2 & 5. NVR static IP was changed after ISP optical router reset.',
    work_performed: 'Re-crimped BNC connectors, replaced 2 weatherproof 12V 2A adapters, reconfigured static IP and port forwarding on the local router.',
    parts_used: [
      { item_name: '12V 2A Regulated CCTV Adapter', quantity: 2, unit_cost: 350, total_cost: 700 },
      { item_name: 'Heavy Duty Copper BNC Connectors', quantity: 4, unit_cost: 75, total_cost: 300 }
    ],
    estimated_cost: 1500,
    final_cost: 1350,
    warranty_status: 'under_warranty',
    warranty_notes: 'CCTV equipment installed by ARS Computers under 1-Year comprehensive on-site warranty until Nov 2026.',
    internal_notes: '[2026-10-24 - Superadmin]: Client holds AMC agreement. Prioritize on-site technician visit.\n---\n[2026-10-24 - Vikram Singh]: Site visited at 11:30 AM. Cabling re-routed away from heavy machinery conduit.',
    created_at: '2026-10-24T06:15:00.000Z',
    updated_at: '2026-10-24T08:30:00.000Z'
  },
  {
    id: 'sr-002',
    ticket_number: 'ARS-SR-20261024-1002',
    customer_name: 'Priya Mehra',
    mobile_number: '+91 9811223344',
    email: 'priya.mehra@gmail.com',
    customer_type: 'Individual',
    product_category: 'Laptop',
    brand: 'Dell',
    model_number: 'Inspiron 15 3520 (Intel i5 12th Gen)',
    serial_number: 'DELL-INSP-550921-A',
    purchase_date: '2024-08-10',
    invoice_number: 'INV-RETAIL-9932',
    request_type: 'Repair/Fault Diagnosis',
    problem_description: 'Laptop powers on, power LED lights up white, but screen remains completely blank (no backlight/Dell logo). Fan runs on full speed after 30 seconds.',
    service_location: 'Workshop',
    site_address: 'Sector 14, Gurugram, Haryana',
    preferred_visit_date: '2026-10-24',
    device_details: {
      issue_boot_failure: true,
      issue_display: true,
      issue_overheating: false,
      issue_slow_performance: false,
      issue_os_software: false,
      issue_data_recovery: false,
      issue_hardware_replacement: true
    },
    status: 'waiting_customer_parts',
    priority: 'medium',
    assigned_technician_id: 'tech-002',
    assigned_technician_name: 'Amit Verma (Hardware Specialist)',
    diagnosis: 'Motherboard RAM slot 1 oxidation causing POST failure. Secondary display out via HDMI works normally.',
    work_performed: 'Cleaned motherboard traces, tested with certified DDR4 3200MHz module. Customer requested upgrade to 16GB RAM.',
    parts_used: [
      { item_name: 'Crucial 16GB DDR4 3200MHz SO-DIMM', quantity: 1, unit_cost: 2800, total_cost: 2800 }
    ],
    estimated_cost: 3200,
    final_cost: null,
    warranty_status: 'warranty_expired',
    warranty_notes: 'Purchased over 2 years ago; manufacturer warranty expired.',
    internal_notes: '[2026-10-24 - Amit Verma]: Waiting for customer approval on RAM replacement cost.',
    created_at: '2026-10-24T07:45:00.000Z',
    updated_at: '2026-10-24T09:10:00.000Z'
  },
  {
    id: 'sr-003',
    ticket_number: 'ARS-SR-20261024-1003',
    customer_name: 'Dr. Alok Verma',
    mobile_number: '+91 9717001122',
    email: 'principal@greenwoodacademy.edu.in',
    customer_type: 'School/Institution',
    product_category: 'Biometric Device',
    brand: 'eSSL',
    model_number: 'eSSL MB20 Face & Fingerprint Terminal',
    serial_number: 'ESSL-MB20-88310',
    purchase_date: '2026-01-20',
    invoice_number: 'INV-ARS-2026-0115',
    request_type: 'Installation/Configuration',
    problem_description: 'Need to sync the biometric device with newly installed school ERP cloud server. Fingerprints register on device but attendance logs fail to export to server database.',
    service_location: 'Remote Support',
    site_address: 'Greenwood Senior School, Civil Lines, Bareilly',
    preferred_visit_date: '2026-10-24',
    device_details: {
      device_model: 'MB20 Facial & RFID',
      port_config: 'TCP/IP 4370',
      software: 'eTimeTrackLite v12'
    },
    status: 'assigned',
    priority: 'medium',
    assigned_technician_id: 'tech-003',
    assigned_technician_name: 'Paras Kandpal (Lead Systems Eng)',
    diagnosis: 'Firewall blocking inbound port 4370 between school LAN and ERP cloud IP.',
    work_performed: null,
    parts_used: [],
    estimated_cost: 0,
    final_cost: 0,
    warranty_status: 'under_warranty',
    warranty_notes: 'Software & configuration support included under 1st year installation agreement.',
    internal_notes: '[2026-10-24 - Superadmin]: Schedule AnyDesk session at 2:00 PM with school IT coordinator.',
    created_at: '2026-10-24T08:00:00.000Z',
    updated_at: '2026-10-24T08:15:00.000Z'
  },
  {
    id: 'sr-004',
    ticket_number: 'ARS-SR-20261024-1004',
    customer_name: 'Kavita Singhal',
    mobile_number: '+91 9988776655',
    email: 'kavita.accounts@singhalgroup.com',
    customer_type: 'Business/Office',
    product_category: 'Printer/Scanner',
    brand: 'Epson',
    model_number: 'EcoTank L3250 Wi-Fi All-in-One',
    serial_number: 'EPS-L3250-994101',
    purchase_date: '2025-06-18',
    invoice_number: 'INV-ARS-2025-0551',
    request_type: 'Repair/Fault Diagnosis',
    problem_description: 'Red ink status light blinking simultaneously with paper feed light. Computer displays "Waste Ink Pad Is At The End Of Its Service Life". Cannot print account invoices.',
    service_location: 'Workshop',
    site_address: 'Nehru Place Commercial Complex, New Delhi',
    preferred_visit_date: '2026-10-24',
    device_details: {
      printer_type: 'Continuous Ink Tank',
      error_code: 'Service Required / Waste Pad Counter Full'
    },
    status: 'new',
    priority: 'urgent',
    assigned_technician_id: null,
    assigned_technician_name: null,
    diagnosis: null,
    work_performed: null,
    parts_used: [],
    estimated_cost: null,
    final_cost: null,
    warranty_status: 'pending_verification',
    warranty_notes: 'Verify print counter and purchase date against serial ledger.',
    internal_notes: null,
    created_at: '2026-10-24T08:45:00.000Z',
    updated_at: '2026-10-24T08:45:00.000Z'
  },
  {
    id: 'sr-005',
    ticket_number: 'ARS-SR-20261024-1005',
    customer_name: 'Mohit Bansal',
    mobile_number: '+91 9899001122',
    email: 'mohit@bansalcreatives.com',
    customer_type: 'Individual',
    product_category: 'Desktop Computer',
    brand: 'Custom Assembled Rig',
    model_number: 'ARS Gaming Workstation (Ryzen 7 7700X / RTX 4070)',
    serial_number: 'ARS-PC-2025-019',
    purchase_date: '2025-04-12',
    invoice_number: 'INV-ARS-2025-0329',
    request_type: 'AMC/Preventive Maintenance',
    problem_description: 'Annual deep clean & thermal repaste service requested. CPU temps reaching 86C during 4K video rendering. Also request checking if BIOS has latest microcode update.',
    service_location: 'Workshop',
    site_address: 'Greater Kailash 2, New Delhi',
    preferred_visit_date: '2026-10-23',
    device_details: {
      issue_boot_failure: false,
      issue_display: false,
      issue_overheating: true,
      issue_slow_performance: false,
      issue_os_software: false,
      issue_data_recovery: false,
      issue_hardware_replacement: false
    },
    status: 'resolved',
    priority: 'low',
    assigned_technician_id: 'tech-002',
    assigned_technician_name: 'Amit Verma (Hardware Specialist)',
    diagnosis: 'Thermal paste on AIO liquid cooler radiator dry. Dust buildup in front intake mesh filters.',
    work_performed: 'Disassembled cooler block, applied Arctic MX-6 high-performance thermal paste, ultrasonically cleaned intake filters, flashed BIOS to revision 2408.',
    parts_used: [
      { item_name: 'Arctic MX-6 Thermal Compound (4g)', quantity: 1, unit_cost: 650, total_cost: 650 }
    ],
    estimated_cost: 1200,
    final_cost: 1150,
    warranty_status: 'under_warranty',
    warranty_notes: 'Custom assembly labor covered under 2-Year ARS Store Care.',
    internal_notes: '[2026-10-23 - Amit Verma]: Stress-tested Cinebench R23 30-min loop. Peak temperatures capped at 71C.',
    resolution_summary: 'Thermal service completed and stress-tested successfully. Machine ready for customer collection.',
    resolved_at: '2026-10-24T05:30:00.000Z',
    created_at: '2026-10-23T10:00:00.000Z',
    updated_at: '2026-10-24T05:30:00.000Z'
  }
]
