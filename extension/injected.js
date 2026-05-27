"use strict";
(() => {
  // src/injected.ts
  var _play = HTMLVideoElement.prototype.play;
  var _pause = HTMLVideoElement.prototype.pause;
  var _ctDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
  function notify(action, time) {
    window.dispatchEvent(new CustomEvent("__cs_from_page", { detail: { action, time } }));
  }
  document.addEventListener("play", (e) => {
    if (e.target instanceof HTMLVideoElement) notify("play", e.target.currentTime);
  }, true);
  document.addEventListener("pause", (e) => {
    if (e.target instanceof HTMLVideoElement) notify("pause", e.target.currentTime);
  }, true);
  document.addEventListener("seeked", (e) => {
    if (e.target instanceof HTMLVideoElement) notify("seek", e.target.currentTime);
  }, true);
  function findVideo() {
    const vs = Array.from(document.querySelectorAll("video"));
    if (!vs.length) return null;
    return vs.find((v) => !v.paused && v.readyState >= 2) ?? vs.find((v) => v.readyState >= 2) ?? vs.find((v) => !!(v.src || v.srcObject)) ?? vs[0];
  }
  window.addEventListener("__cs_to_page", (e) => {
    const { action, time } = e.detail;
    const v = findVideo();
    if (!v) return;
    try {
      if (time !== void 0 && _ctDesc.set) _ctDesc.set.call(v, time);
      if (action === "play") _play.call(v).catch(() => {
      });
      if (action === "pause") _pause.call(v);
    } catch {
    }
  });
})();
