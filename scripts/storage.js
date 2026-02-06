// Chrome storage helper with promise wrappers
const storage = {
  get: (keys) =>
    new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    }),
  set: (obj) =>
    new Promise((resolve) => {
      chrome.storage.local.set(obj, resolve);
    }),
};

// DOM element shorthand
const el = (id) => document.getElementById(id);
