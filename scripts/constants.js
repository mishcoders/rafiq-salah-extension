// Prayer names in Arabic
const PRAYER_NAMES = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

// Country to calculation method mapping
const countryMethodMap = {
  EG: 5,
  DZ: 5,
  SD: 5,
  IQ: 3,
  MA: 5,
  SA: 4,
  YE: 3,
  JO: 3,
  AE: 8,
  LY: 5,
  PS: 3,
  OM: 8,
  KW: 9,
  MR: 3,
  QA: 10,
  BH: 8,
  LB: 3,
  SY: 3,
  TN: 7,
};

// Calculation method names in Arabic
const CALCULATION_METHODS = {
  auto: 'اختيار تلقائي',
  2: 'الجمعية الإسلامية لأمريكا الشمالية',
  3: 'رابطة العالم الإسلامي',
  4: 'جامعة أم القرى',
  5: 'الهيئة المصرية للمساحة',
  7: 'جامعة العلوم التطبيقية، كراتشي',
  8: 'معهد الجيوفيزياء، طهران',
  9: 'الخليج العربي',
  10: 'قطر',
};

// Aladhan API configuration
const API_CONFIG = {
  baseUrl: 'https://api.aladhan.com/v1/timingsByCity',
  school: 0,
  latitudeAdjustmentMethod: 'NONE',
};

// Geolocation config
const GEO_CONFIG = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 300000,
};

// Distance threshold for auto-detection (km)
const MAX_DETECTION_DISTANCE = 500;
