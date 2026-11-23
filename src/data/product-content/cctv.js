/**
 * ARS Computers — CCTV & surveillance product content.
 *
 * Where the catalogue lists a manufacturer series rather than an exact part
 * number, configuration-dependent values are labelled as such instead of being
 * guessed. Recorder, lens and power details must be matched to the selected
 * model before installation.
 */

export const CCTV_CONTENT = {
  'hikvision-full-hd-dome-camera': {
    description:
      'The Hikvision Full HD dome camera is an indoor ceiling-mount surveillance camera for offices, retail floors, corridors and reception areas. The dome housing protects the lens and gives a low-profile ceiling appearance, while infrared LEDs support low-light monitoring. This listing covers the Hikvision Full HD dome models supplied by ARS Computers; the exact resolution, lens, IR range and recorder compatibility are confirmed against the selected model before installation.',
    keyFeatures: [
      'Hikvision indoor ceiling-mount dome camera',
      'Full HD resolution on the listed series',
      'Infrared night vision LEDs',
      'Wide-angle lens options',
      'Low-profile dome housing for offices and retail',
      'Exact model and recorder compatibility confirmed with sales'
    ],
    specs: {
      camera_type: 'Indoor dome camera',
      model_number: 'Hikvision Full HD Dome series — exact model confirmed with sales',
      resolution: '2 MP Full HD (1920 x 1080) on the listed series',
      sensor: 'High-sensitivity CMOS sensor (model-dependent)',
      lens: 'Fixed wide-angle lens (focal length confirmed per model)',
      viewing_angle: 'Configuration-dependent — confirm with sales',
      night_vision: 'Infrared LEDs for low-light monitoring',
      ir_range: 'Configuration-dependent — confirm with sales',
      environment: 'Indoor ceiling mount',
      connectivity: 'HD analog or IP depending on model — confirm with sales',
      power: '12 V DC or PoE depending on model — confirm with sales',
      storage_compatibility: 'DVR/NVR storage — confirm recorder model',
      operating_temperature: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Matches Hikvision DVR/NVR recorders and standard CCTV power supplies, subject to the exact camera model. Confirm the recorder channel type (analog or IP), power method and cable run with ARS Computers before installation.',
    boxContents:
      'Camera unit, mounting hardware and documentation. Power supply, cable and recorder are supplied separately unless included on the quotation.',
    specsVerified: 'partially_verified',
    specSource:
      'Hikvision Full HD dome series listing. Resolution class and infrared feature are series-level; exact model number, lens and IR range must be confirmed with ARS Computers.'
  },

  'cp-plus-full-hd-dome-camera': {
    description:
      'The CP PLUS Full HD dome camera is an indoor surveillance unit for shops, offices, homes and small commercial premises. It uses a high-sensitivity sensor and automatic IR-cut switching to deliver clear colour images in daylight and infrared-assisted images in low light. The compact dome enclosure suits ceiling installation where a discreet camera is preferred. Exact model, resolution, lens and recorder compatibility are confirmed before supply.',
    keyFeatures: [
      'CP PLUS indoor dome surveillance camera',
      'Full HD resolution on the listed series',
      'High-sensitivity image sensor',
      'Automatic IR-cut filter for day/night switching',
      'Compact low-profile enclosure',
      'Exact model and recorder compatibility confirmed with sales'
    ],
    specs: {
      camera_type: 'Indoor dome camera',
      model_number: 'CP PLUS HD Dome series — exact model confirmed with sales',
      resolution: '2 MP Full HD (1920 x 1080) on the listed series',
      sensor: 'High-sensitivity CMOS sensor (model-dependent)',
      lens: 'Fixed wide-angle lens (focal length confirmed per model)',
      viewing_angle: 'Configuration-dependent — confirm with sales',
      night_vision: 'Infrared LEDs with automatic IR-cut switching',
      ir_range: 'Configuration-dependent — confirm with sales',
      environment: 'Indoor ceiling mount',
      connectivity: 'HD analog or IP depending on model — confirm with sales',
      power: '12 V DC or PoE depending on model — confirm with sales',
      storage_compatibility: 'DVR/NVR storage — confirm recorder model',
      operating_temperature: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Works with compatible CP PLUS or third-party DVR/NVR recorders, subject to the exact camera model. Confirm recorder channel type, power supply and cable run with ARS Computers before installation.',
    boxContents:
      'Camera unit, mounting hardware and documentation. Power supply, cable and recorder are supplied separately unless included on the quotation.',
    specsVerified: 'partially_verified',
    specSource:
      'CP PLUS HD Dome series listing. Resolution class and IR-cut feature are series-level; exact model number, lens and IR range must be confirmed with ARS Computers.'
  },

  'smart-outdoor-wifi-bullet-camera': {
    description:
      'This smart outdoor Wi-Fi bullet camera is a wireless surveillance option for gates, parking areas, compounds and building exteriors. Dual high-gain antennas support a more stable Wi-Fi link, and the weatherproof housing and wall bracket are designed for outdoor mounting. Motion detection alerts and smartphone viewing let owners monitor the site remotely. Because this is a solution listing, the exact resolution, storage method and app ecosystem are confirmed with sales.',
    keyFeatures: [
      'Outdoor Wi-Fi bullet camera with weatherproof housing',
      'Dual high-gain wireless antennas',
      'Motion detection alerts to a smartphone app',
      'Remote live view and playback via mobile app',
      'Wall-mount bracket included',
      'Exact model, resolution and storage confirmed with sales'
    ],
    specs: {
      camera_type: 'Outdoor Wi-Fi bullet camera',
      model_number: 'Smart Wi-Fi Bullet series — exact model confirmed with sales',
      resolution: 'Configuration-dependent — confirm with sales',
      sensor: 'CMOS sensor (model-dependent)',
      lens: 'Fixed lens (focal length confirmed per model)',
      viewing_angle: 'Configuration-dependent — confirm with sales',
      night_vision: 'Infrared or white-light night vision depending on model',
      environment: 'Outdoor wall mount',
      weather_rating: 'Weatherproof housing — IP rating confirmed per model',
      connectivity: '2.4 GHz Wi-Fi; wired Ethernet on supported models',
      power: '12 V DC adapter (model-dependent)',
      storage_compatibility: 'microSD card and/or NVR — confirm with sales',
      audio: 'Two-way audio on supported models',
      operating_temperature: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Requires a 2.4 GHz Wi-Fi network and a compatible smartphone app. Confirm the exact model, microSD support, power adapter and NVR compatibility with ARS Computers sales before installation.',
    boxContents:
      'Camera unit, wall-mount bracket, mounting screws, power adapter (if included by the selected model) and quick-start documentation.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Multi-brand smart Wi-Fi bullet solution listing. Exact model, resolution, IP rating and app support are confirmed by ARS Computers at the time of sale.'
  },

  'hikvision-colorvu-4k-bullet-camera': {
    description:
      'The Hikvision ColorVu 4K bullet camera is designed for outdoor surveillance where colour detail matters at night. It combines 4K imaging with an F1.0 large-aperture lens and supplemental warm light to produce full-colour images in very low light. The bullet housing and bracket suit boundary walls, gates, driveways and commercial exteriors. Exact model number, lens, IR/warm-light range and recorder compatibility are confirmed before installation.',
    keyFeatures: [
      'Hikvision ColorVu 4K outdoor bullet camera',
      '24/7 full-colour imaging in low light',
      'F1.0 super-aperture lens',
      'Supplemental warm light for night colour',
      'Weatherproof outdoor housing',
      'Exact model and recorder compatibility confirmed with sales'
    ],
    specs: {
      camera_type: 'Outdoor bullet camera',
      model_number: 'Hikvision ColorVu 4K series — exact model confirmed with sales',
      resolution: '8 MP 4K on the listed series',
      sensor: 'High-sensitivity CMOS sensor (model-dependent)',
      lens: 'F1.0 large-aperture lens (focal length confirmed per model)',
      viewing_angle: 'Configuration-dependent — confirm with sales',
      night_vision: 'Full-colour night imaging with warm-light supplement',
      full_color: '24/7 colour imaging on supported ColorVu models',
      ir_range: 'Warm-light range confirmed per model',
      environment: 'Outdoor wall or pole mount',
      weather_rating: 'Weatherproof housing — IP rating confirmed per model',
      connectivity: 'HD analog or IP depending on model — confirm with sales',
      power: '12 V DC or PoE depending on model — confirm with sales',
      storage_compatibility: 'DVR/NVR storage — confirm recorder model',
      operating_temperature: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Requires a recorder and power source matched to the exact ColorVu model. Confirm whether the selected unit is HD analog or IP, and check PoE availability, cable type and NVR channel capacity with ARS Computers.',
    boxContents:
      'Camera unit, mounting hardware and documentation. Power supply, cable and recorder are supplied separately unless included on the quotation.',
    specsVerified: 'partially_verified',
    specSource:
      'Hikvision ColorVu 4K series listing. 4K resolution and F1.0 aperture are series-level; exact model number, lens and warm-light range must be confirmed with ARS Computers.'
  },

  'multi-channel-cctv-dvr-nvr-recorder': {
    description:
      'This multi-channel CCTV surveillance video recorder family supports 4-channel, 8-channel, and 16-channel surveillance installations. The 4-channel DVR tier provides H.264 real-time 1080p recording, dedicated front-panel LED channel indicators (CH1–CH4), and USB connectivity. The 8-channel NVR tier supports complete IP CCTV deployments with an 8-channel NVR and an 8-port PoE switch; pictured package components (including 8 IP cameras, 1TB WD hard disk, 4U rack, and cabling) represent a complete solution package and are supplied as itemised on the customer quotation. The 16-channel tier accommodates commercial multi-camera installations, with exact recorder hardware, inputs, and storage capacity configured to order. View 3 is an illustrative reference image until a dedicated 16-channel photograph is provided.',
    keyFeatures: [
      '4-Channel standalone DVR tier with H.264 1080p real-time recording, CH1–CH4 channel LEDs, and front USB',
      '8-Channel IP CCTV security solution kit featuring an 8-channel NVR and 8-port PoE switch',
      '8-Channel kit graphic illustrates 8 IP cameras, 1TB WD HDD, 4U rack, and cabling (package items quoted per order)',
      '16-Channel commercial surveillance tier (configuration-dependent; exact model and hardware quoted to order)',
      'Tier-specific hardware: channel capacity, inputs, outputs, and storage matched to customer installation requirements'
    ],
    specs: {
      device_type: 'Multi-Channel Standalone CCTV Video Recorder (DVR/NVR)',
      model_number: 'Multi-Channel Surveillance Series (4-CH DVR / 8-CH NVR / 16-CH DVR/NVR)',
      channels: '4-Channel (4CH DVR), 8-Channel (8CH NVR), and 16-Channel options',
      four_channel_specs: '4CH DVR: H.264 video compression, 1080p real-time recording, CH1–CH4 LEDs, front USB',
      eight_channel_specs: '8CH NVR Kit: 8-channel NVR, 8-port PoE switch; pictured kit items supplied as quoted',
      sixteen_channel_specs: '16CH DVR/NVR: Configuration-dependent; exact model, inputs, and storage confirmed on quotation',
      video_compression: 'H.264 on 4CH unit; model-dependent on 8CH and 16CH units',
      recording_resolution: '1080p Real-Time on 4CH DVR; configuration-dependent on 8CH and 16CH options',
      storage_support: 'Configuration-dependent (1TB WD HDD pictured in 8CH kit; hard drives quoted per customer requirements)',
      operating_temperature: 'Configuration-dependent — confirm with sales'
    },
    compatibility:
      'Camera technology (HD analog, AHD, TVI, CVI, or IP) must match the recorder inputs. Network viewing, monitor resolution, PoE power, and storage capacity are configured to site requirements and confirmed on quotation.',
    boxContents:
      'Standard supply includes the recorder unit, power adapter, USB mouse, and documentation. When ordering the pictured 8-Camera IP CCTV Kit solution, package items (such as the 8-port PoE switch, 8 IP cameras, 1TB WD surveillance HDD, 4U rack, and CAT6 cabling) are supplied as configured on the customer specific quotation. For standalone 4-channel and 16-channel orders, hard drives and cameras are quoted separately.',
    specsVerified: 'configuration_dependent',
    specSource:
      'Hardware attributes verified from physical image labels (4CH DVR: H.264, 1080p real-time, CH1–CH4 LEDs, USB; 8-camera kit graphic: 8CH NVR, 8-port PoE switch, 8 IP cameras, 1TB WD HDD, 4U rack). 16-channel specifications and illustrative image are configuration-dependent and confirmed by ARS Computers at the time of quotation.'
  },

  'cp-plus-360-ptz-smart-camera': {
    description:
      'The CP PLUS 360-degree pan-tilt smart Wi-Fi camera provides wide indoor coverage from a single ceiling or shelf position. Motorised horizontal pan and vertical tilt let the camera sweep a room, while motion tracking follows movement automatically. Two-way audio supports conversation through the mobile app, making the camera useful for home monitoring, childcare and small-office oversight. Exact resolution, storage and app features are confirmed with sales.',
    keyFeatures: [
      'Motorised 360-degree horizontal pan',
      'Vertical tilt and auto motion tracking',
      'Two-way audio via the mobile app',
      'Indoor Wi-Fi monitoring from a single camera',
      'Mobile live view and playback',
      'Exact model, resolution and storage confirmed with sales'
    ],
    specs: {
      camera_type: 'Indoor pan-tilt Wi-Fi camera',
      model_number: 'CP PLUS 360 Pan-Tilt series — exact model confirmed with sales',
      resolution: 'Configuration-dependent — confirm with sales',
      sensor: 'CMOS sensor (model-dependent)',
      lens: 'Fixed wide-angle lens (focal length confirmed per model)',
      pan_range: '360-degree horizontal pan',
      tilt_range: 'Configuration-dependent — confirm with sales',
      tracking: 'Automatic motion tracking on supported models',
      night_vision: 'Infrared night vision (model-dependent)',
      audio: 'Two-way audio',
      microphone: 'Built-in microphone and speaker',
      environment: 'Indoor ceiling or shelf mount',
      connectivity: '2.4 GHz Wi-Fi',
      power: '5 V/12 V DC adapter (model-dependent)',
      storage_compatibility: 'microSD card and/or NVR — confirm with sales'
    },
    compatibility:
      'Requires a 2.4 GHz Wi-Fi network and the CP PLUS mobile app. Confirm microSD capacity, cloud subscription options and NVR compatibility for the exact model with ARS Computers sales.',
    boxContents:
      'Camera unit, mounting kit, power adapter (if included by the selected model) and quick-start documentation.',
    specsVerified: 'configuration_dependent',
    specSource:
      'CP PLUS 360 pan-tilt series listing. Pan range, motion tracking and two-way audio are series-level; exact resolution, storage and app features are confirmed by ARS Computers.'
  }
}
