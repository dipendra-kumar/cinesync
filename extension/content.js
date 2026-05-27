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
  var video = null;
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
    width: 260px;
    background: rgba(12, 6, 10, 0.97);
    border: 1px solid rgba(251,113,133,0.18);
    border-radius: 14px;
    color: #fff;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: none;
    flex-direction: column;
    box-shadow: 0 12px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(225,29,72,0.06);
    backdrop-filter: blur(20px);
    pointer-events: all;
    overflow: hidden;
  }
  .panel.active { display: flex; }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 13px;
    background: rgba(225,29,72,0.07);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    cursor: grab;
    user-select: none;
  }
  .header.dragging { cursor: grabbing; }

  .logo { font-weight: 800; font-size: 14px; color: #fb7185; }

  .header-right { display: flex; align-items: center; gap: 7px; }

  .dots { display: flex; gap: 4px; }
  .dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: #1f2937; transition: background 0.3s;
  }
  .dot.conn { background: #22c55e; }
  .dot.partner { background: #fb7185; }

  .icon-btn {
    background: none; border: none; color: #6b7280;
    cursor: pointer; font-size: 15px; width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 6px; padding: 0; transition: background 0.15s, color 0.15s;
    position: relative;
  }
  .icon-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }

  .unread-badge {
    position: absolute;
    top: -4px; right: -4px;
    background: #e11d48;
    color: #fff;
    font-size: 9px;
    font-weight: 800;
    min-width: 15px;
    height: 15px;
    border-radius: 8px;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    pointer-events: none;
    line-height: 1;
  }
  .unread-badge.show { display: flex; }

  .leave-btn {
    background: rgba(239,68,68,0.07);
    border: 1px solid rgba(239,68,68,0.18);
    border-radius: 9px; color: #f87171;
    cursor: pointer; font-size: 11px;
    padding: 6px 10px; width: 100%;
    font-family: inherit;
    transition: background 0.15s;
    margin-top: 2px;
  }
  .leave-btn:hover { background: rgba(239,68,68,0.18); color: #fca5a5; }

  .body {
    display: flex; flex-direction: column;
    gap: 9px; padding: 12px;
  }

  .room-row {
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; padding: 8px 11px;
  }
  .room-lbl { font-size: 10px; color: #6b7280; margin-bottom: 2px; letter-spacing: 0.5px; text-transform: uppercase; }
  .room-code { color: #fb7185; font-weight: 800; letter-spacing: 4px; font-size: 17px; }

  .copy-btn {
    background: rgba(225,29,72,0.1);
    border: 1px solid rgba(225,29,72,0.2);
    border-radius: 7px; color: #fb7185;
    cursor: pointer; font-size: 11px;
    padding: 4px 10px; transition: background 0.15s;
    white-space: nowrap;
  }
  .copy-btn:hover { background: rgba(225,29,72,0.22); }

  .partner-row {
    text-align: center; font-size: 12px; color: #6b7280;
    padding: 3px 0; transition: color 0.3s;
  }
  .partner-row.online { color: #fb7185; }

  .chat-box {
    height: 150px; overflow-y: auto;
    display: flex; flex-direction: column; gap: 5px;
  }
  .chat-box::-webkit-scrollbar { width: 3px; }
  .chat-box::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

  .msg {
    padding: 5px 9px; border-radius: 10px;
    font-size: 12px; line-height: 1.4;
    word-break: break-word; max-width: 90%;
  }
  .msg.me {
    background: rgba(225,29,72,0.2); align-self: flex-end;
    color: #fecdd3; border-bottom-right-radius: 3px;
  }
  .msg.them {
    background: rgba(255,255,255,0.07); align-self: flex-start;
    color: #e5e7eb; border-bottom-left-radius: 3px;
  }
  .msg.sys { color: #4b5563; font-size: 11px; text-align: center; align-self: center; }

  .input-row { display: flex; gap: 6px; }

  .chat-in {
    flex: 1;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 9px; color: #fff;
    font-size: 12px; padding: 7px 10px; outline: none;
    font-family: inherit; transition: border-color 0.15s;
  }
  .chat-in::placeholder { color: #374151; }
  .chat-in:focus { border-color: rgba(251,113,133,0.45); }

  .send-btn {
    background: #e11d48; border: none; border-radius: 9px;
    color: #fff; cursor: pointer; font-size: 15px;
    width: 33px; height: 33px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: background 0.15s;
  }
  .send-btn:hover { background: #be123c; }
  .send-btn:disabled { background: #1f2937; cursor: not-allowed; }

  .emoji-bar {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1px;
    padding: 2px 0;
  }
  .e-btn {
    background: none; border: none; cursor: pointer;
    font-size: 18px; padding: 4px 5px;
    border-radius: 8px; line-height: 1;
    transition: transform 0.12s, background 0.12s;
    text-align: center;
  }
  .e-btn:hover { transform: scale(1.4); background: rgba(255,255,255,0.07); }
  .e-btn:active { transform: scale(0.82); }

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
        <div class="dot" id="connDot" title="Server connection"></div>
        <div class="dot" id="partDot" title="Partner"></div>
      </div>
      <button class="icon-btn" id="minBtn" title="Minimise">\u2212
        <span class="unread-badge" id="unreadBadge"></span>
      </button>
    </div>
  </div>
  <div class="body" id="panelBody">
    <div class="room-row">
      <div>
        <div class="room-lbl">Room code</div>
        <div class="room-code" id="roomCode">------</div>
      </div>
      <button class="copy-btn" id="copyBtn">Copy</button>
    </div>
    <div class="partner-row" id="partnerRow">Waiting for your partner\u2026</div>
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
    <div class="chat-box" id="chatBox"></div>
    <div class="input-row">
      <input class="chat-in" id="chatIn" placeholder="Say something\u2026" maxlength="200" type="text" autocomplete="off">
      <button class="send-btn" id="sendBtn" disabled>\u2191</button>
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
    row.className = `partner-row${online ? " online" : ""}`;
    row.textContent = online ? "\u2665 Partner connected" : "Waiting for your partner\u2026";
    $("sendBtn").disabled = !online;
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
    const minBtn = $("minBtn");
    const textNode = Array.from(minBtn.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.textContent = minimized ? "+" : "\u2212";
    if (!minimized) clearUnread();
  });
  $("copyBtn").addEventListener("click", () => {
    if (!roomId) return;
    void navigator.clipboard.writeText(roomId).then(() => {
      const btn = $("copyBtn");
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = "Copy", 1500);
    });
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
      chrome.storage.local.get("serverUrl", (r) => {
        resolve(r.serverUrl ?? "ws://localhost:8080");
      });
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
      if (sessionActive) addMsg("Connection lost.", "sys");
    };
    ws.onerror = () => addMsg("Could not connect to server. Check Settings in the popup.", "sys");
  }
  function handleServerMsg(msg) {
    switch (msg.type) {
      case "created":
        roomId = msg.roomId;
        $("roomCode").textContent = roomId;
        addMsg("Session created \u2014 share the code with your partner!", "sys");
        showPanel();
        notifyPopup();
        break;
      case "joined":
        roomId = msg.roomId;
        $("roomCode").textContent = roomId;
        addMsg("Joined the session!", "sys");
        showPanel();
        notifyPopup();
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
  function notifyPopup() {
    chrome.runtime.sendMessage({ type: "status_changed" }).catch(() => {
    });
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
          // beat 1 up
          { transform: `translateX(${drift * 0.4}px)  translateY(-28vh) scale(0.95)`, offset: 0.42 },
          // beat 1 down
          { transform: `translateX(${drift * 0.5}px)  translateY(-36vh) scale(1.25)`, offset: 0.54 },
          // beat 2 up
          { transform: `translateX(${drift * 0.6}px)  translateY(-42vh) scale(0.95)`, offset: 0.64 },
          // beat 2 down
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
          { opacity: 0, transform: `translateX(0)             translateY(0px)   scale(0)   rotate(0deg)` },
          { opacity: 1, transform: `translateX(0)             translateY(-40px) scale(1.8) rotate(-12deg)`, offset: 0.09 },
          { transform: `translateX(${drift * 0.05}px) translateY(-8px)  scale(0.8) rotate(6deg)`, offset: 0.18 },
          // land 1
          { transform: `translateX(${drift * 0.12}px) translateY(-55px) scale(1.5) rotate(-8deg)`, offset: 0.27 },
          // bounce 2
          { transform: `translateX(${drift * 0.2}px)  translateY(-12px) scale(0.85)rotate(4deg)`, offset: 0.36 },
          // land 2
          { transform: `translateX(${drift * 0.35}px) translateY(-22vh) scale(1.1) rotate(0deg)`, offset: 0.5 },
          // launch
          { opacity: 0.8, transform: `translateX(${drift * 0.7}px)  translateY(-50vh) scale(0.95)`, offset: 0.72 },
          { opacity: 0.4, transform: `translateX(${drift * 0.9}px)  translateY(-67vh) scale(0.8)`, offset: 0.88 },
          { ...gone, transform: `translateX(${drift}px)     translateY(-78vh) scale(0.5)` }
        ];
      case "sad":
        return [
          { opacity: 0, transform: `translateX(0px)          translateY(0px)   scale(0)` },
          { opacity: 0.9, transform: `translateX(0px)          translateY(-12px) scale(1.2)`, offset: 0.12 },
          { transform: `translateX(-6px)         translateY(-18px) scale(1.1)`, offset: 0.22 },
          { transform: `translateX(6px)          translateY(-22px) scale(1.1)`, offset: 0.32 },
          { transform: `translateX(-4px)         translateY(-26px) scale(1.05)`, offset: 0.42 },
          { transform: `translateX(${drift * 0.35}px) translateY(-28vh) scale(0.95)`, offset: 0.62 },
          { opacity: 0.5, transform: `translateX(${drift * 0.65}px) translateY(-48vh) scale(0.8)`, offset: 0.82 },
          { ...gone, transform: `translateX(${drift}px)   translateY(-62vh) scale(0.55)` }
        ];
      case "fire":
        return [
          { opacity: 0, transform: `translateX(0)             translateY(0px)   scale(0)` },
          { opacity: 1, transform: `translateX(0)             translateY(-16px) scale(1.7)`, offset: 0.07 },
          { transform: `translateX(${drift * 0.08}px) translateY(-20px) scale(1.1)`, offset: 0.12 },
          // flicker
          { transform: `translateX(${drift * 0.1}px)  translateY(-28px) scale(1.6)`, offset: 0.17 },
          // flicker
          { transform: `translateX(${drift * 0.15}px) translateY(-34px) scale(1.0)`, offset: 0.22 },
          // flicker
          { transform: `translateX(${drift * 0.2}px)  translateY(-40px) scale(1.5)`, offset: 0.27 },
          // flicker
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
          // sway back
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
        el.style.cssText = `
        left: ${xPct}vw;
        bottom: 6vh;
        font-size: ${fontSize}rem;
      `;
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
  function findVideo() {
    const vids = Array.from(document.querySelectorAll("video"));
    if (!vids.length) return null;
    return vids.reduce(
      (best, v) => v.offsetWidth * v.offsetHeight > best.offsetWidth * best.offsetHeight ? v : best
    );
  }
  var onPlay = () => {
    if (isSyncing || !video || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "sync", action: "play", time: video.currentTime }));
  };
  var onPause = () => {
    if (isSyncing || !video || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "sync", action: "pause", time: video.currentTime }));
  };
  var onSeeked = () => {
    if (isSyncing || !video || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "sync", action: "seek", time: video.currentTime }));
  };
  function attachVideo(v) {
    if (video === v) return;
    if (video) {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
    }
    video = v;
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", onSeeked);
  }
  function applySync(msg) {
    if (!video) video = findVideo();
    if (video) {
      isSyncing = true;
      if (msg.action === "play") {
        video.currentTime = msg.time;
        void video.play().catch(() => {
        });
      } else if (msg.action === "pause") {
        video.currentTime = msg.time;
        video.pause();
      } else if (msg.action === "seek") {
        video.currentTime = msg.time;
      }
      setTimeout(() => {
        isSyncing = false;
      }, 500);
    }
    broadcastToIframes({ type: "sync", action: msg.action, time: msg.time });
  }
  function broadcastToIframes(payload) {
    document.querySelectorAll("iframe").forEach((f) => {
      f.contentWindow?.postMessage({ __cinesync: true, ...payload }, "*");
    });
  }
  if (IS_TOP) {
    new MutationObserver(() => {
      if (!sessionActive) return;
      if (!video || !document.contains(video)) {
        const v = findVideo();
        if (v) attachVideo(v);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
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
      void connectWS("join", autoRoom).then(() => {
        const v = findVideo();
        if (v) attachVideo(v);
      });
    })();
    chrome.runtime.onMessage.addListener(
      (msg, _sender, reply) => {
        switch (msg.type) {
          case "get_status":
            reply({ sessionActive, roomId, connected: ws?.readyState === WebSocket.OPEN, partnerOnline });
            break;
          case "create_session":
            sessionActive = true;
            void connectWS("create").then(() => {
              const v = findVideo();
              if (v) attachVideo(v);
            });
            reply({ ok: true });
            break;
          case "join_session":
            sessionActive = true;
            void connectWS("join", msg.roomId).then(() => {
              const v = findVideo();
              if (v) attachVideo(v);
            });
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
    let attachIframeVideo = function(v) {
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
    attachIframeVideo2 = attachIframeVideo;
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
  var attachIframeVideo2;
})();
