/**
 * City translations for bilingual display
 * Maps city names (as returned by API) to their Arabic translations
 * Covers major Islamic cities and capitals
 */
const CityTranslations = {
    // Saudi Arabia
    'Abha': 'أبها',
    'Abqaiq': 'بقيق',
    "Al Ahsa": 'الأحساء',
    'Al Bahah': 'الباحة',
    "Al Jubail": 'الجبيل',
    "Al Kharj": 'الخرج',
    "Al Khobar": 'الخبر',
    "Al Qatif": 'القطيف',
    "Al Qurayyat": 'القريات',
    "Arar": 'عرعر',
    "Buraydah": 'بريدة',
    "Dammam": 'الدمام',
    "Dhahran": 'الظهران',
    "Hafar Al-Batin": 'حفر الباطن',
    "Hail": 'حائل',
    "Jazan": 'جازان',
    "Jeddah": 'جدة',
    "Jizan": 'جازان',
    "Khamis Mushait": 'خميس مشيط',
    "Makkah": 'مكة المكرمة',
    "Madinah": 'المدينة المنورة',
    "Mecca": 'مكة المكرمة',
    "Medina": 'المدينة المنورة',
    "Najran": 'نجران',
    "Riyadh": 'الرياض',
    "Sakaka": 'سكاكا',
    "Tabuk": 'تبوك',
    "Taif": 'الطائف',
    "Yanbu": 'ينبع',

    // Egypt
    "Alexandria": 'الإسكندرية',
    "Aswan": 'أسوان',
    "Asyut": 'أسيوط',
    "Banha": 'بنها',
    "Beni Suef": 'بني سويف',
    "Cairo": 'القاهرة',
    "Damanhur": 'دمنهور',
    "Damietta": 'دمياط',
    "El Arish": 'العريش',
    "El Mansoura": 'المنصورة',
    "El Minya": 'المنيا',
    "Faiyum": 'الفيوم',
    "Giza": 'الجيزة',
    "Hurghada": 'الغردقة',
    "Ismailia": 'الإسماعيلية',
    "Kafr El Sheikh": 'كفر الشيخ',
    "Luxor": 'الأقصر',
    "Marsa Matruh": 'مرسى مطروح',
    "Port Said": 'بورسعيد',
    "Qena": 'قنا',
    "Sharm El Sheikh": 'شرم الشيخ',
    "Sohag": 'سوهاج',
    "Suez": 'السويس',
    "Tanta": 'طنطا',
    "Zagazig": 'الزقازيق',

    // UAE
    "Abu Dhabi": 'أبوظبي',
    "Ajman": 'عجمان',
    "Al Ain": 'العين',
    "Dubai": 'دبي',
    "Fujairah": 'الفجيرة',
    "Ras Al Khaimah": 'رأس الخيمة',
    "Sharjah": 'الشارقة',
    "Umm Al Quwain": 'أم القيوين',

    // Jordan
    "Amman": 'عمان',
    "Aqaba": 'العقبة',
    "Irbid": 'إربد',
    "Jerash": 'جرش',
    "Madaba": 'مأدبا',
    "Mafraq": 'المفرق',
    "Salt": 'السلط',
    "Zarqa": 'الزرقاء',

    // Lebanon
    "Beirut": 'بيروت',
    "Sidon": 'صيدا',
    "Tripoli": 'طرابلس',
    "Tyre": 'صور',

    // Syria
    "Aleppo": 'حلب',
    "Damascus": 'دمشق',
    "Hama": 'حماة',
    "Homs": 'حمص',
    "Latakia": 'اللاذقية',
    "Raqqa": 'الرقة',

    // Iraq
    "Baghdad": 'بغداد',
    "Basra": 'البصرة',
    "Erbil": 'أربيل',
    "Fallujah": 'الفلوجة',
    "Kirkuk": 'كركوك',
    "Mosul": 'الموصل',
    "Najaf": 'النجف',
    "Nasiriyah": 'الناصرية',
    "Ramadi": 'الرمادي',
    "Sulaymaniyah": 'السليمانية',

    // Kuwait
    "Kuwait City": 'مدينة الكويت',
    "Al Ahmadi": 'الأحمدي',
    "Hawalli": 'حولي',
    "Salmiya": 'السالمية',

    // Qatar
    "Doha": 'الدوحة',
    "Al Khor": 'الخور',
    "Al Rayyan": 'الريان',
    "Al Wakrah": 'الوكرة',

    // Bahrain
    "Manama": 'المنامة',
    "Muharraq": 'المحرق',
    "Riffa": 'الرفاع',

    // Oman
    "Muscat": 'مسقط',
    "Salalah": 'صلالة',
    "Sohar": 'صحار',
    "Nizwa": 'نزوى',

    // Yemen
    "Aden": 'عدن',
    "Hodeidah": 'الحديدة',
    "Sanaa": 'صنعاء',
    "Taizz": 'تعز',

    // Palestine
    "Bethlehem": 'بيت لحم',
    "Gaza": 'غزة',
    "Hebron": 'الخليل',
    "Jericho": 'أريحا',
    "Jerusalem": 'القدس',
    "Nablus": 'نابلس',
    "Ramallah": 'رام الله',

    // Morocco
    "Agadir": 'أغادير',
    "Casablanca": 'الدار البيضاء',
    "Fez": 'فاس',
    "Marrakech": 'مراكش',
    "Meknes": 'مكناس',
    "Oujda": 'وجدة',
    "Rabat": 'الرباط',
    "Tangier": 'طنجة',
    "Tetouan": 'تطوان',

    // Algeria
    "Algiers": 'الجزائر العاصمة',
    "Annaba": 'عنابة',
    "Constantine": 'قسنطينة',
    "Oran": 'وهران',

    // Tunisia
    "Sfax": 'صفاقس',
    "Sousse": 'سوسة',
    "Tunis": 'تونس',

    // Libya
    "Benghazi": 'بنغازي',
    "Misrata": 'مصراتة',
    "Tripoli": 'طرابلس',

    // Sudan
    "Khartoum": 'الخرطوم',
    "Omdurman": 'أم درمان',
    "Port Sudan": 'بورتسودان',

    // Mauritania
    "Nouakchott": 'نواكشوط',

    // Somalia
    "Mogadishu": 'مقديشو',

    // Turkey
    "Ankara": 'أنقرة',
    "Antalya": 'أنطاليا',
    "Bursa": 'بورصة',
    "Gaziantep": 'غازي عنتاب',
    "Istanbul": 'إسطنبول',
    "Izmir": 'إزمير',
    "Konya": 'قونيا',

    // Iran
    "Isfahan": 'أصفهان',
    "Mashhad": 'مشهد',
    "Shiraz": 'شيراز',
    "Tabriz": 'تبريز',
    "Tehran": 'طهران',

    // Pakistan
    "Faisalabad": 'فيصل آباد',
    "Gujranwala": 'جرانوالا',
    "Islamabad": 'إسلام أباد',
    "Karachi": 'كراتشي',
    "Lahore": 'لاهور',
    "Multan": 'مولتان',
    "Peshawar": 'بيشاور',
    "Rawalpindi": 'راولبندي',

    // Bangladesh
    "Chittagong": 'شيتاغونغ',
    "Dhaka": 'داكا',
    "Khulna": 'خولنا',

    // India
    "Ahmedabad": 'أحمد آباد',
    "Bangalore": 'بنغالور',
    "Chennai": 'تشيناي',
    "Delhi": 'دلهي',
    "Hyderabad": 'حيدر أباد',
    "Jaipur": 'جايبور',
    "Kanpur": 'كانبور',
    "Kolkata": 'كولكاتا',
    "Lucknow": 'لكهنؤ',
    "Mumbai": 'مومباي',
    "New Delhi": 'نيودلهي',
    "Pune": 'بيون',
    "Surat": 'سورات',

    // Indonesia
    "Bandung": 'باندونغ',
    "Jakarta": 'جاكرتا',
    "Makassar": 'ماكاسار',
    "Medan": 'ميدان',
    "Semarang": 'سيمارانغ',
    "Surabaya": 'سورابايا',
    "Yogyakarta": 'يوغياكرتا',

    // Malaysia
    "Ipoh": 'إيبوه',
    "Johor Bahru": 'جوهر باهرو',
    "Kuala Lumpur": 'كوالالمبور',
    "Kuching": 'كوتشينغ',
    "Penang": 'بينانغ',

    // Afghanistan
    "Herat": 'هرات',
    "Kabul": 'كابل',
    "Kandahar": 'قندهار',

    // Uzbekistan
    "Bukhara": 'بخارى',
    "Samarkand": 'سمرقند',
    "Tashkent": 'طشقند',

    // Kazakhstan
    "Almaty": 'ألماتي',
    "Astana": 'أستانا',

    // Azerbaijan
    "Baku": 'باكو',

    // Tajikistan
    "Dushanbe": 'دوشانبي',

    // Kyrgyzstan
    "Bishkek": 'بشكيك',

    // Turkmenistan
    "Ashgabat": 'عشق أباد',

    // Nigeria
    "Abuja": 'أبوجا',
    "Ibadan": 'إبادان',
    "Kano": 'كانو',
    "Lagos": 'لاغوس',

    // Other major world capitals
    "Athens": 'أثينا',
    "Beijing": 'بكين',
    "Berlin": 'برلين',
    "Bern": 'برن',
    "Brussels": 'بروكسل',
    "Budapest": 'بودابست',
    "Copenhagen": 'كوبنهاغن',
    "Helsinki": 'هلسنكي',
    "Lisbon": 'لشبونة',
    "London": 'لندن',
    "Madrid": 'مدريد',
    "Moscow": 'موسكو',
    "Oslo": 'أوسلو',
    "Paris": 'باريس',
    "Prague": 'براغ',
    "Rome": 'روما',
    "Stockholm": 'ستوكهولم',
    "Vienna": 'فيينا',
    "Warsaw": 'وارسو',
    "Washington": 'واشنطن',
    "Zurich": 'زيورخ',

    /**
     * Get city name in Arabic
     * @param {string} cityName - City name in English (as returned by API)
     * @param {string} lang - Language code ('en' or 'ar')
     * @returns {string} Translated name or original if not found
     */
    getName(cityName, lang = 'en') {
        if (lang === 'en') {
            return cityName;
        }
        const translated = this[cityName];
        return translated || cityName;
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.CityTranslations = CityTranslations;
}
