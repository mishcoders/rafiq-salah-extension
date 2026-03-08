// Prayer names in Arabic
const PRAYER_NAMES = {
    'Fajr': 'الفجر',
    'Sunrise': 'الشروق',
    'Dhuhr': 'الظهر',
    'Asr': 'العصر',
    'Maghrib': 'المغرب',
    'Isha': 'العشاء'
};

// Initialize background script
chrome.runtime.onInstalled.addListener(async () => {
    setupDailyUpdate();
    setupKeepAlive();

    // Send a welcome notification
    setTimeout(async () => {
        try {
            await chrome.notifications.create('welcome', {
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'مرحباً بك في رفيق الصلاة  🕌',
                message: 'تم تثبيت الإكستنشن بنجاح. اختر موقعك لبدء التذكير.',
                priority: 1
            });

            // Clear welcome notification after 5 seconds
            setTimeout(() => {
                chrome.notifications.clear('welcome');
            }, 5000);
        } catch (error) {
            // Silent error handling
        }
    }, 1000);
});

// Keep service worker alive
function setupKeepAlive() {
    // Set up a recurring alarm to keep service worker active
    chrome.alarms.create('keepAlive', {
        delayInMinutes: 0.1, // Start immediately
        periodInMinutes: 1 // Repeat every minute
    });
}

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'keepAlive') {
        // Keep service worker active
        return;
    }

    if (alarm.name === 'dailyUpdate') {
        await updatePrayerTimesDaily();
        // Also clean up old postponed reminders and postpone tracker daily
        await cleanupOldPostponedReminders();
        await cleanupOldPostponeTracker();
    } else if (alarm.name.startsWith('prayer_')) {
        await handlePrayerReminder(alarm.name);
        // Set up alarm for next day for this prayer
        await setupNextDayAlarm(alarm.name);
    } else if (alarm.name.startsWith('snooze_')) {
        // Validate if we should still show the postponed reminder
        const shouldShow = await validateReminderTime();

        if (shouldShow) {
            const notificationId = `snooze_reminder_${Date.now()}`;

            // This is a postponed reminder - show notification without postpone button
            chrome.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'تذكير مؤجل 🔔',
                message: 'تذكير: حان وقت الصلاة (لا يمكن التأجيل مرة أخرى)',
                priority: 2,
                requireInteraction: true,
                buttons: [
                    { title: 'تم' }
                ]
            });

            // Auto-clear after 2 minutes if not interacted with
            setTimeout(() => {
                chrome.notifications.clear(notificationId);
            }, 120000);
        }

        // Clean up this postponed reminder from storage
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
    return true; // Keep message channel open for async response
});


// Helper function to validate if we're still within a valid reminder window
async function validateReminderTime() {
    try {
        const result = await chrome.storage.local.get(['prayerTimes', 'reminderTime']);

        if (!result.prayerTimes) {
            return false;
        }

        const reminderMinutes = result.reminderTime || 5;
        const now = new Date();
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

        // Check all prayer times to see if we're within any valid reminder window
        const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

        for (const prayerName of prayers) {
            if (result.prayerTimes[prayerName]) {
                const prayerTimeStr = result.prayerTimes[prayerName];
                const [hours, minutes] = prayerTimeStr.split(':').map(Number);
                const prayerTimeMinutes = hours * 60 + minutes;

                // Calculate reminder window (reminderMinutes before prayer time)
                const reminderStartMinutes = prayerTimeMinutes - reminderMinutes;

                // Check if current time is within the reminder window for this prayer
                if (currentTimeMinutes >= reminderStartMinutes && currentTimeMinutes <= prayerTimeMinutes) {
                    return true;
                }
            }
        }

        return false;
    } catch (error) {
        // If there's an error, err on the side of not showing notifications
        return false;
    }
}

// Set up alarm for next day
async function setupNextDayAlarm(alarmName) {
    const alarmParts = alarmName.split('_');
    const alarmType = alarmParts.length >= 3 ? alarmParts[1] : 'pre';
    const prayerName = alarmParts.length >= 3 ? alarmParts.slice(2).join('_') : alarmParts.slice(1).join('_');
    const result = await chrome.storage.local.get(['prayerTimes', 'reminderTime', 'preReminderEnabled', 'exactReminderEnabled', 'reminderEnabled']);

    // Master reminderEnabled check removed as per user request to use individual toggles in settings

    if (result.prayerTimes && result.prayerTimes[prayerName]) {
        const reminderMinutes = result.reminderTime || 5;
        const prayerTime = result.prayerTimes[prayerName];
        const [hours, minutes] = prayerTime.split(':').map(Number);

        // Calculate tomorrow's prayer time
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(hours, minutes, 0, 0);

        if (alarmType === 'pre' && result.preReminderEnabled !== false) {
            const tomorrowReminderTime = new Date(tomorrow.getTime() - reminderMinutes * 60 * 1000);
            scheduleAlarmSafe(alarmName, tomorrowReminderTime.getTime());
        }

        if (alarmType === 'exact' && result.exactReminderEnabled !== false) {
            scheduleAlarmSafe(alarmName, tomorrow.getTime());
        }

    }
}

async function setupPrayerAlarms(prayerTimes, countryCode, cityName) {
    // Clear existing prayer alarms
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
    // Treat as enabled always, individual toggles handle actual notifications
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

    // Store current location for daily updates
    await chrome.storage.local.set({
        currentCountryCode: countryCode,
        currentCityName: cityName
    });
}

async function handlePrayerReminder(alarmName) {
    const alarmParts = alarmName.split('_');
    const alarmType = alarmParts.length >= 3 ? alarmParts[1] : 'pre';
    const prayerName = alarmParts.length >= 3 ? alarmParts.slice(2).join('_') : alarmParts.slice(1).join('_');
    const arabicName = PRAYER_NAMES[prayerName];

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

    // Validate if we're still within the reminder window
    if (result.prayerTimes && result.prayerTimes[prayerName]) {
        const now = new Date();
        const prayerTimeStr = result.prayerTimes[prayerName];
        const [hours, minutes] = prayerTimeStr.split(':').map(Number);

        // Create prayer time for today
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

    // Create appropriate message based on reminder time
    let timeMessage;
    if (alarmType === 'pre') {
        if (reminderMinutes === 1) {
            timeMessage = 'خلال دقيقة واحدة';
        } else if (reminderMinutes < 60) {
            timeMessage = `خلال ${reminderMinutes} دقيقة`;
        } else {
            const hours = Math.floor(reminderMinutes / 60);
            const mins = reminderMinutes % 60;
            if (mins === 0) {
                timeMessage = `خلال ${hours} ساعة`;
            } else {
                timeMessage = `خلال ${hours} ساعة و${mins} دقيقة`;
            }
        }
    } else {
        timeMessage = 'الآن';
    }

    const notificationId = `prayer_notification_${Date.now()}`;

    // Show notification
    try {
        // Check permission first
        const permission = await chrome.notifications.getPermissionLevel();
        if (permission === 'denied') {
            return;
        }

        await chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: 'icon.png',
            title: alarmType === 'pre' ? 'تذكير الصلاة 🕌' : 'حان وقت الصلاة 🕌',
            message: alarmType === 'pre' ? `حان وقت صلاة ${arabicName} ${timeMessage}` : `حان وقت صلاة ${arabicName}`,
            priority: 2,
            requireInteraction: true,
            buttons: alarmType === 'pre'
                ? [{ title: 'تم' }, { title: 'تأجيل 5 دقائق' }]
                : [{ title: 'تم' }]
        });

        // Auto-clear after 2 minutes if not interacted with
        setTimeout(() => {
            chrome.notifications.clear(notificationId);
        }, 120000);

    } catch (error) {
        // Fallback: try simpler notification
        try {
            await chrome.notifications.create(`fallback_${Date.now()}`, {
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'تذكير الصلاة',
                message: alarmType === 'pre' ? `صلاة ${arabicName} ${timeMessage}` : `حان وقت صلاة ${arabicName}`
            });
        } catch (fallbackError) {
            // Silent error handling
        }
    }
}

async function handleReminderToggle(enabled) {
    if (enabled) {
        // Re-setup alarms if reminders are enabled
        const result = await chrome.storage.local.get(['prayerTimes', 'currentCountryCode', 'currentCityName']);
        if (result.prayerTimes && result.currentCountryCode && result.currentCityName) {
            setupPrayerAlarms(result.prayerTimes, result.currentCountryCode, result.currentCityName);
        }
    } else {
        // Clear all prayer alarms if reminders are disabled
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
    // Check removed as per user request to use individual toggles in settings
    if (false) { // Skip old logic
        const alarms = await chrome.alarms.getAll();
        for (const alarm of alarms) {
            if (alarm.name.startsWith('prayer_') || alarm.name.startsWith('snooze_')) {
                chrome.alarms.clear(alarm.name);
            }
        }
        return;
    }
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
                message: 'حدث خطأ أثناء جدولة التنبيهات. يرجى المحاولة مرة أخرى.',
                at: Date.now()
            }
        });
    }
}



function setupDailyUpdate() {
    // Set up daily update at 12:01 AM
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 1, 0, 0); // 12:01 AM

    chrome.alarms.create('dailyUpdate', {
        when: tomorrow.getTime(),
        periodInMinutes: 24 * 60 // Repeat every 24 hours
    });
}

async function updatePrayerTimesDaily() {
    try {
        const result = await chrome.storage.local.get(['currentCountryCode', 'currentCityName']);

        if (!result.currentCountryCode || !result.currentCityName) {
            return;
        }

        // Get current date using local timezone to avoid UTC shifting
        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

        // Get calculation method from settings with auto-detection fallback
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

        // Fetch updated prayer times with explicit school and latitude adjustment defaults
        const school = 0; // Shafi/Maliki/Hanbali default
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

            // Update stored prayer times
            await chrome.storage.local.set({
                prayerTimes: prayerTimes,
                lastUpdated: Date.now()
            });

            // Setup new alarms for today
            await setupPrayerAlarms(prayerTimes, result.currentCountryCode, result.currentCityName);

            // Prayer times updated successfully
        }
    } catch (error) {
        // Silent error handling
    }
}

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.notifications.clear(notificationId);
    chrome.action.openPopup();
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (buttonIndex === 0) {
        // "تم" button - just close
        chrome.notifications.clear(notificationId);
    } else if (buttonIndex === 1) {
        // "تأجيل 5 دقائق" button - set snooze alarm
        chrome.notifications.clear(notificationId);

        // Check if this notification has already been postponed
        const postponeTracker = await chrome.storage.local.get(['postponeTracker']) || { postponeTracker: {} };
        const tracker = postponeTracker.postponeTracker || {};

        // Create a unique key for this prayer time (based on current hour to group same prayer reminders)
        const now = new Date();
        const currentHour = now.getHours();
        const trackingKey = `prayer_${currentHour}_${now.toDateString()}`;

        // Check if this prayer reminder has already been postponed
        if (tracker[trackingKey]) {
            // Already postponed once, show message and don't allow another postponement
            chrome.notifications.create(`no_more_postpone_${Date.now()}`, {
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'لا يمكن التأجيل مرة أخرى',
                message: 'تم تأجيل هذا التذكير مسبقاً. حان وقت الصلاة الآن.'
            });
            return;
        }

        // Mark this prayer as postponed
        tracker[trackingKey] = {
            postponedAt: Date.now(),
            count: 1
        };
        await chrome.storage.local.set({ postponeTracker: tracker });

        const snoozeTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
        const snoozeId = `snooze_${Date.now()}`;

        chrome.alarms.create(snoozeId, {
            when: snoozeTime.getTime()
        });

        // Store postponed reminder info for restoration after browser restart
        const postponedReminders = await chrome.storage.local.get(['postponedReminders']) || { postponedReminders: [] };
        const reminders = postponedReminders.postponedReminders || [];
        reminders.push({
            id: snoozeId,
            scheduledTime: snoozeTime.getTime(),
            createdAt: Date.now(),
            trackingKey: trackingKey // Store tracking key for cleanup
        });

        await chrome.storage.local.set({ postponedReminders: reminders });

        // Show confirmation
        chrome.notifications.create(`snooze_confirm_${Date.now()}`, {
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'تم التأجيل',
            message: 'سيتم تذكيرك مرة أخرى خلال 5 دقائق (لمرة واحدة فقط)'
        });
    }
});



// Clean up old alarms on startup
chrome.runtime.onStartup.addListener(async () => {
    await restoreAlarmsOnStartup();
});

// Clean up old postponed reminders (older than 24 hours)
async function cleanupOldPostponedReminders() {
    try {
        const postponedReminders = await chrome.storage.local.get(['postponedReminders']);
        if (!postponedReminders.postponedReminders) return;

        const now = Date.now();
        const validReminders = postponedReminders.postponedReminders.filter(reminder => {
            const age = now - reminder.createdAt;
            return age < 24 * 60 * 60 * 1000; // Keep reminders younger than 24 hours
        });

        await chrome.storage.local.set({ postponedReminders: validReminders });
    } catch (error) {
        // Silent error handling
    }
}

// Clean up old postpone tracker entries (older than 24 hours)
async function cleanupOldPostponeTracker() {
    try {
        const postponeTracker = await chrome.storage.local.get(['postponeTracker']);
        if (!postponeTracker.postponeTracker) return;

        const now = Date.now();
        const tracker = postponeTracker.postponeTracker;
        const cleanedTracker = {};

        // Remove entries older than 24 hours
        for (const [key, value] of Object.entries(tracker)) {
            const age = now - value.postponedAt;
            if (age < 24 * 60 * 60 * 1000) { // Keep entries younger than 24 hours
                cleanedTracker[key] = value;
            }
        }

        await chrome.storage.local.set({ postponeTracker: cleanedTracker });
    } catch (error) {
        // Silent error handling
    }
}

// Restore postponed reminders that should still fire
async function restorePostponedReminders() {
    try {
        const postponedReminders = await chrome.storage.local.get(['postponedReminders']);
        if (!postponedReminders.postponedReminders) return;

        const now = Date.now();
        const validReminders = [];

        for (const reminder of postponedReminders.postponedReminders) {
            // Only restore reminders that are:
            // 1. Still in the future OR 
            // 2. Less than 10 minutes in the past (in case browser was closed briefly)
            const timeDiff = reminder.scheduledTime - now;
            if (timeDiff > -10 * 60 * 1000) { // -10 minutes in milliseconds
                if (timeDiff > 0) {
                    // Future reminder - restore the alarm
                    chrome.alarms.create(reminder.id, {
                        when: reminder.scheduledTime
                    });
                    validReminders.push(reminder);
                } else {
                    // Past reminder within 10 minutes - check if still valid before firing
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
                            buttons: [
                                { title: 'تم' }
                            ]
                        });

                        // Auto-clear after 2 minutes if not interacted with
                        setTimeout(() => {
                            chrome.notifications.clear(lateNotificationId);
                        }, 120000);
                    }

                    // Don't add to validReminders as it's been processed
                }
            }
            // Reminders older than 10 minutes are discarded
        }

        // Update storage with only valid reminders
        await chrome.storage.local.set({ postponedReminders: validReminders });

    } catch (error) {
        // Silent error handling
    }
}

// Restore alarms when service worker wakes up
async function restoreAlarmsOnStartup() {
    try {
        // First restore postponed reminders
        await restorePostponedReminders();

        // Clear old prayer alarms and set up fresh ones
        const result = await chrome.storage.local.get([
            'prayerTimes',
            'currentCountryCode',
            'currentCityName',
            'reminderEnabled'
        ]);

        if (result.prayerTimes && result.currentCountryCode && result.currentCityName) {
            await setupPrayerAlarms(result.prayerTimes, result.currentCountryCode, result.currentCityName);
        }

        // Ensure daily update alarm is set
        setupDailyUpdate();
        setupKeepAlive();

    } catch (error) {
        // Silent error handling
    }
}

// Call restore function immediately when service worker starts
restoreAlarmsOnStartup();
