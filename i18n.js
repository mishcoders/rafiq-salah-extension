/**
 * Internationalization module for Prayer Pal
 * Handles loading translations and applying them to the UI
 */

const I18n = (function() {
    'use strict';

    const DEFAULT_LANG = 'ar';
    const STORAGE_KEY = 'selectedLanguage';

    let currentLang = DEFAULT_LANG;
    let translations = {};
    let isLoaded = false;

    /**
     * Initialize the i18n module
     * Loads saved language preference and translation file
     */
    async function init() {
        const stored = await chrome.storage.local.get([STORAGE_KEY]);
        currentLang = stored[STORAGE_KEY] || DEFAULT_LANG;
        await loadTranslations(currentLang);
        applyDirection();
        isLoaded = true;
    }

    /**
     * Load translation file for the specified language
     */
    async function loadTranslations(lang) {
        try {
            const url = chrome.runtime.getURL(`locales/${lang}.json`);
            const response = await fetch(url);
            if (response.ok) {
                translations = await response.json();
                currentLang = lang;
            } else {
                console.error(`Failed to load translations for ${lang}`);
                // Fallback to default language
                if (lang !== DEFAULT_LANG) {
                    await loadTranslations(DEFAULT_LANG);
                }
            }
        } catch (error) {
            console.error('Error loading translations:', error);
        }
    }

    /**
     * Get a translation by key path (e.g., "app.name" or "prayer.fajr")
     */
    function t(key, replacements = {}) {
        const keys = key.split('.');
        let value = translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return key; // Return key if translation not found
            }
        }

        if (typeof value !== 'string') {
            return key;
        }

        // Replace placeholders like {variable}
        return value.replace(/\{([^}]+)\}/g, (match, name) => {
            return replacements[name] !== undefined ? replacements[name] : match;
        });
    }

    /**
     * Apply translations to all elements with data-i18n attribute
     */
    function applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key) {
                const translation = t(key);

                // Check if element has HTML content that should be preserved
                if (element.hasAttribute('data-i18n-html')) {
                    element.innerHTML = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });

        // Update placeholders for inputs
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (key) {
                element.placeholder = t(key);
            }
        });

        // Update title attributes
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            if (key) {
                element.title = t(key);
            }
        });
    }

    /**
     * Apply text direction (RTL for Arabic, LTR for English)
     */
    function applyDirection() {
        document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = currentLang;
        document.body?.classList.toggle('rtl', currentLang === 'ar');
        document.body?.classList.toggle('ltr', currentLang !== 'ar');
    }

    /**
     * Change the current language
     */
    async function setLanguage(lang) {
        if (lang === currentLang && isLoaded) {
            return;
        }

        currentLang = lang;
        await chrome.storage.local.set({ [STORAGE_KEY]: lang });
        await loadTranslations(lang);
        applyDirection();
        applyTranslations();

        // Dispatch custom event for language change
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    }

    /**
     * Get the current language
     */
    function getLanguage() {
        return currentLang;
    }

    /**
     * Check if current language is RTL
     */
    function isRTL() {
        return currentLang === 'ar';
    }

    /**
     * Get prayer name translation
     */
    function getPrayerName(prayerKey) {
        return t(`prayer.${prayerKey.toLowerCase()}`);
    }

    /**
     * Get calculation method name
     */
    function getCalculationMethod(methodKey) {
        return t(`calculationMethods.${methodKey}`);
    }

    // Public API
    return {
        init,
        t,
        translate: t,
        applyTranslations,
        setLanguage,
        getLanguage,
        isRTL,
        getPrayerName,
        getCalculationMethod,
        applyDirection
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18n;
}
