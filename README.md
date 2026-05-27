# CineSync

A self-hosted browser extension that lets two people watch any online video in perfect sync — no matter where they are in the world.

Supports any site with a `<video>` element: YouTube, streaming platforms, direct video URLs, and sites that embed their player in cross-origin iframes.

---

## Features

- **Universal video sync** — works on any website, including cross-origin iframe players
- **Real-time playback control** — play, pause, and seek are instantly mirrored
- **One-click invite link** — host generates a link; partner clicks it and lands directly on the video, already joined
- **In-page chat** — draggable, minimizable panel with unread message badge
- **Animated emoji reactions** — 22 emojis, each category has its own animation (heartbeat, tumble spin, shake, bounce, flicker, wave)
- **Self-hosted** — your data never touches a third-party server
- **Cloudflare Tunnel / ngrok support** — expose your local server with a permanent public URL

---

## Tech Stack

| Layer | Technology |
|---|---|
| Browser Extension | TypeScript, Chrome Extension Manifest V3 |
| UI | Shadow DOM, Web Animations API |
| Server | Node.js, TypeScript, WebSocket (`ws`), HTTP |
| Build | esbuild |
| Tunnel | Cloudflare Tunnel or ngrok |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Your Machine                                           │
│                                                         │
│  ┌──────────────┐        ┌──────────────────────────┐  │
│  │  CineSync    │  ws:// │  Node.js Server          │  │
│  │  Extension   │◄──────►│  • WebSocket relay       │  │
│  │  (Chrome)    │        │  • HTTP invite redirect  │  │
│  └──────────────┘        └──────────┬───────────────┘  │
│                                     │ port 8080         │
└─────────────────────────────────────┼───────────────────┘
                                      │
                              Cloudflare Tunnel
                           (wss://sync.yourdomain.com)
                                      │
                         ┌────────────▼──────────────┐
                         │  Partner's Machine        │
                         │  CineSync Extension       │
                         │  (Chrome / Brave / Edge)  │
                         └───────────────────────────┘
```

**Cross-origin iframe support:** The extension runs in every frame (`all_frames: true`). Iframe content scripts detect the video and relay events to the top frame via `postMessage`. The top frame owns the WebSocket connection and forwards everything to the server.

---

## Prerequisites

- **Node.js** v18 or later
- **Chrome**, **Brave**, or **Edge** (any Chromium-based browser)
- A **Cloudflare account with a domain** (recommended) or **ngrok**

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/cinesync.git
cd cinesync
```

### 2. Set up the server

```bash
cd server
npm install
npm start
# CineSync server running on port 8080
```

### 3. Expose the server publicly

#### Option A — Cloudflare Tunnel (recommended, permanent URL)

```bash
# Install cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Authenticate with your Cloudflare account
cloudflared tunnel login

# Create a tunnel
cloudflared tunnel create cinesync

# Add a DNS record (replace with your domain)
cloudflared tunnel route dns cinesync sync.yourdomain.com

# Create ~/.cloudflared/config.yml
```

```yaml
tunnel: cinesync
credentials-file: /home/youruser/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: sync.yourdomain.com
    service: http://localhost:8080
  - service: http_status:404
```

```bash
cloudflared tunnel run cinesync
```

#### Option B — ngrok (quick testing)

```bash
ngrok http 8080
# Copy the https://xxx.ngrok-free.app URL
```

### 4. Build the extension

```bash
cd extension
npm install
npm run build
```

### 5. Load the extension in your browser

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder

The CineSync icon will appear in your toolbar. Pin it for easy access.

### 6. Configure the server URL

In both your browser and your partner's browser:

1. Click the CineSync extension icon
2. Go to **⚙ Settings**
3. Enter your public server URL:
   - Cloudflare: `wss://sync.yourdomain.com`
   - ngrok: `wss://xxx.ngrok-free.app`
4. Click **Save**

---

## How to Use

### Starting a session (host)

1. Navigate to any video page
2. Click the **CineSync** extension icon
3. Click **Create Session**
4. Click **Copy Invite Link** — a link is generated containing your current video URL and room code
5. Send the link to your partner

### Joining a session (partner)

1. Click the invite link — it redirects you directly to the video page and auto-joins the room
2. The CineSync panel appears on screen once connected

### In-session controls

| Control | Action |
|---|---|
| Play / Pause | Synced instantly to partner |
| Seek (scrub) | Synced instantly to partner |
| Chat | Type in the panel, press Enter or ↑ |
| Emoji reactions | Click any emoji — animates across both screens |
| Minimize panel | Click **−** (unread badge shows new messages) |
| Leave session | Click **Leave Room** in the panel |

---

## Development

```bash
# Auto-rebuild on file change
cd extension
npm run watch

# Type-check only (no emit)
npm run typecheck

# Generate placeholder icons (rose-colored squares)
node generate-icons.mjs
```

After each rebuild, go to `chrome://extensions` and click the **↺ refresh** icon on the CineSync card, then reload the video tab.

### Project Structure

```
cinesync/
├── server/
│   ├── server.ts          # WebSocket relay + HTTP invite redirect
│   ├── package.json
│   └── tsconfig.json
└── extension/
    ├── src/
    │   ├── background.ts  # Sets storage defaults on install
    │   ├── content.ts     # Core logic: WS, video sync, overlay UI, iframe bridge
    │   └── popup.ts       # Popup UI: create/join session, settings
    ├── manifest.json
    ├── popup.html
    ├── popup.css
    ├── build.mjs          # esbuild config
    ├── generate-icons.mjs # Generates placeholder PNG icons
    └── tsconfig.json
```

### Key design decisions

- **Shadow DOM** for the overlay UI — completely isolated from host page styles
- **`all_frames: true`** with `IS_TOP` guards — the full session logic (WebSocket, popup messages, auto-join) runs only in the top frame; iframes run a lightweight `postMessage` bridge to relay video events
- **No background service worker state** — the content script owns the WebSocket connection, avoiding Manifest V3 service worker lifecycle issues
- **Invite link flow** — the server's HTTP `/join` endpoint redirects to the video URL with `?cinesync=ROOMID` appended; the content script reads and strips it on load

---

## Browser Compatibility

| Browser | Supported |
|---|---|
| Chrome 116+ | ✅ |
| Brave | ✅ |
| Edge | ✅ |
| Firefox | ❌ (uses different extension API) |

---

## License

MIT
