export {};

// Runs in the page's MAIN JS world at document_start — before any site JS loads.

const _play   = HTMLVideoElement.prototype.play;
const _pause  = HTMLVideoElement.prototype.pause;
// currentTime is defined on HTMLMediaElement, NOT HTMLVideoElement — must use the right prototype
const _ctDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')!;

function notify(action: string, time: number): void {
  window.dispatchEvent(new CustomEvent('__cs_from_page', { detail: { action, time } }));
}

// Capture-phase listeners on document — registered before any page JS, so they
// always fire first. Browser media events come from the media engine and can't
// be suppressed by site JS (even Netflix's player).
document.addEventListener('play', (e) => {
  if (e.target instanceof HTMLVideoElement) notify('play', e.target.currentTime);
}, true);

document.addEventListener('pause', (e) => {
  if (e.target instanceof HTMLVideoElement) notify('pause', e.target.currentTime);
}, true);

document.addEventListener('seeked', (e) => {
  if (e.target instanceof HTMLVideoElement) notify('seek', e.target.currentTime);
}, true);

// Prefer a playing video; fall back to one that has content loaded, then any video.
function findVideo(): HTMLVideoElement | null {
  const vs = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  if (!vs.length) return null;
  return (
    vs.find(v => !v.paused && v.readyState >= 2) ??
    vs.find(v => v.readyState >= 2) ??
    vs.find(v => !!(v.src || v.srcObject)) ??
    vs[0]
  );
}

// Control commands from the content script — use the saved native methods to
// bypass any DRM or player overrides that loaded after document_start.
window.addEventListener('__cs_to_page', (e: Event) => {
  const { action, time } = (e as CustomEvent<{ action: string; time?: number }>).detail;
  const v = findVideo();
  if (!v) return;
  try {
    if (time !== undefined && _ctDesc.set) _ctDesc.set.call(v, time);
    if (action === 'play')  _play.call(v).catch(() => {});
    if (action === 'pause') _pause.call(v);
  } catch { /* ignore player rejections */ }
});
