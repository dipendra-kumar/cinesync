import { createServer, IncomingMessage as HttpRequest, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomBytes } from 'crypto';

const PORT = parseInt(process.env.PORT ?? '8080', 10);

// ── Types ──────────────────────────────────────────────────────────────────────

interface Client extends WebSocket {
  roomId?: string;
  isAlive: boolean;
}

interface WsMessage {
  type: string;
  roomId?: string;
  text?: string;
  action?: 'play' | 'pause' | 'seek';
  time?: number;
  emoji?: string;
}

// ── State ──────────────────────────────────────────────────────────────────────

const rooms = new Map<string, Client[]>();

function generateRoomId(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

function relay(sender: Client, payload: object): void {
  if (!sender.roomId) return;
  const room = rooms.get(sender.roomId);
  if (!room) return;
  const data = JSON.stringify(payload);
  for (const c of room) {
    if (c !== sender && c.readyState === WebSocket.OPEN) c.send(data);
  }
}

// ── HTTP — invite link redirect ────────────────────────────────────────────────
// GET /join?room=ROOMID&video=https://...
// → 302 to https://...?cinesync=ROOMID

function handleHttp(req: HttpRequest, res: ServerResponse): void {
  // CORS — extension pages are cross-origin
  res.setHeader('Access-Control-Allow-Origin', '*');

  const base = `http://${req.headers.host ?? 'localhost'}`;
  const reqUrl = new URL(req.url ?? '/', base);

  if (reqUrl.pathname !== '/join') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CineSync server is running.');
    return;
  }

  const roomId   = reqUrl.searchParams.get('room')?.toUpperCase();
  const videoRaw = reqUrl.searchParams.get('video');

  if (!roomId || !videoRaw) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Missing room or video parameter.');
    return;
  }

  let videoUrl: URL;
  try {
    videoUrl = new URL(videoRaw);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Invalid video URL.');
    return;
  }

  // Embed room ID as a query param the content script will read and remove
  videoUrl.searchParams.set('cinesync', roomId);

  res.writeHead(302, { Location: videoUrl.toString() });
  res.end();
  console.log(`[${roomId}] invite link followed → ${videoUrl.toString()}`);
}

// ── Server setup ───────────────────────────────────────────────────────────────

const httpServer = createServer(handleHttp);
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (socket: WebSocket) => {
  const client = socket as Client;
  client.isAlive = true;

  client.on('pong', () => { client.isAlive = true; });

  client.on('message', (raw) => {
    let msg: WsMessage;
    try { msg = JSON.parse(raw.toString()) as WsMessage; } catch { return; }

    switch (msg.type) {
      case 'create': {
        const roomId = generateRoomId();
        rooms.set(roomId, [client]);
        client.roomId = roomId;
        client.send(JSON.stringify({ type: 'created', roomId }));
        console.log(`[${roomId}] created`);
        break;
      }

      case 'join': {
        const roomId = msg.roomId?.toUpperCase();
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room) {
          client.send(JSON.stringify({ type: 'error', message: 'Room not found.' }));
        } else if (room.length >= 2) {
          client.send(JSON.stringify({ type: 'error', message: 'Room is full.' }));
        } else {
          room.push(client);
          client.roomId = roomId;
          client.send(JSON.stringify({ type: 'joined', roomId }));
          relay(client, { type: 'partner_joined' });
          console.log(`[${roomId}] partner joined`);
        }
        break;
      }

      case 'sync':
      case 'chat':
      case 'reaction':
        relay(client, msg);
        break;
    }
  });

  client.on('close', () => {
    if (!client.roomId) return;
    const room = rooms.get(client.roomId);
    if (!room) return;
    const remaining = room.filter(c => c !== client);
    if (remaining.length === 0) {
      rooms.delete(client.roomId);
      console.log(`[${client.roomId}] closed`);
    } else {
      rooms.set(client.roomId, remaining);
      remaining.forEach(c => {
        if (c.readyState === WebSocket.OPEN)
          c.send(JSON.stringify({ type: 'partner_left' }));
      });
      console.log(`[${client.roomId}] one partner left`);
    }
  });
});

// Heartbeat — drop dead connections every 30 s
const heartbeat = setInterval(() => {
  (wss.clients as Set<Client>).forEach(c => {
    if (!c.isAlive) { c.terminate(); return; }
    c.isAlive = false;
    c.ping();
  });
}, 30_000);

wss.on('close', () => clearInterval(heartbeat));

httpServer.listen(PORT, () => {
  console.log(`🎬 KD Cinema server running on port ${PORT}`);
});
