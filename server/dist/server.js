"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const crypto_1 = require("crypto");
const PORT = parseInt(process.env.PORT ?? '8080', 10);
// ── State ──────────────────────────────────────────────────────────────────────
const rooms = new Map();
function generateRoomId() {
    return (0, crypto_1.randomBytes)(3).toString('hex').toUpperCase();
}
function relay(sender, payload) {
    if (!sender.roomId)
        return;
    const room = rooms.get(sender.roomId);
    if (!room)
        return;
    const data = JSON.stringify(payload);
    for (const c of room) {
        if (c !== sender && c.readyState === ws_1.WebSocket.OPEN)
            c.send(data);
    }
}
// ── Server ─────────────────────────────────────────────────────────────────────
const wss = new ws_1.WebSocketServer({ port: PORT });
wss.on('connection', (socket) => {
    const client = socket;
    client.isAlive = true;
    client.on('pong', () => { client.isAlive = true; });
    client.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        }
        catch {
            return;
        }
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
                if (!roomId)
                    return;
                const room = rooms.get(roomId);
                if (!room) {
                    client.send(JSON.stringify({ type: 'error', message: 'Room not found.' }));
                }
                else if (room.length >= 2) {
                    client.send(JSON.stringify({ type: 'error', message: 'Room is full.' }));
                }
                else {
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
                relay(client, msg);
                break;
        }
    });
    client.on('close', () => {
        if (!client.roomId)
            return;
        const room = rooms.get(client.roomId);
        if (!room)
            return;
        const remaining = room.filter(c => c !== client);
        if (remaining.length === 0) {
            rooms.delete(client.roomId);
            console.log(`[${client.roomId}] closed`);
        }
        else {
            rooms.set(client.roomId, remaining);
            remaining.forEach(c => {
                if (c.readyState === ws_1.WebSocket.OPEN)
                    c.send(JSON.stringify({ type: 'partner_left' }));
            });
            console.log(`[${client.roomId}] one partner left`);
        }
    });
});
// Heartbeat — drop dead connections every 30 s
const heartbeat = setInterval(() => {
    wss.clients.forEach(c => {
        if (!c.isAlive) {
            c.terminate();
            return;
        }
        c.isAlive = false;
        c.ping();
    });
}, 30_000);
wss.on('close', () => clearInterval(heartbeat));
console.log(`OurScreen server running on port ${PORT}`);
