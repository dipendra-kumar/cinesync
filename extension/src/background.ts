chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ serverUrl: 'ws://localhost:8080' });
});
