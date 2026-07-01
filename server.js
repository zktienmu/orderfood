import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const SEATS = 4;

// ---- Load menu and build a catalog of valid "order units" (item / size / add-on) ----
const menu = JSON.parse(fs.readFileSync(path.join(__dirname, 'menu.json'), 'utf8'));

/** Map of unitId -> { price, label:{en,zh} } — the authoritative price list. */
const catalog = new Map();
for (const section of menu.sections) {
  for (const item of section.items) {
    if (Array.isArray(item.priceOptions)) {
      item.priceOptions.forEach((opt, i) => {
        catalog.set(`${item.id}::size${i}`, { price: opt.price });
      });
    } else {
      catalog.set(item.id, { price: item.price });
    }
    if (Array.isArray(item.addons)) {
      for (const addon of item.addons) {
        catalog.set(`${item.id}::addon:${addon.id}`, { price: addon.price });
      }
    }
  }
}

// ---- Shared, in-memory order state (single group session) ----
function freshState() {
  const seats = {};
  for (let i = 1; i <= SEATS; i++) seats[i] = { name: '', units: {} };
  return { seats };
}
let state = freshState();

// ---- Static file serving ----
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  if (urlPath === '/menu.json') {
    res.writeHead(200, { 'Content-Type': MIME['.json'] });
    return res.end(JSON.stringify(menu));
  }
  const filePath = path.join(__dirname, 'public', path.normalize(urlPath));
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---- WebSocket: broadcast full state on every change ----
const wss = new WebSocketServer({ server });

function broadcast() {
  const msg = JSON.stringify({ type: 'state', state });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

function clamp(n) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 99);
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'state', state }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const seat = String(msg.seat);
    const seatOk = Object.prototype.hasOwnProperty.call(state.seats, seat);

    switch (msg.type) {
      case 'setName':
        if (seatOk) {
          state.seats[seat].name = String(msg.name ?? '').slice(0, 24);
          broadcast();
        }
        break;
      case 'setQty':
        if (seatOk && catalog.has(msg.unitId)) {
          const qty = clamp(msg.qty);
          if (qty === 0) delete state.seats[seat].units[msg.unitId];
          else state.seats[seat].units[msg.unitId] = qty;
          broadcast();
        }
        break;
      case 'clearSeat':
        if (seatOk) {
          state.seats[seat].units = {};
          broadcast();
        }
        break;
      case 'clearAll':
        state = freshState();
        broadcast();
        break;
    }
  });
});

server.listen(PORT, () => {
  console.log(`Order Together running at http://localhost:${PORT}`);
});
