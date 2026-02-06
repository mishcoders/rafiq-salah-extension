// Notification creation and management

function formatReminderTime(reminderMinutes) {
  if (reminderMinutes === 1) return 'خلال دقيقة واحدة';
  if (reminderMinutes < 60) return `خلال ${reminderMinutes} دقيقة`;

  const hours = Math.floor(reminderMinutes / 60);
  const mins = reminderMinutes % 60;
  if (mins === 0) return `خلال ${hours} ساعة`;
  return `خلال ${hours} ساعة و${mins} دقيقة`;
}

async function showPrayerReminder(prayerName, reminderMinutes) {
  const arabicName = PRAYER_NAMES[prayerName];
  const timeMessage = formatReminderTime(reminderMinutes);
  const notificationId = `prayer_notification_${Date.now()}`;

  try {
    const permission = await chrome.notifications.getPermissionLevel();
    if (permission === 'denied') return;

    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'تذكير الصلاة 🕌',
      message: `حان وقت صلاة ${arabicName} ${timeMessage}`,
      priority: 2,
      requireInteraction: true,
      buttons: [
        { title: 'تم' },
        { title: 'تأجيل 5 دقائق' },
      ],
    });

    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, NOTIFICATION_AUTO_CLEAR_MS);
  } catch (err) {
    try {
      await chrome.notifications.create(`fallback_${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'تذكير الصلاة',
        message: `صلاة ${arabicName} ${timeMessage}`,
      });
    } catch (fallbackErr) {
      // Silent
    }
  }
}

function showPostponedReminder() {
  const notificationId = `snooze_reminder_${Date.now()}`;

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'تذكير مؤجل 🔔',
    message: 'تذكير: حان وقت الصلاة (لا يمكن التأجيل مرة أخرى)',
    priority: 2,
    requireInteraction: true,
    buttons: [{ title: 'تم' }],
  });

  setTimeout(() => {
    chrome.notifications.clear(notificationId);
  }, NOTIFICATION_AUTO_CLEAR_MS);
}

function showPostponeConfirmation() {
  chrome.notifications.create(`snooze_confirm_${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'تم التأجيل',
    message: 'سيتم تذكيرك مرة أخرى خلال 5 دقائق (لمرة واحدة فقط)',
  });
}

function showNoMorePostpone() {
  chrome.notifications.create(`no_more_postpone_${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'لا يمكن التأجيل مرة أخرى',
    message: 'تم تأجيل هذا التذكير مسبقاً. حان وقت الصلاة الآن.',
  });
}

function showWelcome() {
  setTimeout(async () => {
    try {
      await chrome.notifications.create('welcome', {
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'مرحباً بك في رفيق الصلاة 🕌',
        message: 'تم تثبيت الإكستنشن بنجاح. اختر موقعك لبدء التذكير.',
        priority: 1,
      });

      setTimeout(() => {
        chrome.notifications.clear('welcome');
      }, 5000);
    } catch (err) {
      // Silent
    }
  }, 1000);
}
