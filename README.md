# 一起點餐 · みんなで注文

A clean, mobile-first bilingual (**中文 / 日本語**) group-ordering web app. Up to
**4 diners** order at the same time from their own phones and every change syncs
**live** to everyone's screen via WebSocket.

The menu is a Japanese izakaya menu (生魚片、燒烤、前菜、炸物、飯類) with each dish
shown in Chinese with the Japanese name underneath. Recommended dishes are marked
with a gold ★.

## Features

- **中日對照** — Chinese name with the Japanese name right below it.
- **四人同步 · 4 seats in real time** — pick a guest tab (1–4), tap `＋ / −` to
  order. Everyone connected sees updates instantly; each dish shows colored badges
  for who has ordered it.
- **Fixed checkout bar** — an always-visible bottom bar with the total dish count,
  per-guest counts, and grand total; tap to slide up the full per-guest breakdown.
- **Prices** — set in `menu.json` (currently `0` placeholders, ready to fill in).
- **Clean, large type** — mobile-first, comfortable font sizes.
- **Prices are server-authoritative** — the server validates every item against
  `menu.json`, so totals can't be tampered with from the client.

## Run

```bash
npm install
npm start
# open http://localhost:3000
```

Set a custom port with `PORT=8080 npm start`.

Everyone on the same network opens the same URL, taps their own guest number,
and starts ordering together.

## Deploy (Railway)

The repo includes `railway.json`, so deploying is one click:

1. Railway → **New Project → Deploy from GitHub repo** → pick `orderfood`.
2. On first deploy, open **Settings → Networking → Generate Domain** to get a
   public URL (this also enables WebSockets).
3. Done — Railway runs `npm install` then `npm start`, and injects `PORT`
   automatically (the server already reads it).

Keep it at **1 replica** (already set in `railway.json`): the live order is held
in the server's memory and broadcast in-process, so multiple replicas wouldn't
share state. Restarts/redeploys clear the table.

## How it works

- `server.js` — a small Node HTTP server (static files) plus a `ws` WebSocket
  server. It holds one shared, in-memory order for the table and broadcasts the
  full state to all clients on every change.
- `menu.json` — the single source of truth for dishes, translations, prices,
  size options, and add-ons. Edit this to change the menu.
- `public/` — the frontend (`index.html`, `app.js`, `style.css`).

State is in memory only, so restarting the server clears the table (the
`清空全部 · Clear all` button does the same on demand).

## Dietary tags

**DF** 無乳製品 Dairy Free · **NF** 無堅果 Nut Free · **GF** 無麩質 Gluten Free ·
**(V)** 純素 Vegan
