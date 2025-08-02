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

// DOM elements
let countrySelect, citySelect, saveLocationBtn, locationDisplay, locationText, editLocationBtn;
let locationSelection, prayerTimesSection, loadingState, errorState;
let nextPrayerText, countdownText, reminderToggle;

// Global variables
let citiesData = [];
let currentPrayerTimes = null;
let countdownInterval = null;
let settingsToggle, reminderSettings, reminderTimeSelect, calculationMethodSelect, saveSettingsBtn, testNotificationBtn;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    initializeElements();
    await loadCitiesData();
    await checkUserLocation();
    setupEventListeners();
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
    reminderToggle = document.getElementById('reminderToggle');
    settingsToggle = document.getElementById('settingsToggle');
    reminderSettings = document.getElementById('reminderSettings');
    reminderTimeSelect = document.getElementById('reminderTime');
    calculationMethodSelect = document.getElementById('calculationMethod');
    saveSettingsBtn = document.getElementById('saveSettings');
    testNotificationBtn = document.getElementById('testNotification');
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
    const result = await chrome.storage.local.get(['selectedCountry', 'selectedCity']);
    
    if (result.selectedCountry && result.selectedCity) {
        showPrayerTimesSection(result.selectedCountry, result.selectedCity);
    } else {
        showLocationSelection();
    }
}

function showLocationSelection() {
    locationDisplay.classList.add('hidden');
    prayerTimesSection.classList.add('hidden');
    locationSelection.classList.remove('hidden');
}

async function showPrayerTimesSection(countryCode, cityName) {
    const country = citiesData.find(c => c.code === countryCode);
    const city = country?.cities.find(c => c.en === cityName);
    
    if (country && city) {
        locationText.textContent = `${city.ar}, ${country.name}`;
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
        // Get current date and calculation method
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        
        // Auto-detect calculation method based on country, fallback to user setting or default
        const settings = await chrome.storage.local.get(['calculationMethod']);
        const autoMethod = countryMethodMap[countryCode] || 2;
        
        let method;
        if (settings.calculationMethod === 'auto' || !settings.calculationMethod) {
            method = autoMethod;
        } else {
            method = parseInt(settings.calculationMethod);
        }
        
        // Fetch prayer times from Aladhan API
        const response = await fetch(
            `https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=${encodeURIComponent(cityName)}&country=${countryCode}&method=${method}`
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
        showError('خطأ في تحميل مواقيت الصلاة. يرجى المحاولة مرة أخرى.');
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
        { name: 'Fajr', time: timeToMinutes(currentPrayerTimes.Fajr) },
        { name: 'Dhuhr', time: timeToMinutes(currentPrayerTimes.Dhuhr) },
        { name: 'Asr', time: timeToMinutes(currentPrayerTimes.Asr) },
        { name: 'Maghrib', time: timeToMinutes(currentPrayerTimes.Maghrib) },
        { name: 'Isha', time: timeToMinutes(currentPrayerTimes.Isha) }
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
        nextPrayer = { name: 'Fajr', time: prayers[0].time + 24 * 60 };
    }
    
    const timeUntil = nextPrayer.time - currentTime;
    const hours = Math.floor(timeUntil / 60);
    const minutes = timeUntil % 60;
    
    let timeText = '';
    if (hours > 0) {
        timeText = `بعد ${hours} ساعة و${minutes} دقيقة`;
    } else {
        timeText = `بعد ${minutes} دقيقة`;
    }
    
    nextPrayerText.textContent = `🕌 الصلاة القادمة: ${PRAYER_NAMES[nextPrayer.name]} ${timeText}`;
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
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-SA', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    countdownText.textContent = `الوقت الحالي: ${timeStr}`;
}

async function updateReminderToggle() {
    const result = await chrome.storage.local.get(['reminderEnabled', 'reminderTime', 'calculationMethod', 'selectedCountry']);
    const isEnabled = result.reminderEnabled !== false; // Default to true
    
    reminderToggle.textContent = isEnabled ? '🚫 إيقاف التذكير' : '🔔 تفعيل التذكير';
    reminderToggle.className = isEnabled ? 'btn btn-danger' : 'btn btn-primary';
    
    // Update settings UI
    if (result.reminderTime) {
        reminderTimeSelect.value = result.reminderTime;
    }
    
    // Set calculation method - default to auto if not set
    const currentMethod = result.calculationMethod || 'auto';
    calculationMethodSelect.value = currentMethod;
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
                selectedCity: cityName
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
    
    reminderToggle.addEventListener('click', async () => {
        const result = await chrome.storage.local.get(['reminderEnabled']);
        const currentState = result.reminderEnabled !== false;
        const newState = !currentState;
        
        await chrome.storage.local.set({ reminderEnabled: newState });
        await updateReminderToggle();
        
        // Notify background script
        chrome.runtime.sendMessage({
            action: 'toggleReminder',
            enabled: newState
        });
    });
    
    settingsToggle.addEventListener('click', () => {
        reminderSettings.classList.toggle('hidden');
    });
    
    saveSettingsBtn.addEventListener('click', async () => {
        const reminderTime = parseInt(reminderTimeSelect.value);
        const calculationMethod = calculationMethodSelect.value; // Keep as string to handle 'auto'
        
        await chrome.storage.local.set({
            reminderTime: reminderTime,
            calculationMethod: calculationMethod
        });
        
        // Reload prayer times with new calculation method
        const result = await chrome.storage.local.get(['selectedCountry', 'selectedCity']);
        if (result.selectedCountry && result.selectedCity) {
            await loadPrayerTimes(result.selectedCountry, result.selectedCity);
        }
        
        // Hide settings panel
        reminderSettings.classList.add('hidden');
        
        // Show success message
        showError('تم حفظ الإعدادات بنجاح');
        setTimeout(() => {
            hideError();
        }, 2000);
    });
    
    testNotificationBtn.addEventListener('click', async () => {
        // Show immediate feedback
        showError('جاري إرسال تنبيه تجريبي...');
        
        try {
            // Send test notification request to background script
            chrome.runtime.sendMessage({ action: 'testNotification' });
            
            // Check notification permission
            const permission = await chrome.notifications.getPermissionLevel();
            
            if (permission === 'denied') {
                showError('❌ الإشعارات مرفوضة. يرجى تفعيلها من إعدادات المتصفح');
                setTimeout(() => {
                    hideError();
                }, 5000);
                return;
            }
            
            // Show success message
            showError('✅ تم إرسال تنبيه تجريبي - تحقق من الإشعارات');
            setTimeout(() => {
                hideError();
            }, 3000);
            
        } catch (error) {
            showError('❌ خطأ في إرسال التنبيه التجريبي');
            setTimeout(() => {
                hideError();
            }, 3000);
        }
    });
    

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
});