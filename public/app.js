(() => {
  'use strict';

  const SEAT_COLORS = { 1: 'var(--s1)', 2: 'var(--s2)', 3: 'var(--s3)', 4: 'var(--s4)' };
  const SEAT_HEX = { 1: '#d1442f', 2: '#2f7dd1', 3: '#1f9d55', 4: '#b6832f' };
  const SEATS = [1, 2, 3, 4];

  let MENU = null;
  let STATE = { seats: { 1: { name: '', units: {} }, 2: { name: '', units: {} }, 3: { name: '', units: {} }, 4: { name: '', units: {} } } };
  let activeSeat = Number(localStorage.getItem('seat')) || 1;
  let ws = null;
  const priceOf = new Map(); // unitId -> price
  const unitsByItem = new Map(); // itemId -> [{unitId, price, label|null, isAddon}]

  // ---------- Boot ----------
  fetch('/menu.json').then(r => r.json()).then(menu => {
    MENU = menu;
    indexMenu();
    renderSeatTabs();
    renderMenu();
    renderLegend();
    connect();
  });

  function indexMenu() {
    for (const section of MENU.sections) {
      for (const item of section.items) {
        const units = [];
        if (Array.isArray(item.priceOptions)) {
          item.priceOptions.forEach((opt, i) => {
            const id = `${item.id}::size${i}`;
            priceOf.set(id, opt.price);
            units.push({ unitId: id, price: opt.price, label: opt.label, isAddon: false });
          });
        } else {
          priceOf.set(item.id, item.price);
          units.push({ unitId: item.id, price: item.price, label: null, isAddon: false });
        }
        if (Array.isArray(item.addons)) {
          for (const a of item.addons) {
            const id = `${item.id}::addon:${a.id}`;
            priceOf.set(id, a.price);
            units.push({ unitId: id, price: a.price, label: a.name, isAddon: true });
          }
        }
        unitsByItem.set(item.id, units);
      }
    }
  }

  // ---------- WebSocket ----------
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    const dot = document.getElementById('liveDot');
    ws.onopen = () => dot.classList.add('on');
    ws.onclose = () => { dot.classList.remove('on'); setTimeout(connect, 1500); };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'state') { STATE = msg.state; onState(); }
    };
  }
  function send(obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  // ---------- Seat tabs ----------
  function renderSeatTabs() {
    const wrap = document.getElementById('seatTabs');
    wrap.innerHTML = '';
    SEATS.forEach(seat => {
      const tab = document.createElement('button');
      tab.className = 'seat-tab' + (seat === activeSeat ? ' active' : '');
      tab.style.setProperty('--seat-color', SEAT_COLORS[seat]);
      tab.dataset.seat = seat;
      tab.innerHTML = `
        <span class="seat-label"><span class="seat-dot" style="background:${SEAT_HEX[seat]}"></span>${seat} 號 · Guest ${seat}</span>
        <input type="text" placeholder="輸入名字 name (選填)" maxlength="24" data-nameinput="${seat}" />
        <span class="seat-meta" data-seatmeta="${seat}"></span>`;
      tab.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;
        activeSeat = seat;
        localStorage.setItem('seat', seat);
        document.querySelectorAll('.seat-tab').forEach(t => t.classList.toggle('active', Number(t.dataset.seat) === seat));
        applyActiveSeatColor();
        renderMenu();
      });
      const input = tab.querySelector('input');
      input.addEventListener('input', () => send({ type: 'setName', seat, name: input.value }));
      wrap.appendChild(tab);
    });
    applyActiveSeatColor();
  }

  function applyActiveSeatColor() {
    document.documentElement.style.setProperty('--seat-color-active', SEAT_COLORS[activeSeat]);
    document.querySelector('.menu').style.setProperty('--seat-color', SEAT_COLORS[activeSeat]);
  }

  // ---------- Menu ----------
  function renderMenu() {
    const root = document.getElementById('menu');
    root.style.setProperty('--seat-color', SEAT_COLORS[activeSeat]);
    root.innerHTML = '';
    for (const section of MENU.sections) {
      const sec = document.createElement('div');
      sec.className = 'menu-section';
      let noteHtml = section.note ? `<p class="section-note">${section.note.zh}</p>` : '';
      sec.innerHTML = `<div class="section-head"><h2>${section.name.zh}</h2><span class="en">${section.name.en}</span></div>${noteHtml}`;
      for (const item of section.items) sec.appendChild(renderCard(item));
      root.appendChild(sec);
    }
  }

  function renderCard(item) {
    const card = document.createElement('div');
    card.className = 'card';
    const tags = (item.tags || []).map(t => `<span class="tag ${t}">${t}</span>`).join('');
    const priceLabel = item.priceNote ? `${item.priceNote.zh}` : `$${item.price}`;
    const units = unitsByItem.get(item.id);

    // unit rows (steppers). Addons show "+$", size options show their own price,
    // a plain single unit needs no label (price is shown on the card side).
    const rows = units.map(u => {
      let lbl;
      if (u.isAddon) {
        lbl = `<div class="unit-label">＋ ${u.label.zh}<span class="en"> · ${u.label.en}</span> <span class="unit-price">+$${u.price}</span></div>`;
      } else if (u.label) {
        lbl = `<div class="unit-label">${u.label.zh}<span class="en"> · ${u.label.en}</span> <span class="unit-price">$${u.price}</span></div>`;
      } else {
        lbl = `<div class="unit-label"></div>`;
      }
      return `<div class="unit-row">${lbl}${stepperHtml(u.unitId)}</div>`;
    }).join('');

    card.innerHTML = `
      <div class="card-main">
        <div class="item-name-zh">${item.name.zh}<span class="tags">${tags}</span></div>
        <div class="item-name-en">${item.name.en}</div>
        <div class="item-desc-zh">${item.desc.zh}</div>
        <div class="units">${rows}</div>
      </div>
      <div class="card-side">
        <div class="price">${priceLabel}</div>
        <div class="others" data-others="${item.id}"></div>
      </div>`;

    // wire steppers
    card.querySelectorAll('[data-unit]').forEach(el => {
      const unitId = el.dataset.unit;
      el.querySelector('.minus').addEventListener('click', () => bump(unitId, -1));
      el.querySelector('.plus').addEventListener('click', () => bump(unitId, +1));
    });
    return card;
  }

  function stepperHtml(unitId) {
    return `<div class="stepper" data-unit="${unitId}">
      <button class="minus" aria-label="減少">−</button>
      <span class="qty" data-qty="${unitId}">0</span>
      <button class="plus" aria-label="增加">＋</button>
    </div>`;
  }

  function bump(unitId, delta) {
    const cur = STATE.seats[activeSeat]?.units[unitId] || 0;
    send({ type: 'setQty', seat: activeSeat, unitId, qty: Math.max(0, cur + delta) });
  }

  // ---------- On new state ----------
  function onState() {
    // seat names + meta
    SEATS.forEach(seat => {
      const s = STATE.seats[seat] || { name: '', units: {} };
      const input = document.querySelector(`[data-nameinput="${seat}"]`);
      if (input && document.activeElement !== input && input.value !== s.name) input.value = s.name;
      const meta = document.querySelector(`[data-seatmeta="${seat}"]`);
      if (meta) {
        const { count, total } = seatTotals(seat);
        meta.textContent = count ? `${count} 項 · $${total}` : '尚未點餐 empty';
      }
    });

    // stepper quantities (active seat)
    document.querySelectorAll('[data-qty]').forEach(el => {
      const q = STATE.seats[activeSeat]?.units[el.dataset.qty] || 0;
      el.textContent = q;
      el.classList.toggle('has', q > 0);
    });

    // "who ordered this dish" badges — one per guest with qty > 0, in their colour
    document.querySelectorAll('[data-others]').forEach(el => {
      const itemId = el.dataset.others;
      const units = unitsByItem.get(itemId).map(u => u.unitId);
      el.innerHTML = '';
      SEATS.forEach(seat => {
        const q = units.reduce((sum, uid) => sum + (STATE.seats[seat]?.units[uid] || 0), 0);
        if (q > 0) {
          const b = document.createElement('span');
          b.className = 'badge' + (seat === activeSeat ? ' mine' : '');
          b.style.background = SEAT_HEX[seat];
          b.innerHTML = `${seatLabel(seat)}<span class="badge-x">×${q}</span>`;
          el.appendChild(b);
        }
      });
    });

    renderSummary();
  }

  function seatLabel(seat) {
    const name = (STATE.seats[seat]?.name || '').trim();
    if (!name) return `${seat}號`;
    return name.length > 6 ? name.slice(0, 6) + '…' : name;
  }

  function seatTotals(seat) {
    const units = STATE.seats[seat]?.units || {};
    let count = 0, total = 0;
    for (const [uid, q] of Object.entries(units)) {
      count += q;
      total += q * (priceOf.get(uid) || 0);
    }
    return { count, total };
  }

  // ---------- Summary ----------
  function labelForUnit(unitId) {
    // find item + unit
    for (const section of MENU.sections) {
      for (const item of section.items) {
        for (const u of unitsByItem.get(item.id)) {
          if (u.unitId === unitId) {
            if (u.isAddon) return { zh: `${item.name.zh}（＋${u.label.zh}）`, en: `${item.name.en} (+${u.label.en})` };
            if (u.label) return { zh: `${item.name.zh}（${u.label.zh}）`, en: `${item.name.en} (${u.label.en})` };
            return { zh: item.name.zh, en: item.name.en };
          }
        }
      }
    }
    return { zh: unitId, en: unitId };
  }

  function renderSummary() {
    let grand = 0, grandCount = 0;
    let html = '';
    SEATS.forEach(seat => {
      const s = STATE.seats[seat] || { name: '', units: {} };
      const entries = Object.entries(s.units).filter(([, q]) => q > 0);
      const { count, total } = seatTotals(seat);
      grand += total; grandCount += count;
      const displayName = s.name ? `${s.name}` : `${seat} 號 Guest ${seat}`;
      html += `<div class="sum-seat"><div class="sum-seat-head"><span class="seat-dot" style="background:${SEAT_HEX[seat]}"></span>${displayName}</div>`;
      if (!entries.length) {
        html += `<div class="sum-empty">—</div>`;
      } else {
        for (const [uid, q] of entries) {
          const lbl = labelForUnit(uid);
          const amt = q * (priceOf.get(uid) || 0);
          html += `<div class="sum-line"><span><span class="q">${q}×</span> ${lbl.zh} <span class="en">${lbl.en}</span></span><span class="amt">$${amt}</span></div>`;
        }
        html += `<div class="sum-seat-sub"><span>小計 subtotal</span><span>$${total}</span></div>`;
      }
      html += `</div>`;
    });

    // sidebar (desktop) + slide-up sheet share the same breakdown
    document.getElementById('summaryBody').innerHTML = html;
    document.getElementById('checkoutBody').innerHTML = html;
    document.getElementById('grandTotal').textContent = `$${grand}`;

    // fixed bar quick stats
    document.getElementById('cbCount').textContent = grandCount;
    document.getElementById('cbGrand').textContent = `$${grand}`;
    const seatsEl = document.getElementById('cbSeats');
    seatsEl.innerHTML = '';
    SEATS.forEach(seat => {
      const { count } = seatTotals(seat);
      if (count > 0) {
        const c = document.createElement('span');
        c.className = 'cb-seat';
        c.innerHTML = `<span class="dot" style="background:${SEAT_HEX[seat]}"></span>${seatLabel(seat)} ×${count}`;
        seatsEl.appendChild(c);
      }
    });
  }

  // ---------- Legend + clear ----------
  function renderLegend() {
    const el = document.getElementById('legend');
    el.innerHTML = Object.entries(MENU.legend)
      .map(([k, v]) => `<span><b>${k}</b> · ${v.zh} ${v.en}</span>`).join('');
    document.getElementById('clearAllBtn').addEventListener('click', () => {
      if (confirm('確定要清空所有人的點餐嗎？\nClear the whole table for everyone?')) send({ type: 'clearAll' });
    });

    // fixed checkout bar: tap to expand/collapse the detail sheet
    const checkout = document.getElementById('checkout');
    document.getElementById('checkoutBar').addEventListener('click', () => {
      const open = checkout.classList.toggle('open');
      document.getElementById('checkoutBar').setAttribute('aria-expanded', open);
    });
  }
})();
