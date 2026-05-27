"use strict";
(() => {
  // src/content.ts
  var APP_NAME = "CineSync";
  var IS_TOP = window === window.top;
  var ws = null;
  var roomId = null;
  var sessionActive = false;
  var partnerOnline = false;
  var isSyncing = false;
  var minimized = false;
  var unreadCount = 0;
  var host = document.createElement("div");
  host.id = "__cinesync__";
  Object.assign(host.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "2147483647",
    pointerEvents: "none",
    overflow: "visible"
  });
  if (IS_TOP) document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: "open" });
  var styleEl = document.createElement("style");
  styleEl.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .panel {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 312px;
    background: rgba(12, 12, 16, 0.97);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    color: #f4f4f5;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: none;
    flex-direction: column;
    box-shadow: 0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(99,102,241,0.06);
    backdrop-filter: blur(28px);
    pointer-events: all;
    overflow: hidden;
  }
  .panel.active { display: flex; }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 14px;
    background: rgba(255,255,255,0.025);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    cursor: grab;
    user-select: none;
    flex-shrink: 0;
  }
  .header.dragging { cursor: grabbing; }

  .logo { font-weight: 700; font-size: 13px; color: #e4e4e7; letter-spacing: 0.2px; }

  .header-right { display: flex; align-items: center; gap: 4px; }

  .dots { display: flex; gap: 4px; margin-right: 4px; }
  .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #27272a; transition: background 0.3s;
  }
  .dot.conn    { background: #22c55e; }
  .dot.partner { background: #818cf8; }

  .icon-btn {
    background: none; border: none; color: #52525b;
    cursor: pointer; width: 26px; height: 26px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 7px; padding: 0; transition: background 0.15s, color 0.15s;
    position: relative; flex-shrink: 0;
  }
  .icon-btn:hover { background: rgba(255,255,255,0.08); color: #e4e4e7; }
  .icon-btn svg { pointer-events: none; }

  @keyframes badge-pulse {
    0%, 100% { transform: scale(1); }
    50%       { transform: scale(1.18); }
  }

  .unread-badge {
    position: absolute;
    top: -6px; right: -6px;
    background: #ef4444;
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    pointer-events: none;
    line-height: 1;
    box-shadow: 0 0 0 2px rgba(12,12,16,0.9);
    animation: badge-pulse 1.6s ease-in-out infinite;
  }
  .unread-badge.show { display: flex; }

  .status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px;
    font-size: 11.5px;
    color: #3f3f46;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: color 0.3s;
    flex-shrink: 0;
    user-select: none;
  }
  .status-bar::before {
    content: '';
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #27272a;
    flex-shrink: 0;
    transition: background 0.3s;
  }
  .status-bar.online { color: #a5b4fc; }
  .status-bar.online::before { background: #818cf8; }

  .body {
    display: flex; flex-direction: column;
    gap: 8px; padding: 12px;
    overflow: hidden;
  }

  .chat-box {
    height: 240px; overflow-y: auto;
    display: flex; flex-direction: column; gap: 6px;
    padding-right: 2px;
  }
  .chat-box::-webkit-scrollbar { width: 3px; }
  .chat-box::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }
  .chat-box::-webkit-scrollbar-track { background: transparent; }

  .msg {
    padding: 7px 11px; border-radius: 12px;
    font-size: 13px; line-height: 1.45;
    word-break: break-word; max-width: 85%;
  }
  .msg.me {
    background: rgba(99,102,241,0.22); align-self: flex-end;
    color: #c7d2fe; border-bottom-right-radius: 4px;
  }
  .msg.them {
    background: rgba(255,255,255,0.07); align-self: flex-start;
    color: #e4e4e7; border-bottom-left-radius: 4px;
  }
  .msg.sys {
    color: #3f3f46; font-size: 11px;
    text-align: center; align-self: center;
    padding: 2px 6px; background: none;
  }

  .divider-line {
    border: none; border-top: 1px solid rgba(255,255,255,0.05);
    margin: 0; flex-shrink: 0;
  }

  .emoji-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    padding: 1px 0;
  }
  .e-btn {
    background: none; border: none; cursor: pointer;
    font-size: 17px; padding: 4px 4px;
    border-radius: 7px; line-height: 1;
    transition: transform 0.12s, background 0.12s;
    text-align: center;
  }
  .e-btn:hover { transform: scale(1.35); background: rgba(255,255,255,0.07); }
  .e-btn:active { transform: scale(0.82); }

  .input-row { display: flex; gap: 7px; align-items: flex-end; }

  .chat-in {
    flex: 1;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 11px; color: #f4f4f5;
    font-size: 13px; padding: 9px 12px; outline: none;
    font-family: inherit; transition: border-color 0.15s;
    resize: none; line-height: 1.4;
  }
  .chat-in::placeholder { color: #3f3f46; }
  .chat-in:focus { border-color: rgba(129,140,248,0.45); }

  .send-btn {
    background: #6366f1; border: none; border-radius: 11px;
    color: #fff; cursor: pointer;
    width: 38px; height: 38px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: background 0.15s;
  }
  .send-btn:hover { background: #4f46e5; }
  .send-btn:disabled { background: #27272a; cursor: not-allowed; opacity: 0.5; }

  .leave-btn {
    background: none; border: none;
    color: #3f3f46; cursor: pointer;
    font-size: 11px; padding: 2px 0; width: 100%;
    font-family: inherit; transition: color 0.15s;
    text-align: center; letter-spacing: 0.2px;
  }
  .leave-btn:hover { color: #f87171; }

  @keyframes float-up {
    0%   { opacity: 0;   transform: translateY(0)     scale(0.4); }
    12%  { opacity: 1;   transform: translateY(-12px) scale(1.15); }
    80%  { opacity: 0.7; }
    100% { opacity: 0;   transform: translateY(-75vh) scale(0.9); }
  }

  .reaction-float {
    position: fixed;
    pointer-events: none;
    user-select: none;
    line-height: 1;
    animation: float-up linear forwards;
    will-change: transform, opacity;
  }
`;
  shadow.appendChild(styleEl);
  var panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
  <div class="header" id="drag">
    <span class="logo">\u{1F3AC} ${APP_NAME}</span>
    <div class="header-right">
      <div class="dots">
        <div class="dot" id="connDot" title="Server"></div>
        <div class="dot" id="partDot" title="Partner"></div>
      </div>
      <button class="icon-btn" id="copyLinkBtn" title="Copy invite link">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </button>
      <button class="icon-btn" id="minBtn" title="Minimise">
        <svg id="minIcon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span class="unread-badge" id="unreadBadge"></span>
      </button>
    </div>
  </div>
  <div class="status-bar" id="partnerRow">Waiting for your partner\u2026</div>
  <div class="body" id="panelBody">
    <div class="chat-box" id="chatBox"></div>
    <hr class="divider-line">
    <div class="emoji-bar" id="emojiBar">
      <button class="e-btn" data-emoji="\u2764\uFE0F">\u2764\uFE0F</button>
      <button class="e-btn" data-emoji="\u{1F495}">\u{1F495}</button>
      <button class="e-btn" data-emoji="\u{1F60D}">\u{1F60D}</button>
      <button class="e-btn" data-emoji="\u{1F970}">\u{1F970}</button>
      <button class="e-btn" data-emoji="\u{1F48B}">\u{1F48B}</button>
      <button class="e-btn" data-emoji="\u{1F602}">\u{1F602}</button>
      <button class="e-btn" data-emoji="\u{1F923}">\u{1F923}</button>
      <button class="e-btn" data-emoji="\u{1F606}">\u{1F606}</button>
      <button class="e-btn" data-emoji="\u{1F62E}">\u{1F62E}</button>
      <button class="e-btn" data-emoji="\u{1F631}">\u{1F631}</button>
      <button class="e-btn" data-emoji="\u{1F92F}">\u{1F92F}</button>
      <button class="e-btn" data-emoji="\u{1F440}">\u{1F440}</button>
      <button class="e-btn" data-emoji="\u{1F44F}">\u{1F44F}</button>
      <button class="e-btn" data-emoji="\u{1F389}">\u{1F389}</button>
      <button class="e-btn" data-emoji="\u{1F973}">\u{1F973}</button>
      <button class="e-btn" data-emoji="\u{1F622}">\u{1F622}</button>
      <button class="e-btn" data-emoji="\u{1F494}">\u{1F494}</button>
      <button class="e-btn" data-emoji="\u{1F525}">\u{1F525}</button>
      <button class="e-btn" data-emoji="\u{1F4AF}">\u{1F4AF}</button>
      <button class="e-btn" data-emoji="\u{1F37F}">\u{1F37F}</button>
      <button class="e-btn" data-emoji="\u{1F60E}">\u{1F60E}</button>
      <button class="e-btn" data-emoji="\u{1F319}">\u{1F319}</button>
    </div>
    <hr class="divider-line">
    <div class="input-row">
      <input class="chat-in" id="chatIn" placeholder="Message\u2026" maxlength="200" type="text" autocomplete="off">
      <button class="send-btn" id="sendBtn" disabled>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
        </svg>
      </button>
    </div>
    <button class="leave-btn" id="leaveBtn">Leave Room</button>
  </div>
`;
  shadow.appendChild(panel);
  var $ = (id) => shadow.getElementById(id);
  function showPanel() {
    panel.classList.add("active");
    clearUnread();
  }
  function hidePanel() {
    panel.classList.remove("active");
  }
  function setConnected(on) {
    $("connDot").className = `dot${on ? " conn" : ""}`;
  }
  function setPartner(online) {
    partnerOnline = online;
    $("partDot").className = `dot${online ? " partner" : ""}`;
    const row = $("partnerRow");
    row.className = `status-bar${online ? " online" : ""}`;
    row.textContent = online ? "Partner connected" : "Waiting for your partner\u2026";
  }
  function addMsg(text, kind) {
    const chatBox = $("chatBox");
    const d = document.createElement("div");
    d.className = `msg ${kind}`;
    d.textContent = text;
    chatBox.appendChild(d);
    chatBox.scrollTop = chatBox.scrollHeight;
    if (minimized && kind !== "me") bumpUnread();
  }
  function bumpUnread() {
    unreadCount++;
    const badge = $("unreadBadge");
    badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    badge.classList.add("show");
  }
  function clearUnread() {
    unreadCount = 0;
    const badge = $("unreadBadge");
    badge.textContent = "";
    badge.classList.remove("show");
  }
  var dragging = false;
  var dragOff = { x: 0, y: 0 };
  var dragHandle = $("drag");
  dragHandle.addEventListener("mousedown", (e) => {
    const me = e;
    if (me.target.closest(".icon-btn, .copy-btn")) return;
    dragging = true;
    const r = panel.getBoundingClientRect();
    dragOff = { x: me.clientX - r.left, y: me.clientY - r.top };
    dragHandle.classList.add("dragging");
    me.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const x = Math.max(0, Math.min(e.clientX - dragOff.x, window.innerWidth - panel.offsetWidth));
    const y = Math.max(0, Math.min(e.clientY - dragOff.y, window.innerHeight - panel.offsetHeight));
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    panel.style.right = "auto";
  }, true);
  document.addEventListener("mouseup", () => {
    dragging = false;
    dragHandle.classList.remove("dragging");
  }, true);
  window.addEventListener("resize", () => {
    const left = parseFloat(panel.style.left);
    const top = parseFloat(panel.style.top);
    if (isNaN(left) || isNaN(top)) return;
    panel.style.left = `${Math.max(0, Math.min(left, window.innerWidth - panel.offsetWidth))}px`;
    panel.style.top = `${Math.max(0, Math.min(top, window.innerHeight - panel.offsetHeight))}px`;
  });
  $("minBtn").addEventListener("click", () => {
    minimized = !minimized;
    $("panelBody").style.display = minimized ? "none" : "flex";
    const icon = $("minIcon");
    icon.innerHTML = minimized ? '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>' : '<line x1="5" y1="12" x2="19" y2="12"/>';
    if (!minimized) clearUnread();
  });
  async function copyInviteLink() {
    if (!roomId) return;
    const serverUrl = await getServerUrl();
    const httpUrl = serverUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
    const link = `${httpUrl}/join?room=${roomId}&video=${encodeURIComponent(location.href)}`;
    await navigator.clipboard.writeText(link);
    const btn = $("copyLinkBtn");
    btn.style.color = "#22c55e";
    setTimeout(() => btn.style.color = "", 1500);
  }
  $("copyLinkBtn").addEventListener("click", () => {
    void copyInviteLink();
  });
  $("leaveBtn").addEventListener("click", () => {
    disconnect();
    notifyPopup();
  });
  function sendChat() {
    const input = $("chatIn");
    const text = input.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "chat", text }));
    addMsg(text, "me");
    input.value = "";
  }
  $("sendBtn").addEventListener("click", sendChat);
  var chatIn = $("chatIn");
  chatIn.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") sendChat();
  });
  chatIn.addEventListener("keyup", (e) => e.stopPropagation());
  chatIn.addEventListener("keypress", (e) => e.stopPropagation());
  async function getServerUrl() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get("serverUrl", (r) => {
          resolve(r.serverUrl ?? "ws://localhost:8080");
        });
      } catch {
        resolve("ws://localhost:8080");
      }
    });
  }
  async function connectWS(action, joinId) {
    const url = await getServerUrl();
    ws = new WebSocket(url);
    ws.onopen = () => {
      setConnected(true);
      const payload = action === "create" ? { type: "create" } : { type: "join", roomId: joinId };
      ws.send(JSON.stringify(payload));
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      handleServerMsg(msg);
    };
    ws.onclose = () => {
      setConnected(false);
      setPartner(false);
      $("sendBtn").disabled = true;
      if (sessionActive) addMsg("Connection lost.", "sys");
    };
    ws.onerror = () => addMsg("Could not connect to server. Check Settings in the popup.", "sys");
  }
  function controlVideo(action, time) {
    window.dispatchEvent(new CustomEvent("__cs_to_page", { detail: { action, time } }));
  }
  function handleServerMsg(msg) {
    switch (msg.type) {
      case "created":
        roomId = msg.roomId;
        addMsg("Session created \u2014 share the invite link!", "sys");
        $("sendBtn").disabled = false;
        showPanel();
        notifyPopup();
        break;
      case "joined":
        roomId = msg.roomId;
        addMsg("Joined the session!", "sys");
        $("sendBtn").disabled = false;
        setPartner(true);
        showPanel();
        notifyPopup();
        isSyncing = true;
        controlVideo("pause");
        broadcastToIframes({ type: "sync", action: "pause", time: 0 });
        setTimeout(() => {
          isSyncing = false;
        }, 800);
        break;
      case "partner_joined":
        setPartner(true);
        addMsg("Your partner joined \u2665", "sys");
        notifyPopup();
        break;
      case "partner_left":
        setPartner(false);
        addMsg("Partner disconnected.", "sys");
        notifyPopup();
        break;
      case "sync":
        applySync(msg);
        break;
      case "chat":
        addMsg(msg.text, "them");
        break;
      case "reaction":
        spawnReaction(msg.emoji);
        break;
      case "error":
        addMsg(`Error: ${msg.message}`, "sys");
        break;
    }
  }
  function disconnect() {
    ws?.close();
    ws = null;
    sessionActive = false;
    roomId = null;
    setConnected(false);
    setPartner(false);
    hidePanel();
  }
  function contextValid() {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }
  function notifyPopup() {
    if (!contextValid()) return;
    try {
      chrome.runtime.sendMessage({ type: "status_changed" }).catch(() => {
      });
    } catch {
    }
  }
  var EMOJIS = [
    "\u2764\uFE0F",
    "\u{1F495}",
    "\u{1F60D}",
    "\u{1F970}",
    "\u{1F48B}",
    "\u{1F602}",
    "\u{1F923}",
    "\u{1F606}",
    "\u{1F62E}",
    "\u{1F631}",
    "\u{1F92F}",
    "\u{1F440}",
    "\u{1F44F}",
    "\u{1F389}",
    "\u{1F973}",
    "\u{1F622}",
    "\u{1F494}",
    "\u{1F525}",
    "\u{1F4AF}",
    "\u{1F37F}",
    "\u{1F60E}",
    "\u{1F319}"
  ];
  function getEmojiStyle(emoji) {
    if (["\u2764\uFE0F", "\u{1F495}", "\u{1F60D}", "\u{1F970}", "\u{1F48B}"].includes(emoji)) return "love";
    if (["\u{1F602}", "\u{1F923}", "\u{1F606}"].includes(emoji)) return "laugh";
    if (["\u{1F62E}", "\u{1F631}", "\u{1F92F}", "\u{1F440}"].includes(emoji)) return "shocked";
    if (["\u{1F44F}", "\u{1F389}", "\u{1F973}", "\u{1F4AF}"].includes(emoji)) return "hype";
    if (["\u{1F622}", "\u{1F494}"].includes(emoji)) return "sad";
    if (["\u{1F525}"].includes(emoji)) return "fire";
    return "default";
  }
  function buildKeyframes(style, drift) {
    const gone = { opacity: 0 };
    switch (style) {
      case "love":
        return [
          { opacity: 0, transform: `translateX(0)              translateY(0)     scale(0)` },
          { opacity: 1, transform: `translateX(0)              translateY(-18px) scale(1.6)`, offset: 0.08 },
          { transform: `translateX(0)              translateY(-24px) scale(1.0)`, offset: 0.14 },
          { transform: `translateX(${drift * 0.3}px)  translateY(-22vh) scale(1.25)`, offset: 0.32 },
          { transform: `translateX(${drift * 0.4}px)  translateY(-28vh) scale(0.95)`, offset: 0.42 },
          { transform: `translateX(${drift * 0.5}px)  translateY(-36vh) scale(1.25)`, offset: 0.54 },
          { transform: `translateX(${drift * 0.6}px)  translateY(-42vh) scale(0.95)`, offset: 0.64 },
          { opacity: 0.7, transform: `translateX(${drift * 0.85}px) translateY(-60vh) scale(0.8)`, offset: 0.85 },
          { ...gone, transform: `translateX(${drift}px)     translateY(-78vh) scale(0.4)` }
        ];
      case "laugh":
        return [
          { opacity: 0, transform: `translateX(0)             translateY(0)     scale(0)   rotate(0deg)` },
          { opacity: 1, transform: `translateX(0)             translateY(-20px) scale(1.6) rotate(-15deg)`, offset: 0.08 },
          { transform: `translateX(${drift * 0.1}px) translateY(-25px) scale(1.1) rotate(10deg)`, offset: 0.14 },
          { transform: `translateX(${drift * 0.3}px) translateY(-22vh) scale(1.1) rotate(120deg)`, offset: 0.38 },
          { transform: `translateX(${drift * 0.6}px) translateY(-45vh) scale(1.0) rotate(260deg)`, offset: 0.65 },
          { opacity: 0.6, transform: `translateX(${drift * 0.9}px) translateY(-64vh) scale(0.85)rotate(360deg)`, offset: 0.85 },
          { ...gone, transform: `translateX(${drift}px)    translateY(-78vh) scale(0.5) rotate(400deg)` }
        ];
      case "shocked":
        return [
          { opacity: 0, transform: `translateX(0px)   translateY(0px)   scale(0)` },
          { opacity: 1, transform: `translateX(-14px)  translateY(-6px)  scale(1.7)`, offset: 0.06 },
          { transform: `translateX(14px)   translateY(-6px)  scale(1.7)`, offset: 0.09 },
          { transform: `translateX(-12px)  translateY(-8px)  scale(1.6)`, offset: 0.12 },
          { transform: `translateX(12px)   translateY(-8px)  scale(1.6)`, offset: 0.15 },
          { transform: `translateX(-8px)   translateY(-10px) scale(1.5)`, offset: 0.18 },
          { transform: `translateX(0px)    translateY(-12px) scale(1.4)`, offset: 0.22 },
          { opacity: 0.9, transform: `translateX(${drift * 0.6}px) translateY(-42vh) scale(1.0)`, offset: 0.62 },
          { opacity: 0.5, transform: `translateX(${drift * 0.9}px) translateY(-64vh) scale(0.8)`, offset: 0.85 },
          { ...gone, transform: `translateX(${drift}px)    translateY(-78vh) scale(0.5)` }
        ];
      case "hype":
        return [
          { opacity: 0, transform: `translateX(0)              translateY(0px)   scale(0)   rotate(0deg)` },
          { opacity: 1, transform: `translateX(0)              translateY(-40px) scale(1.8) rotate(-12deg)`, offset: 0.09 },
          { transform: `translateX(${drift * 0.05}px) translateY(-8px)  scale(0.8) rotate(6deg)`, offset: 0.18 },
          { transform: `translateX(${drift * 0.12}px) translateY(-55px) scale(1.5) rotate(-8deg)`, offset: 0.27 },
          { transform: `translateX(${drift * 0.2}px)  translateY(-12px) scale(0.85)rotate(4deg)`, offset: 0.36 },
          { transform: `translateX(${drift * 0.35}px) translateY(-22vh) scale(1.1) rotate(0deg)`, offset: 0.5 },
          { opacity: 0.8, transform: `translateX(${drift * 0.7}px)  translateY(-50vh) scale(0.95)`, offset: 0.72 },
          { opacity: 0.4, transform: `translateX(${drift * 0.9}px)  translateY(-67vh) scale(0.8)`, offset: 0.88 },
          { ...gone, transform: `translateX(${drift}px)     translateY(-78vh) scale(0.5)` }
        ];
      case "sad":
        return [
          { opacity: 0, transform: `translateX(0px)            translateY(0px)   scale(0)` },
          { opacity: 0.9, transform: `translateX(0px)            translateY(-12px) scale(1.2)`, offset: 0.12 },
          { transform: `translateX(-6px)           translateY(-18px) scale(1.1)`, offset: 0.22 },
          { transform: `translateX(6px)            translateY(-22px) scale(1.1)`, offset: 0.32 },
          { transform: `translateX(-4px)           translateY(-26px) scale(1.05)`, offset: 0.42 },
          { transform: `translateX(${drift * 0.35}px) translateY(-28vh) scale(0.95)`, offset: 0.62 },
          { opacity: 0.5, transform: `translateX(${drift * 0.65}px) translateY(-48vh) scale(0.8)`, offset: 0.82 },
          { ...gone, transform: `translateX(${drift}px)     translateY(-62vh) scale(0.55)` }
        ];
      case "fire":
        return [
          { opacity: 0, transform: `translateX(0)              translateY(0px)   scale(0)` },
          { opacity: 1, transform: `translateX(0)              translateY(-16px) scale(1.7)`, offset: 0.07 },
          { transform: `translateX(${drift * 0.08}px) translateY(-20px) scale(1.1)`, offset: 0.12 },
          { transform: `translateX(${drift * 0.1}px)  translateY(-28px) scale(1.6)`, offset: 0.17 },
          { transform: `translateX(${drift * 0.15}px) translateY(-34px) scale(1.0)`, offset: 0.22 },
          { transform: `translateX(${drift * 0.2}px)  translateY(-40px) scale(1.5)`, offset: 0.27 },
          { transform: `translateX(${drift * 0.35}px) translateY(-22vh) scale(1.2)`, offset: 0.42 },
          { transform: `translateX(${drift * 0.55}px) translateY(-40vh) scale(1.0)`, offset: 0.6 },
          { opacity: 0.7, transform: `translateX(${drift * 0.8}px)  translateY(-58vh) scale(0.85)`, offset: 0.8 },
          { ...gone, transform: `translateX(${drift}px)     translateY(-75vh) scale(0.5)` }
        ];
      default:
        return [
          { opacity: 0, transform: `translateX(0)              translateY(0)     scale(0)` },
          { opacity: 1, transform: `translateX(0)              translateY(-18px) scale(1.5)`, offset: 0.08 },
          { transform: `translateX(${drift * 0.1}px)  translateY(-22px) scale(1.0)`, offset: 0.14 },
          { transform: `translateX(${drift * 0.4}px)  translateY(-20vh) scale(1.1)`, offset: 0.35 },
          { transform: `translateX(${drift * 0.15}px) translateY(-36vh) scale(1.05)`, offset: 0.55 },
          { transform: `translateX(${drift * 0.7}px)  translateY(-52vh) scale(0.95)`, offset: 0.75 },
          { opacity: 0.5, transform: `translateX(${drift * 0.85}px) translateY(-64vh) scale(0.8)`, offset: 0.88 },
          { ...gone, transform: `translateX(${drift}px)     translateY(-78vh) scale(0.55)` }
        ];
    }
  }
  var STYLE_DURATION = {
    love: [3.2, 4.2],
    laugh: [2.4, 3.2],
    shocked: [2, 2.8],
    hype: [2.2, 3],
    sad: [3.8, 5],
    fire: [1.8, 2.5],
    default: [2.5, 3.4]
  };
  function spawnReaction(emoji) {
    const style = getEmojiStyle(emoji);
    const [minD, maxD] = STYLE_DURATION[style];
    const count = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const el = document.createElement("div");
        el.className = "reaction-float";
        el.textContent = emoji;
        const xPct = 6 + Math.random() * 88;
        const fontSize = 2.4 + Math.random() * 1.8;
        const duration = (minD + Math.random() * (maxD - minD)) * 1e3;
        const drift = (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 90);
        el.style.cssText = `left: ${xPct}vw; bottom: 6vh; font-size: ${fontSize}rem;`;
        el.animate(buildKeyframes(style, drift), {
          duration,
          easing: "linear",
          fill: "forwards"
        }).onfinish = () => el.remove();
        shadow.appendChild(el);
      }, i * 130);
    }
  }
  function sendReaction(emoji) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "reaction", emoji }));
    spawnReaction(emoji);
  }
  $("emojiBar").addEventListener("click", (e) => {
    const btn = e.target.closest(".e-btn");
    if (!btn) return;
    const emoji = btn.dataset["emoji"];
    if (emoji && EMOJIS.includes(emoji)) sendReaction(emoji);
  });
  function applySync(msg) {
    isSyncing = true;
    controlVideo(msg.action, msg.time);
    broadcastToIframes({ type: "sync", action: msg.action, time: msg.time });
    setTimeout(() => {
      isSyncing = false;
    }, 500);
  }
  function broadcastToIframes(payload) {
    document.querySelectorAll("iframe").forEach((f) => {
      f.contentWindow?.postMessage({ __cinesync: true, ...payload }, "*");
    });
  }
  if (IS_TOP) {
    window.addEventListener("__cs_from_page", (e) => {
      if (!contextValid()) {
        disconnect();
        return;
      }
      const { action, time } = e.detail;
      if (isSyncing || !sessionActive || !ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "sync", action, time }));
    });
  }
  if (IS_TOP) {
    (function autoJoinFromUrl() {
      const params = new URLSearchParams(location.search);
      const autoRoom = params.get("cinesync");
      if (!autoRoom) return;
      params.delete("cinesync");
      const clean = params.toString() ? `${location.pathname}?${params.toString()}${location.hash}` : `${location.pathname}${location.hash}`;
      history.replaceState(null, "", clean);
      sessionActive = true;
      void connectWS("join", autoRoom);
    })();
    chrome.runtime.onMessage.addListener(
      (msg, _sender, reply) => {
        switch (msg.type) {
          case "get_status":
            reply({ sessionActive, roomId, connected: ws?.readyState === WebSocket.OPEN, partnerOnline });
            break;
          case "create_session":
            sessionActive = true;
            void connectWS("create");
            reply({ ok: true });
            break;
          case "join_session":
            sessionActive = true;
            void connectWS("join", msg.roomId);
            reply({ ok: true });
            break;
          case "leave_session":
            disconnect();
            reply({ ok: true });
            break;
        }
        return true;
      }
    );
  }
  if (IS_TOP) {
    window.addEventListener("message", (e) => {
      const d = e.data;
      if (!d?.__cinesync || d.type !== "video_event") return;
      if (!sessionActive || !ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "sync", action: d.action, time: d.time }));
    });
  }
  if (!IS_TOP) {
    let findVideo = function() {
      const vids = Array.from(document.querySelectorAll("video"));
      if (!vids.length) return null;
      return vids.reduce(
        (best, v) => v.offsetWidth * v.offsetHeight > best.offsetWidth * best.offsetHeight ? v : best
      );
    }, attachIframeVideo = function(v) {
      if (iVid === v) return;
      iVid = v;
      const emit = (action) => {
        if (iSyncing) return;
        window.top?.postMessage(
          { __cinesync: true, type: "video_event", action, time: v.currentTime },
          "*"
        );
      };
      v.addEventListener("play", () => emit("play"));
      v.addEventListener("pause", () => emit("pause"));
      v.addEventListener("seeked", () => emit("seek"));
    };
    findVideo2 = findVideo, attachIframeVideo2 = attachIframeVideo;
    let iVid = null;
    let iSyncing = false;
    window.addEventListener("message", (e) => {
      const d = e.data;
      if (!d?.__cinesync || d.type !== "sync" || !iVid) return;
      iSyncing = true;
      if (d.action === "play") {
        iVid.currentTime = d.time;
        void iVid.play().catch(() => {
        });
      }
      if (d.action === "pause") {
        iVid.currentTime = d.time;
        iVid.pause();
      }
      if (d.action === "seek") {
        iVid.currentTime = d.time;
      }
      setTimeout(() => {
        iSyncing = false;
      }, 500);
    });
    const checkIframeVideo = () => {
      const v = findVideo();
      if (v) attachIframeVideo(v);
    };
    checkIframeVideo();
    new MutationObserver(checkIframeVideo).observe(document.documentElement, { childList: true, subtree: true });
  }
  var findVideo2;
  var attachIframeVideo2;
})();
