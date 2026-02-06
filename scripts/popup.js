/* Main popup initialization */

document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  await loadCitiesData();
  await checkUserLocation();
  setupEventListeners();
});

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
  if (countdownInterval) clearInterval(countdownInterval);
});
