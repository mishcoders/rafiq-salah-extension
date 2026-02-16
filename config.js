// Developer Configuration
// Set developerMode to true to enable testing of prayer reminders.
// This will override the actual prayer times with fake data to simulate a prayer approaching.

const CONFIG = {
    // Enable developer mode to test prayer reminders
    // When true, 'Maghrib' prayer will be set to (now + testPrayerOffsetMinutes)
    // And reminder time will be set to (testPrayerOffsetMinutes)
    // This causes the reminder notification to trigger immediately or very soon.
    developerMode: false,

    // The offset in minutes for the test prayer time from now.
    // Example: 2 means the prayer is set to 2 minutes from now.
    // The reminder setting will also be forced to this value to ensure the notification fires.
    testPrayerOffsetMinutes: 1
};
