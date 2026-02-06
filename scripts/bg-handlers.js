// Message and event handlers

async function handlePrayerReminder(alarmName) {
  const prayerName = alarmName.replace('prayer_', '');

  const result = await bgStorage.get(['reminderEnabled', 'reminderTime', 'prayerTimes']);
  const reminderEnabled = result.reminderEnabled !== false;
  const reminderMinutes = result.reminderTime || 5;

  if (!reminderEnabled) return;

  if (result.prayerTimes && result.prayerTimes[prayerName]) {
    const now = new Date();
    const [hours, minutes] = result.prayerTimes[prayerName].split(':').map(Number);

    const prayerTime = new Date();
    prayerTime.setHours(hours, minutes, 0, 0);

    const reminderStartTime = new Date(prayerTime.getTime() - reminderMinutes * 60 * 1000);

    if (now < reminderStartTime || now > prayerTime) return;
  }

  await showPrayerReminder(prayerName, reminderMinutes);
  await setupNextDayAlarm(alarmName);
}

async function handleReminderToggle(enabled) {
  if (enabled) {
    const result = await bgStorage.get(['prayerTimes', 'currentCountryCode', 'currentCityName']);
    if (result.prayerTimes && result.currentCountryCode && result.currentCityName) {
      await setupPrayerAlarms(result.prayerTimes, result.currentCountryCode, result.currentCityName);
    }
  } else {
    const alarms = await chrome.alarms.getAll();
    alarms.forEach((alarm) => {
      if (alarm.name.startsWith('prayer_')) chrome.alarms.clear(alarm.name);
    });
  }
}

async function handlePostponeClick() {
  const postponeTracker = (await bgStorage.get(['postponeTracker'])) || { postponeTracker: {} };
  const tracker = postponeTracker.postponeTracker || {};

  const now = new Date();
  const currentHour = now.getHours();
  const trackingKey = `prayer_${currentHour}_${now.toDateString()}`;

  if (tracker[trackingKey]) {
    showNoMorePostpone();
    return;
  }

  tracker[trackingKey] = {
    postponedAt: Date.now(),
    count: 1,
  };
  await bgStorage.set({ postponeTracker: tracker });

  const snoozeTime = new Date(Date.now() + SNOOZE_MINUTES * 60 * 1000);
  const snoozeId = `snooze_${Date.now()}`;

  chrome.alarms.create(snoozeId, {
    when: snoozeTime.getTime(),
  });

  const postponedReminders = (await bgStorage.get(['postponedReminders'])) || { postponedReminders: [] };
  const reminders = postponedReminders.postponedReminders || [];
  reminders.push({
    id: snoozeId,
    scheduledTime: snoozeTime.getTime(),
    createdAt: Date.now(),
    trackingKey,
  });

  await bgStorage.set({ postponedReminders: reminders });
  showPostponeConfirmation();
}

async function updatePrayerTimesDaily() {
  try {
    const result = await bgStorage.get(['currentCountryCode', 'currentCityName']);

    if (!result.currentCountryCode || !result.currentCityName) return;

    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    const settings = await bgStorage.get(['calculationMethod', 'currentCountryCode']);
    const autoMethod = COUNTRY_METHOD_MAP[settings.currentCountryCode] || 2;

    let method = settings.calculationMethod === 'auto' || !settings.calculationMethod ? autoMethod : parseInt(settings.calculationMethod, 10);

    const url = new URL(API_CONFIG.baseUrl);
    url.searchParams.set('city', result.currentCityName);
    url.searchParams.set('country', result.currentCountryCode);
    url.searchParams.set('method', method);
    url.searchParams.set('school', API_CONFIG.school);
    url.searchParams.set('latitudeAdjustmentMethod', API_CONFIG.latitudeAdjustmentMethod);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Failed to fetch prayer times');

    const data = await response.json();

    if (data.code === 200 && data.data?.timings) {
      await bgStorage.set({
        prayerTimes: data.data.timings,
        lastUpdated: Date.now(),
      });

      await setupPrayerAlarms(data.data.timings, result.currentCountryCode, result.currentCityName);
    }
  } catch (err) {
    // Silent
  }
}

async function restorePostponedReminders() {
  try {
    const result = await bgStorage.get(['postponedReminders']);
    if (!result.postponedReminders) return;

    const now = Date.now();
    const validReminders = [];

    for (const reminder of result.postponedReminders) {
      const timeDiff = reminder.scheduledTime - now;
      if (timeDiff > -LATE_REMINDER_THRESHOLD_MS) {
        if (timeDiff > 0) {
          chrome.alarms.create(reminder.id, {
            when: reminder.scheduledTime,
          });
          validReminders.push(reminder);
        } else {
          const shouldFire = await validateReminderTime();

          if (shouldFire) {
            const lateNotificationId = `late_snooze_reminder_${Date.now()}`;
            chrome.notifications.create(lateNotificationId, {
              type: 'basic',
              iconUrl: 'icon.png',
              title: 'تذكير مؤجل 🔔',
              message: 'تذكير: حان وقت الصلاة (لا يمكن التأجيل مرة أخرى)',
              priority: 2,
              requireInteraction: true,
              buttons: [{ title: 'تم' }],
            });

            setTimeout(() => {
              chrome.notifications.clear(lateNotificationId);
            }, NOTIFICATION_AUTO_CLEAR_MS);
          }
        }
      }
    }

    await bgStorage.set({ postponedReminders: validReminders });
  } catch (err) {
    // Silent
  }
}
