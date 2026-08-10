#!/usr/bin/env node
/**
 * RO Assist Monitor Relay Server
 * 
 * WebSocket relay สำหรับรับข้อมูลจากสคริปต์ (bot client) 
 * และส่งต่อให้หน้าเว็บ monitor (monitor client)
 * 
 * วิธีรัน:
 *   npm install ws
 *   node relay-server.js
 * 
 * หรือใช้ PM2:
 *   pm2 start relay-server.js --name ro-monitor
 */

const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3002;
// ★ admin token — สำหรับดูรายชื่อบอททั้งหมด (ผ่าน ?token= หรือ {type:'list', token:})
//   ตั้งค่าผ่าน env var ADMIN_TOKEN หรือ default 'ro-admin-2026'
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'ro-admin-2026';

// ★ HTTP server — serve remote-monitor.html + relay.js (เปิดเว็บได้เลยไม่ต้องโหลดไฟล์)
const MONITOR_HTML = fs.readFileSync(path.join(__dirname, 'remote-monitor.html'), 'utf8');
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(MONITOR_HTML);
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

// WebSocket server บน server เดียวกัน
const wss = new WebSocketServer({ server });

// store: playerId -> { botWs, lastData, monitors: Set<ws> }
const bots = new Map();

function log(...args) {
  console.log(`[${new Date().toLocaleTimeString()}]`, ...args);
}

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  ws.isAlive = true;
  ws.role = null;       // 'bot' | 'monitor'
  ws.playerId = null;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }

    // ---- Bot client register ----
    if (msg.type === 'register' && msg.playerId) {
      ws.role = 'bot';
      ws.playerId = String(msg.playerId);
      let entry = bots.get(ws.playerId);
      if (!entry) {
        entry = { botWs: null, lastData: null, monitors: new Set() };
        bots.set(ws.playerId, entry);
      }
      // ถ้ามี bot เก่าอยู่ → ปิดการเชื่อมต่อเก่า
      if (entry.botWs && entry.botWs !== ws && entry.botWs.readyState === 1) {
        try { entry.botWs.close(); } catch (_) {}
      }
      entry.botWs = ws;
      log(`🤖 Bot registered: ${msg.playerName || ''} (${ws.playerId}) from ${ip}`);
      // ส่งข้อมูลล่าสุด (ถ้ามี) กลับไป
      if (entry.lastData) {
        try { ws.send(JSON.stringify({ type: 'data', ...entry.lastData })); } catch (_) {}
      }
      return;
    }

    // ---- Bot client data ----
    if (msg.type === 'data' && ws.role === 'bot') {
      const entry = bots.get(ws.playerId);
      if (!entry) return;
      entry.lastData = msg.payload || msg;
      // forward ให้ทุก monitor ที่ subscribe player_id นี้
      const dataStr = JSON.stringify({ type: 'data', ...entry.lastData });
      for (const monitor of entry.monitors) {
        if (monitor.readyState === 1) {
          try { monitor.send(dataStr); } catch (_) {}
        }
      }
      return;
    }

    // ---- Monitor client subscribe ----
    if (msg.type === 'subscribe' && msg.playerId) {
      ws.role = 'monitor';
      // ★★ unsubscribe อันเก่าก่อน (กันข้อมูลสลับเมื่อเปลี่ยน player_id)
      //   ปัญหา: monitor subscribe ใหม่แต่ไม่ลบออกจาก entry เก่า → รับข้อมูล 2 bot พร้อมกัน
      if (ws.playerId && ws.playerId !== String(msg.playerId)) {
        const oldEntry = bots.get(ws.playerId);
        if (oldEntry) oldEntry.monitors.delete(ws);
      }
      ws.playerId = String(msg.playerId);
      let entry = bots.get(ws.playerId);
      if (!entry) {
        entry = { botWs: null, lastData: null, monitors: new Set() };
        bots.set(ws.playerId, entry);
      }
      entry.monitors.add(ws);
      log(`🖥️ Monitor subscribed: ${ws.playerId} from ${ip}`);
      // ส่งข้อมูลล่าสุด (ถ้ามี)
      if (entry.lastData) {
        try { ws.send(JSON.stringify({ type: 'data', ...entry.lastData })); } catch (_) {}
      } else {
        try { ws.send(JSON.stringify({ type: 'waiting', message: 'ยังไม่มีบอทเชื่อมต่อ player_id นี้' })); } catch (_) {}
      }
      return;
    }

    // ---- Monitor client list bots (admin only) ----
    if (msg.type === 'list') {
      ws.role = 'monitor';
      // ★ ต้องส่ง token ที่ตรงกับ ADMIN_TOKEN ถึงจะเห็นรายชื่อบอททั้งหมด
      if (msg.token !== ADMIN_TOKEN) {
        try { ws.send(JSON.stringify({ type: 'botList', bots: [], error: 'unauthorized' })); } catch (_) {}
        return;
      }
      ws.isAdmin = true;
      const list = [];
      for (const [pid, entry] of bots) {
        if (entry.botWs && entry.botWs.readyState === 1) {
          list.push({ playerId: pid, name: entry.lastData?.player?.name || '?', map: entry.lastData?.map || '?' });
        }
      }
      try { ws.send(JSON.stringify({ type: 'botList', bots: list })); } catch (_) {}
      return;
    }
  });

  ws.on('close', () => {
    if (ws.role === 'bot' && ws.playerId) {
      const entry = bots.get(ws.playerId);
      if (entry && entry.botWs === ws) {
        entry.botWs = null;
        log(`🤖 Bot disconnected: ${ws.playerId}`);
      }
    } else if (ws.role === 'monitor' && ws.playerId) {
      const entry = bots.get(ws.playerId);
      if (entry) entry.monitors.delete(ws);
      log(`🖥️ Monitor disconnected from ${ip}`);
    }
  });

  ws.on('error', () => {});
});

// Heartbeat — ล้าง connection ที่ตาย
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch (_) {}
  });
}, 30000);

server.listen(PORT, () => {
  log(`✅ RO Monitor Relay running on port ${PORT}`);
  log(`   🌐 Monitor web:  http://localhost:${PORT}/`);
  log(`   🤖 Bot connect:   ws://localhost:${PORT}`);
  log(`   🖥️ Monitor WS:    ws://localhost:${PORT} (send {type:'subscribe', playerId:'...'})`);
});

process.on('SIGINT', () => { clearInterval(heartbeat); wss.close(); server.close(); process.exit(0); });
