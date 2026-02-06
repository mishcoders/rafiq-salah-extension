// Location detection and city finding

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation not supported'));
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, GEO_CONFIG);
  });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getCityCoordinates() {
  return {
    EG: {
      Cairo: { lat: 30.0444, lon: 31.2357 },
      Alexandria: { lat: 31.2001, lon: 29.9187 },
      Giza: { lat: 30.0131, lon: 31.2089 },
      Luxor: { lat: 25.6872, lon: 32.6396 },
      Aswan: { lat: 24.0889, lon: 32.8998 },
    },
    SA: {
      Riyadh: { lat: 24.7136, lon: 46.6753 },
      Jeddah: { lat: 21.4858, lon: 39.1925 },
      Mecca: { lat: 21.3891, lon: 39.8579 },
      Medina: { lat: 24.5247, lon: 39.5692 },
      Dammam: { lat: 26.4207, lon: 50.0888 },
    },
    AE: {
      Dubai: { lat: 25.2048, lon: 55.2708 },
      'Abu Dhabi': { lat: 24.2992, lon: 54.6972 },
      Sharjah: { lat: 25.3463, lon: 55.4209 },
      Ajman: { lat: 25.4052, lon: 55.5136 },
    },
    JO: {
      Amman: { lat: 31.9454, lon: 35.9284 },
      Zarqa: { lat: 32.0727, lon: 36.0888 },
      Irbid: { lat: 32.5556, lon: 35.85 },
    },
    LB: {
      Beirut: { lat: 33.8938, lon: 35.5018 },
      Tripoli: { lat: 34.4367, lon: 35.8497 },
      Sidon: { lat: 33.5633, lon: 35.365 },
    },
    SY: {
      Damascus: { lat: 33.5138, lon: 36.2765 },
      Aleppo: { lat: 36.2021, lon: 37.1343 },
      Homs: { lat: 34.7394, lon: 36.7163 },
    },
    IQ: {
      Baghdad: { lat: 33.3152, lon: 44.3661 },
      Basra: { lat: 30.5085, lon: 47.7804 },
      Mosul: { lat: 36.335, lon: 43.1189 },
    },
    KW: {
      'Kuwait City': { lat: 29.3759, lon: 47.9774 },
      Hawalli: { lat: 29.3375, lon: 48.0281 },
    },
    QA: {
      Doha: { lat: 25.2854, lon: 51.531 },
      'Al Rayyan': { lat: 25.2919, lon: 51.424 },
    },
    BH: {
      Manama: { lat: 26.2285, lon: 50.586 },
      Riffa: { lat: 26.13, lon: 50.555 },
    },
    OM: {
      Muscat: { lat: 23.5859, lon: 58.4059 },
      Salalah: { lat: 17.0151, lon: 54.0924 },
    },
    YE: {
      Sanaa: { lat: 15.3694, lon: 44.191 },
      Aden: { lat: 12.7797, lon: 45.0367 },
    },
    PS: {
      Gaza: { lat: 31.3547, lon: 34.3088 },
      Ramallah: { lat: 31.9073, lon: 35.2044 },
    },
    MA: {
      Casablanca: { lat: 33.5731, lon: -7.5898 },
      Rabat: { lat: 34.0209, lon: -6.8416 },
      Marrakech: { lat: 31.6295, lon: -7.9811 },
    },
    DZ: {
      Algiers: { lat: 36.7538, lon: 3.0588 },
      Oran: { lat: 35.6976, lon: -0.6337 },
      Constantine: { lat: 36.365, lon: 6.6147 },
    },
    TN: {
      Tunis: { lat: 36.8065, lon: 10.1815 },
      Sfax: { lat: 34.7406, lon: 10.7603 },
    },
    LY: {
      Tripoli: { lat: 32.8872, lon: 13.1913 },
      Benghazi: { lat: 32.1167, lon: 20.0683 },
    },
    SD: {
      Khartoum: { lat: 15.5007, lon: 32.5599 },
      Omdurman: { lat: 15.6445, lon: 32.4777 },
    },
    MR: {
      Nouakchott: { lat: 18.0735, lon: -15.9582 },
    },
  };
}

async function findClosestCity(userLat, userLon) {
  try {
    const cityCoordinates = await getCityCoordinates();
    let closestCity = null;
    let minDistance = Infinity;

    for (const country of citiesData) {
      for (const city of country.cities) {
        const coords = cityCoordinates[country.code]?.[city.en];
        if (!coords) continue;

        const distance = calculateDistance(userLat, userLon, coords.lat, coords.lon);
        if (distance < minDistance) {
          minDistance = distance;
          closestCity = { countryCode: country.code, cityName: city.en, distance };
        }
      }
    }

    return closestCity && closestCity.distance < MAX_DETECTION_DISTANCE ? closestCity : null;
  } catch (err) {
    console.error('Error finding closest city:', err);
    return null;
  }
}

async function attemptAutoLocationDetection() {
  try {
    updateLoadingMessage('جاري تحديد موقعك تلقائياً...');
    showLoading(true);

    const position = await getCurrentPosition();
    const { latitude, longitude } = position.coords;

    updateLoadingMessage('جاري البحث عن أقرب مدينة...');
    const closestLocation = await findClosestCity(latitude, longitude);

    if (closestLocation) {
      await storage.set({
        selectedCountry: closestLocation.countryCode,
        selectedCity: closestLocation.cityName,
        locationDetected: true,
        autoDetected: true,
      });
      await showPrayerTimesSection(closestLocation.countryCode, closestLocation.cityName);
    } else {
      await storage.set({ locationDetected: true });
      showLocationSelection();
    }
  } catch (err) {
    console.log('Auto location detection failed:', err);
    await storage.set({ locationDetected: true });
    showLocationSelection();
  } finally {
    showLoading(false);
    updateLoadingMessage('جاري تحميل رفيق الصلاة...');
  }
}
