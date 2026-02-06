// UI state and DOM element management

// DOM element references
let countrySelect,
  citySelect,
  saveLocationBtn,
  locationDisplay,
  locationText,
  editLocationBtn;
let locationSelection, prayerTimesSection, loadingState, errorState;
let nextPrayerText, countdownText, reminderToggle, calculationMethodText;
let settingsToggle, reminderSettings, reminderTimeSelect, calculationMethodSelect, saveSettingsBtn;

// Global state
let citiesData = [];
let currentPrayerTimes = null;
let countdownInterval = null;

function initializeElements() {
  countrySelect = el('countrySelect');
  citySelect = el('citySelect');
  saveLocationBtn = el('saveLocationBtn');
  locationDisplay = el('locationDisplay');
  locationText = el('locationText');
  editLocationBtn = el('editLocationBtn');
  locationSelection = el('locationSelection');
  prayerTimesSection = el('prayerTimesSection');
  loadingState = el('loadingState');
  errorState = el('errorState');
  nextPrayerText = el('nextPrayerText');
  countdownText = el('countdownText');
  reminderToggle = el('reminderToggle');
  calculationMethodText = el('calculationMethodText');
  settingsToggle = el('settingsToggle');
  reminderSettings = el('reminderSettings');
  reminderTimeSelect = el('reminderTime');
  calculationMethodSelect = el('calculationMethod');
  saveSettingsBtn = el('saveSettings');
}

function showLocationSelection() {
  locationDisplay.classList.add('hidden');
  prayerTimesSection.classList.add('hidden');
  locationSelection.classList.remove('hidden');
}

async function showPrayerTimesSection(countryCode, cityName) {
  const country = citiesData.find((c) => c.code === countryCode);
  const city = country?.cities.find((c) => c.en === cityName);

  if (!country || !city) return;

  const result = await storage.get(['autoDetected']);
  const autoDetectedText = result.autoDetected ? ' 📍' : '';

  locationText.textContent = `${city.ar}, ${country.name}${autoDetectedText}`;
  locationDisplay.classList.remove('hidden');
  locationSelection.classList.add('hidden');

  await loadPrayerTimes(countryCode, cityName);
  await updateReminderToggle();

  prayerTimesSection.classList.remove('hidden');
}

async function updateReminderToggle() {
  const result = await storage.get(['reminderEnabled', 'reminderTime', 'calculationMethod', 'selectedCountry']);
  const isEnabled = result.reminderEnabled !== false;

  reminderToggle.textContent = isEnabled ? '🚫 إيقاف التذكير' : '🔔 تفعيل التذكير';
  reminderToggle.className = isEnabled ? 'btn btn-danger' : 'btn btn-primary';

  if (result.reminderTime) reminderTimeSelect.value = result.reminderTime;

  const currentMethod = result.calculationMethod || 'auto';
  calculationMethodSelect.value = currentMethod;
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

function showSuccess(message) {
  errorState.textContent = message;
  errorState.classList.remove('hidden');
  errorState.classList.add('snackbar');
  errorState.style.background = 'rgb(34, 197, 94)';
  errorState.style.color = '#fff';
  
  // Auto-hide after 3 seconds
  const timeoutId = setTimeout(() => {
    hideSuccess();
  }, 3000);
  
  // Store timeout ID to clear if needed
  if (errorState.snackbarTimeout) {
    clearTimeout(errorState.snackbarTimeout);
  }
  errorState.snackbarTimeout = timeoutId;
}

function hideSuccess() {
  errorState.classList.add('hidden');
  errorState.classList.remove('snackbar');
  errorState.style.background = '';
  errorState.style.color = '';
  
  if (errorState.snackbarTimeout) {
    clearTimeout(errorState.snackbarTimeout);
    errorState.snackbarTimeout = null;
  }
}

function updateLoadingMessage(message) {
  if (loadingState) loadingState.textContent = message;
}

function updateSaveButton() {
  saveLocationBtn.disabled = !countrySelect.value || !citySelect.value;
}

function populateCountrySelect() {
  countrySelect.innerHTML = '<option value="">اختر دولة</option>';
  citiesData.forEach((country) => {
    const option = document.createElement('option');
    option.value = country.code;
    option.textContent = country.name;
    countrySelect.appendChild(option);
  });
}

function populateCitySelect(countryCode) {
  const country = citiesData.find((c) => c.code === countryCode);
  citySelect.innerHTML = '<option value="">اختر المدينة</option>';

  if (country?.cities) {
    country.cities.forEach((city) => {
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

async function loadCitiesData() {
  try {
    const response = await fetch('constants/cities.json');
    citiesData = await response.json();
    populateCountrySelect();
  } catch (err) {
    showError('خطأ في تحميل بيانات المدن');
  }
}

async function checkUserLocation() {
  const result = await storage.get(['selectedCountry', 'selectedCity', 'locationDetected']);

  if (result.selectedCountry && result.selectedCity) {
    await showPrayerTimesSection(result.selectedCountry, result.selectedCity);
  } else if (!result.locationDetected) {
    // First time user - show location selection UI immediately
    showLocationSelection();

    attemptAutoLocationDetection();
  } else {
    showLocationSelection();
  }
}
