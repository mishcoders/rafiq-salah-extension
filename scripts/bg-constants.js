// Background script constants

const PRAYER_NAMES = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

const COUNTRY_METHOD_MAP = {
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

const API_CONFIG = {
  baseUrl: 'https://api.aladhan.com/v1/timingsByCity',
  school: 0,
  latitudeAdjustmentMethod: 'NONE',
};

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const SNOOZE_MINUTES = 5;
const NOTIFICATION_AUTO_CLEAR_MS = 120000; // 2 minutes
const POSTPONE_VALIDITY_MS = 24 * 60 * 60 * 1000; // 24 hours
const LATE_REMINDER_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
