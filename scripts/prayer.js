// Prayer time fetching and display logic

async function loadPrayerTimes(countryCode, cityName) {
  showLoading(true);
  hideError();

  try {
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    const settings = await storage.get(['calculationMethod']);
    const autoMethod = countryMethodMap[countryCode] || 2;
    let method =
      settings.calculationMethod === 'auto' || !settings.calculationMethod
        ? autoMethod
        : parseInt(settings.calculationMethod, 10);

    const url = new URL(API_CONFIG.baseUrl);
    url.searchParams.set('city', cityName);
    url.searchParams.set('country', countryCode);
    url.searchParams.set('method', method);
    url.searchParams.set('school', API_CONFIG.school);
    url.searchParams.set('latitudeAdjustmentMethod', API_CONFIG.latitudeAdjustmentMethod);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Failed to fetch prayer times');

    const data = await response.json();
    if (data.code === 200 && data.data?.timings) {
      currentPrayerTimes = data.data.timings;
      await storage.set({ prayerTimes: currentPrayerTimes, lastUpdated: Date.now() });

      updatePrayerDisplay();
      startCountdown();

      chrome.runtime.sendMessage({
        action: 'updatePrayerTimes',
        prayerTimes: currentPrayerTimes,
        countryCode,
        cityName,
      });
    } else {
      throw new Error('Invalid API response');
    }
  } catch (err) {
    showError('خطأ في تحميل رفيق الصلاة. يرجى المحاولة مرة أخرى.');
  } finally {
    showLoading(false);
  }
}

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
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
    { name: 'Isha', time: timeToMinutes(currentPrayerTimes.Isha), timeStr: currentPrayerTimes.Isha },
  ];

  let nextPrayer =
    prayers.find((p) => p.time > currentTime) || {
      name: 'Fajr',
      time: prayers[0].time + 24 * 60,
      timeStr: currentPrayerTimes.Fajr,
    };

  const timeUntil = nextPrayer.time - currentTime;
  const hours = Math.floor(timeUntil / 60);
  const minutes = timeUntil % 60;

  const formatTo12Hour = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'م' : 'ص';
    const displayHours = h % 12 || 12;
    return `${displayHours}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const timeText = hours > 0 ? `${hours} ساعة و${minutes} دقيقة` : `${minutes} دقيقة`;
  const formattedTime = formatTo12Hour(nextPrayer.timeStr);

  nextPrayerText.innerHTML = `🕌 الصلاة القادمة: ${PRAYER_NAMES[nextPrayer.name]} في ${formattedTime}<br><span class="countdown-time">${timeText}</span>`;

  updateCalculationMethodDisplay();
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    updatePrayerDisplay();
    updateCountdownDisplay();
  }, 1000);
}

function updateCountdownDisplay() {
  const now = new Date();
  const timeStr = now
    .toLocaleTimeString('ar-SA', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(/AM/g, 'ص')
    .replace(/PM/g, 'م');

  countdownText.textContent = `الوقت الحالي: ${timeStr}`;
  countdownText.classList.remove('hidden');
}

async function updateCalculationMethodDisplay() {
  const result = await storage.get(['calculationMethod', 'selectedCountry']);
  const currentMethod = result.calculationMethod || 'auto';

  let methodName;
  if (currentMethod === 'auto' && result.selectedCountry) {
    const autoMethodId = countryMethodMap[result.selectedCountry] || 2;
    methodName = `${CALCULATION_METHODS.auto} (${CALCULATION_METHODS[autoMethodId.toString()]})`;
  } else {
    methodName = CALCULATION_METHODS[currentMethod] || CALCULATION_METHODS.auto;
  }

  if (calculationMethodText) {
    calculationMethodText.textContent = `طريقة الحساب: ${methodName}`;
  }
}
