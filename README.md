# 一起點餐 · Order Together

A clean, bilingual (**中文 / English**) group-ordering web app. Up to **4 diners**
order at the same time from their own phones and every change syncs **live** to
everyone's screen via WebSocket.

The menu is a Mexican-inspired restaurant menu (分享前菜、主餐、Tacos、Chilaquiles、
甜點、兒童餐) with every dish, size option, and add-on shown in Chinese with the
original English underneath.

## Features

- **中英對照** — Chinese heading with the English name and description right below it.
- **四人同步 · 4 seats in real time** — pick a guest tab (1–4), tap `＋ / −` to
  order. Everyone connected sees updates instantly; other guests' quantities show
  as small colored badges on each dish.
- **Live summary** — a running per-guest breakdown and a grand total.
- **Sizes & add-ons** — e.g. soup cup/bowl, "add cheese", chilaquiles / kids
  add-ons, each with its own stepper.
- **Clean, large type** — comfortable font sizes; works on phone and desktop.
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
