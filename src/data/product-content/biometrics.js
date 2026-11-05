/**
 * ARS Computers — Biometric, attendance and access-control product content.
 *
 * Capacity figures, firmware features and software compatibility vary across
 * device families. Values that require the exact model are labelled as
 * configuration-dependent instead of being estimated.
 */

export const BIOMETRIC_CONTENT = {
  'electromagnetic-door-access-controllers': {
    description:
      'This access-control package supplies the locking and exit hardware around a biometric or RFID door terminal. Electromagnetic locks hold the door closed until the controller releases them, while brackets, exit buttons and break-glass units complete the installation. The listing covers 600 lb and 1200 lb lock options and compatible accessories supplied by ARS Computers. Holding force, door type, power and controller compatibility are confirmed before installation.',
    keyFeatures: [
      'Electromagnetic door lock and access-control hardware',
      'Compatible with biometric and RFID terminals',
      '600 lb and 1200 lb holding-force options',
      'L/Z mounting brackets and exit devices available',
      'Emergency break-glass option for safe exit',
      'Exact lock and controller configuration confirmed with sales'
    ],
    specs: {
      device_type: 'Electromagnetic lock and access-control kit',
      model_number: 'Door access series — exact lock model confirmed with sales',
      auth_methods: 'Works with biometric, RFID or keypad terminals (terminal supplied separately)',
      holding_force: '600 lb or 1200 lb options — confirm with sales',
      fail_safe: 'Fail-safe release on power loss on supported locks',
      bracket: 'L/Z mounting brackets available',
      exit_device: 'Exit button and break-glass options available',
      door_type: 'Wood, metal and glass doors with the correct bracket',
      power: '12/24 V DC, controller-dependent',
      access_control: 'Relay control from compatible access terminal',
      installation: 'Professional installation recommended'
    },
    compatibility:
      'Must be matched to the door material, frame type and access controller. Confirm holding force, voltage, bracket type and whether a break-glass exit is required with ARS Computers before installation.',
    boxContents:
      'Lock unit and selected mounting hardware. Exit button, break-glass unit, power supply and controller are included only if specified on the quotation.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand door access solution listing. Exact lock model, holding force and accessory bundle are confirmed by ARS Computers at the time of sale.'
  },

  'hikvision-minmoe-face-terminal': {
    description:
      'The Hikvision MinMoe face recognition terminal provides touchless attendance and door access using AI face verification. A dual-lens camera helps reject photo and video spoofing, and the colour touchscreen gives clear on-device feedback. It is suited to offices, factories, schools and controlled entry points. This listing covers the MinMoe models supplied by ARS Computers; user capacity, firmware features, card support and software integration are confirmed per model.',
    keyFeatures: [
      'Hikvision MinMoe AI face recognition terminal',
      'Dual-lens camera with anti-spoofing protection',
      'Touchscreen colour display',
      'Touchless attendance and door access',
      'Network synchronisation and relay output',
      'Exact model and capacity confirmed with sales'
    ],
    specs: {
      device_type: 'AI face recognition access and attendance terminal',
      model_number: 'Hikvision MinMoe series — exact model confirmed with sales',
      auth_methods: 'Face recognition; card support on selected models',
      sensor_type: 'Dual-lens camera with anti-spoofing',
      recognition_speed: 'Sub-second class verification — exact rating confirmed with sales',
      anti_spoofing: 'Dual-lens liveness detection',
      user_capacity: 'Configuration-dependent — confirm with sales',
      face_capacity: 'Configuration-dependent — confirm with sales',
      card_capacity: 'Configuration-dependent — confirm with sales',
      log_capacity: 'Configuration-dependent — confirm with sales',
      display_type: 'Colour touchscreen',
      connectivity: 'TCP/IP; Wi-Fi on selected models',
      access_control: 'Door relay and Wiegand interface on supported models',
      software: 'Hikvision attendance/access software — version confirmed with sales',
      power: '12 V DC or PoE depending on model'
    },
    compatibility:
      'Integrates with Hikvision access-control and attendance software and compatible door locks. Confirm the exact model, card technology, relay/Wiegand requirements and software licence with ARS Computers sales.',
    boxContents:
      'Terminal unit, mounting bracket, power adapter where supplied, and documentation. Door lock, controller and network cabling are supplied separately unless included on the quotation.',
    specsVerified: 'partially_verified',
    specSource:
      'Hikvision MinMoe series listing. Dual-lens anti-spoofing, touchscreen and face recognition are series-level; exact model, capacity and firmware features are confirmed by ARS Computers.'
  },

  'hikvision-wall-mount-face-terminal': {
    description:
      'This Hikvision wall-mount face and attendance terminal is designed for entrance walls, reception areas and staff rooms where a fixed, angled viewing position is needed. It supports AI face verification, mask detection and voice prompts on supported models, and can synchronise attendance over TCP/IP. The wall bracket keeps the camera at a consistent height for reliable recognition. Exact model, capacity and access-control features are confirmed with sales.',
    keyFeatures: [
      'Hikvision wall-mount AI face and attendance terminal',
      'Wall bracket for fixed entrance mounting',
      'Mask detection and voice prompts on supported models',
      'Touchless face verification',
      'TCP/IP attendance synchronisation',
      'Exact model and capacity confirmed with sales'
    ],
    specs: {
      device_type: 'Wall-mount face recognition attendance terminal',
      model_number: 'Hikvision wall-mount series — exact model confirmed with sales',
      auth_methods: 'Face recognition; card support on selected models',
      sensor_type: 'Dual-lens camera with anti-spoofing on supported models',
      recognition_speed: 'Sub-second class verification — exact rating confirmed with sales',
      anti_spoofing: 'Liveness detection on supported models',
      user_capacity: 'Configuration-dependent — confirm with sales',
      face_capacity: 'Configuration-dependent — confirm with sales',
      log_capacity: 'Configuration-dependent — confirm with sales',
      display_type: 'Colour display (model-dependent)',
      connectivity: 'TCP/IP; Wi-Fi on selected models',
      access_control: 'Door relay and Wiegand interface on supported models',
      software: 'Hikvision attendance/access software — version confirmed with sales',
      installation: 'Wall-mount bracket included',
      power: '12 V DC or PoE depending on model'
    },
    compatibility:
      'Integrates with Hikvision attendance/access software and compatible door hardware. Confirm the exact model, mask-detection firmware, relay/Wiegand requirements and mounting height with ARS Computers sales.',
    boxContents:
      'Terminal unit, wall-mount bracket, mounting screws, power adapter where supplied, and documentation. Door lock and controller are supplied separately unless included on the quotation.',
    specsVerified: 'partially_verified',
    specSource:
      'Hikvision wall-mount face terminal listing. Wall mounting, mask detection and voice prompt features are series-level; exact model, capacity and firmware are confirmed by ARS Computers.'
  },

  'mantra-optical-fingerprint-scanner': {
    description:
      'The Mantra optical fingerprint scanner is a USB biometric peripheral for employee attendance, identity verification and Aadhaar-style enrolment workflows. The optical sensor reads fingerprints through a scratch-resistant surface, and USB power keeps installation simple. It is typically paired with attendance or enrolment software on a Windows PC. Exact model, sensor resolution, SDK support and certification status are confirmed with sales.',
    keyFeatures: [
      'Mantra optical fingerprint scanner',
      'Scratch-resistant optical sensor surface',
      'USB interface and bus power',
      'Suitable for attendance and identity enrolment',
      'Compact desktop peripheral',
      'Exact model and SDK support confirmed with sales'
    ],
    specs: {
      device_type: 'USB optical fingerprint scanner',
      model_number: 'Mantra optical fingerprint series — exact model confirmed with sales',
      auth_methods: 'Fingerprint',
      sensor_type: 'Optical fingerprint sensor',
      recognition_speed: 'Configuration-dependent — confirm with sales',
      fingerprint_capacity: 'Software-dependent — scanner stores no templates by itself',
      connectivity: 'USB',
      software: 'Windows attendance/enrolment software; SDK availability confirmed with sales',
      power: 'USB bus powered',
      dimensions: 'Configuration-dependent — confirm with sales',
      operating_temperature: 'Configuration-dependent — confirm with sales',
      installation: 'Desktop USB connection'
    },
    compatibility:
      'Requires compatible Windows attendance, HR or enrolment software and the correct SDK/driver for the exact model. Confirm Aadhaar/UIDAI certification status and software integration with ARS Computers sales before purchase.',
    boxContents:
      'Scanner unit, USB cable and documentation. Software licence and installation service are supplied only if specified on the quotation.',
    specsVerified: 'partially_verified',
    specSource:
      'Mantra optical fingerprint scanner listing. Optical sensor and USB interface are series-level; exact model, SDK and certification are confirmed by ARS Computers.'
  },

  'essl-rfid-card-keypad-terminal': {
    description:
      'The eSSL RFID card and keypad terminal is an attendance and access device for offices, factories and sites that use proximity cards or PIN entry. Staff present a card or enter a PIN at the tactile keypad, and the terminal logs the event for attendance and payroll export. This listing covers the eSSL RFID/keypad models supplied by ARS Computers. Card frequency, user capacity, connectivity and software version are confirmed with sales.',
    keyFeatures: [
      'eSSL RFID card and keypad attendance terminal',
      'Proximity card reader plus 16-key tactile keypad',
      'Dual-factor card and PIN authentication option',
      'Attendance logging and payroll export',
      'Network or USB connectivity depending on model',
      'Exact model and card frequency confirmed with sales'
    ],
    specs: {
      device_type: 'RFID and keypad attendance terminal',
      model_number: 'eSSL RFID and keypad series — exact model confirmed with sales',
      auth_methods: 'RFID card and PIN keypad',
      sensor_type: 'Proximity card reader',
      user_capacity: 'Configuration-dependent — confirm with sales',
      card_capacity: 'Configuration-dependent — confirm with sales',
      log_capacity: 'Configuration-dependent — confirm with sales',
      display_type: 'LCD display (model-dependent)',
      connectivity: 'TCP/IP, USB or RS485 depending on model',
      access_control: 'Door relay output on supported models',
      software: 'eSSL attendance and payroll software — version confirmed with sales',
      reporting: 'Attendance reports and payroll export via eSSL software',
      power: '12 V DC adapter',
      operating_temperature: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Must use compatible RFID cards at the correct frequency. Confirm the exact model, card type, connectivity and eSSL software licence with ARS Computers sales before deployment.',
    boxContents:
      'Terminal unit, power adapter where supplied, mounting hardware and documentation. RFID cards and software licence are supplied separately unless included on the quotation.',
    specsVerified: 'partially_verified',
    specSource:
      'eSSL RFID and keypad series listing. Card/keypad authentication and attendance export are series-level; exact model, capacity and card frequency are confirmed by ARS Computers.'
  },

  'cp-plus-rfid-attendance-device': {
    description:
      'The CP PLUS biometric RFID card attendance device is a proximity-card punch terminal for staff attendance in offices, shops and small factories. It reads RFID cards quickly, gives audible confirmation, and stores punch logs so attendance can continue during a network interruption. This listing covers the CP PLUS RFID terminal models supplied by ARS Computers. Card frequency, user capacity, connectivity and software support are confirmed with sales.',
    keyFeatures: [
      'CP PLUS RFID card attendance terminal',
      'High-speed proximity card reader',
      'Audible verification beeper',
      'Offline log storage during network interruption',
      'Compact wall-mount design',
      'Exact model and card frequency confirmed with sales'
    ],
    specs: {
      device_type: 'RFID card attendance terminal',
      model_number: 'CP PLUS RFID terminal series — exact model confirmed with sales',
      auth_methods: 'RFID proximity card',
      sensor_type: 'Proximity card reader',
      recognition_speed: 'High-speed card read — exact rating confirmed with sales',
      user_capacity: 'Configuration-dependent — confirm with sales',
      card_capacity: 'Configuration-dependent — confirm with sales',
      log_capacity: 'Configuration-dependent — confirm with sales',
      display_type: 'LCD display (model-dependent)',
      connectivity: 'TCP/IP or USB depending on model',
      access_control: 'Door relay output on supported models',
      software: 'CP PLUS attendance software — version confirmed with sales',
      reporting: 'Attendance reports and export via CP PLUS software',
      power: '12 V DC adapter',
      installation: 'Wall mount'
    },
    compatibility:
      'Requires compatible RFID cards at the correct frequency and the matching CP PLUS attendance software. Confirm the exact model, card type and connectivity with ARS Computers sales.',
    boxContents:
      'Terminal unit, power adapter where supplied, mounting hardware and documentation. RFID cards and software licence are supplied separately unless included on the quotation.',
    specsVerified: 'partially_verified',
    specSource:
      'CP PLUS RFID terminal series listing. Proximity card reading and offline log storage are series-level; exact model, capacity and card frequency are confirmed by ARS Computers.'
  }
}
