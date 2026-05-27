"use strict";
(() => {
  // src/popup.ts
  var activeTab = null;
  var prevScreen = "home";
  var $ = (id) => document.getElementById(id);
  function show(screen) {
    ["home", "session", "settings"].forEach((s) => {
      $(`screen-${s}`).style.display = s === screen ? "flex" : "none";
    });
  }
  function showError(msg) {
    const bar = $("error-bar");
    bar.textContent = msg;
    bar.style.display = "block";
    setTimeout(() => bar.style.display = "none", 3500);
  }
  async function sendToContent(msg) {
    if (!activeTab?.id) throw new Error("No active tab");
    return chrome.tabs.sendMessage(activeTab.id, msg);
  }
  async function getStatus() {
    try {
      return await sendToContent({ type: "get_status" });
    } catch {
      return null;
    }
  }
  function wsUrlToHttp(wsUrl) {
    return wsUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
  }
  async function buildInviteLink(roomId) {
    const videoUrl = activeTab?.url ?? "";
    return new Promise((resolve) => {
      chrome.storage.local.get("serverUrl", (r) => {
        const wsUrl = r.serverUrl ?? "ws://localhost:8080";
        const httpUrl = wsUrlToHttp(wsUrl);
        resolve(`${httpUrl}/join?room=${roomId}&video=${encodeURIComponent(videoUrl)}`);
      });
    });
  }
  async function renderSession(status) {
    show("session");
    const badge = $("partner-badge");
    badge.textContent = status.partnerOnline ? "\u2665 Partner connected" : "Waiting for partner\u2026";
    badge.className = `partner-badge${status.partnerOnline ? " online" : ""}`;
    if (status.roomId) {
      const link = await buildInviteLink(status.roomId);
      $("invite-link").textContent = link;
      $("invite-link").title = link;
    }
  }
  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab ?? null;
    const status = await getStatus();
    if (status?.sessionActive && status.roomId) {
      await renderSession(status);
    } else {
      show("home");
    }
    chrome.storage.local.get("serverUrl", (r) => {
      const saved = r.serverUrl;
      $("server-url").value = saved ?? "";
    });
  }
  $("btn-create").addEventListener("click", async () => {
    try {
      await sendToContent({ type: "create_session" });
      await new Promise((r) => setTimeout(r, 700));
      const status = await getStatus();
      if (status?.sessionActive) await renderSession(status);
    } catch {
      showError("Refresh the page first, then try again.");
    }
  });
  $("btn-copy-link").addEventListener("click", async () => {
    const link = $("invite-link").textContent ?? "";
    if (!link || link === "generating\u2026") return;
    await navigator.clipboard.writeText(link);
    const btn = $("btn-copy-link");
    btn.textContent = "Copied!";
    setTimeout(() => btn.textContent = "Copy Invite Link", 1800);
  });
  $("btn-leave").addEventListener("click", async () => {
    await sendToContent({ type: "leave_session" }).catch(() => {
    });
    show("home");
  });
  $("btn-to-settings").addEventListener("click", () => {
    prevScreen = "home";
    show("settings");
  });
  $("btn-session-settings").addEventListener("click", () => {
    prevScreen = "session";
    show("settings");
  });
  $("btn-back").addEventListener("click", () => show(prevScreen));
  $("btn-save").addEventListener("click", () => {
    const url = $("server-url").value.trim();
    if (!url) {
      showError("Enter a server URL.");
      return;
    }
    chrome.storage.local.set({ serverUrl: url }, () => {
      const btn = $("btn-save");
      btn.textContent = "Saved!";
      setTimeout(() => btn.textContent = "Save", 1500);
    });
  });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "status_changed") {
      void getStatus().then((s) => {
        if (s?.sessionActive && s.roomId) void renderSession(s);
      });
    }
  });
  void init();
})();
