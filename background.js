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
                title: 'مرحباً بك في مواقيت الصلاة 🕌',
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
    } else if (alarm.name.startsWith('prayer_')) {
        await handlePrayerReminder(alarm.name);
        // Set up alarm for next day for this prayer
        await setupNextDayAlarm(alarm.name);
    } else if (alarm.name.startsWith('snooze_')) {
        chrome.notifications.create(`snooze_reminder_${Date.now()}`, {
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'تذكير مؤجل 🔔',
            message: 'تذكير: حان وقت الصلاة',
            priority: 2
        });
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
        case 'testNotification':
            await testNotification();
            break;


    }
    return true; // Keep message channel open for async response
});

// Test notification function
async function testNotification() {
    try {
        const permission = await chrome.notifications.getPermissionLevel();
        
        if (permission === 'denied') {
            // Try to show a basic notification anyway
            try {
                await chrome.notifications.create(`fallback_test_${Date.now()}`, {
                    type: 'basic',
                    iconUrl: 'icon.png',
                    title: 'تنبيه',
                    message: 'يرجى تفعيل الإشعارات في إعدادات المتصفح'
                });
            } catch (fallbackError) {
                // Silent error handling
            }
            return;
        }
        
        const notificationId = `test_${Date.now()}`;
        
        await chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'اختبار التنبيه 🔔',
            message: 'هذا اختبار للتأكد من عمل التنبيهات - إذا رأيت هذه الرسالة فالتنبيهات تعمل بشكل صحيح!',
            priority: 2,
            requireInteraction: false
        });
        
        // Auto-clear after 8 seconds
        setTimeout(() => {
            chrome.notifications.clear(notificationId);
        }, 8000);
        
    } catch (error) {
        // Try the most basic notification possible
        try {
            await chrome.notifications.create(`basic_test_${Date.now()}`, {
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'تنبيه بسيط',
                message: 'اختبار أساسي'
            });
        } catch (basicError) {
            // Silent error handling
        }
    }
}



// Set up alarm for next day
async function setupNextDayAlarm(alarmName) {
    const prayerName = alarmName.replace('prayer_', '');
    const result = await chrome.storage.local.get(['prayerTimes', 'reminderTime']);
    
    if (result.prayerTimes && result.prayerTimes[prayerName]) {
        const reminderMinutes = result.reminderTime || 5;
        const prayerTime = result.prayerTimes[prayerName];
        const [hours, minutes] = prayerTime.split(':').map(Number);
        
        // Calculate tomorrow's prayer time
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(hours, minutes, 0, 0);
        
        const tomorrowReminderTime = new Date(tomorrow.getTime() - reminderMinutes * 60 * 1000);
        
        chrome.alarms.create(alarmName, {
            when: tomorrowReminderTime.getTime()
        });
        
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
    
    // Check if reminders are enabled and get reminder time
    const result = await chrome.storage.local.get(['reminderEnabled', 'reminderTime']);
    const reminderEnabled = result.reminderEnabled !== false; // Default to true
    const reminderMinutes = result.reminderTime || 5; // Default to 5 minutes
    
    if (!reminderEnabled) {
        return;
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    
    prayers.forEach(prayer => {
        const prayerTime = prayerTimes[prayer];
        if (prayerTime) {
            const [hours, minutes] = prayerTime.split(':').map(Number);
            const prayerDate = new Date(today);
            prayerDate.setHours(hours, minutes, 0, 0);
            
            // Set reminder based on user preference
            const reminderTime = new Date(prayerDate.getTime() - reminderMinutes * 60 * 1000);
            
            // Set alarm for today if reminder time is in the future
            if (reminderTime > now) {
                chrome.alarms.create(`prayer_${prayer}`, {
                    when: reminderTime.getTime()
                });
            } else {
                // If reminder time has passed today, set for tomorrow
                const tomorrowPrayerDate = new Date(prayerDate.getTime() + 24 * 60 * 60 * 1000);
                const tomorrowReminderTime = new Date(tomorrowPrayerDate.getTime() - reminderMinutes * 60 * 1000);
                
                chrome.alarms.create(`prayer_${prayer}`, {
                    when: tomorrowReminderTime.getTime()
                });
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
    const prayerName = alarmName.replace('prayer_', '');
    const arabicName = PRAYER_NAMES[prayerName];
    
    // Check if reminders are still enabled and get reminder time
    const result = await chrome.storage.local.get(['reminderEnabled', 'reminderTime']);
    const reminderEnabled = result.reminderEnabled !== false;
    const reminderMinutes = result.reminderTime || 5;
    
    if (!reminderEnabled) {
        return;
    }
    
    // Create appropriate message based on reminder time
    let timeMessage;
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
            title: 'تذكير الصلاة 🕌',
            message: `حان وقت صلاة ${arabicName} ${timeMessage}`,
            priority: 2,
            requireInteraction: true,
            buttons: [
                { title: 'تم' },
                { title: 'تأجيل 5 دقائق' }
            ]
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
                message: `صلاة ${arabicName} ${timeMessage}`
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
            if (alarm.name.startsWith('prayer_')) {
                chrome.alarms.clear(alarm.name);
            }
        }
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
        
        // Get current date
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        
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
        
        // Fetch updated prayer times
        const response = await fetch(
            `https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=${encodeURIComponent(result.currentCityName)}&country=${result.currentCountryCode}&method=${method}`
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
        
        const snoozeTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
        chrome.alarms.create(`snooze_${Date.now()}`, {
            when: snoozeTime.getTime()
        });
        
        // Show confirmation
        chrome.notifications.create(`snooze_confirm_${Date.now()}`, {
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'تم التأجيل',
            message: 'سيتم تذكيرك مرة أخرى خلال 5 دقائق'
        });
    }
});



// Clean up old alarms on startup
chrome.runtime.onStartup.addListener(async () => {
    await restoreAlarmsOnStartup();
});

// Restore alarms when service worker wakes up
async function restoreAlarmsOnStartup() {
    try {
        // Clear old prayer alarms and set up fresh ones
        const result = await chrome.storage.local.get([
            'prayerTimes', 
            'currentCountryCode', 
            'currentCityName', 
            'reminderEnabled'
        ]);
        
        if (result.prayerTimes && result.currentCountryCode && result.currentCityName) {
            const reminderEnabled = result.reminderEnabled !== false;
            if (reminderEnabled) {
                await setupPrayerAlarms(result.prayerTimes, result.currentCountryCode, result.currentCityName);
            }
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