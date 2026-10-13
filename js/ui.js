/* Интерфейс песочницы: ввод, панель веществ, таблица Менделеева, настройки, сохранения. */
(function () {
  'use strict';
  const G = globalThis.G, D = G.D, S = G.sim, ID = D.ID;
  const $ = (s, r) => (r || document).querySelector(s);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  /* ---------- иконки ---------- */
  const IC = {
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
    step: '<path d="M6 5.5v13l9-6.5z" fill="currentColor" stroke="none"/><path d="M18.5 5.5v13"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    sliders: '<path d="M4 7h9M18 7h2M4 17h2M11 17h9"/><circle cx="15.5" cy="7" r="2.3"/><circle cx="8.5" cy="17" r="2.3"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    eraser: '<path d="M8 20h11M4.5 14.5 13 6l6 6-7 7H8z"/><path d="m9 10 6 6"/>',
    flame: '<path d="M12 3c.8 4 5 5.5 5 10.2a5 5 0 0 1-10 0c0-2 1-3.3 2-4.2.1 2 .9 3 2 3 .2-3-1-5.2 1-9z"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9 4.5l3 2.5 3-2.5M9 19.5l3-2.5 3 2.5"/>',
    wind: '<path d="M3 8h10.5a2.7 2.7 0 1 0-2.7-2.7M3 12h15a3 3 0 1 1-3 3M3 16h7"/>',
    bomb: '<circle cx="10.5" cy="14" r="6"/><path d="M15 9.5 18 6.5M17.5 3.5v2M20.5 6.5h-2M19.5 4.5l-1 1"/>',
    bolt: '<path d="M13 2.5 5 13.5h6l-1 8 8-11.5h-6z"/>',
    spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>',
    pick: '<path d="m15 4 5 5-3 3-5-5zM13.5 9.5 5 18v2h2l8.5-8.5"/>',
    inspect: '<circle cx="11" cy="11" r="6"/><path d="m16 16 5 5"/>',
    circle: '<circle cx="12" cy="12" r="7"/>',
    square: '<rect x="5" y="5" width="14" height="14" rx="2"/>'
  };
  const svg = (name) => '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' + IC[name] + '</svg>';

  /* ---------- состояние ---------- */
  const DEF = { tool: 'el', el: ID.sand, brush: 4, shape: 0, speed: 1, gravity: 1, edge: 0, amb: 22, cell: 3, glow: true, view: 0, replace: false, fps: false, tab: 'powder', recent: [], hintSeen: false };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  let st = Object.assign({}, DEF);
  try { Object.assign(st, JSON.parse(lsGet('sandbox.settings') || '{}')); } catch (e) { /* ignore */ }
  if (!D.names[st.el]) st.el = ID.sand;
  st.recent = (st.recent || []).filter(i => D.names[i]).slice(0, 14);
  const saveSettings = () => lsSet('sandbox.settings', JSON.stringify(st));

  let paused = false;
  let dirty = true;

  /* ---------- холст ---------- */
  const stage = $('#stage'), world = $('#world'), cv = $('#cv'), glow = $('#glow'), cursor = $('#cursor');
  const ctx = cv.getContext('2d'), gctx = glow.getContext('2d');
  let img, gimg, px, gpx, cell = st.cell;

  function layout() {
    cell = st.cell;
    const r = stage.getBoundingClientRect();
    const w = Math.max(40, Math.floor(r.width / cell)), hh = Math.max(40, Math.floor(r.height / cell));
    if (w !== S.w || hh !== S.h || !img) {
      S.resize(w, hh);
      cv.width = glow.width = w; cv.height = glow.height = hh;
      img = ctx.createImageData(w, hh); px = new Uint32Array(img.data.buffer);
      gimg = gctx.createImageData(w, hh); gpx = new Uint32Array(gimg.data.buffer);
    }
    world.style.width = w * cell + 'px'; world.style.height = hh * cell + 'px';
    world.style.left = Math.floor((r.width - w * cell) / 2) + 'px';
    glow.style.filter = 'blur(' + Math.round(cell * 2.3) + 'px) saturate(1.3)';
    dirty = true;
  }

  /* ---------- уведомления ---------- */
  const toastEl = $('#toast'); let toastT = 0;
  function toast(msg, ms) {
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms || 1800);
  }
  function hideHint() { if (!st.hintSeen) { st.hintSeen = true; $('#hint').classList.add('gone'); saveSettings(); } }

  /* ---------- инструменты ---------- */
  const TOOLS = [
    { id: 'erase', name: 'Ластик', sub: 'стирает всё', icon: 'eraser', color: '#e8506a' },
    { id: 'heat', name: 'Нагрев', sub: 'поднимает t°', icon: 'flame', color: '#ff7a2a' },
    { id: 'cool', name: 'Охлаждение', sub: 'снижает t°', icon: 'snow', color: '#4aa8f5' },
    { id: 'wind', name: 'Ветер', sub: 'веди пальцем', icon: 'wind', color: '#4fc3b0' },
    { id: 'bomb', name: 'Взрыв', sub: 'тап — бабах', icon: 'bomb', color: '#ef4444' },
    { id: 'bolt', name: 'Молния', sub: 'тап — разряд', icon: 'bolt', color: '#e6b800' },
    { id: 'spark', name: 'Искра', sub: 'заряд в провод', icon: 'spark', color: '#d9a400' },
    { id: 'pick', name: 'Пипетка', sub: 'взять вещество', icon: 'pick', color: '#8b6cf0' },
    { id: 'inspect', name: 'Датчик', sub: 't° и состав', icon: 'inspect', color: '#3fae78' }
  ];
  const toolById = Object.fromEntries(TOOLS.map(t => [t.id, t]));
  const STROKE_TOOLS = new Set(['el', 'erase', 'bomb', 'bolt', 'spark']);

  /* ---------- образцы цвета ---------- */
  const rgbS = (i, k) => 'rgb(' + D.CR[i] + ',' + D.CG[i] + ',' + D.CB[i] + ')';
  function swatch(i) {
    const kind = D.KIND[i], s = h('span', 'sw k' + kind);
    const c = rgbS(i), cr = D.CR[i], cg = D.CG[i], cb = D.CB[i];
    const dark = 'rgb(' + (cr * .72 | 0) + ',' + (cg * .72 | 0) + ',' + (cb * .72 | 0) + ')';
    if (kind === 2) s.style.backgroundColor = c;
    else if (kind === 4) s.style.background = 'radial-gradient(circle at 50% 50%, rgba(' + cr + ',' + cg + ',' + cb + ',.9) 0%, rgba(' + cr + ',' + cg + ',' + cb + ',.25) 75%)';
    else s.style.background = 'linear-gradient(150deg,' + c + ',' + dark + ')';
    if (D.GLA[i] > .2) s.style.boxShadow = '0 0 14px rgba(' + D.GLR[i] + ',' + D.GLG[i] + ',' + D.GLB[i] + ',' + Math.min(.8, D.GLA[i]) + ')';
    return s;
  }

  /* ---------- выбор ---------- */
  function pushRecent(id) {
    st.recent = [id].concat(st.recent.filter(x => x !== id)).slice(0, 14);
  }
  function selectEl(id, quiet) {
    st.tool = 'el'; st.el = id; pushRecent(id);
    updateChip(); markSel(); saveSettings(); updateCursorShape();
    if (!quiet && D.infos[id]) toast(D.names[id] + ' · ' + D.infos[id], 2600);
  }
  function selectTool(id) { st.tool = id; updateChip(); markSel(); saveSettings(); updateCursorShape(); }
  function updateChip() {
    const sw = $('#chipSw'); sw.innerHTML = ''; sw.className = 'sw';
    if (st.tool === 'el') {
      const s = swatch(st.el); sw.className = s.className; sw.style.cssText = s.style.cssText;
      $('#chipName').textContent = D.names[st.el];
      $('#chipSub').textContent = D.formulas[st.el];
    } else {
      const t = toolById[st.tool];
      sw.className = 'sw k1'; sw.style.cssText = 'background:' + t.color + ';display:grid;place-items:center';
      sw.innerHTML = '<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">' + IC[t.icon] + '</svg>';
      $('#chipName').textContent = t.name; $('#chipSub').textContent = t.sub;
    }
  }
  function markSel() {
    document.querySelectorAll('#items .tile').forEach(t => {
      const sel = (t.dataset.tool && st.tool === t.dataset.tool) || (t.dataset.id && st.tool === 'el' && +t.dataset.id === st.el);
      t.classList.toggle('sel', !!sel);
    });
    document.querySelectorAll('#pgrid .el').forEach(t => t.classList.toggle('sel', st.tool === 'el' && t.dataset.keys.split(',').includes(String(st.el))));
    updatePcard();
  }

  /* ---------- панель ---------- */
  const dock = $('#dock'), tabsEl = $('#tabs'), itemsEl = $('#items'), ptable = $('#ptable');
  const TABS = [['recent', 'Недавние'], ['build', 'Строй'], ['metal', 'Металлы'], ['powder', 'Порошки'], ['liquid', 'Жидкости'], ['gas', 'Газы'], ['chem', 'Химия'], ['boom', 'Взрыв'], ['energy', 'Энергия'], ['life', 'Жизнь'], ['tool', 'Инструменты'], ['table', 'Таблица']];
  function renderTabs() {
    tabsEl.innerHTML = '';
    TABS.forEach(([id, name]) => {
      const b = h('button', st.tab === id ? 'on' : '', name); b.dataset.tab = id; tabsEl.appendChild(b);
    });
  }
  function tileFor(i) {
    const b = h('button', 'tile'); b.dataset.id = i; b.title = D.names[i];
    b.appendChild(swatch(i));
    b.appendChild(h('span', 'nm', D.names[i]));
    b.appendChild(h('span', 'fm', D.formulas[i]));
    return b;
  }
  function renderItems() {
    const tab = st.tab;
    const isTable = tab === 'table';
    itemsEl.hidden = isTable; ptable.hidden = !isTable;
    if (isTable) { buildTable(); markSel(); return; }
    itemsEl.innerHTML = '';
    itemsEl.scrollLeft = 0; itemsEl.scrollTop = 0;
    if (tab === 'tool') {
      TOOLS.forEach(t => {
        const b = h('button', 'tile'); b.dataset.tool = t.id;
        const sw = h('span', 'sw k1'); sw.style.background = t.color; sw.innerHTML = svg(t.icon);
        b.appendChild(sw); b.appendChild(h('span', 'nm', t.name)); b.appendChild(h('span', 'fm', t.sub));
        itemsEl.appendChild(b);
      });
    } else if (tab === 'recent') {
      if (!st.recent.length) itemsEl.appendChild(h('div', 'empty-note', 'Здесь появятся вещества, которые ты использовал.'));
      st.recent.forEach(i => itemsEl.appendChild(tileFor(i)));
    } else {
      G.defs.forEach(d => {
        const c = d.cat;
        if (c === tab || (Array.isArray(c) && c.includes(tab))) itemsEl.appendChild(tileFor(d.id));
      });
    }
    markSel();
  }
  function setTab(id) {
    st.tab = id; renderTabs(); renderItems(); saveSettings();
    if (id === 'table') setOpen(true);
    const on = tabsEl.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  function setOpen(v) { dock.classList.toggle('open', v); }
  const toggleOpen = () => setOpen(!dock.classList.contains('open'));

  tabsEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });
  itemsEl.addEventListener('click', (e) => {
    const t = e.target.closest('.tile'); if (!t) return;
    if (t.dataset.tool) selectTool(t.dataset.tool); else selectEl(+t.dataset.id);
    if (st.tab === 'recent') { /* не перестраиваем, чтобы список не прыгал */ }
  });
  $('#chip').addEventListener('click', toggleOpen);

  /* перетаскивание за ручку */
  (function () {
    const g = $('#grab'); let y0 = null, moved = false;
    g.addEventListener('pointerdown', (e) => { y0 = e.clientY; moved = false; g.setPointerCapture(e.pointerId); });
    g.addEventListener('pointermove', (e) => {
      if (y0 == null) return;
      const dy = e.clientY - y0;
      if (Math.abs(dy) > 18) { moved = true; setOpen(dy < 0); y0 = e.clientY; }
    });
    g.addEventListener('pointerup', () => { if (y0 != null && !moved) toggleOpen(); y0 = null; });
    g.addEventListener('pointercancel', () => { y0 = null; });
  })();

  /* ---------- таблица Менделеева ---------- */
  let tableBuilt = false, tableSel = null, pfit = true;
  const STATE_RU = { gas: 'газ', liquid: 'жидкость', solid: 'твёрдое', unknown: 'неизвестно' };
  function sizeTable() {
    const g = $('#pgrid'); if (!g || ptable.hidden) return;
    g.classList.toggle('fit', pfit);
    $('#pzoom').textContent = pfit ? 'Крупнее' : 'Вся таблица';
    if (pfit) {
      const w = ptable.clientWidth - 12, pw = Math.max(14, Math.min(44, Math.floor((w - 17 * 2) / 18)));
      g.style.setProperty('--pw', pw + 'px'); g.style.setProperty('--ph', Math.round(pw * 1.3) + 'px');
    }
  }
  function buildTable() {
    if (!tableBuilt) {
      tableBuilt = true;
      const grid = $('#pgrid');
      G.table.forEach(e => {
        const b = h('button', 'el' + (e.generic ? '' : ' det') + (e.radio ? ' rad' : ''));
        b.style.background = e.catColor; b.style.gridRow = e.row; b.style.gridColumn = e.col;
        b.dataset.z = e.z; b.dataset.keys = e.keys.map(k => ID[k]).join(',');
        b.innerHTML = '<small>' + e.z + '</small><b>' + e.sym + '</b><i>' + e.name + '</i>';
        b.title = e.name;
        grid.appendChild(b);
      });
      const pick = (z) => { tableSel = G.table[z - 1]; selectEl(ID[tableSel.keys[0]]); };
      grid.addEventListener('click', (ev) => { const b = ev.target.closest('.el'); if (b) pick(+b.dataset.z); });
      /* в режиме «по ширине» элементы мелкие: ведём пальцем — карточка показывает элемент под ним, отпустили — выбрали */
      let scrub = false, last = 0;
      const under = (ev) => { const t = document.elementFromPoint(ev.clientX, ev.clientY); return t && t.closest ? t.closest('#pgrid .el') : null; };
      grid.addEventListener('pointerdown', (ev) => {
        if (!pfit) return; scrub = true;
        const b = under(ev); if (b) { last = +b.dataset.z; tableSel = G.table[last - 1]; updatePcard(); }
      });
      grid.addEventListener('pointermove', (ev) => {
        if (!scrub) return; const b = under(ev);
        if (b && +b.dataset.z !== last) { last = +b.dataset.z; tableSel = G.table[last - 1]; updatePcard(); }
      });
      const end = () => { if (scrub && last) pick(last); scrub = false; last = 0; };
      grid.addEventListener('pointerup', end); grid.addEventListener('pointercancel', () => { scrub = false; });
      $('#pcard').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-id]'); if (b) selectEl(+b.dataset.id); });
      $('#pzoom').addEventListener('click', () => { pfit = !pfit; sizeTable(); });
      updatePcard();
    }
    sizeTable();
  }
  function updatePcard() {
    const card = $('#pcard'); if (!card) return;
    if (!tableSel) { card.innerHTML = '<div class="tx"><b>Выбери элемент</b><div>Нажми или проведи пальцем по таблице.</div><div>● подробная модель · ☢ радиоактивный</div><div>Остальные — простые инертные вещества.</div></div>'; return; }
    const e = tableSel;
    const acts = e.keys.length > 1 ? e.keys.map(k => '<button data-id="' + ID[k] + '" class="' + (st.el === ID[k] && st.tool === 'el' ? 'on' : '') + '">' + D.names[ID[k]] + '</button>').join('') : '';
    card.innerHTML = '<div class="big" style="background:' + e.catColor + '"><small>' + e.z + '</small><b>' + e.sym + '</b></div>' +
      '<div class="tx"><b>' + e.name + '</b><div>' + e.catName + ' · ' + STATE_RU[e.state] + (e.radio ? ' · ☢ радиоактивен' : '') + '</div>' +
      '<div>' + (e.generic ? 'Модель: упрощённая' : 'Модель: подробная — реагирует, плавится, горит') + '</div>' +
      (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>';
  }

  /* ---------- ввод ---------- */
  const ptrs = new Map();
  let snapshots = [];
  const btnUndo = $('#btnUndo');
  function pushUndo() {
    snapshots.push(S.snapshot()); if (snapshots.length > 10) snapshots.shift();
    btnUndo.disabled = false;
  }
  function doUndo() {
    while (snapshots.length) {
      const s = snapshots.pop();
      if (S.restore(s)) { dirty = true; break; }
    }
    btnUndo.disabled = !snapshots.length;
  }

  function toCell(e) {
    const r = world.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / cell), Math.floor((e.clientY - r.top) / cell)];
  }
  function updateCursorShape() {
    const show = ['el', 'erase', 'heat', 'cool', 'wind', 'spark', 'bomb'].includes(st.tool);
    cursor.dataset.show = show ? '1' : '';
    const r = st.tool === 'bomb' ? 6 + st.brush : st.brush;
    const d = (2 * r + 1) * cell;
    cursor.style.width = cursor.style.height = d + 'px';
    cursor.classList.toggle('sq', st.shape === 1 && st.tool !== 'bomb');
    if (!show) cursor.style.display = 'none';
  }
  function moveCursor(e) {
    if (!cursor.dataset.show) return;
    const sr = stage.getBoundingClientRect();
    cursor.style.left = (e.clientX - sr.left) + 'px'; cursor.style.top = (e.clientY - sr.top) + 'px';
    cursor.style.display = 'block';
  }

  function stamp(x, y) {
    const t = st.tool, r = st.brush;
    switch (t) {
      case 'el': S.paint(x, y, r, st.shape, st.el, st.replace); break;
      case 'erase': S.paint(x, y, r, st.shape, 0, true); break;
      case 'heat': S.heatTool(x, y, r, 30); break;
      case 'cool': S.heatTool(x, y, r, -30); break;
      case 'spark': S.sparkTool(x, y, r); break;
      default: break;
    }
    dirty = true;
  }
  function line(x0, y0, x1, y1, fn) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy));
    const step = Math.max(1, Math.floor(st.brush * .7));
    if (n === 0) { fn(x1, y1); return; }
    for (let s = step; s < n; s += step) fn(Math.round(x0 + dx * s / n), Math.round(y0 + dy * s / n));
    fn(x1, y1);
  }
  function inspectAt(x, y) {
    const c = S.cellInfo(x, y); if (!c) return;
    const t = Math.round(c.temp);
    toast(c.name + (c.formula ? ' (' + c.formula + ')' : '') + ' · ' + t + ' °C' + (c.burning ? ' · горит' : ''), 1500);
  }
  function onDown(p) {
    switch (st.tool) {
      case 'bomb': S.blast(p.x, p.y, 6 + st.brush, 1.4); dirty = true; break;
      case 'bolt': S.lightning(p.x, p.y); dirty = true; break;
      case 'pick': {
        const id = S.typeAt(p.x, p.y);
        if (id) { selectEl(id); toast('Взято: ' + D.names[id]); } else toast('Здесь пусто');
        break;
      }
      case 'inspect': inspectAt(p.x, p.y); break;
      case 'wind': break;
      default: stamp(p.x, p.y);
    }
  }
  function onMove(p, nx, ny) {
    switch (st.tool) {
      case 'el': case 'erase': case 'heat': case 'cool': case 'spark':
        line(p.x, p.y, nx, ny, stamp); break;
      case 'wind': S.windTool(nx, ny, st.brush, (nx - p.x) * 1.6, (ny - p.y) * 1.6); dirty = true; break;
      case 'inspect': inspectAt(nx, ny); break;
      default: break;
    }
  }

  world.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { world.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    hideHint();
    const [x, y] = toCell(e);
    const p = { id: e.pointerId, x, y };
    if (ptrs.size === 0 && STROKE_TOOLS.has(st.tool)) pushUndo();
    ptrs.set(e.pointerId, p);
    moveCursor(e);
    onDown(p);
  });
  world.addEventListener('pointermove', (e) => {
    moveCursor(e);
    const p = ptrs.get(e.pointerId); if (!p) return;
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    const list = evs.length ? evs : [e];
    for (const ev of list) {
      const [nx, ny] = toCell(ev);
      if (nx !== p.x || ny !== p.y) { onMove(p, nx, ny); p.x = nx; p.y = ny; }
    }
  });
  const up = (e) => {
    ptrs.delete(e.pointerId);
    if (e.pointerType !== 'mouse') cursor.style.display = 'none';
  };
  world.addEventListener('pointerup', up);
  world.addEventListener('pointercancel', up);
  world.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !ptrs.size) cursor.style.display = 'none'; });
  world.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());

  /* ---------- вертикальный слайдер размера ---------- */
  (function () {
    const vs = $('#vs'), fill = $('#vsFill'), knob = $('#vsKnob'), val = $('#vsVal'), MAX = 20;
    function paintSlider() {
      const f = st.brush / MAX;
      fill.style.height = (f * 100) + '%'; knob.style.bottom = (f * 100) + '%';
      val.textContent = st.brush + 1;
    }
    function setFrom(e) {
      const r = $('.track', vs).getBoundingClientRect();
      const f = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      st.brush = Math.round(f * MAX); paintSlider(); updateCursorShape();
    }
    let drag = false;
    vs.addEventListener('pointerdown', (e) => { drag = true; vs.setPointerCapture(e.pointerId); setFrom(e); });
    vs.addEventListener('pointermove', (e) => { if (drag) setFrom(e); });
    const end = () => { if (drag) { drag = false; saveSettings(); } };
    vs.addEventListener('pointerup', end); vs.addEventListener('pointercancel', end);
    const shapeBtn = $('#shapeBtn');
    const drawShape = () => { shapeBtn.innerHTML = svg(st.shape ? 'square' : 'circle'); };
    shapeBtn.addEventListener('click', () => { st.shape ^= 1; drawShape(); updateCursorShape(); saveSettings(); });
    G.paintSlider = () => { paintSlider(); drawShape(); };
    paintSlider(); drawShape();
  })();

  /* ---------- верхние кнопки ---------- */
  const btnPlay = $('#btnPlay'), btnStep = $('#btnStep');
  function drawTop() {
    btnPlay.innerHTML = svg(paused ? 'play' : 'pause');
    btnPlay.setAttribute('aria-label', paused ? 'Продолжить' : 'Пауза');
    btnPlay.classList.toggle('on', paused);
    btnStep.hidden = !paused;
    $('#btnStep').innerHTML = svg('step');
    btnUndo.innerHTML = svg('undo');
    $('#btnShot').innerHTML = svg('camera');
    $('#btnSet').innerHTML = svg('sliders');
  }
  btnPlay.addEventListener('click', () => { paused = !paused; drawTop(); dirty = true; });
  btnStep.addEventListener('click', () => { S.step(); dirty = true; });
  btnUndo.addEventListener('click', doUndo);
  $('#btnShot').addEventListener('click', screenshot);
  $('#btnSet').addEventListener('click', () => openSheet(true));

  function screenshot() {
    const w = S.w, hh = S.h, k = Math.max(2, Math.round(1080 / w));
    const c = document.createElement('canvas'); c.width = w * k; c.height = hh * k;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, '#141a2b'); g.addColorStop(1, '#06070a');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingEnabled = false; x.drawImage(cv, 0, 0, c.width, c.height);
    if (st.glow) { x.globalCompositeOperation = 'lighter'; x.imageSmoothingEnabled = true; x.globalAlpha = .55; x.drawImage(glow, 0, 0, c.width, c.height); }
    c.toBlob(async (blob) => {
      if (!blob) { toast('Не удалось сделать снимок'); return; }
      const file = new File([blob], 'pesochnitsa.png', { type: 'image/png' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Песочница' }); return; }
      } catch (err) { if (err && err.name === 'AbortError') return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'pesochnitsa.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 20000);
      toast('Снимок сохранён');
    }, 'image/png');
  }

  /* ---------- настройки ---------- */
  const sheet = $('#settings'), sheetBg = $('#sheetBg');
  function openSheet(v) {
    sheet.classList.toggle('on', v); sheetBg.classList.toggle('on', v);
    sheet.setAttribute('aria-hidden', v ? 'false' : 'true');
    if (v) renderSlots();
  }
  sheetBg.addEventListener('click', () => openSheet(false));
  $('#setClose').addEventListener('click', () => openSheet(false));
  $('#setClose').innerHTML = svg('close');

  function row(label, sub) { const r = h('div', 'row'); const l = h('label', '', label + (sub ? '<small>' + sub + '</small>' : '')); r.appendChild(l); return r; }
  function seg(opts, get, set) {
    const s = h('div', 'seg');
    const draw = () => s.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', opts[i][0] === get()));
    opts.forEach(([v, name]) => { const b = h('button', '', name); b.addEventListener('click', () => { set(v); draw(); saveSettings(); }); s.appendChild(b); });
    draw(); return s;
  }
  function toggle(get, set) {
    const t = h('button', 'sw-t' + (get() ? ' on' : ''));
    t.setAttribute('role', 'switch'); t.setAttribute('aria-checked', get());
    t.addEventListener('click', () => { const v = !get(); set(v); t.classList.toggle('on', v); t.setAttribute('aria-checked', v); saveSettings(); });
    return t;
  }
  function buildSettings() {
    const b = $('#setBody'); b.innerHTML = '';
    b.appendChild(h('div', 'sec', 'Готовые сцены'));
    const sc = h('div', 'scenes');
    G.scenes.forEach(x => {
      const c = h('button', 'scene', '<b>' + x.name + '</b><small>' + x.sub + '</small>');
      c.addEventListener('click', () => { pushUndo(); const msg = G.loadScene(x.id); dirty = true; openSheet(false); setOpen(false); if (msg) toast(msg, 4200); });
      sc.appendChild(c);
    });
    b.appendChild(sc);
    b.appendChild(h('div', 'sec', 'Симуляция'));
    let r = row('Скорость'); r.appendChild(seg([[.25, '¼×'], [.5, '½×'], [1, '1×'], [2, '2×'], [3, '3×']], () => st.speed, v => st.speed = v)); b.appendChild(r);
    r = row('Гравитация'); r.appendChild(seg([[1, '↓ Вниз'], [-1, '↑ Вверх'], [0, '○ Нет']], () => st.gravity, v => { st.gravity = v; S.gravity = v; })); b.appendChild(r);
    r = row('Края мира', 'куда исчезают газы и жидкости'); r.appendChild(seg([[0, 'Стены'], [1, 'Верх'], [2, 'Все']], () => st.edge, v => { st.edge = v; S.edge = v; })); b.appendChild(r);
    r = row('Температура среды'); const rg = h('div', 'rng'); const inp = h('input'); inp.type = 'range'; inp.min = -60; inp.max = 120; inp.step = 1; inp.value = st.amb;
    const sp = h('span', '', st.amb + ' °C'); inp.addEventListener('input', () => { st.amb = +inp.value; S.ambient = st.amb; sp.textContent = st.amb + ' °C'; }); inp.addEventListener('change', saveSettings);
    rg.appendChild(inp); rg.appendChild(sp); r.appendChild(rg); b.appendChild(r);

    b.appendChild(h('div', 'sec', 'Вид'));
    r = row('Режим'); r.appendChild(seg([[0, 'Обычный'], [1, 'Тепловой']], () => st.view, v => { st.view = v; dirty = true; })); b.appendChild(r);
    r = row('Детализация', 'мельче — красивее, но тяжелее для телефона'); r.appendChild(seg([[4, 'Крупно'], [3, 'Средне'], [2, 'Мелко']], () => st.cell, v => { st.cell = v; layout(); updateCursorShape(); })); b.appendChild(r);
    r = row('Свечение', 'огонь, лава, электричество'); r.appendChild(toggle(() => st.glow, v => { st.glow = v; glow.classList.toggle('off', !v); dirty = true; })); b.appendChild(r);
    r = row('Показывать FPS'); r.appendChild(toggle(() => st.fps, v => { st.fps = v; if (!v) $('#hud').textContent = ''; })); b.appendChild(r);

    b.appendChild(h('div', 'sec', 'Рисование'));
    r = row('Рисовать поверх', 'заменять уже лежащее вещество'); r.appendChild(toggle(() => st.replace, v => st.replace = v)); b.appendChild(r);

    b.appendChild(h('div', 'sec', 'Сохранения'));
    const slots = h('div', 'slots'); slots.id = 'slots'; b.appendChild(slots);
    const clr = h('button', 'btn danger', 'Очистить весь мир'); clr.addEventListener('click', () => { pushUndo(); S.clearAll(); dirty = true; openSheet(false); toast('Очищено · можно отменить'); }); b.appendChild(clr);
    b.appendChild(h('div', 'note', 'Мир сохраняется автоматически, когда ты сворачиваешь страницу. Чтобы играть на весь экран без панелей Safari: «Поделиться» → «На экран Домой».'));
  }
  const slotKey = (n) => 'sandbox.slot' + n;
  function renderSlots() {
    const box = $('#slots'); if (!box) return; box.innerHTML = '';
    for (let n = 1; n <= 3; n++) {
      let data = null; try { data = JSON.parse(lsGet(slotKey(n)) || 'null'); } catch (e) { data = null; }
      const s = h('div', 'slot');
      const th = h('div', 'th', data ? '' : 'пусто'); if (data && data.th) th.style.backgroundImage = 'url(' + data.th + ')';
      const tm = h('div', 'tm', data ? new Date(data.t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
      const bt = h('div', 'bt'); const save = h('button', 'pri', 'Сохр.'); const load = h('button', '', 'Загр.'); load.disabled = !data;
      save.addEventListener('click', () => {
        const ok = lsSet(slotKey(n), JSON.stringify({ d: S.serialize(), th: thumb(), t: Date.now(), amb: S.ambient, k: KEYS }));
        toast(ok ? 'Сохранено в слот ' + n : 'Не хватило места для сохранения'); renderSlots();
      });
      load.addEventListener('click', () => {
        try { pushUndo(); S.deserialize(data.d, data.k); st.amb = Math.round(S.ambient); buildSettings(); dirty = true; openSheet(false); toast('Загружено: слот ' + n); } catch (e) { toast('Не удалось загрузить'); }
      });
      bt.appendChild(save); bt.appendChild(load); s.appendChild(th); s.appendChild(tm); s.appendChild(bt); box.appendChild(s);
    }
  }
  function thumb() {
    try {
      const c = document.createElement('canvas'); const w = 90; c.width = w; c.height = Math.round(w * S.h / S.w);
      const x = c.getContext('2d'); x.fillStyle = '#0b0d14'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(cv, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .6);
    } catch (e) { return ''; }
  }

  /* ---------- автосохранение ---------- */
  const KEYS = G.defs.map(d => d.key);
  function autosave() { try { lsSet('sandbox.auto', JSON.stringify({ d: S.serialize(), amb: S.ambient, k: KEYS })); } catch (e) { /* ignore */ } }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { autosave(); saveSettings(); } });
  window.addEventListener('pagehide', () => { autosave(); saveSettings(); });
  setInterval(() => { if (!document.hidden && !ptrs.size) autosave(); }, 20000);

  /* ---------- хуки симуляции ---------- */
  S.hooks.blast = (m) => {
    if (m < 5) return;
    world.classList.remove('shake'); void world.offsetWidth; world.classList.add('shake');
  };
  S.hooks.lightning = () => { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); };

  /* ---------- главный цикл ---------- */
  let acc = 0, frames = 0, last = performance.now(), fpsT = last, fps = 0, slow = 0, slowWarned = false;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = now - last; last = now;
    if (!paused) {
      acc += st.speed;
      let n = 0;
      while (acc >= 1 && n < 4) { S.step(); acc -= 1; n++; }
      if (acc >= 1) acc = 0;
      dirty = true;
    }
    for (const p of ptrs.values()) {
      if (st.tool === 'el' || st.tool === 'erase' || st.tool === 'heat' || st.tool === 'cool' || st.tool === 'spark') stamp(p.x, p.y);
    }
    if (dirty) {
      S.render(px, gpx, st.view, st.glow && st.view === 0);
      ctx.putImageData(img, 0, 0);
      if (st.glow && st.view === 0) gctx.putImageData(gimg, 0, 0); else if (!glowCleared) { gctx.clearRect(0, 0, glow.width, glow.height); }
      glowCleared = !(st.glow && st.view === 0);
      dirty = paused ? false : true;
    }
    frames++;
    if (now - fpsT > 500) {
      fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now;
      if (st.fps) $('#hud').textContent = fps + ' fps · ' + S.w + '×' + S.h + ' · ' + S.stats() + ' частиц';
      if (!paused && fps < 30) { slow++; if (slow >= 6 && !slowWarned && st.cell < 4) { slowWarned = true; toast('Тормозит? Настройки → Детализация → «Крупно»', 3500); } } else slow = 0;
    }
    void dt;
  }
  let glowCleared = false;

  /* ---------- клавиатура (для компьютера) ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); btnPlay.click(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); doUndo(); }
    else if (e.key === '[') { st.brush = Math.max(0, st.brush - 1); G.paintSlider(); updateCursorShape(); }
    else if (e.key === ']') { st.brush = Math.min(20, st.brush + 1); G.paintSlider(); updateCursorShape(); }
  });

  /* ---------- запуск ---------- */
  function init() {
    S.gravity = st.gravity; S.edge = st.edge; S.ambient = st.amb;
    glow.classList.toggle('off', !st.glow);
    drawTop(); btnUndo.disabled = true;
    renderTabs(); renderItems(); updateChip(); buildSettings(); updateCursorShape();
    layout();
    // восстановление мира
    try {
      const a = JSON.parse(lsGet('sandbox.auto') || 'null');
      if (a && a.d) { S.deserialize(a.d, a.k); st.amb = Math.round(S.ambient); S.ambient = st.amb; buildSettings(); }
    } catch (e) { /* пустой мир */ }
    if (st.hintSeen) $('#hint').classList.add('gone');
    new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => { layout(); updateCursorShape(); sizeTable(); }, 200); }).observe(stage);
    requestAnimationFrame(frame);
    try {
      if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
        navigator.serviceWorker.register('sw.js').catch(() => { /* офлайн-режим недоступен */ });
      }
    } catch (e) { /* закрытая рамка: без офлайн-режима */ }
  }
  let rz = 0;
  G.ui = { st, selectEl, selectTool, setTab, setOpen, toast, S, get paused() { return paused; }, layout, TOOLS };
  init();
})();
