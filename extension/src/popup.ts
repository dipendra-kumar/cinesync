export {};

// ── Types ──────────────────────────────────────────────────────────────────────

interface StatusResponse {
  sessionActive: boolean;
  roomId: string | null;
  connected: boolean;
  partnerOnline: boolean;
}

type ScreenId = 'home' | 'session' | 'settings';

// ── State ──────────────────────────────────────────────────────────────────────

let activeTab: chrome.tabs.Tab | null = null;
let prevScreen: ScreenId = 'home';

// ── Helpers ────────────────────────────────────────────────────────────────────

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

function show(screen: ScreenId): void {
  (['home', 'session', 'settings'] as ScreenId[]).forEach(s => {
    ($(`screen-${s}`) as HTMLElement).style.display = s === screen ? 'flex' : 'none';
  });
}

function showError(msg: string): void {
  const bar = $('error-bar');
  bar.textContent = msg;
  bar.style.display = 'block';
  setTimeout(() => (bar.style.display = 'none'), 3500);
}

async function sendToContent<T>(msg: object): Promise<T> {
  if (!activeTab?.id) throw new Error('No active tab');
  return chrome.tabs.sendMessage<object, T>(activeTab.id, msg);
}

async function getStatus(): Promise<StatusResponse | null> {
  try { return await sendToContent<StatusResponse>({ type: 'get_status' }); }
  catch { return null; }
}

// Converts ws:// → http://, wss:// → https://
function wsUrlToHttp(wsUrl: string): string {
  return wsUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
}

async function buildInviteLink(roomId: string): Promise<string> {
  const videoUrl = activeTab?.url ?? '';
  return new Promise(resolve => {
    chrome.storage.local.get('serverUrl', r => {
      const wsUrl  = (r as { serverUrl?: string }).serverUrl ?? 'ws://localhost:8080';
      const httpUrl = wsUrlToHttp(wsUrl);
      resolve(`${httpUrl}/join?room=${roomId}&video=${encodeURIComponent(videoUrl)}`);
    });
  });
}

// ── Session screen ─────────────────────────────────────────────────────────────

async function renderSession(status: StatusResponse): Promise<void> {
  show('session');

  const badge = $('partner-badge');
  badge.textContent = status.partnerOnline ? '♥ Partner connected' : 'Waiting for partner…';
  badge.className = `partner-badge${status.partnerOnline ? ' online' : ''}`;

  if (status.roomId) {
    const link = await buildInviteLink(status.roomId);
    $('invite-link').textContent = link;
    ($('invite-link') as HTMLElement).title = link;
  }
}

// ── Init ───────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab ?? null;

  const status = await getStatus();

  if (!status) {
    show('home');
    showError('Navigate to a video page first, then try again.');
    return;
  }

  if (status.sessionActive && status.roomId) {
    await renderSession(status);
  } else {
    show('home');
  }

  chrome.storage.local.get('serverUrl', r => {
    const saved = (r as { serverUrl?: string }).serverUrl;
    ($('server-url') as HTMLInputElement).value = saved ?? '';
  });
}

// ── Button listeners ───────────────────────────────────────────────────────────

$('btn-create').addEventListener('click', async () => {
  try {
    await sendToContent({ type: 'create_session' });
    await new Promise(r => setTimeout(r, 700));
    const status = await getStatus();
    if (status?.sessionActive) await renderSession(status);
  } catch {
    showError('Could not reach the page. Refresh and try again.');
  }
});

$('btn-copy-link').addEventListener('click', async () => {
  const link = $('invite-link').textContent ?? '';
  if (!link || link === 'generating…') return;
  await navigator.clipboard.writeText(link);
  const btn = $('btn-copy-link');
  btn.textContent = 'Copied!';
  setTimeout(() => (btn.textContent = 'Copy Invite Link'), 1800);
});

$('btn-leave').addEventListener('click', async () => {
  await sendToContent({ type: 'leave_session' }).catch(() => {});
  show('home');
});

$('btn-to-settings').addEventListener('click', () => {
  prevScreen = 'home';
  show('settings');
});

$('btn-session-settings').addEventListener('click', () => {
  prevScreen = 'session';
  show('settings');
});

$('btn-back').addEventListener('click', () => show(prevScreen));

$('btn-save').addEventListener('click', () => {
  const url = ($('server-url') as HTMLInputElement).value.trim();
  if (!url) { showError('Enter a server URL.'); return; }
  chrome.storage.local.set({ serverUrl: url }, () => {
    const btn = $('btn-save');
    btn.textContent = 'Saved!';
    setTimeout(() => (btn.textContent = 'Save'), 1500);
  });
});

// Re-render when content script notifies us of a status change
chrome.runtime.onMessage.addListener((msg: { type: string }) => {
  if (msg.type === 'status_changed') {
    void getStatus().then(s => { if (s?.sessionActive && s.roomId) void renderSession(s); });
  }
});

void init();
