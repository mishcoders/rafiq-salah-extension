/**
 * Prayer Pal Popup Script
 * Handles UI interactions, API calls for countries/cities, prayer time display, and settings
 */

// Prayer names keys for i18n
const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// Country to calculation method mapping
const countryMethodMap = {
    'EG': 5, 'DZ': 5, 'SD': 5, 'IQ': 3, 'MA': 5, 'SA': 4, 'YE': 3,
    'JO': 3, 'AE': 8, 'LY': 5, 'PS': 3, 'OM': 8, 'KW': 9, 'MR': 3,
    'QA': 10, 'BH': 8, 'LB': 3, 'SY': 3, 'TN': 7
};

// API endpoints
const API_BASE = 'https://api.aladhan.com/v1';
const COUNTRIES_API = 'https://restcountries.com/v3.1/all?fields=name,cca2';
const CITIES_API = 'https://countriesnow.space/api/v0.1/countries/cities';
const COUNTRIES_CACHE_KEY = 'countriesCache';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

// DOM elements
let countrySelect, citySelect, saveLocationBtn, locationDisplay, locationText, editLocationBtn;
let locationSelection, locationPrompt, prayerTimesSection, loadingState, errorState;
let autoDetectBtn, manualSelectBtn, locationError;
let nextPrayerText, calculationMethodText, prayerCards;
let settingsToggle, reminderSettings, reminderTimeSlider, reminderTimeSliderWrap, reminderTimeLabels, calculationMethodSelect;
let preReminderToggle, exactReminderToggle, langToggle, currentLangSpan;
let showMoreBtn, showMoreContainer, showMoreHint;

// Global variables
let countriesData = [];
let citiesData = [];
let currentPrayerTimes = null;
let countdownInterval = null;
let scrollAnimationFrame = null;
let scrollCancelHandlers = [];
let isAutoScrolling = false;
let lastPrayerCardSignature = null;
let idleAutoScrollTimer = null;
let idleAutoScrollFrame = null;
let idleAutoScrollDirection = 1;
let idleAutoScrollActive = false;
let idleAutoScrollLastTime = 0;
let isCardHovering = false;
let notificationMasterEnabled = true;
let showAllCountries = false;
const reminderTimeOptions = [1, 5, 10, 15, 30];

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n first
    await I18n.init();

    initializeElements();
    await loadCountriesData();
    await checkUserLocation();
    setupEventListeners();
    initializeIdleAutoScroll();
    updateUILanguage();
});

function initializeElements() {
    countrySelect = document.getElementById('countrySelect');
    citySelect = document.getElementById('citySelect');
    saveLocationBtn = document.getElementById('saveLocationBtn');
    locationDisplay = document.getElementById('locationDisplay');
    locationText = document.getElementById('locationText');
    editLocationBtn = document.getElementById('editLocationBtn');
    locationSelection = document.getElementById('locationSelection');
    locationPrompt = document.getElementById('locationPrompt');
    prayerTimesSection = document.getElementById('prayerTimesSection');
    loadingState = document.getElementById('loadingState');
    errorState = document.getElementById('errorState');
    autoDetectBtn = document.getElementById('autoDetectBtn');
    manualSelectBtn = document.getElementById('manualSelectBtn');
    locationError = document.getElementById('locationError');
    nextPrayerText = document.getElementById('nextPrayerText');
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
    langToggle = document.getElementById('langToggle');
    currentLangSpan = document.getElementById('currentLang');
    showMoreBtn = document.getElementById('showMoreBtn');
    showMoreContainer = document.getElementById('showMoreContainer');
    showMoreHint = document.getElementById('showMoreHint');
}

function updateUILanguage() {
    // Update language toggle button
    if (currentLangSpan) {
        currentLangSpan.textContent = I18n.getLanguage().toUpperCase();
    }
    // Apply all translations
    I18n.applyTranslations();
}

/**
 * Load countries from restcountries.com API with caching
 * Uses: cca2 (ISO2), name.common (English), name.nativeName.ara.common (Arabic)
 */
async function loadCountriesData() {
    try {
        // Check cache first
        const cache = await chrome.storage.local.get([COUNTRIES_CACHE_KEY]);
        if (cache[COUNTRIES_CACHE_KEY]) {
            const { data, timestamp } = cache[COUNTRIES_CACHE_KEY];
            if (Date.now() - timestamp < CACHE_DURATION) {
                countriesData = normalizeCountriesData(data);
                populateCountrySelect();
                return;
            }
        }

        // Fetch from restcountries.com API
        const response = await fetch(COUNTRIES_API);
        if (!response.ok) {
            throw new Error('Failed to fetch countries');
        }

        const rawData = await response.json();
        if (Array.isArray(rawData)) {
            // Normalize and cache the data
            countriesData = normalizeCountriesData(rawData);
            await chrome.storage.local.set({
                [COUNTRIES_CACHE_KEY]: {
                    data: rawData,
                    timestamp: Date.now()
                }
            });
            populateCountrySelect();
        } else {
            throw new Error('Invalid API response');
        }
    } catch (error) {
        console.error('Error loading countries:', error);
        showError(I18n.t('errors.loadingCities'));
        // Try to use cached data even if expired
        const cache = await chrome.storage.local.get([COUNTRIES_CACHE_KEY]);
        if (cache[COUNTRIES_CACHE_KEY]) {
            countriesData = normalizeCountriesData(cache[COUNTRIES_CACHE_KEY].data);
            populateCountrySelect();
        }
    }
}

/**
 * Normalize countries data from restcountries.com format
 * Uses CountryTranslations for bilingual names
 */
function normalizeCountriesData(rawData) {
    return rawData.map(country => {
        const iso2 = country.cca2;
        const apiName = country.name?.common || country.name || iso2;

        // Use CountryTranslations if available, fallback to API names
        const hasTranslation = CountryTranslations && CountryTranslations[iso2];
        const englishName = hasTranslation ? CountryTranslations[iso2].en : apiName;
        const arabicName = hasTranslation ? CountryTranslations[iso2].ar : apiName;

        return {
            iso2: iso2,
            englishName: englishName,
            arabicName: arabicName
        };
    }).filter(country => country.iso2);
}

/**
 * Load cities for a country from countriesnow.space API (no caching)
 * POST with body: { "country": "EnglishCountryName" }
 */
async function loadCitiesForCountry(countryCode) {
    try {
        // Find the country to get its English name
        const country = countriesData.find(c => c.iso2 === countryCode);
        if (!country) {
            return [];
        }

        // Fetch from countriesnow.space API using POST
        const response = await fetch(CITIES_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ country: country.englishName })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch cities');
        }

        const result = await response.json();
        if (result.error === false && Array.isArray(result.data)) {
            // Return array of city objects with name property
            return result.data.map(cityName => ({
                name: cityName
            }));
        } else {
            throw new Error('Invalid API response');
        }
    } catch (error) {
        console.error('Error loading cities:', error);
        return [];
    }
}

function populateCountrySelect() {
    const currentLang = I18n.getLanguage();
    countrySelect.innerHTML = `<option value="">${I18n.t('location.chooseCountry')}</option>`;

    // In Arabic mode and not showing all countries, filter to Arab countries only
    let countriesToShow = [...countriesData];
    if (currentLang === 'ar' && !showAllCountries) {
        countriesToShow = countriesData.filter(c => CountryTranslations?.isArabCountry(c.iso2));
    }

    // Sort countries alphabetically based on current language
    const sortedCountries = countriesToShow.sort((a, b) => {
        const nameA = currentLang === 'ar' ? a.arabicName : a.englishName;
        const nameB = currentLang === 'ar' ? b.arabicName : b.englishName;
        return nameA.localeCompare(nameB, currentLang);
    });

    sortedCountries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.iso2;
        // Use translated name based on current language
        option.textContent = currentLang === 'ar' ? country.arabicName : country.englishName;
        countrySelect.appendChild(option);
    });

    // Show/hide the show more button based on language and filter state
    if (showMoreContainer) {
        if (currentLang === 'ar') {
            showMoreContainer.classList.remove('hidden');
            // Update button text based on state
            if (showMoreBtn) {
                showMoreBtn.textContent = I18n.t(showAllCountries ? 'location.showLess' : 'location.showMore');
            }
        } else {
            // Always hide in English mode
            showMoreContainer.classList.add('hidden');
        }
    }
}

async function populateCitySelect(countryCode) {
    const currentLang = I18n.getLanguage();
    citySelect.innerHTML = `<option value="">${I18n.t('location.chooseCity')}</option>`;
    citySelect.disabled = true;

    if (countryCode) {
        const cities = await loadCitiesForCountry(countryCode);
        citiesData = cities;

        if (cities && cities.length > 0) {
            // Sort cities based on translated names for current language
            const sortedCities = [...cities].sort((a, b) => {
                const nameA = currentLang === 'ar' 
                    ? (CityTranslations?.getName(a.name, 'ar') || a.name) 
                    : a.name;
                const nameB = currentLang === 'ar' 
                    ? (CityTranslations?.getName(b.name, 'ar') || b.name) 
                    : b.name;
                return nameA.localeCompare(nameB, currentLang === 'ar' ? 'ar' : 'en');
            });

            sortedCities.forEach(city => {
                const option = document.createElement('option');
                option.value = city.name;
                // Use translated name based on current language
                option.textContent = currentLang === 'ar' 
                    ? (CityTranslations?.getName(city.name, 'ar') || city.name)
                    : city.name;
                citySelect.appendChild(option);
            });
            citySelect.disabled = false;
        }
    }

    updateSaveButton();
}

function updateSaveButton() {
    saveLocationBtn.disabled = !countrySelect.value || !citySelect.value;
}

async function checkUserLocation() {
    const result = await chrome.storage.local.get(['selectedCountry', 'selectedCity', 'locationPromptSeen']);

    if (result.selectedCountry && result.selectedCity) {
        await showPrayerTimesSection(result.selectedCountry, result.selectedCity);
    } else if (!result.locationPromptSeen) {
        showLocationPrompt();
    } else {
        showLocationSelection();
    }
}

function showLocationPrompt(isEdit = false) {
    locationPrompt?.classList.remove('hidden');
    locationSelection?.classList.add('hidden');
    locationDisplay?.classList.add('hidden');
    prayerTimesSection?.classList.add('hidden');
    hideLocationError();

    const titleElement = locationPrompt?.querySelector('h3');
    const textElement = locationPrompt?.querySelector('.location-prompt-text');

    if (titleElement && textElement) {
        if (isEdit) {
            titleElement.textContent = I18n.t('location.changeLocation');
            textElement.textContent = I18n.t('locationPrompt.changeDescription');
        } else {
            titleElement.textContent = I18n.t('locationPrompt.setLocation');
            textElement.textContent = I18n.t('locationPrompt.description');
        }
    }
}

function updatePromptTitleForEdit() {
    showLocationPrompt(true);
}

function showLocationError(message) {
    if (locationError) {
        locationError.textContent = message;
        locationError.classList.remove('hidden');
        locationError.style.animation = 'none';
        locationError.offsetHeight;
        locationError.style.animation = '';
    }
}

function hideLocationError() {
    locationError?.classList.add('hidden');
}

function setLocationPromptLoading(isLoading) {
    if (autoDetectBtn) {
        if (isLoading) {
            autoDetectBtn.classList.add('btn-loading');
            autoDetectBtn.disabled = true;
            manualSelectBtn.disabled = true;
        } else {
            autoDetectBtn.classList.remove('btn-loading');
            autoDetectBtn.disabled = false;
            manualSelectBtn.disabled = false;
        }
    }
}

function showLocationSelection() {
    locationDisplay?.classList.add('hidden');
    prayerTimesSection?.classList.add('hidden');
    locationPrompt?.classList.add('hidden');
    locationSelection?.classList.remove('hidden');
}

// Automatic location detection
async function attemptAutoLocationDetection() {
    setLocationPromptLoading(true);
    hideLocationError();

    try {
        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;

        const closestLocation = await findClosestCity(latitude, longitude);

        if (closestLocation) {
            await chrome.storage.local.set({
                selectedCountry: closestLocation.countryCode,
                selectedCity: closestLocation.cityName,
                locationPromptSeen: true,
                autoDetected: true
            });

            await showPrayerTimesSection(closestLocation.countryCode, closestLocation.cityName);
        } else {
            showLocationError(I18n.t('locationPrompt.noNearbyCity'));
            setTimeout(() => {
                showLocationSelection();
            }, 2000);
        }
    } catch (error) {
        console.error('Auto location detection failed:', error);

        let errorKey = 'locationPrompt.error';
        if (error.name === 'PermissionDeniedError' || error.code === 1) {
            errorKey = 'locationPrompt.permissionDenied';
        } else if (error.name === 'PositionUnavailableError' || error.code === 2) {
            errorKey = 'locationPrompt.positionUnavailable';
        } else if (error.name === 'TimeoutError' || error.code === 3) {
            errorKey = 'locationPrompt.timeout';
        } else if (!navigator.geolocation) {
            errorKey = 'locationPrompt.notSupported';
        }

        showLocationError(I18n.t(errorKey));
    } finally {
        setLocationPromptLoading(false);
    }
}

function proceedToManualSelection() {
    chrome.storage.local.set({ locationPromptSeen: true });
    showLocationSelection();

    countrySelect.value = '';
    citySelect.innerHTML = `<option value="">${I18n.t('location.chooseCity')}</option>`;
    citySelect.disabled = true;
    updateSaveButton();
}

function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 10000
            }
        );
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function findClosestCity(userLat, userLon) {
    try {
        const cityCoordinates = await getCityCoordinates();

        let closestCity = null;
        let minDistance = Infinity;

        for (const country of countriesData) {
            if (!country.iso2) continue;

            const cities = await loadCitiesForCountry(country.iso2);
            for (const city of cities) {
                const coords = cityCoordinates[country.iso2]?.[city.name];
                if (coords) {
                    const distance = calculateDistance(userLat, userLon, coords.lat, coords.lon);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestCity = {
                            countryCode: country.iso2,
                            cityName: city.name,
                            distance: distance
                        };
                    }
                }
            }
        }

        return (closestCity && closestCity.distance < 500) ? closestCity : null;
    } catch (error) {
        console.error('Error finding closest city:', error);
        return null;
    }
}

function getCityCoordinates() {
    // Simplified dataset with major cities coordinates
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
            'Tripoli': { lat: 34.4367, lon: 35.8497 }
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
        },
        'US': {
            'New York': { lat: 40.7128, lon: -74.0060 },
            'Los Angeles': { lat: 34.0522, lon: -118.2437 },
            'Chicago': { lat: 41.8781, lon: -87.6298 }
        },
        'GB': {
            'London': { lat: 51.5074, lon: -0.1278 },
            'Manchester': { lat: 53.4808, lon: -2.2426 }
        },
        'FR': {
            'Paris': { lat: 48.8566, lon: 2.3522 },
            'Marseille': { lat: 43.2965, lon: 5.3698 }
        },
        'DE': {
            'Berlin': { lat: 52.5200, lon: 13.4050 },
            'Munich': { lat: 48.1351, lon: 11.5820 }
        },
        'TR': {
            'Istanbul': { lat: 41.0082, lon: 28.9784 },
            'Ankara': { lat: 39.9334, lon: 32.8597 }
        },
        'IN': {
            'Mumbai': { lat: 19.0760, lon: 72.8777 },
            'Delhi': { lat: 28.6139, lon: 77.2090 }
        },
        'ID': {
            'Jakarta': { lat: -6.2088, lon: 106.8456 }
        },
        'MY': {
            'Kuala Lumpur': { lat: 3.1390, lon: 101.6869 }
        },
        'PK': {
            'Karachi': { lat: 24.8607, lon: 67.0011 },
            'Lahore': { lat: 31.5204, lon: 74.3587 }
        },
        'BD': {
            'Dhaka': { lat: 23.8103, lon: 90.4125 }
        }
    };
}

async function showPrayerTimesSection(countryCode, cityName) {
    const currentLang = I18n.getLanguage();
    const country = countriesData.find(c => c.iso2 === countryCode);

    if (country && cityName) {
        const result = await chrome.storage.local.get(['autoDetected']);
        const autoDetectedText = result.autoDetected ? ' 📍' : '';
        
        // Use translated names based on current language
        const countryName = currentLang === 'ar' ? country.arabicName : country.englishName;
        const cityDisplayName = currentLang === 'ar' 
            ? (CityTranslations?.getName(cityName, 'ar') || cityName)
            : cityName;

        locationText.textContent = `${cityDisplayName}, ${countryName}${autoDetectedText}`;
        locationDisplay.classList.remove('hidden');
        locationSelection.classList.add('hidden');
        locationPrompt?.classList.add('hidden');

        await loadPrayerTimes(countryCode, cityName);
        await updateReminderToggle();

        prayerTimesSection.classList.remove('hidden');
    }
}

async function loadPrayerTimes(countryCode, cityName) {
    showLoading(true);
    hideError();

    try {
        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

        const settings = await chrome.storage.local.get(['calculationMethod']);
        const autoMethod = countryMethodMap[countryCode] || 2;

        let method;
        if (settings.calculationMethod === 'auto' || !settings.calculationMethod) {
            method = autoMethod;
        } else {
            method = parseInt(settings.calculationMethod);
        }

        const school = 0;
        const latitudeAdjustmentMethod = 'NONE';
        const response = await fetch(
            `${API_BASE}/timingsByCity/${dateStr}?city=${encodeURIComponent(cityName)}&country=${countryCode}&method=${method}&school=${school}&latitudeAdjustmentMethod=${latitudeAdjustmentMethod}`
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
        console.error('Error loading prayer times:', error);
        showError(I18n.t('errors.loadingPrayerTimes'));
    } finally {
        showLoading(false);
    }
}

function updatePrayerDisplay() {
    if (!currentPrayerTimes) return;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const prayers = [
        { name: 'Fajr', time: timeToMinutes(currentPrayerTimes.Fajr), timeStr: currentPrayerTimes.Fajr },
        { name: 'Dhuhr', time: timeToMinutes(currentPrayerTimes.Dhuhr), timeStr: currentPrayerTimes.Dhuhr },
        { name: 'Asr', time: timeToMinutes(currentPrayerTimes.Asr), timeStr: currentPrayerTimes.Asr },
        { name: 'Maghrib', time: timeToMinutes(currentPrayerTimes.Maghrib), timeStr: currentPrayerTimes.Maghrib },
        { name: 'Isha', time: timeToMinutes(currentPrayerTimes.Isha), timeStr: currentPrayerTimes.Isha }
    ];

    let nextPrayer = null;
    for (const prayer of prayers) {
        if (prayer.time > currentTime) {
            nextPrayer = prayer;
            break;
        }
    }

    if (!nextPrayer) {
        nextPrayer = { name: 'Fajr', time: prayers[0].time + 24 * 60, timeStr: currentPrayerTimes.Fajr };
    }

    const timeUntil = nextPrayer.time - currentTime;
    const hours = Math.floor(timeUntil / 60);
    const minutes = timeUntil % 60;

    const formattedTime = formatTo12Hour(nextPrayer.timeStr);

    let timeText = '';
    if (hours > 0) {
        const hourKey = hours === 1 ? 'prayer.hour' : 'prayer.hours';
        const minuteKey = minutes === 1 ? 'prayer.minute' : 'prayer.minutes';
        if (I18n.isRTL()) {
            timeText = `${hours} ${I18n.t(hourKey)} و${minutes} ${I18n.t(minuteKey)}`;
        } else {
            timeText = `${hours} ${I18n.t(hourKey)} ${minutes > 0 ? `and ${minutes} ${I18n.t(minuteKey)}` : ''}`;
        }
    } else {
        const minuteKey = minutes === 1 ? 'prayer.minute' : 'prayer.minutes';
        timeText = `${minutes} ${I18n.t(minuteKey)}`;
    }

    const prayerName = I18n.getPrayerName(nextPrayer.name);

    if (I18n.isRTL()) {
        nextPrayerText.innerHTML = `🕌 ${I18n.t('prayer.nextPrayer')}: ${prayerName} ${I18n.t('prayer.at')} ${formattedTime}<br><span class="countdown-time">${timeText}</span>`;
    } else {
        nextPrayerText.innerHTML = `🕌 ${I18n.t('prayer.nextPrayer')}: ${prayerName} ${I18n.t('prayer.at')} ${formattedTime}<br><span class="countdown-time">${timeText}</span>`;
    }

    renderPrayerCards(prayers, nextPrayer.name, formatTo12Hour);
    updateCalculationMethodDisplay();
}

function formatTo12Hour(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const isRTL = I18n.isRTL();
    const period = hours >= 12 ? (isRTL ? 'م' : I18n.t('prayer.pm')) : (isRTL ? 'ص' : I18n.t('prayer.am'));
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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
    }, 1000);
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
    startAutoScroll(0, prefersReducedMotion);
    reminderSettings.classList.add('hidden');
}

async function updateCalculationMethodDisplay() {
    const result = await chrome.storage.local.get(['calculationMethod', 'selectedCountry']);
    const currentMethod = result.calculationMethod || 'auto';

    let methodName;
    if (currentMethod === 'auto' && result.selectedCountry) {
        const autoMethodId = countryMethodMap[result.selectedCountry] || 2;
        methodName = I18n.t('calculationMethods.autoWithMethod', { method: I18n.t(`calculationMethods.${autoMethodId}`) });
    } else {
        methodName = I18n.t(`calculationMethods.${currentMethod}`) || I18n.t('calculationMethods.auto');
    }

    if (calculationMethodText) {
        calculationMethodText.textContent = I18n.t('calculationMethods.method', { method: methodName });
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

    const preEnabled = result.preReminderEnabled !== false;
    const exactEnabled = result.exactReminderEnabled !== false;
    notificationMasterEnabled = true;

    if (result.reminderTime) {
        setReminderSliderByMinutes(result.reminderTime);
    } else {
        setReminderSliderByMinutes(5);
    }

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
    // Language toggle
    langToggle?.addEventListener('click', async () => {
        const newLang = I18n.getLanguage() === 'ar' ? 'en' : 'ar';
        await I18n.setLanguage(newLang);
        updateUILanguage();
        populateCountrySelect(); // Re-populate to sort by new language
    });

    // Listen for language change event
    window.addEventListener('languageChanged', () => {
        updateUILanguage();
        updatePrayerDisplay();
        updateCalculationMethodDisplay();
        
        // In English mode, always show all countries
        if (I18n.getLanguage() === 'en') {
            showAllCountries = false;
        }
        populateCountrySelect();
        
        // Refresh city dropdown if a country is selected
        if (countrySelect && countrySelect.value) {
            populateCitySelect(countrySelect.value);
        }
        
        // Only update location display text if location is already visible (don't navigate)
        if (locationDisplay && !locationDisplay.classList.contains('hidden')) {
            chrome.storage.local.get(['selectedCountry', 'selectedCity', 'autoDetected']).then(result => {
                if (result.selectedCountry && result.selectedCity) {
                    const country = countriesData.find(c => c.iso2 === result.selectedCountry);
                    if (country) {
                        const currentLang = I18n.getLanguage();
                        const countryName = currentLang === 'ar' ? country.arabicName : country.englishName;
                        const cityDisplayName = currentLang === 'ar' 
                            ? (CityTranslations?.getName(result.selectedCity, 'ar') || result.selectedCity)
                            : result.selectedCity;
                        const autoDetectedText = result.autoDetected ? ' 📍' : '';
                        locationText.textContent = `${cityDisplayName}, ${countryName}${autoDetectedText}`;
                    }
                }
            });
        }
    });

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
                autoDetected: false
            });

            await showPrayerTimesSection(countryCode, cityName);
        }
    });

    editLocationBtn.addEventListener('click', () => {
        showLocationPrompt();
        updatePromptTitleForEdit();
    });

    autoDetectBtn?.addEventListener('click', () => {
        attemptAutoLocationDetection();
    });

    manualSelectBtn?.addEventListener('click', () => {
        proceedToManualSelection();
    });

    // Show more/less countries toggle (only in Arabic mode)
    showMoreBtn?.addEventListener('click', () => {
        showAllCountries = !showAllCountries;
        populateCountrySelect();
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
    const signature = `${I18n.getLanguage()}:${nextPrayerName}:${prayers.map(prayer => prayer.name + prayer.timeStr).join('|')}`;
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
        title.textContent = I18n.getPrayerName(prayer.name);

        const time = document.createElement('div');
        time.className = 'prayer-card-time';
        time.textContent = formatTo12Hour(prayer.timeStr);

        info.appendChild(title);
        info.appendChild(time);

        card.appendChild(info);

        if (prayer.name === nextPrayerName) {
            const badge = document.createElement('div');
            badge.className = 'prayer-card-next';
            badge.textContent = I18n.t('prayer.next');
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

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    stopIdleAutoScroll();
    clearIdleAutoScrollTimer();
});
