// Prayer names in Arabic
const PRAYER_NAMES = {
    'Fajr': 'الفجر',
    'Sunrise': 'الشروق',
    'Dhuhr': 'الظهر',
    'Asr': 'العصر',
    'Maghrib': 'المغرب',
    'Isha': 'العشاء'
};

// Country to calculation method mapping
const countryMethodMap = {
    'EG': 5,  // Egypt
    'DZ': 5,  // Algeria
    'SD': 5,  // Sudan
    'IQ': 3,  // Iraq
    'MA': 5,  // Morocco
    'SA': 4,  // Saudi Arabia
    'YE': 3,  // Yemen
    'JO': 3,  // Jordan
    'AE': 8,  // United Arab Emirates
    'LY': 5,  // Libya
    'PS': 3,  // Palestine
    'OM': 8,  // Oman
    'KW': 9,  // Kuwait
    'MR': 3,  // Mauritania
    'QA': 10, // Qatar
    'BH': 8,  // Bahrain
    'LB': 3,  // Lebanon
    'SY': 3,  // Syria
    'TN': 7   // Tunisia
};

// Calculation method names in Arabic
const CALCULATION_METHODS = {
    'auto': 'اختيار تلقائي',
    '2': 'الجمعية الإسلامية لأمريكا الشمالية',
    '3': 'رابطة العالم الإسلامي',
    '4': 'جامعة أم القرى',
    '5': 'الهيئة المصرية للمساحة',
    '7': 'جامعة العلوم التطبيقية، كراتشي',
    '8': 'معهد الجيوفيزياء، طهران',
    '9': 'الخليج العربي',
    '10': 'قطر'
};

// DOM elements
let countrySelect, citySelect, saveLocationBtn, locationDisplay, locationText, editLocationBtn;
let locationSelection, prayerTimesSection, loadingState, errorState;
let nextPrayerText, countdownText, calculationMethodText, prayerCards;

// Global variables
let citiesData = [];
let currentPrayerTimes = null;
let countdownInterval = null;
let settingsToggle, reminderSettings, reminderTimeSlider, reminderTimeSliderWrap, reminderTimeLabels, calculationMethodSelect;
let preReminderToggle, exactReminderToggle;
let scrollAnimationFrame = null;
let scrollCancelHandlers = [];
let isAutoScrolling = false;
let lastPrayerCardSignature = null;
let notificationMasterEnabled = true;
let idleAutoScrollTimer = null;
let idleAutoScrollFrame = null;
let idleAutoScrollDirection = 1;
let idleAutoScrollActive = false;
let idleAutoScrollLastTime = 0;
let isCardHovering = false;
const reminderTimeOptions = [1, 5, 10, 15, 30];

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    initializeElements();
    await loadCitiesData();
    await checkUserLocation();
    setupEventListeners();
    initializeIdleAutoScroll();
});

function initializeElements() {
    countrySelect = document.getElementById('countrySelect');
    citySelect = document.getElementById('citySelect');
    saveLocationBtn = document.getElementById('saveLocationBtn');
    locationDisplay = document.getElementById('locationDisplay');
    locationText = document.getElementById('locationText');
    editLocationBtn = document.getElementById('editLocationBtn');
    locationSelection = document.getElementById('locationSelection');
    prayerTimesSection = document.getElementById('prayerTimesSection');
    loadingState = document.getElementById('loadingState');
    errorState = document.getElementById('errorState');
    nextPrayerText = document.getElementById('nextPrayerText');
    countdownText = document.getElementById('countdownText');
    calculationMethodText = document.getElementById('calculationMethodText');
    prayerCards = document.getElementById('prayerCards');
    settingsToggle = document.getElementById('settingsToggle');
    reminderSettings = document.getElementById('reminderSettings');
    reminderTimeSlider = document.getElementById('reminderTimeSlider');
    reminderTimeSliderWrap = document.getElementById('reminderTimeSliderWrap');
    reminderTimeLabels = Array.from(document.querySelectorAll('.reminder-slider-label'));
    calculationMethodSelect = document.getElementById('calculationMethod');
    preReminderToggle = document.getElementById('preReminderToggle');
    exactReminderToggle = document.getElementById('exactReminderToggle');

}

function getReminderTimeFromSlider() {
    if (!reminderTimeSlider) {
        return 5;
    }
    const index = Number(reminderTimeSlider.value);
    return reminderTimeOptions[index] || 5;
}

function setReminderSliderByMinutes(minutes) {
    if (!reminderTimeSlider) {
        return;
    }
    const index = reminderTimeOptions.indexOf(minutes);
    const safeIndex = index === -1 ? 1 : index;
    reminderTimeSlider.value = String(safeIndex);
    updateReminderSliderLabels(reminderTimeOptions[safeIndex]);
}

function updateReminderSliderLabels(selectedMinutes) {
    if (!reminderTimeLabels || reminderTimeLabels.length === 0) {
        return;
    }
    const currentValue = selectedMinutes ?? getReminderTimeFromSlider();
    reminderTimeLabels.forEach(label => {
        const labelValue = Number(label.dataset.value);
        label.classList.toggle('active', labelValue === currentValue);
    });
}

async function loadCitiesData() {
    try {
        const response = await fetch('cities.json');
        citiesData = await response.json();
        populateCountrySelect();
    } catch (error) {
        showError('خطأ في تحميل بيانات المدن');
    }
}

function populateCountrySelect() {
    countrySelect.innerHTML = '<option value="">اختر دولة</option>';
    citiesData.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.name;
        countrySelect.appendChild(option);
    });
}



function populateCitySelect(countryCode) {
    const country = citiesData.find(c => c.code === countryCode);
    citySelect.innerHTML = '<option value="">اختر المدينة</option>';

    if (country && country.cities) {
        country.cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city.en;
            option.textContent = city.ar;
            citySelect.appendChild(option);
        });
        citySelect.disabled = false;
    } else {
        citySelect.disabled = true;
    }

    updateSaveButton();
}

function updateSaveButton() {
    saveLocationBtn.disabled = !countrySelect.value || !citySelect.value;
}

async function checkUserLocation() {
    const result = await chrome.storage.local.get(['selectedCountry', 'selectedCity', 'locationDetected']);

    if (result.selectedCountry && result.selectedCity) {
        showPrayerTimesSection(result.selectedCountry, result.selectedCity);
    } else if (!result.locationDetected) {
        // First time user - attempt automatic location detection
        await attemptAutoLocationDetection();
    } else {
        showLocationSelection();
    }
}

function showLocationSelection() {
    locationDisplay.classList.add('hidden');
    prayerTimesSection.classList.add('hidden');
    locationSelection.classList.remove('hidden');
}

// Automatic location detection functions
async function attemptAutoLocationDetection() {
    try {
        // Update loading message for location detection
        updateLoadingMessage('جاري تحديد موقعك تلقائياً...');
        showLoading(true);

        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;

        // Update loading message for finding closest city
        updateLoadingMessage('جاري البحث عن أقرب مدينة...');

        // Find closest city from our data
        const closestLocation = await findClosestCity(latitude, longitude);

        if (closestLocation) {
            // Save the detected location
            await chrome.storage.local.set({
                selectedCountry: closestLocation.countryCode,
                selectedCity: closestLocation.cityName,
                locationDetected: true,
                autoDetected: true
            });

            // Show prayer times for detected location
            await showPrayerTimesSection(closestLocation.countryCode, closestLocation.cityName);
        } else {
            // Fallback to manual selection
            await chrome.storage.local.set({ locationDetected: true });
            showLocationSelection();
        }
    } catch (error) {
        console.log('Auto location detection failed:', error);
        // Mark as attempted and show manual selection
        await chrome.storage.local.set({ locationDetected: true });
        showLocationSelection();
    } finally {
        showLoading(false);
        // Reset loading message
        updateLoadingMessage('جاري تحميل رفيق الصلاة...');
    }
}

// Update loading message
function updateLoadingMessage(message) {
    if (loadingState) {
        loadingState.textContent = message;
    }
}



async function getCurrentPosition() {
    // Use IP-based geolocation - no permission prompt needed
    try {
        const response = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('ipapi.co failed');
        const data = await response.json();
        if (!data.latitude || !data.longitude) throw new Error('No coords in response');
        return { coords: { latitude: data.latitude, longitude: data.longitude } };
    } catch (_) {
        // Fallback to ip-api.com
        const response = await fetch('http://ip-api.com/json/?fields=lat,lon,status', { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('ip-api.com failed');
        const data = await response.json();
        if (data.status !== 'success') throw new Error('ip-api.com returned non-success status');
        return { coords: { latitude: data.lat, longitude: data.lon } };
    }
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Find closest city from available data
async function findClosestCity(userLat, userLon) {
    try {
        // Get approximate coordinates for major cities in each country
        const cityCoordinates = await getCityCoordinates();

        let closestCity = null;
        let minDistance = Infinity;

        for (const country of citiesData) {
            for (const city of country.cities) {
                const coords = cityCoordinates[country.code]?.[city.en];
                if (coords) {
                    const distance = calculateDistance(userLat, userLon, coords.lat, coords.lon);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestCity = {
                            countryCode: country.code,
                            cityName: city.en,
                            distance: distance
                        };
                    }
                }
            }
        }

        // Only return if within reasonable distance (500km)
        return (closestCity && closestCity.distance < 500) ? closestCity : null;
    } catch (error) {
        console.error('Error finding closest city:', error);
        return null;
    }
}

// Get approximate coordinates for major cities
function getCityCoordinates() {
    // This is a simplified dataset with major cities coordinates
    // In a real implementation, you might want to use a more comprehensive API
    return {
        'EG': {
            'Cairo': { lat: 30.0444, lon: 31.2357 },
            'Alexandria': { lat: 31.2001, lon: 29.9187 },
            'Giza': { lat: 30.0131, lon: 31.2089 },
            'Luxor': { lat: 25.6872, lon: 32.6396 },
            'Aswan': { lat: 24.0889, lon: 32.8998 }
        },
        'SA': {
            'Riyadh': { lat: 24.7136, lon: 46.6753 },
            'Jeddah': { lat: 21.4858, lon: 39.1925 },
            'Mecca': { lat: 21.3891, lon: 39.8579 },
            'Medina': { lat: 24.5247, lon: 39.5692 },
            'Dammam': { lat: 26.4207, lon: 50.0888 }
        },
        'AE': {
            'Dubai': { lat: 25.2048, lon: 55.2708 },
            'Abu Dhabi': { lat: 24.2992, lon: 54.6972 },
            'Sharjah': { lat: 25.3463, lon: 55.4209 },
            'Ajman': { lat: 25.4052, lon: 55.5136 }
        },
        'JO': {
            'Amman': { lat: 31.9454, lon: 35.9284 },
            'Zarqa': { lat: 32.0727, lon: 36.0888 },
            'Irbid': { lat: 32.5556, lon: 35.8500 }
        },
        'LB': {
            'Beirut': { lat: 33.8938, lon: 35.5018 },
            'Tripoli': { lat: 34.4367, lon: 35.8497 },
            'Sidon': { lat: 33.5633, lon: 35.3650 }
        },
        'SY': {
            'Damascus': { lat: 33.5138, lon: 36.2765 },
            'Aleppo': { lat: 36.2021, lon: 37.1343 },
            'Homs': { lat: 34.7394, lon: 36.7163 }
        },
        'IQ': {
            'Baghdad': { lat: 33.3152, lon: 44.3661 },
            'Basra': { lat: 30.5085, lon: 47.7804 },
            'Mosul': { lat: 36.3350, lon: 43.1189 }
        },
        'KW': {
            'Kuwait City': { lat: 29.3759, lon: 47.9774 },
            'Hawalli': { lat: 29.3375, lon: 48.0281 }
        },
        'QA': {
            'Doha': { lat: 25.2854, lon: 51.5310 },
            'Al Rayyan': { lat: 25.2919, lon: 51.4240 }
        },
        'BH': {
            'Manama': { lat: 26.2285, lon: 50.5860 },
            'Riffa': { lat: 26.1300, lon: 50.5550 }
        },
        'OM': {
            'Muscat': { lat: 23.5859, lon: 58.4059 },
            'Salalah': { lat: 17.0151, lon: 54.0924 }
        },
        'YE': {
            'Sanaa': { lat: 15.3694, lon: 44.1910 },
            'Aden': { lat: 12.7797, lon: 45.0367 }
        },
        'PS': {
            'Gaza': { lat: 31.3547, lon: 34.3088 },
            'Ramallah': { lat: 31.9073, lon: 35.2044 }
        },
        'MA': {
            'Casablanca': { lat: 33.5731, lon: -7.5898 },
            'Rabat': { lat: 34.0209, lon: -6.8416 },
            'Marrakech': { lat: 31.6295, lon: -7.9811 }
        },
        'DZ': {
            'Algiers': { lat: 36.7538, lon: 3.0588 },
            'Oran': { lat: 35.6976, lon: -0.6337 },
            'Constantine': { lat: 36.3650, lon: 6.6147 }
        },
        'TN': {
            'Tunis': { lat: 36.8065, lon: 10.1815 },
            'Sfax': { lat: 34.7406, lon: 10.7603 }
        },
        'LY': {
            'Tripoli': { lat: 32.8872, lon: 13.1913 },
            'Benghazi': { lat: 32.1167, lon: 20.0683 }
        },
        'SD': {
            'Khartoum': { lat: 15.5007, lon: 32.5599 },
            'Omdurman': { lat: 15.6445, lon: 32.4777 }
        },
        'MR': {
            'Nouakchott': { lat: 18.0735, lon: -15.9582 }
        }
    };
}

async function showPrayerTimesSection(countryCode, cityName) {
    const country = citiesData.find(c => c.code === countryCode);
    const city = country?.cities.find(c => c.en === cityName);

    if (country && city) {
        // Check if location was auto-detected
        const result = await chrome.storage.local.get(['autoDetected']);
        const autoDetectedText = result.autoDetected ? ' 📍' : '';

        locationText.textContent = `${city.ar}, ${country.name}${autoDetectedText}`;
        locationDisplay.classList.remove('hidden');
        locationSelection.classList.add('hidden');

        await loadPrayerTimes(countryCode, cityName);
        await updateReminderToggle();

        prayerTimesSection.classList.remove('hidden');
    }
}

async function loadPrayerTimes(countryCode, cityName) {
    showLoading(true);
    hideError();

    try {
        // Get current date (use local date to avoid UTC offset issues)
        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

        // Auto-detect calculation method based on country, fallback to user setting or default
        const settings = await chrome.storage.local.get(['calculationMethod']);
        const autoMethod = countryMethodMap[countryCode] || 2;

        let method;
        if (settings.calculationMethod === 'auto' || !settings.calculationMethod) {
            method = autoMethod;
        } else {
            method = parseInt(settings.calculationMethod);
        }

        // Fetch prayer times from Aladhan API (include safe defaults for school/latitude adjustment)
        const school = 0; // Shafi/Maliki/Hanbali default
        const latitudeAdjustmentMethod = 'NONE';
        const response = await fetch(
            `https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=${encodeURIComponent(cityName)}&country=${countryCode}&method=${method}&school=${school}&latitudeAdjustmentMethod=${latitudeAdjustmentMethod}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch prayer times');
        }

        const data = await response.json();

        if (data.code === 200 && data.data && data.data.timings) {
            currentPrayerTimes = data.data.timings;
            await chrome.storage.local.set({
                prayerTimes: currentPrayerTimes,
                lastUpdated: Date.now()
            });

            updatePrayerDisplay();
            startCountdown();

            // Send prayer times to background script for alarm setup
            chrome.runtime.sendMessage({
                action: 'updatePrayerTimes',
                prayerTimes: currentPrayerTimes,
                countryCode: countryCode,
                cityName: cityName
            });
        } else {
            throw new Error('Invalid API response');
        }
    } catch (error) {
        showError('خطأ في تحميل رفيق الصلاة. يرجى المحاولة مرة أخرى.');
    } finally {
        showLoading(false);
    }
}

function updatePrayerDisplay() {
    if (!currentPrayerTimes) return;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // Prayer times in minutes from midnight
    const prayers = [
        { name: 'Fajr', time: timeToMinutes(currentPrayerTimes.Fajr), timeStr: currentPrayerTimes.Fajr },
        { name: 'Dhuhr', time: timeToMinutes(currentPrayerTimes.Dhuhr), timeStr: currentPrayerTimes.Dhuhr },
        { name: 'Asr', time: timeToMinutes(currentPrayerTimes.Asr), timeStr: currentPrayerTimes.Asr },
        { name: 'Maghrib', time: timeToMinutes(currentPrayerTimes.Maghrib), timeStr: currentPrayerTimes.Maghrib },
        { name: 'Isha', time: timeToMinutes(currentPrayerTimes.Isha), timeStr: currentPrayerTimes.Isha }
    ];

    // Find next prayer
    let nextPrayer = null;
    for (const prayer of prayers) {
        if (prayer.time > currentTime) {
            nextPrayer = prayer;
            break;
        }
    }

    // If no prayer found today, next prayer is Fajr tomorrow
    if (!nextPrayer) {
        nextPrayer = { name: 'Fajr', time: prayers[0].time + 24 * 60, timeStr: currentPrayerTimes.Fajr };
    }

    const timeUntil = nextPrayer.time - currentTime;
    const hours = Math.floor(timeUntil / 60);
    const minutes = timeUntil % 60;

    // Convert 24-hour time to 12-hour AM/PM format with Arabic indicators
    function formatTo12Hour(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'م' : 'ص'; // م for مساء (evening), ص for صباح (morning)
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    let timeText = '';
    if (hours > 0) {
        timeText = `${hours} ساعة و${minutes} دقيقة`;
    } else {
        timeText = `${minutes} دقيقة`;
    }

    const formattedTime = formatTo12Hour(nextPrayer.timeStr);
    nextPrayerText.innerHTML = `🕌 الصلاة القادمة: ${PRAYER_NAMES[nextPrayer.name]} في ${formattedTime}<br><span class="countdown-time">${timeText}</span>`;

    renderPrayerCards(prayers, nextPrayer.name, formatTo12Hour);

    // Update calculation method display
    updateCalculationMethodDisplay();
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function startCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    countdownInterval = setInterval(() => {
        updatePrayerDisplay();
        updateCountdownDisplay();
    }, 1000);
}

function updateCountdownDisplay() {
    if (!countdownText) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-SA', {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).replace(/AM/g, 'ص').replace(/PM/g, 'م');
    countdownText.textContent = `الوقت الحالي: ${timeStr}`;
    countdownText.classList.remove('hidden');
}

function getScrollRoot() {
    return document.scrollingElement || document.documentElement;
}

function clearScrollCancelHandlers() {
    scrollCancelHandlers.forEach(handler => handler());
    scrollCancelHandlers = [];
}

function cancelAutoScroll() {
    if (scrollAnimationFrame) {
        cancelAnimationFrame(scrollAnimationFrame);
        scrollAnimationFrame = null;
    }
    isAutoScrolling = false;
    clearScrollCancelHandlers();
    if (reminderSettings) {
        reminderSettings.classList.remove('scroll-focus');
    }
    document.body.classList.remove('scrolling-settings');
}

function addScrollCancelListener(type, options) {
    const handler = () => {
        if (isAutoScrolling) {
            cancelAutoScroll();
        }
    };
    document.addEventListener(type, handler, options);
    scrollCancelHandlers.push(() => document.removeEventListener(type, handler, options));
}

function startAutoScroll(targetY, prefersReducedMotion) {
    const scrollRoot = getScrollRoot();
    cancelAutoScroll();
    if (!scrollRoot) {
        return;
    }
    if (prefersReducedMotion) {
        scrollRoot.scrollTop = targetY;
        if (reminderSettings) {
            reminderSettings.classList.add('scroll-focus');
            setTimeout(() => {
                reminderSettings.classList.remove('scroll-focus');
            }, 400);
        }
        return;
    }
    const startY = scrollRoot.scrollTop;
    const distance = targetY - startY;
    const duration = 400;
    const startTime = performance.now();
    isAutoScrolling = true;
    if (reminderSettings) {
        reminderSettings.classList.add('scroll-focus');
    }
    document.body.classList.add('scrolling-settings');
    addScrollCancelListener('wheel', { passive: true });
    addScrollCancelListener('touchstart', { passive: true });
    addScrollCancelListener('mousedown', { passive: true });
    addScrollCancelListener('keydown', false);

    const ease = (t) => {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    };

    const step = (now) => {
        if (!isAutoScrolling) {
            return;
        }
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = ease(progress);
        scrollRoot.scrollTop = startY + distance * eased;
        if (progress < 1) {
            scrollAnimationFrame = requestAnimationFrame(step);
        } else {
            cancelAutoScroll();
        }
    };

    scrollAnimationFrame = requestAnimationFrame(step);
}

function openSettingsMenu() {
    reminderSettings.classList.remove('hidden');
    stopIdleAutoScroll();
    const scrollRoot = getScrollRoot();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => {
        const targetY = Math.max(scrollRoot.scrollHeight - scrollRoot.clientHeight, 0);
        startAutoScroll(targetY, prefersReducedMotion);
    });
}

function closeSettingsMenu() {
    const scrollRoot = getScrollRoot();
    if (!scrollRoot) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Start smooth scroll back to top
    startAutoScroll(0, prefersReducedMotion);

    // Add hidden class to trigger CSS transition
    reminderSettings.classList.add('hidden');
}

async function updateCalculationMethodDisplay() {
    const result = await chrome.storage.local.get(['calculationMethod', 'selectedCountry']);
    const currentMethod = result.calculationMethod || 'auto';

    let methodName;
    if (currentMethod === 'auto' && result.selectedCountry) {
        const autoMethodId = countryMethodMap[result.selectedCountry] || 2;
        methodName = `${CALCULATION_METHODS['auto']} (${CALCULATION_METHODS[autoMethodId.toString()]})`;
    } else {
        methodName = CALCULATION_METHODS[currentMethod] || CALCULATION_METHODS['auto'];
    }

    if (calculationMethodText) {
        calculationMethodText.textContent = `طريقة الحساب: ${methodName}`;
    }
}

async function updateReminderToggle() {
    const result = await chrome.storage.local.get([
        'reminderTime',
        'calculationMethod',
        'selectedCountry',
        'preReminderEnabled',
        'exactReminderEnabled',
        'lastScheduleError'
    ]);

    // Default both reminders to true if not explicitly set to false
    const preEnabled = result.preReminderEnabled !== false;
    const exactEnabled = result.exactReminderEnabled !== false;
    notificationMasterEnabled = true;

    // Update settings UI
    if (result.reminderTime) {
        setReminderSliderByMinutes(result.reminderTime);
    } else {
        setReminderSliderByMinutes(5);
    }

    // Set calculation method - default to auto if not set
    const currentMethod = result.calculationMethod || 'auto';
    calculationMethodSelect.value = currentMethod;

    preReminderToggle.checked = preEnabled;
    exactReminderToggle.checked = exactEnabled;
    updateToggleAvailability(true);

    if (result.lastScheduleError && result.lastScheduleError.message) {
        showError(result.lastScheduleError.message);
        setTimeout(() => {
            hideError();
        }, 3000);
    }
}

function setupEventListeners() {
    countrySelect.addEventListener('change', (e) => {
        populateCitySelect(e.target.value);
    });

    citySelect.addEventListener('change', updateSaveButton);

    saveLocationBtn.addEventListener('click', async () => {
        const countryCode = countrySelect.value;
        const cityName = citySelect.value;

        if (countryCode && cityName) {
            await chrome.storage.local.set({
                selectedCountry: countryCode,
                selectedCity: cityName,
                autoDetected: false // Clear auto-detected flag for manual selection
            });

            await showPrayerTimesSection(countryCode, cityName);
        }
    });

    editLocationBtn.addEventListener('click', () => {
        showLocationSelection();
        // Reset selections
        countrySelect.value = '';
        citySelect.innerHTML = '<option value="">اختر المدينة</option>';
        citySelect.disabled = true;
        updateSaveButton();
    });

    preReminderToggle.addEventListener('change', () => {
        updateToggleAvailability(true);
    });

    exactReminderToggle.addEventListener('change', () => {
        updateToggleAvailability(true);
    });

    settingsToggle.addEventListener('click', () => {
        const isHidden = reminderSettings.classList.contains('hidden');
        if (isHidden) {
            openSettingsMenu();
        } else {
            closeSettingsMenu();
        }
    });

    async function saveSettings() {
        const reminderTime = getReminderTimeFromSlider();
        const calculationMethod = calculationMethodSelect.value;
        const preEnabled = preReminderToggle.checked;
        const exactEnabled = exactReminderToggle.checked;

        await chrome.storage.local.set({
            reminderTime: reminderTime,
            calculationMethod: calculationMethod,
            preReminderEnabled: preEnabled,
            exactReminderEnabled: exactEnabled
        });

        const result = await chrome.storage.local.get(['selectedCountry', 'selectedCity']);
        if (result.selectedCountry && result.selectedCity) {
            await loadPrayerTimes(result.selectedCountry, result.selectedCity);
        }

        updateCalculationMethodDisplay();

        await chrome.runtime.sendMessage({
            action: 'updateNotificationSettings'
        });
    }

    if (reminderTimeSlider) {
        reminderTimeSlider.addEventListener('change', saveSettings);
        reminderTimeSlider.addEventListener('input', () => {
            updateReminderSliderLabels();
        });
    }

    if (reminderTimeLabels && reminderTimeLabels.length > 0) {
        reminderTimeLabels.forEach(label => {
            label.addEventListener('click', async () => {
                const value = Number(label.dataset.value);
                setReminderSliderByMinutes(value);
                await saveSettings();
            });
        });
    }

    preReminderToggle.addEventListener('change', async () => {
        updateToggleAvailability(true);
        await saveSettings();
    });

    exactReminderToggle.addEventListener('change', async () => {
        updateToggleAvailability(true);
        await saveSettings();
    });

    calculationMethodSelect.addEventListener('change', saveSettings);

}

function updateToggleAvailability(isEnabled) {
    const toggleRows = reminderSettings.querySelectorAll('.toggle-row');
    toggleRows.forEach(row => {
        row.classList.toggle('disabled', !isEnabled);
    });
    preReminderToggle.disabled = !isEnabled;
    exactReminderToggle.disabled = !isEnabled;
    if (reminderTimeSlider) {
        reminderTimeSlider.disabled = !isEnabled || !preReminderToggle.checked;
    }
    if (reminderTimeSliderWrap) {
        reminderTimeSliderWrap.classList.toggle('disabled', !isEnabled || !preReminderToggle.checked);
    }
    calculationMethodSelect.disabled = !isEnabled;
}

function renderPrayerCards(prayers, nextPrayerName, formatTo12Hour) {
    if (!prayerCards) {
        return;
    }
    const signature = `${nextPrayerName}:${prayers.map(prayer => prayer.name + prayer.timeStr).join('|')}`;
    if (signature === lastPrayerCardSignature) {
        return;
    }
    lastPrayerCardSignature = signature;
    prayerCards.innerHTML = '';

    prayers.forEach(prayer => {
        const card = document.createElement('div');
        card.className = `prayer-card${prayer.name === nextPrayerName ? ' next' : ''}`;

        const info = document.createElement('div');
        info.className = 'prayer-card-info';

        const title = document.createElement('div');
        title.className = 'prayer-card-title';
        title.textContent = PRAYER_NAMES[prayer.name];

        const time = document.createElement('div');
        time.className = 'prayer-card-time';
        time.textContent = formatTo12Hour(prayer.timeStr);

        info.appendChild(title);
        info.appendChild(time);

        card.appendChild(info);

        if (prayer.name === nextPrayerName) {
            const badge = document.createElement('div');
            badge.className = 'prayer-card-next';
            badge.textContent = 'التالي';
            card.appendChild(badge);
        }

        prayerCards.appendChild(card);
    });
    scheduleIdleAutoScroll();
}

function initializeIdleAutoScroll() {
    if (!prayerCards) {
        return;
    }
    scheduleIdleAutoScroll();
    prayerCards.addEventListener('mouseenter', handleCardsHoverStart);
    prayerCards.addEventListener('mouseleave', handleCardsHoverEnd);
    prayerCards.addEventListener('wheel', handleCardsScrollInteraction, { passive: true });
    prayerCards.addEventListener('touchstart', handleCardsScrollInteraction, { passive: true });
    prayerCards.addEventListener('touchmove', handleCardsScrollInteraction, { passive: true });
    prayerCards.addEventListener('pointerdown', handleCardsScrollInteraction, { passive: true });
    prayerCards.addEventListener('pointermove', handleCardsScrollInteraction, { passive: true });
    prayerCards.addEventListener('scroll', handleCardsScrollInteraction, { passive: true });
}

function handleCardsHoverStart() {
    isCardHovering = true;
    stopIdleAutoScroll();
    clearIdleAutoScrollTimer();
}

function handleCardsHoverEnd() {
    isCardHovering = false;
    scheduleIdleAutoScroll();
}

function handleCardsScrollInteraction() {
    stopIdleAutoScroll();
    scheduleIdleAutoScroll();
}

function clearIdleAutoScrollTimer() {
    if (idleAutoScrollTimer) {
        clearTimeout(idleAutoScrollTimer);
        idleAutoScrollTimer = null;
    }
}

function scheduleIdleAutoScroll() {
    if (isCardHovering) {
        return;
    }
    clearIdleAutoScrollTimer();
    idleAutoScrollTimer = setTimeout(() => {
        startIdleAutoScroll();
    }, 4000);
}

function startIdleAutoScroll() {
    if (idleAutoScrollActive || isAutoScrolling || !prayerCards) {
        return;
    }
    const maxScroll = prayerCards.scrollWidth - prayerCards.clientWidth;
    if (maxScroll <= 0) {
        scheduleIdleAutoScroll();
        return;
    }
    idleAutoScrollActive = true;
    idleAutoScrollLastTime = performance.now();

    const step = (now) => {
        if (!idleAutoScrollActive || !prayerCards) {
            return;
        }
        const deltaSeconds = Math.max((now - idleAutoScrollLastTime) / 1000, 0);
        idleAutoScrollLastTime = now;
        const currentMax = prayerCards.scrollWidth - prayerCards.clientWidth;
        if (currentMax <= 0) {
            stopIdleAutoScroll();
            return;
        }
        let nextScrollLeft = prayerCards.scrollLeft + idleAutoScrollDirection * 70 * deltaSeconds;
        if (nextScrollLeft >= currentMax) {
            nextScrollLeft = currentMax;
            idleAutoScrollDirection = -1;
        } else if (nextScrollLeft <= 0) {
            nextScrollLeft = 0;
            idleAutoScrollDirection = 1;
        }
        prayerCards.scrollLeft = nextScrollLeft;
        idleAutoScrollFrame = requestAnimationFrame(step);
    };

    idleAutoScrollFrame = requestAnimationFrame(step);
}

function stopIdleAutoScroll() {
    if (idleAutoScrollFrame) {
        cancelAnimationFrame(idleAutoScrollFrame);
        idleAutoScrollFrame = null;
    }
    idleAutoScrollActive = false;
}

function showLoading(show) {
    if (show) {
        loadingState.classList.remove('hidden');
    } else {
        loadingState.classList.add('hidden');
    }
}



function showError(message) {
    errorState.textContent = message;
    errorState.classList.remove('hidden');
}

function hideError() {
    errorState.classList.add('hidden');
}

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    stopIdleAutoScroll();
    clearIdleAutoScrollTimer();
});
