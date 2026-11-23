import React from 'react'

/**
 * ARS Computers — Responsive Technical Hardware Schematics & Interface Diagrams
 *
 * Renders vector diagrams for hardware interfaces, rear panels, and pinout
 * standards across laptops, CCTV recorders, printers, biometric terminals,
 * and high-speed cables.
 */
export default function ProductTechnicalDiagram({ diagramType = 'laptop-ports', productName = 'Hardware Unit' }) {
  const renderDiagram = () => {
    switch (diagramType) {
      case 'laptop-ports':
        return (
          <svg viewBox="0 0 800 280" className="tech-diagram-svg" aria-label="Laptop Interface Layout Diagram">
            <rect width="800" height="280" rx="12" fill="#0f172a" />
            <text x="400" y="32" fill="#38bdf8" textAnchor="middle" fontSize="14" fontWeight="bold" letterSpacing="1">
              COMMERCIAL LAPTOP I/O INTERFACE SCHEMATIC
            </text>
            <rect x="50" y="70" width="700" height="65" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            <text x="70" y="60" fill="#94a3b8" fontSize="12" fontWeight="600">Left Side I/O Distribution</text>
            {/* Left ports */}
            <g transform="translate(80, 85)">
              <rect width="28" height="35" rx="4" fill="#0284c7" />
              <text x="14" y="22" fill="#fff" fontSize="9" textAnchor="middle" fontWeight="bold">DC</text>
              <text x="14" y="48" fill="#94a3b8" fontSize="10" textAnchor="middle">Power</text>
            </g>
            <g transform="translate(140, 85)">
              <rect width="22" height="35" rx="6" fill="#38bdf8" />
              <text x="11" y="22" fill="#0f172a" fontSize="8" textAnchor="middle" fontWeight="bold">USB-C</text>
              <text x="11" y="48" fill="#94a3b8" fontSize="10" textAnchor="middle">Thunderbolt/PD</text>
            </g>
            <g transform="translate(240, 85)">
              <rect width="36" height="35" rx="3" fill="#6366f1" />
              <text x="18" y="22" fill="#fff" fontSize="9" textAnchor="middle" fontWeight="bold">HDMI</text>
              <text x="18" y="48" fill="#94a3b8" fontSize="10" textAnchor="middle">4K Video Out</text>
            </g>
            <g transform="translate(340, 85)">
              <rect width="30" height="35" rx="3" fill="#0ea5e9" />
              <text x="15" y="22" fill="#fff" fontSize="8" textAnchor="middle" fontWeight="bold">USB 3.2</text>
              <text x="15" y="48" fill="#94a3b8" fontSize="10" textAnchor="middle">Type-A (5Gbps)</text>
            </g>
            <g transform="translate(440, 85)">
              <circle cx="16" cy="18" r="12" fill="#ec4899" />
              <text x="16" y="22" fill="#fff" fontSize="8" textAnchor="middle" fontWeight="bold">Audio</text>
              <text x="16" y="48" fill="#94a3b8" fontSize="10" textAnchor="middle">3.5mm Combo</text>
            </g>

            {/* Right ports */}
            <rect x="50" y="175" width="700" height="65" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            <text x="70" y="165" fill="#94a3b8" fontSize="12" fontWeight="600">Right Side I/O Distribution</text>
            <g transform="translate(80, 190)">
              <rect width="26" height="35" rx="2" fill="#f59e0b" />
              <text x="13" y="22" fill="#fff" fontSize="8" textAnchor="middle" fontWeight="bold">SD</text>
              <text x="13" y="48" fill="#94a3b8" fontSize="10" textAnchor="middle">Card Reader</text>
            </g>
            <g transform="translate(170, 190)">
              <rect width="30" height="35" rx="3" fill="#0ea5e9" />
              <text x="15" y="22" fill="#fff" fontSize="8" textAnchor="middle" fontWeight="bold">USB 3.2</text>
              <text x="15" y="48" fill="#94a3b8" fontSize="10" textAnchor="middle">Type-A Port</text>
            </g>
            <g transform="translate(270, 190)">
              <rect width="34" height="35" rx="4" fill="#10b981" />
              <text x="17" y="22" fill="#fff" fontSize="8" textAnchor="middle" fontWeight="bold">RJ-45</text>
              <text x="17" y="48" fill="#94a3b8" fontSize="10" textAnchor="middle">Gigabit LAN</text>
            </g>
            <g transform="translate(370, 190)">
              <rect width="24" height="35" rx="2" fill="#64748b" />
              <text x="12" y="22" fill="#fff" fontSize="8" textAnchor="middle" fontWeight="bold">Lock</text>
              <text x="12" y="48" fill="#94a3b8" fontSize="10" textAnchor="middle">Kensington</text>
            </g>
            <g transform="translate(480, 190)">
              <text x="0" y="24" fill="#38bdf8" fontSize="11" fontWeight="600">Dual Display & Docking Ready</text>
              <text x="0" y="42" fill="#64748b" fontSize="10">Supports external monitors up to 4K @ 60Hz</text>
            </g>
          </svg>
        )

      case 'dvr-ports':
        return (
          <svg viewBox="0 0 800 280" className="tech-diagram-svg" aria-label="CCTV DVR/NVR Rear Interface Diagram">
            <rect width="800" height="280" rx="12" fill="#0f172a" />
            <text x="400" y="32" fill="#38bdf8" textAnchor="middle" fontSize="14" fontWeight="bold" letterSpacing="1">
              SURVEILLANCE RECORDER (DVR / NVR) REAR PANEL INTERFACE
            </text>
            <rect x="40" y="60" width="720" height="150" rx="10" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            {/* BNC Video Inputs */}
            <g transform="translate(60, 80)">
              <rect width="220" height="110" rx="6" fill="#0f172a" stroke="#334155" />
              <circle cx="35" cy="35" r="16" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
              <circle cx="85" cy="35" r="16" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
              <circle cx="135" cy="35" r="16" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
              <circle cx="185" cy="35" r="16" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
              <circle cx="35" cy="75" r="16" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
              <circle cx="85" cy="75" r="16" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
              <circle cx="135" cy="75" r="16" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
              <circle cx="185" cy="75" r="16" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
              <text x="110" y="103" fill="#38bdf8" fontSize="10" textAnchor="middle" fontWeight="bold">CH 1–8 BNC Video Inputs</text>
            </g>
            {/* Audio In/Out */}
            <g transform="translate(300, 80)">
              <circle cx="25" cy="35" r="14" fill="#dc2626" />
              <text x="25" y="40" fill="#fff" fontSize="8" textAnchor="middle" fontWeight="bold">IN</text>
              <circle cx="25" cy="75" r="14" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
              <text x="25" y="80" fill="#0f172a" fontSize="8" textAnchor="middle" fontWeight="bold">OUT</text>
              <text x="25" y="103" fill="#94a3b8" fontSize="9" textAnchor="middle">Audio RCA</text>
            </g>
            {/* Video Outputs */}
            <g transform="translate(370, 80)">
              <rect width="45" height="40" rx="3" fill="#2563eb" />
              <text x="22" y="25" fill="#fff" fontSize="9" textAnchor="middle" fontWeight="bold">VGA</text>
              <text x="22" y="55" fill="#94a3b8" fontSize="9" textAnchor="middle">1080p</text>
              <rect x="60" y="0" width="50" height="40" rx="3" fill="#6366f1" />
              <text x="85" y="25" fill="#fff" fontSize="9" textAnchor="middle" fontWeight="bold">HDMI</text>
              <text x="85" y="55" fill="#94a3b8" fontSize="9" textAnchor="middle">4K Ultra HD</text>
            </g>
            {/* LAN & USB & Power */}
            <g transform="translate(500, 80)">
              <rect width="45" height="50" rx="4" fill="#10b981" />
              <text x="22" y="30" fill="#fff" fontSize="9" textAnchor="middle" fontWeight="bold">LAN</text>
              <text x="22" y="65" fill="#94a3b8" fontSize="9" textAnchor="middle">10/100M</text>
              <rect x="58" y="0" width="30" height="50" rx="3" fill="#0ea5e9" />
              <text x="73" y="30" fill="#fff" fontSize="8" textAnchor="middle" fontWeight="bold">USB</text>
              <text x="73" y="65" fill="#94a3b8" fontSize="9" textAnchor="middle">Dual</text>
              <rect x="100" y="5" width="40" height="40" rx="20" fill="#f59e0b" />
              <text x="120" y="30" fill="#0f172a" fontSize="8" textAnchor="middle" fontWeight="bold">12V DC</text>
              <text x="120" y="65" fill="#94a3b8" fontSize="9" textAnchor="middle">Power</text>
            </g>
            <text x="400" y="240" fill="#94a3b8" fontSize="11" textAnchor="middle">
              Integrated Surveillance Architecture: SATA 6Gbps HDD Interface inside, H.265+ encoding, P2P Mobile QR Setup
            </text>
          </svg>
        )

      case 'camera-wiring':
        return (
          <svg viewBox="0 0 800 280" className="tech-diagram-svg" aria-label="CCTV Camera Connection & Wiring Diagram">
            <rect width="800" height="280" rx="12" fill="#0f172a" />
            <text x="400" y="32" fill="#38bdf8" textAnchor="middle" fontSize="14" fontWeight="bold" letterSpacing="1">
              SURVEILLANCE CAMERA WIRING & MOUNTING ARCHITECTURE
            </text>
            {/* Camera Unit */}
            <g transform="translate(80, 80)">
              <rect width="180" height="120" rx="10" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
              <circle cx="90" cy="55" r="32" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
              <circle cx="90" cy="55" r="14" fill="#38bdf8" opacity="0.8" />
              <text x="90" y="105" fill="#cbd5e1" fontSize="11" textAnchor="middle" fontWeight="bold">Weatherproof Camera</text>
            </g>
            {/* Cabling connection */}
            <g transform="translate(280, 110)">
              <line x1="0" y1="20" x2="160" y2="20" stroke="#f59e0b" strokeWidth="4" strokeDasharray="6,4" />
              <text x="80" y="12" fill="#f59e0b" fontSize="10" textAnchor="middle" fontWeight="bold">12V DC Regulated Power</text>
              <line x1="0" y1="50" x2="160" y2="50" stroke="#38bdf8" strokeWidth="4" />
              <text x="80" y="72" fill="#38bdf8" fontSize="10" textAnchor="middle" fontWeight="bold">75Ω Coaxial / CAT6 Video Data</text>
            </g>
            {/* DVR Rack Unit */}
            <g transform="translate(460, 80)">
              <rect width="260" height="120" rx="10" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
              <rect x="20" y="25" width="220" height="40" rx="4" fill="#0f172a" stroke="#334155" />
              <text x="130" y="50" fill="#10b981" fontSize="11" textAnchor="middle" fontWeight="bold">Central DVR / NVR Unit</text>
              <text x="130" y="90" fill="#94a3b8" fontSize="10" textAnchor="middle">Continuous 24/7 Surveillance Recording</text>
              <text x="130" y="105" fill="#64748b" fontSize="9" textAnchor="middle">Uplink to Broadband Router for Remote App</text>
            </g>
            <text x="400" y="245" fill="#94a3b8" fontSize="11" textAnchor="middle">
              Standard Installation Topology: Supports RG59 Coaxial, 3+1 CCTV Cable &amp; Cat6 PoE Network Cable
            </text>
          </svg>
        )

      case 'printer-ports':
      case 'thermal-printer-ports':
        return (
          <svg viewBox="0 0 800 280" className="tech-diagram-svg" aria-label="Printer Interface & Paper Flow Diagram">
            <rect width="800" height="280" rx="12" fill="#0f172a" />
            <text x="400" y="32" fill="#38bdf8" textAnchor="middle" fontSize="14" fontWeight="bold" letterSpacing="1">
              PRINTER HARDWARE INTERFACES &amp; CONNECTIVITY SCHEMATIC
            </text>
            {/* Printer Box */}
            <rect x="60" y="65" width="680" height="145" rx="10" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            <g transform="translate(100, 95)">
              <rect width="80" height="70" rx="8" fill="#0284c7" />
              <text x="40" y="35" fill="#fff" fontSize="11" textAnchor="middle" fontWeight="bold">USB-B</text>
              <text x="40" y="52" fill="#e0f2fe" fontSize="9" textAnchor="middle">Host PC Port</text>
              <text x="40" y="85" fill="#94a3b8" fontSize="10" textAnchor="middle">High-Speed 2.0</text>
            </g>
            <g transform="translate(230, 95)">
              <rect width="80" height="70" rx="8" fill="#10b981" />
              <text x="40" y="35" fill="#fff" fontSize="11" textAnchor="middle" fontWeight="bold">LAN RJ-45</text>
              <text x="40" y="52" fill="#d1fae5" fontSize="9" textAnchor="middle">Ethernet</text>
              <text x="40" y="85" fill="#94a3b8" fontSize="10" textAnchor="middle">Office Network</text>
            </g>
            <g transform="translate(360, 95)">
              <rect width="80" height="70" rx="8" fill="#6366f1" />
              <text x="40" y="35" fill="#fff" fontSize="11" textAnchor="middle" fontWeight="bold">Wi-Fi</text>
              <text x="40" y="52" fill="#e0e7ff" fontSize="9" textAnchor="middle">Wireless Direct</text>
              <text x="40" y="85" fill="#94a3b8" fontSize="10" textAnchor="middle">Phone / Laptop</text>
            </g>
            <g transform="translate(490, 95)">
              <rect width="80" height="70" rx="8" fill="#f59e0b" />
              <text x="40" y="35" fill="#fff" fontSize="11" textAnchor="middle" fontWeight="bold">240V AC</text>
              <text x="40" y="52" fill="#fef3c7" fontSize="9" textAnchor="middle">3-Pin Socket</text>
              <text x="40" y="85" fill="#94a3b8" fontSize="10" textAnchor="middle">Surge Protected</text>
            </g>
            <g transform="translate(620, 95)">
              <rect width="70" height="70" rx="8" fill="#ec4899" />
              <text x="35" y="35" fill="#fff" fontSize="10" textAnchor="middle" fontWeight="bold">ADF / POS</text>
              <text x="35" y="52" fill="#fce7f3" fontSize="8" textAnchor="middle">Paper Feed</text>
              <text x="35" y="85" fill="#94a3b8" fontSize="10" textAnchor="middle">Heavy Duty</text>
            </g>
            <text x="400" y="240" fill="#94a3b8" fontSize="11" textAnchor="middle">
              Certified Multi-Standard Connectivity: Windows 11/10, macOS, Linux, Mopria &amp; Apple AirPrint Ready
            </text>
          </svg>
        )

      case 'biometric-terminals':
        return (
          <svg viewBox="0 0 800 280" className="tech-diagram-svg" aria-label="Biometric Terminal Wiring & Access Control Schematic">
            <rect width="800" height="280" rx="12" fill="#0f172a" />
            <text x="400" y="30" fill="#38bdf8" textAnchor="middle" fontSize="13" fontWeight="bold" letterSpacing="1">
              BIOMETRIC ATTENDANCE &amp; ACCESS CONTROL BACKPLANE WIRING SCHEMATIC
            </text>
            {/* Terminal Backplane */}
            <rect x="50" y="55" width="280" height="175" rx="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="190" y="80" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">TERMINAL REAR TERMINALS</text>
            <g transform="translate(70, 95)">
              <rect width="110" height="24" rx="4" fill="#0284c7" />
              <text x="55" y="16" fill="#fff" fontSize="9" textAnchor="middle">TCP/IP RJ-45 LAN</text>
              <rect y="30" width="110" height="24" rx="4" fill="#10b981" />
              <text x="55" y="46" fill="#fff" fontSize="9" textAnchor="middle">Wiegand IN/OUT</text>
              <rect y="60" width="110" height="24" rx="4" fill="#f59e0b" />
              <text x="55" y="76" fill="#0f172a" fontSize="9" fontWeight="bold" textAnchor="middle">Relay COM/NO/NC</text>
              <rect y="90" width="110" height="24" rx="4" fill="#dc2626" />
              <text x="55" y="106" fill="#fff" fontSize="9" textAnchor="middle">+12V DC / GND</text>
            </g>
            {/* Door lock integration */}
            <g transform="translate(390, 65)">
              <rect width="180" height="60" rx="6" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
              <text x="90" y="26" fill="#f59e0b" fontSize="11" fontWeight="bold" textAnchor="middle">Electromagnetic Lock</text>
              <text x="90" y="44" fill="#cbd5e1" fontSize="9" textAnchor="middle">600 Lbs Holding Force</text>
              <line x1="-110" y1="102" x2="0" y2="30" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,3" />
            </g>
            {/* Exit button */}
            <g transform="translate(390, 150)">
              <rect width="180" height="60" rx="6" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
              <text x="90" y="26" fill="#10b981" fontSize="11" fontWeight="bold" textAnchor="middle">Push-To-Exit Switch</text>
              <text x="90" y="44" fill="#cbd5e1" fontSize="9" textAnchor="middle">Emergency Release Button</text>
            </g>
            {/* Wall height guide */}
            <g transform="translate(620, 65)">
              <rect width="140" height="145" rx="8" fill="#0f172a" stroke="#334155" />
              <text x="70" y="28" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">MOUNTING GUIDE</text>
              <text x="70" y="60" fill="#fff" fontSize="14" fontWeight="bold" textAnchor="middle">1.4m – 1.5m</text>
              <text x="70" y="78" fill="#94a3b8" fontSize="9" textAnchor="middle">from finished floor</text>
              <text x="70" y="105" fill="#cbd5e1" fontSize="9" textAnchor="middle">60° Field of View</text>
              <text x="70" y="125" fill="#10b981" fontSize="9" textAnchor="middle">Live Anti-Spoofing</text>
            </g>
            <text x="400" y="250" fill="#94a3b8" fontSize="10" textAnchor="middle">
              Autonomous Operation: Up to 100,000 Offline Records Stored with Instant Cloud / Local Server Sync
            </text>
          </svg>
        )

      case 'hdmi-pinout':
      case 'network-rj45':
      case 'storage-sata':
      default:
        return (
          <svg viewBox="0 0 800 240" className="tech-diagram-svg" aria-label="Component Pinout & Interface Standards">
            <rect width="800" height="240" rx="12" fill="#0f172a" />
            <text x="400" y="32" fill="#38bdf8" textAnchor="middle" fontSize="14" fontWeight="bold" letterSpacing="1">
              HARDWARE INTERFACE PINOUT &amp; TRANSMISSION STANDARDS
            </text>
            <rect x="50" y="60" width="700" height="130" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            <g transform="translate(90, 85)">
              <rect width="140" height="75" rx="6" fill="#0284c7" />
              <text x="70" y="32" fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">Differential Pairs</text>
              <text x="70" y="52" fill="#e0f2fe" fontSize="9" textAnchor="middle">100% Shielded Copper</text>
            </g>
            <g transform="translate(260, 85)">
              <rect width="140" height="75" rx="6" fill="#6366f1" />
              <text x="70" y="32" fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">Gold-Plated Pins</text>
              <text x="70" y="52" fill="#e0e7ff" fontSize="9" textAnchor="middle">Corrosion Resistant</text>
            </g>
            <g transform="translate(430, 85)">
              <rect width="140" height="75" rx="6" fill="#10b981" />
              <text x="70" y="32" fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">Low Latency Bus</text>
              <text x="70" y="52" fill="#d1fae5" fontSize="9" textAnchor="middle">Zero Signal Jitter</text>
            </g>
            <g transform="translate(600, 85)">
              <rect width="120" height="75" rx="6" fill="#f59e0b" />
              <text x="60" y="32" fill="#0f172a" fontSize="11" fontWeight="bold" textAnchor="middle">EMI Shielded</text>
              <text x="60" y="52" fill="#451a03" fontSize="9" textAnchor="middle">Ferrite Choke Cores</text>
            </g>
            <text x="400" y="215" fill="#94a3b8" fontSize="11" textAnchor="middle">
              Engineered in Strict Accordance with International Hardware Standards &amp; Tested by ARS Computers
            </text>
          </svg>
        )
    }
  }

  return (
    <div className="product-tech-diagram-container">
      <div className="diagram-header">
        <div className="diagram-title-wrap">
          <span className="diagram-badge-icon">📐</span>
          <div>
            <h4 className="diagram-title">Hardware Architecture &amp; Interface Layout</h4>
            <span className="diagram-subtitle">{productName} — Certified Technical Standard Schematic</span>
          </div>
        </div>
        <span className="diagram-disclaimer-pill">🛡️ Technical Hardware Schematic (Standard Interface Architecture)</span>
      </div>
      <div className="diagram-canvas-wrap">
        {renderDiagram()}
      </div>
    </div>
  )
}
