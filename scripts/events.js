// Event listeners setup

function setupEventListeners() {
  countrySelect.addEventListener('change', (e) => populateCitySelect(e.target.value));

  citySelect.addEventListener('change', updateSaveButton);

  saveLocationBtn.addEventListener('click', async () => {
    const countryCode = countrySelect.value;
    const cityName = citySelect.value;

    if (!countryCode || !cityName) return;

    await storage.set({
      selectedCountry: countryCode,
      selectedCity: cityName,
      autoDetected: false,
    });

    await showPrayerTimesSection(countryCode, cityName);
  });

  editLocationBtn.addEventListener('click', () => {
    showLocationSelection();
    countrySelect.value = '';
    citySelect.innerHTML = '<option value="">اختر المدينة</option>';
    citySelect.disabled = true;
    updateSaveButton();
  });

  reminderToggle.addEventListener('click', async () => {
    const result = await storage.get(['reminderEnabled']);
    const currentState = result.reminderEnabled !== false;
    const newState = !currentState;

    await storage.set({ reminderEnabled: newState });
    await updateReminderToggle();

    chrome.runtime.sendMessage({
      action: 'toggleReminder',
      enabled: newState,
    });
  });

  settingsToggle.addEventListener('click', () => {
    reminderSettings.classList.toggle('hidden');
  });

  saveSettingsBtn.addEventListener('click', async () => {
    const reminderTime = parseInt(reminderTimeSelect.value, 10);
    const calculationMethod = calculationMethodSelect.value;

    await storage.set({
      reminderTime,
      calculationMethod,
    });

    const result = await storage.get(['selectedCountry', 'selectedCity']);
    if (result.selectedCountry && result.selectedCity) {
      await loadPrayerTimes(result.selectedCountry, result.selectedCity);
    }

    updateCalculationMethodDisplay();
    reminderSettings.classList.add('hidden');

    showSuccess('تم حفظ الإعدادات بنجاح');
    setTimeout(hideSuccess, 2000);
  });
}
