/**
 * Prayer Pal Background Script
 * Handles alarms, notifications, and prayer time scheduling
 */

// Prayer names keys for i18n
const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// Initialize background script
chrome.runtime.onInstalled.addListener(async () => {
    setupDailyUpdate();
    setupKeepAlive();

    // Send a welcome notification
    setTimeout(async () => {
        try {
            const lang = await getLanguage();
            const title = lang === 'ar'
                ? 'مرحباً بك في رفيق الصلاة  🕌'
                : 'Welcome to Prayer Pal 🕌';
            const message = lang === 'ar'
                ? 'تم تثبيت الإكستنشن بنجاح. اختر موقعك لبدء التذكير.'
                : 'Extension installed successfully. Select your location to start receiving reminders.';

            await chrome.notifications.create('welcome', {
                type: 'basic',
                iconUrl: 'icon.png',
                title: title,
                message: message,
                priority: 1
            });

            setTimeout(() => {
                chrome.notifications.clear('welcome');
            }, 5000);
        } catch (error) {
            // Silent error handling
        }
    }, 1000);
});

// Get current language from storage
async function getLanguage() {
    const result = await chrome.storage.local.get(['selectedLanguage']);
    return result.selectedLanguage || 'ar';
}

// Keep service worker alive
function setupKeepAlive() {
    chrome.alarms.create('keepAlive', {
        delayInMinutes: 0.1,
        periodInMinutes: 1
    });
}

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'keepAlive') {
        return;
    }

    if (alarm.name === 'dailyUpdate') {
        await updatePrayerTimesDaily();
        await cleanupOldPostponedReminders();
        await cleanupOldPostponeTracker();
    } else if (alarm.name.startsWith('prayer_')) {
        await handlePrayerReminder(alarm.name);
        await setupNextDayAlarm(alarm.name);
    } else if (alarm.name.startsWith('snooze_')) {
        const shouldShow = await validateReminderTime();

        if (shouldShow) {
            const notificationId = `snooze_reminder_${Date.now()}`;
            const lang = await getLanguage();

            const title = lang === 'ar' ? 'تذكير مؤجل 🔔' : 'Postponed Reminder 🔔';
            const message = lang === 'ar'
                ? 'تذكير: حان وقت الصلاة (لا يمكن التأجيل مرة أخرى)'
                : 'Reminder: It\'s time for prayer (cannot be postponed again)';

            chrome.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: 'icon.png',
                title: title,
                message: message,
                priority: 2,
                requireInteraction: true,
                buttons: [
                    { title: lang === 'ar' ? 'تم' : 'Done' }
                ]
            });

            setTimeout(() => {
                chrome.notifications.clear(notificationId);
            }, 120000);
        }

        const postponedReminders = await chrome.storage.local.get(['postponedReminders']);
        if (postponedReminders.postponedReminders) {
            const updatedReminders = postponedReminders.postponedReminders.filter(
                reminder => reminder.id !== alarm.name
            );
            await chrome.storage.local.set({ postponedReminders: updatedReminders });
        }
    }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    switch (request.action) {
        case 'updatePrayerTimes':
            await setupPrayerAlarms(request.prayerTimes, request.countryCode, request.cityName);
            break;
        case 'toggleReminder':
            await handleReminderToggle(request.enabled);
            break;
        case 'updateNotificationSettings':
            await handleNotificationSettingsUpdate();
            break;
    }
    return true;
});

async function validateReminderTime() {
    try {
        const result = await chrome.storage.local.get(['prayerTimes', 'reminderTime']);

        if (!result.prayerTimes) {
            return false;
        }

        const reminderMinutes = result.reminderTime || 5;
        const now = new Date();
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

        const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

        for (const prayerName of prayers) {
            if (result.prayerTimes[prayerName]) {
                const prayerTimeStr = result.prayerTimes[prayerName];
                const [hours, minutes] = prayerTimeStr.split(':').map(Number);
                const prayerTimeMinutes = hours * 60 + minutes;

                const reminderStartMinutes = prayerTimeMinutes - reminderMinutes;

                if (currentTimeMinutes >= reminderStartMinutes && currentTimeMinutes <= prayerTimeMinutes) {
                    return true;
                }
            }
        }

        return false;
    } catch (error) {
        return false;
    }
}

async function setupNextDayAlarm(alarmName) {
    const alarmParts = alarmName.split('_');
    const alarmType = alarmParts.length >= 3 ? alarmParts[1] : 'pre';
    const prayerName = alarmParts.length >= 3 ? alarmParts.slice(2).join('_') : alarmParts.slice(1).join('_');
    const result = await chrome.storage.local.get(['prayerTimes', 'reminderTime', 'preReminderEnabled', 'exactReminderEnabled', 'reminderEnabled']);

    const reminderMinutes = result.reminderTime || 5;
    const preEnabled = result.preReminderEnabled !== false;
    const exactEnabled = result.exactReminderEnabled !== false;

    await chrome.storage.local.set({ lastScheduleError: null });

    if (result.prayerTimes && result.prayerTimes[prayerName]) {
        const prayerTime = result.prayerTimes[prayerName];
        const [hours, minutes] = prayerTime.split(':').map(Number);

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(hours, minutes, 0, 0);

        if (alarmType === 'pre' && preEnabled) {
            const tomorrowReminderTime = new Date(tomorrow.getTime() - reminderMinutes * 60 * 1000);
            scheduleAlarmSafe(alarmName, tomorrowReminderTime.getTime());
        }

        if (alarmType === 'exact' && exactEnabled) {
            scheduleAlarmSafe(alarmName, tomorrow.getTime());
        }
    }
}

async function setupPrayerAlarms(prayerTimes, countryCode, cityName) {
    const alarms = await chrome.alarms.getAll();
    for (const alarm of alarms) {
        if (alarm.name.startsWith('prayer_')) {
            chrome.alarms.clear(alarm.name);
        }
    }

    const result = await chrome.storage.local.get([
        'reminderEnabled',
        'reminderTime',
        'preReminderEnabled',
        'exactReminderEnabled'
    ]);

    const reminderMinutes = result.reminderTime || 5;
    const preEnabled = result.preReminderEnabled !== false;
    const exactEnabled = result.exactReminderEnabled !== false;

    await chrome.storage.local.set({ lastScheduleError: null });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    prayers.forEach(prayer => {
        const prayerTime = prayerTimes[prayer];
        if (prayerTime) {
            const [hours, minutes] = prayerTime.split(':').map(Number);
            const prayerDate = new Date(today);
            prayerDate.setHours(hours, minutes, 0, 0);

            if (preEnabled) {
                const reminderTime = new Date(prayerDate.getTime() - reminderMinutes * 60 * 1000);
                if (reminderTime > now) {
                    scheduleAlarmSafe(`prayer_pre_${prayer}`, reminderTime.getTime());
                } else {
                    const tomorrowPrayerDate = new Date(prayerDate.getTime() + 24 * 60 * 60 * 1000);
                    const tomorrowReminderTime = new Date(tomorrowPrayerDate.getTime() - reminderMinutes * 60 * 1000);
                    scheduleAlarmSafe(`prayer_pre_${prayer}`, tomorrowReminderTime.getTime());
                }
            }

            if (exactEnabled) {
                if (prayerDate > now) {
                    scheduleAlarmSafe(`prayer_exact_${prayer}`, prayerDate.getTime());
                } else {
                    const tomorrowExact = new Date(prayerDate.getTime() + 24 * 60 * 60 * 1000);
                    scheduleAlarmSafe(`prayer_exact_${prayer}`, tomorrowExact.getTime());
                }
            }
        }
    });

    await chrome.storage.local.set({
        currentCountryCode: countryCode,
        currentCityName: cityName
    });
}

async function handlePrayerReminder(alarmName) {
    const alarmParts = alarmName.split('_');
    const alarmType = alarmParts.length >= 3 ? alarmParts[1] : 'pre';
    const prayerName = alarmParts.length >= 3 ? alarmParts.slice(2).join('_') : alarmParts.slice(1).join('_');

    const lang = await getLanguage();

    const prayerNames = {
        'Fajr': lang === 'ar' ? 'الفجر' : 'Fajr',
        'Sunrise': lang === 'ar' ? 'الشروق' : 'Sunrise',
        'Dhuhr': lang === 'ar' ? 'الظهر' : 'Dhuhr',
        'Asr': lang === 'ar' ? 'العصر' : 'Asr',
        'Maghrib': lang === 'ar' ? 'المغرب' : 'Maghrib',
        'Isha': lang === 'ar' ? 'العشاء' : 'Isha'
    };

    const arabicName = prayerNames[prayerName];

    const result = await chrome.storage.local.get([
        'reminderEnabled',
        'reminderTime',
        'prayerTimes',
        'preReminderEnabled',
        'exactReminderEnabled'
    ]);
    const reminderMinutes = result.reminderTime || 5;

    if (alarmType === 'pre' && result.preReminderEnabled === false) {
        return;
    }

    if (alarmType === 'exact' && result.exactReminderEnabled === false) {
        return;
    }

    if (result.prayerTimes && result.prayerTimes[prayerName]) {
        const now = new Date();
        const prayerTimeStr = result.prayerTimes[prayerName];
        const [hours, minutes] = prayerTimeStr.split(':').map(Number);

        const prayerTime = new Date();
        prayerTime.setHours(hours, minutes, 0, 0);

        if (alarmType === 'pre') {
            const reminderStartTime = new Date(prayerTime.getTime() - reminderMinutes * 60 * 1000);
            if (now < reminderStartTime || now > prayerTime) {
                return;
            }
        }

        if (alarmType === 'exact') {
            const diffMinutes = Math.abs(now.getTime() - prayerTime.getTime()) / 60000;
            if (diffMinutes > 10) {
                return;
            }
        }
    }

    let timeMessage;
    if (alarmType === 'pre') {
        if (reminderMinutes === 1) {
            timeMessage = lang === 'ar' ? 'خلال دقيقة واحدة' : 'in 1 minute';
        } else if (reminderMinutes < 60) {
            timeMessage = lang === 'ar'
                ? `خلال ${reminderMinutes} دقيقة`
                : `in ${reminderMinutes} minutes`;
        } else {
            const hours = Math.floor(reminderMinutes / 60);
            const mins = reminderMinutes % 60;
            if (mins === 0) {
                timeMessage = lang === 'ar'
                    ? `خلال ${hours} ساعة`
                    : `in ${hours} hour${hours > 1 ? 's' : ''}`;
            } else {
                timeMessage = lang === 'ar'
                    ? `خلال ${hours} ساعة و${mins} دقيقة`
                    : `in ${hours} hour${hours > 1 ? 's' : ''} and ${mins} minute${mins > 1 ? 's' : ''}`;
            }
        }
    } else {
        timeMessage = lang === 'ar' ? 'الآن' : 'Now';
    }

    const notificationId = `prayer_notification_${Date.now()}`;

    try {
        const permission = await chrome.notifications.getPermissionLevel();
        if (permission === 'denied') {
            return;
        }

        const title = alarmType === 'pre'
            ? (lang === 'ar' ? 'تذكير الصلاة 🕌' : 'Prayer Reminder 🕌')
            : (lang === 'ar' ? 'حان وقت الصلاة 🕌' : 'Time for Prayer 🕌');

        const message = alarmType === 'pre'
            ? (lang === 'ar'
                ? `حان وقت صلاة ${arabicName} ${timeMessage}`
                : `Time for ${arabicName} prayer ${timeMessage}`)
            : (lang === 'ar'
                ? `حان وقت صلاة ${arabicName}`
                : `Time for ${arabicName} prayer`);

        const doneButton = lang === 'ar' ? 'تم' : 'Done';
        const postponeButton = lang === 'ar' ? 'تأجيل 5 دقائق' : 'Postpone 5 minutes';

        await chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: 'icon.png',
            title: title,
            message: message,
            priority: 2,
            requireInteraction: true,
            buttons: alarmType === 'pre'
                ? [{ title: doneButton }, { title: postponeButton }]
                : [{ title: doneButton }]
        });

        setTimeout(() => {
            chrome.notifications.clear(notificationId);
        }, 120000);

    } catch (error) {
        try {
            const fallbackTitle = lang === 'ar' ? 'تذكير الصلاة' : 'Prayer Reminder';
            const fallbackMessage = alarmType === 'pre'
                ? (lang === 'ar' ? `صلاة ${arabicName} ${timeMessage}` : `${arabicName} prayer ${timeMessage}`)
                : (lang === 'ar' ? `حان وقت صلاة ${arabicName}` : `Time for ${arabicName} prayer`);

            await chrome.notifications.create(`fallback_${Date.now()}`, {
                type: 'basic',
                iconUrl: 'icon.png',
                title: fallbackTitle,
                message: fallbackMessage
            });
        } catch (fallbackError) {
            // Silent error handling
        }
    }
}

async function handleReminderToggle(enabled) {
    if (enabled) {
        const result = await chrome.storage.local.get(['prayerTimes', 'currentCountryCode', 'currentCityName']);
        if (result.prayerTimes && result.currentCountryCode && result.currentCityName) {
            setupPrayerAlarms(result.prayerTimes, result.currentCountryCode, result.currentCityName);
        }
    } else {
        const alarms = await chrome.alarms.getAll();
        for (const alarm of alarms) {
            if (alarm.name.startsWith('prayer_') || alarm.name.startsWith('snooze_')) {
                chrome.alarms.clear(alarm.name);
            }
        }
    }
}

async function handleNotificationSettingsUpdate() {
    const result = await chrome.storage.local.get(['prayerTimes', 'currentCountryCode', 'currentCityName', 'reminderEnabled']);
    if (result.prayerTimes && result.currentCountryCode && result.currentCityName) {
        setupPrayerAlarms(result.prayerTimes, result.currentCountryCode, result.currentCityName);
    }
}

function scheduleAlarmSafe(alarmName, when) {
    try {
        chrome.alarms.create(alarmName, { when });
    } catch (error) {
        chrome.storage.local.set({
            lastScheduleError: {
                message: 'An error occurred while scheduling reminders. Please try again.',
                at: Date.now()
            }
        });
    }
}

function setupDailyUpdate() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 1, 0, 0);

    chrome.alarms.create('dailyUpdate', {
        when: tomorrow.getTime(),
        periodInMinutes: 24 * 60
    });
}

async function updatePrayerTimesDaily() {
    try {
        const result = await chrome.storage.local.get(['currentCountryCode', 'currentCityName']);

        if (!result.currentCountryCode || !result.currentCityName) {
            return;
        }

        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

        const settings = await chrome.storage.local.get(['calculationMethod', 'currentCountryCode']);
        const countryMethodMap = {
            'EG': 5, 'DZ': 5, 'SD': 5, 'IQ': 3, 'MA': 5, 'SA': 4, 'YE': 3, 'JO': 3,
            'AE': 8, 'LY': 5, 'PS': 3, 'OM': 8, 'KW': 9, 'MR': 3, 'QA': 10, 'BH': 8,
            'LB': 3, 'SY': 3, 'TN': 7
        };
        const autoMethod = countryMethodMap[settings.currentCountryCode] || 2;

        let method;
        if (settings.calculationMethod === 'auto' || !settings.calculationMethod) {
            method = autoMethod;
        } else {
            method = parseInt(settings.calculationMethod);
        }

        const school = 0;
        const latitudeAdjustmentMethod = 'NONE';
        const response = await fetch(
            `https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=${encodeURIComponent(result.currentCityName)}&country=${result.currentCountryCode}&method=${method}&school=${school}&latitudeAdjustmentMethod=${latitudeAdjustmentMethod}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch prayer times');
        }

        const data = await response.json();

        if (data.code === 200 && data.data && data.data.timings) {
            const prayerTimes = data.data.timings;

            await chrome.storage.local.set({
                prayerTimes: prayerTimes,
                lastUpdated: Date.now()
            });

            await setupPrayerAlarms(prayerTimes, result.currentCountryCode, result.currentCityName);
        }
    } catch (error) {
        // Silent error handling
    }
}

chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.notifications.clear(notificationId);
    chrome.action.openPopup();
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    const lang = await getLanguage();

    if (buttonIndex === 0) {
        chrome.notifications.clear(notificationId);
    } else if (buttonIndex === 1) {
        chrome.notifications.clear(notificationId);

        const postponeTracker = await chrome.storage.local.get(['postponeTracker']) || { postponeTracker: {} };
        const tracker = postponeTracker.postponeTracker || {};

        const now = new Date();
        const currentHour = now.getHours();
        const trackingKey = `prayer_${currentHour}_${now.toDateString()}`;

        if (tracker[trackingKey]) {
            const title = lang === 'ar' ? 'لا يمكن التأجيل مرة أخرى' : 'Cannot postpone again';
            const message = lang === 'ar'
                ? 'تم تأجيل هذا التذكير مسبقاً. حان وقت الصلاة الآن.'
                : 'This reminder has already been postponed. It\'s time for prayer now.';

            chrome.notifications.create(`no_more_postpone_${Date.now()}`, {
                type: 'basic',
                iconUrl: 'icon.png',
                title: title,
                message: message
            });
            return;
        }

        tracker[trackingKey] = {
            postponedAt: Date.now(),
            count: 1
        };
        await chrome.storage.local.set({ postponeTracker: tracker });

        const snoozeTime = new Date(Date.now() + 5 * 60 * 1000);
        const snoozeId = `snooze_${Date.now()}`;

        chrome.alarms.create(snoozeId, {
            when: snoozeTime.getTime()
        });

        const postponedReminders = await chrome.storage.local.get(['postponedReminders']) || { postponedReminders: [] };
        const reminders = postponedReminders.postponedReminders || [];
        reminders.push({
            id: snoozeId,
            scheduledTime: snoozeTime.getTime(),
            createdAt: Date.now(),
            trackingKey: trackingKey
        });

        await chrome.storage.local.set({ postponedReminders: reminders });

        const confirmTitle = lang === 'ar' ? 'تم التأجيل' : 'Postponed';
        const confirmMessage = lang === 'ar'
            ? 'سيتم تذكيرك مرة أخرى خلال 5 دقائق (لمرة واحدة فقط)'
            : 'You will be reminded again in 5 minutes (once only)';

        chrome.notifications.create(`snooze_confirm_${Date.now()}`, {
            type: 'basic',
            iconUrl: 'icon.png',
            title: confirmTitle,
            message: confirmMessage
        });
    }
});

chrome.runtime.onStartup.addListener(async () => {
    await restoreAlarmsOnStartup();
});

async function cleanupOldPostponedReminders() {
    try {
        const postponedReminders = await chrome.storage.local.get(['postponedReminders']);
        if (!postponedReminders.postponedReminders) return;

        const now = Date.now();
        const validReminders = postponedReminders.postponedReminders.filter(reminder => {
            const age = now - reminder.createdAt;
            return age < 24 * 60 * 60 * 1000;
        });

        await chrome.storage.local.set({ postponedReminders: validReminders });
    } catch (error) {
        // Silent error handling
    }
}

async function cleanupOldPostponeTracker() {
    try {
        const postponeTracker = await chrome.storage.local.get(['postponeTracker']);
        if (!postponeTracker.postponeTracker) return;

        const now = Date.now();
        const tracker = postponeTracker.postponeTracker;
        const cleanedTracker = {};

        for (const [key, value] of Object.entries(tracker)) {
            const age = now - value.postponedAt;
            if (age < 24 * 60 * 60 * 1000) {
                cleanedTracker[key] = value;
            }
        }

        await chrome.storage.local.set({ postponeTracker: cleanedTracker });
    } catch (error) {
        // Silent error handling
    }
}

async function restorePostponedReminders() {
    try {
        const postponedReminders = await chrome.storage.local.get(['postponedReminders']);
        if (!postponedReminders.postponedReminders) return;

        const now = Date.now();
        const validReminders = [];

        for (const reminder of postponedReminders.postponedReminders) {
            const timeDiff = reminder.scheduledTime - now;
            if (timeDiff > -10 * 60 * 1000) {
                if (timeDiff > 0) {
                    chrome.alarms.create(reminder.id, {
                        when: reminder.scheduledTime
                    });
                    validReminders.push(reminder);
                } else {
                    const shouldFire = await validateReminderTime();

                    if (shouldFire) {
                        const lang = await getLanguage();
                        const lateNotificationId = `late_snooze_reminder_${Date.now()}`;
                        const title = lang === 'ar' ? 'تذكير مؤجل 🔔' : 'Postponed Reminder 🔔';
                        const message = lang === 'ar'
                            ? 'تذكير: حان وقت الصلاة (لا يمكن التأجيل مرة أخرى)'
                            : 'Reminder: It\'s time for prayer (cannot be postponed again)';

                        chrome.notifications.create(lateNotificationId, {
                            type: 'basic',
                            iconUrl: 'icon.png',
                            title: title,
                            message: message,
                            priority: 2,
                            requireInteraction: true,
                            buttons: [
                                { title: lang === 'ar' ? 'تم' : 'Done' }
                            ]
                        });

                        setTimeout(() => {
                            chrome.notifications.clear(lateNotificationId);
                        }, 120000);
                    }
                }
            }
        }

        await chrome.storage.local.set({ postponedReminders: validReminders });

    } catch (error) {
        // Silent error handling
    }
}

async function restoreAlarmsOnStartup() {
    try {
        await restorePostponedReminders();

        const result = await chrome.storage.local.get([
            'prayerTimes',
            'currentCountryCode',
            'currentCityName',
            'reminderEnabled'
        ]);

        if (result.prayerTimes && result.currentCountryCode && result.currentCityName) {
            await setupPrayerAlarms(result.prayerTimes, result.currentCountryCode, result.currentCityName);
        }

        setupDailyUpdate();
        setupKeepAlive();

    } catch (error) {
        // Silent error handling
    }
}

restoreAlarmsOnStartup();
