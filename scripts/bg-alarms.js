// Alarm setup and management

function setupKeepAlive() {
  chrome.alarms.create('keepAlive', {
    delayInMinutes: 0.1,
    periodInMinutes: 1,
  });
}

function setupDailyUpdate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 1, 0, 0);

  chrome.alarms.create('dailyUpdate', {
    when: tomorrow.getTime(),
    periodInMinutes: 24 * 60,
  });
}

async function setupPrayerAlarms(prayerTimes, countryCode, cityName) {
  const alarms = await chrome.alarms.getAll();
  alarms.forEach((alarm) => {
    if (alarm.name.startsWith('prayer_')) chrome.alarms.clear(alarm.name);
  });

  const result = await bgStorage.get(['reminderEnabled', 'reminderTime']);
  const reminderEnabled = result.reminderEnabled !== false;
  const reminderMinutes = result.reminderTime || 5;

  if (!reminderEnabled) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  PRAYERS.forEach((prayer) => {
    if (!prayerTimes[prayer]) return;

    const [hours, minutes] = prayerTimes[prayer].split(':').map(Number);
    const prayerDate = new Date(today);
    prayerDate.setHours(hours, minutes, 0, 0);

    const reminderTime = new Date(prayerDate.getTime() - reminderMinutes * 60 * 1000);

    if (reminderTime > now) {
      chrome.alarms.create(`prayer_${prayer}`, {
        when: reminderTime.getTime(),
      });
    } else {
      const tomorrowPrayerDate = new Date(prayerDate.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowReminderTime = new Date(tomorrowPrayerDate.getTime() - reminderMinutes * 60 * 1000);

      chrome.alarms.create(`prayer_${prayer}`, {
        when: tomorrowReminderTime.getTime(),
      });
    }
  });

  await bgStorage.set({
    currentCountryCode: countryCode,
    currentCityName: cityName,
  });
}

async function setupNextDayAlarm(alarmName) {
  const prayerName = alarmName.replace('prayer_', '');
  const result = await bgStorage.get(['prayerTimes', 'reminderTime']);

  if (!result.prayerTimes || !result.prayerTimes[prayerName]) return;

  const reminderMinutes = result.reminderTime || 5;
  const prayerTime = result.prayerTimes[prayerName];
  const [hours, minutes] = prayerTime.split(':').map(Number);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hours, minutes, 0, 0);

  const tomorrowReminderTime = new Date(tomorrow.getTime() - reminderMinutes * 60 * 1000);

  chrome.alarms.create(alarmName, {
    when: tomorrowReminderTime.getTime(),
  });
}

async function validateReminderTime() {
  try {
    const result = await bgStorage.get(['prayerTimes', 'reminderTime']);

    if (!result.prayerTimes) return false;

    const reminderMinutes = result.reminderTime || 5;
    const now = new Date();
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

    for (const prayerName of PRAYERS) {
      if (result.prayerTimes[prayerName]) {
        const [hours, minutes] = result.prayerTimes[prayerName].split(':').map(Number);
        const prayerTimeMinutes = hours * 60 + minutes;
        const reminderStartMinutes = prayerTimeMinutes - reminderMinutes;

        if (currentTimeMinutes >= reminderStartMinutes && currentTimeMinutes <= prayerTimeMinutes) {
          return true;
        }
      }
    }

    return false;
  } catch (err) {
    return false;
  }
}

async function cleanupOldPostponedReminders() {
  try {
    const result = await bgStorage.get(['postponedReminders']);
    if (!result.postponedReminders) return;

    const now = Date.now();
    const validReminders = result.postponedReminders.filter((reminder) => now - reminder.createdAt < POSTPONE_VALIDITY_MS);

    await bgStorage.set({ postponedReminders: validReminders });
  } catch (err) {
    // Silent
  }
}

async function cleanupOldPostponeTracker() {
  try {
    const result = await bgStorage.get(['postponeTracker']);
    if (!result.postponeTracker) return;

    const now = Date.now();
    const cleanedTracker = {};

    Object.entries(result.postponeTracker).forEach(([key, value]) => {
      if (now - value.postponedAt < POSTPONE_VALIDITY_MS) {
        cleanedTracker[key] = value;
      }
    });

    await bgStorage.set({ postponeTracker: cleanedTracker });
  } catch (err) {
    // Silent
  }
}

async function restoreAlarmsOnStartup() {
  try {
    await restorePostponedReminders();

    const result = await bgStorage.get(['prayerTimes', 'currentCountryCode', 'currentCityName', 'reminderEnabled']);

    if (result.prayerTimes && result.currentCountryCode && result.currentCityName) {
      const reminderEnabled = result.reminderEnabled !== false;
      if (reminderEnabled) {
        await setupPrayerAlarms(result.prayerTimes, result.currentCountryCode, result.currentCityName);
      }
    }

    setupDailyUpdate();
    setupKeepAlive();
  } catch (err) {
    // Silent
  }
}
