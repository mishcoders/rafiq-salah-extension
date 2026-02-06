/* Main background service worker - initialization and event listeners */

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  setupDailyUpdate();
  setupKeepAlive();
  showWelcome();
});

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'keepAlive') return;

  if (alarm.name === 'dailyUpdate') {
    await updatePrayerTimesDaily();
    await cleanupOldPostponedReminders();
    await cleanupOldPostponeTracker();
  } else if (alarm.name.startsWith('prayer_')) {
    await handlePrayerReminder(alarm.name);
  } else if (alarm.name.startsWith('snooze_')) {
    const shouldShow = await validateReminderTime();

    if (shouldShow) {
      showPostponedReminder();
    }

    const postponedReminders = (await bgStorage.get(['postponedReminders'])) || { postponedReminders: [] };
    if (postponedReminders.postponedReminders) {
      const updatedReminders = postponedReminders.postponedReminders.filter((reminder) => reminder.id !== alarm.name);
      await bgStorage.set({ postponedReminders: updatedReminders });
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
  }
  return true;
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
  chrome.action.openPopup();
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    chrome.notifications.clear(notificationId);
  } else if (buttonIndex === 1) {
    chrome.notifications.clear(notificationId);
    await handlePostponeClick();
  }
});

// Restore on startup
chrome.runtime.onStartup.addListener(async () => {
  await restoreAlarmsOnStartup();
});

// Initialize on first load
restoreAlarmsOnStartup();
