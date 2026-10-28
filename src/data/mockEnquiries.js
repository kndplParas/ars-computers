/**
 * ============================================================================
 * ARS Computers — Fictional Demo Enquiries Data
 * ============================================================================
 * Clearly labeled mock customer quote requests and service enquiries for
 * administrative user interface testing.
 *
 * NOTE: All names, organizations, contact info, and requirements below are
 * synthetic demo data. They do NOT originate from a production database.
 * ============================================================================
 */

export const INITIAL_DEMO_ENQUIRIES = [
  {
    id: 'ENQ-2026-001',
    customer_name: 'Vikram Malhotra',
    company: 'Apex Logistics & Freight Pvt Ltd',
    email: 'vikram.malhotra@apexlogistics.example.com',
    phone: '+91 98112 34567',
    category_interest: 'computer-laptop',
    category_label: 'Computer & Laptop',
    service_requested: 'Bulk Business Laptops Procurement',
    industry: 'Logistics & Supply Chain',
    budget: '₹2,50,000 – ₹3,50,000',
    timeline: 'Immediate (Within 7 Days)',
    message: 'Need a formal quotation for 5 units of Dell Latitude / HP ProBook business laptops with Intel Core i5, 16GB RAM, 512GB SSD, and pre-activated Windows 11 Pro. Required with valid GST invoice and manufacturer onsite warranty support for our warehouse operations desk.',
    status: 'new',
    created_at: '2026-10-20T09:15:00Z',
    admin_notes: 'Initial inbound lead from website contact form. Verified corporate GST registration request.',
    is_demo: true
  },
  {
    id: 'ENQ-2026-002',
    customer_name: 'Ananya Sharma',
    company: 'Prism Diagnostics & Clinic',
    email: 'ananya.tech@prismhealth.example.com',
    phone: '+91 98200 87654',
    category_interest: 'cctv',
    category_label: 'CCTV Surveillance',
    service_requested: '8-Channel 4K ColorVu IP Security Setup',
    industry: 'Healthcare & Clinical',
    budget: '₹75,000 – ₹1,10,000',
    timeline: '1–2 Weeks',
    message: 'Looking for a complete commercial security installation for our 2-floor medical diagnostic centre in Haldwani. Requires 8 outdoor/indoor Hikvision ColorVu IP cameras with audio support, 16-channel PoE NVR, and at least 30 days continuous recording backup with mobile live viewing.',
    status: 'in_progress',
    created_at: '2026-10-19T14:30:00Z',
    admin_notes: 'Technician site visit scheduled for cable routing survey. Follow up with quotation draft.',
    is_demo: true
  },
  {
    id: 'ENQ-2026-003',
    customer_name: 'Rajesh Gupta',
    company: 'Shivaay Steel Fabrication Works',
    email: 'rajesh.gupta@shivaaysteel.example.com',
    phone: '+91 98370 12345',
    category_interest: 'biometric-machine',
    category_label: 'Biometric Machine',
    service_requested: 'Biometric Attendance & Access Control',
    industry: 'Manufacturing & Workshop',
    budget: '₹18,000 – ₹28,000',
    timeline: 'Immediate (Within 7 Days)',
    message: 'Require an optical fingerprint + RFID card attendance machine with cloud sync and battery backup for 45 factory workers. Also need integration guidance for payroll report export (Excel/CSV) and an electromagnetic door lock kit for the administrative office.',
    status: 'quoted',
    created_at: '2026-10-18T11:20:00Z',
    admin_notes: 'Sent formal quotation for eSSL K90 Pro with EM Lock and 1-year annual service support.',
    is_demo: true
  },
  {
    id: 'ENQ-2026-004',
    customer_name: 'Dr. Meenakshi Pant',
    company: 'Himalayan Public School',
    email: 'principal@himalayanschool.example.edu',
    phone: '+91 94120 67890',
    category_interest: 'printer',
    category_label: 'Office & Commercial Printers',
    service_requested: 'High-Speed Duplex Network Printers',
    industry: 'Education & Academics',
    budget: '₹60,000 – ₹90,000',
    timeline: 'Within 1 Month',
    message: 'Our examination wing requires 2 heavy-duty monochrome laser printers capable of high-speed auto-duplex printing (min 38 ppm) with gigabit ethernet and low per-page cartridge cost. Please also include pricing for original high-yield toner cartridges.',
    status: 'new',
    created_at: '2026-10-20T08:00:00Z',
    admin_notes: 'Pending review by commercial printer sales specialist. Recommended HP LaserJet Pro M404dn.',
    is_demo: true
  },
  {
    id: 'ENQ-2026-005',
    customer_name: 'Arun Karki',
    company: 'Karki & Associates Legal Consultants',
    email: 'arun@karkilegal.example.com',
    phone: '+91 97580 45678',
    category_interest: 'computer-laptop',
    category_label: 'Computer & Laptop',
    service_requested: 'Custom CAD / Design Workstation Desktop',
    industry: 'Legal & Architecture',
    budget: '₹1,40,000 – ₹1,80,000',
    timeline: '1–2 Weeks',
    message: 'Seeking a high-performance desktop tower tailored for AutoCAD 2026 and Revit 3D architectural rendering. Specs preference: Intel Core i7 14th Gen or Ryzen 7, 32GB DDR5 RAM, 1TB Gen4 NVMe, and Nvidia RTX 4070 12GB GPU with dual 27-inch IPS monitors.',
    status: 'in_progress',
    created_at: '2026-10-17T16:45:00Z',
    admin_notes: 'Custom build configuration prepared. Client requested Dell UltraSharp monitor bundle discount.',
    is_demo: true
  },
  {
    id: 'ENQ-2026-006',
    customer_name: 'Harish Joshi',
    company: 'Kumaon Heritage Resort & Spa',
    email: 'gm@kumaonheritage.example.com',
    phone: '+91 98970 89012',
    category_interest: 'cctv',
    category_label: 'CCTV Surveillance',
    service_requested: 'Resort Perimeter Surveillance & Wi-Fi Mesh',
    industry: 'Hospitality & Tourism',
    budget: '₹1,50,000 – ₹2,20,000',
    timeline: 'Within 1 Month',
    message: 'Need 16 long-range night vision bullet cameras along with wireless mesh links between main reception and luxury cottages spread across 3 acres. Looking for a full turnkey installation with cabling, weatherproofing, and staff training.',
    status: 'quoted',
    created_at: '2026-10-16T10:10:00Z',
    admin_notes: 'Submitted proposal #ARS-QUO-26-88 with outdoor cat6 cabling and 2-year maintenance pack.',
    is_demo: true
  },
  {
    id: 'ENQ-2026-007',
    customer_name: 'Pooja Bisht',
    company: 'Nainital Chartered Accountants',
    email: 'pooja.b@nainitalca.example.in',
    phone: '+91 94111 23456',
    category_interest: 'accessories',
    category_label: 'IT & Computer Accessories',
    service_requested: 'Office Ergonomic IT Accessories Package',
    industry: 'Finance & Auditing',
    budget: '₹15,000 – ₹25,000',
    timeline: 'Immediate (Within 7 Days)',
    message: 'Requirement for 8 units of wireless keyboard-mouse combos (Logitech MK295 silent), 5 heavy-duty surge protectors, and 4 high-speed USB 3.0 hubs for audit season setup.',
    status: 'closed',
    created_at: '2026-10-14T13:25:00Z',
    admin_notes: 'Delivered and invoiced on 15 Oct 2026. Payment settled via NEFT.',
    is_demo: true
  },
  {
    id: 'ENQ-2026-008',
    customer_name: 'Suresh Chandra',
    company: 'Chandra Agro Commodities',
    email: 'suresh@chandraagro.example.com',
    phone: '+91 98371 99887',
    category_interest: 'biometric-machine',
    category_label: 'Biometric Machine',
    service_requested: 'Facial Recognition Attendance Terminal',
    industry: 'Agriculture & Processing',
    budget: '₹25,000 – ₹35,000',
    timeline: 'Flexible Planning',
    message: 'Seeking a contactless facial recognition attendance device for grain sorting depot workers where dry dust causes finger smudge issues with optical scanners. Need thermal/face match capability and USB log download.',
    status: 'closed',
    created_at: '2026-10-12T15:50:00Z',
    admin_notes: 'Installed Realtime AI Face recognition unit. 30-day testing concluded satisfactorily.',
    is_demo: true
  }
]

export const ENQUIRY_STATUSES = [
  { id: 'new', label: 'New', color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe', icon: '🔵' },
  { id: 'in_progress', label: 'In Progress', color: '#b45309', bg: '#fef3c7', border: '#fde68a', icon: '🟡' },
  { id: 'quoted', label: 'Quotation Sent', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0', icon: '🟢' },
  { id: 'completion_requested', label: 'Completion Pending', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: '⏳' },
  { id: 'returned_for_rework', label: 'Returned for Rework', color: '#c2410c', bg: '#fff7ed', border: '#ffedd5', icon: '🔄' },
  { id: 'rejection_requested', label: 'Pending Rejection', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', icon: '⏳' },
  { id: 'rejected', label: 'Rejected', color: '#991b1b', bg: '#fef2f2', border: '#fecaca', icon: '❌' },
  { id: 'completed', label: 'Completed (Archived)', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0', icon: '✅' },
  { id: 'in_bin', label: 'In Bin', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', icon: '🗑️' },
  { id: 'closed', label: 'Closed', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', icon: '⚪' }
]

