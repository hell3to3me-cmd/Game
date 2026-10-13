/* Проверки физики и химии без браузера:  node tests/run.js  */
'use strict';
const path = require('path');
globalThis.G = {};
require(path.join(__dirname, '../js/data.js'));
require(path.join(__dirname, '../js/sim.js'));
require(path.join(__dirname, '../js/scenes.js'));
globalThis.btoa = globalThis.btoa || ((s) => Buffer.from(s, 'binary').toString('base64'));
globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));

const S = G.sim, D = G.D, ID = D.ID;
let fails = 0, total = 0;
function ok(cond, msg) { total++; if (!cond) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); }

function fresh(w = 50, h = 40, g = 1) { S.resize(w, h); S.clearAll(); S.ambient = 22; S.gravity = g; S.edge = 0; }
function run(n) { for (let i = 0; i < n; i++) S.step(); }
function counts() { const r = S._raw(), m = {}; for (let i = 0; i < r.W * r.H; i++) { const t = r.T[i]; if (t) m[D.defs[t - 1].key] = (m[D.defs[t - 1].key] || 0) + 1; } return m; }
function rect(x0, y0, x1, y1, k) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) S.put(x, y, ID[k]); }
function floor() { rect(0, S.h - 1, S.w - 1, S.h - 1, 'wall'); }
const n = (c, k) => c[k] || 0;

console.log('Данные');
ok(D.N > 150, 'веществ: ' + (D.N - 1));
ok(G.table.length === 118, 'в таблице 118 элементов');
{ const seen = new Set(); let dup = 0; G.table.forEach(e => { const k = e.row + ',' + e.col; if (seen.has(k)) dup++; seen.add(k); }); ok(dup === 0, 'позиции элементов в таблице не пересекаются'); }
ok(G.table.every(e => e.keys && e.keys.every(k => ID[k])), 'у каждого элемента есть вещество');

console.log('Жидкости и порошки');
fresh(40, 30); floor(); rect(10, 2, 20, 8, 'water'); run(200);
{ const c = counts(); ok(n(c, 'water') === 77, 'вода не теряется (77 клеток)'); const r = S._raw(); const rows = new Set(); for (let i = 0; i < r.W * r.H; i++) if (r.T[i] === ID.water) rows.add((i / r.W) | 0); ok(rows.size <= 3, 'вода растеклась тонким слоем (рядов: ' + rows.size + ')'); }
fresh(40, 30); floor(); for (let i = 0; i < 300; i++) { S.put(20, 2, ID.sand); run(1); } run(100);
{ const r = S._raw(); let top = 99; for (let i = 0; i < r.W * r.H; i++) if (r.T[i] === ID.sand) top = Math.min(top, (i / r.W) | 0); ok(n(counts(), 'sand') === 300 && top > 8 && top < 20, 'песок образует кучу (высота ' + (29 - top) + ')'); }
fresh(40, 40); floor(); rect(10, 30, 15, 36, 'oil'); rect(10, 20, 15, 29, 'water'); run(300);
{ const r = S._raw(); let oilY = 0, oc = 0, wy = 0, wc = 0; for (let i = 0; i < r.W * r.H; i++) { if (r.T[i] === ID.oil) { oilY += (i / r.W) | 0; oc++; } if (r.T[i] === ID.water) { wy += (i / r.W) | 0; wc++; } } ok(oilY / oc < wy / wc, 'нефть всплывает над водой'); }

console.log('Огонь и тепло');
fresh(40, 30); floor(); rect(10, 20, 20, 28, 'wood'); for (let x = 10; x <= 20; x++) S.put(x, 19, ID.fire); run(400);
ok(n(counts(), 'wood') < 20 && n(counts(), 'ash') > 50, 'дерево сгорает в пепел');
fresh(40, 30); floor(); rect(5, 20, 35, 28, 'water'); rect(5, 29, 35, 29, 'heater'); run(300);
ok(n(counts(), 'steam') > 30, 'нагреватель кипятит воду');
fresh(40, 30); floor(); rect(5, 26, 35, 28, 'water'); rect(5, 29, 35, 29, 'cooler'); run(400);
ok(n(counts(), 'ice') > 30, 'холодильник замораживает воду');
fresh(40, 40); floor(); rect(5, 34, 35, 38, 'water'); rect(15, 20, 25, 33, 'lava'); run(1500);
ok(n(counts(), 'stone') > 100 && n(counts(), 'steam') > 20, 'лава и вода дают камень и пар');
fresh(40, 40); floor(); rect(5, 30, 35, 38, 'sand'); S.lightning(20, 29); run(10);
ok(n(counts(), 'molten_glass') + n(counts(), 'glass') > 3, 'молния спекает песок в стекло');

console.log('Взрывы');
fresh(60, 40); floor(); rect(25, 35, 34, 38, 'tnt'); for (let x = 25; x <= 34; x++) S.put(x, 34, ID.fire); run(60);
ok(n(counts(), 'tnt') === 0, 'тротил взрывается целиком (цепная реакция)');
fresh(50, 40); floor(); rect(10, 34, 20, 38, 'nitro'); for (let x = 10; x <= 20; x++) S.put(x, 33, ID.fire); run(250);
ok(n(counts(), 'nitro') <= 3, 'нитроглицерин взрывается');

console.log('Химия');
fresh(30, 30); floor(); rect(5, 25, 20, 28, 'iron'); rect(5, 15, 20, 24, 'acid'); run(400);
ok(n(counts(), 'iron') === 0 && n(counts(), 'hydrogen') > 30, 'кислота растворяет железо с выделением H₂');
fresh(40, 30); floor(); rect(5, 20, 35, 28, 'water'); rect(18, 15, 22, 17, 'sodium'); run(150);
ok(n(counts(), 'sodium') === 0 && n(counts(), 'base') > 3, 'натрий реагирует с водой, остаётся щёлочь');
fresh(30, 30); floor(); rect(10, 25, 12, 28, 'sodium'); rect(13, 25, 16, 28, 'chlorine'); run(200);
ok(n(counts(), 'salt') >= 6, '2Na + Cl₂ → соль');
fresh(30, 30); floor(); rect(5, 20, 20, 28, 'aluminum'); rect(5, 10, 20, 19, 'mercury'); run(900);
ok(n(counts(), 'ash') > 80 && n(counts(), 'mercury') === 160, 'ртуть разъедает алюминий и сама не расходуется');
fresh(30, 30); floor(); S.ambient = 40; rect(10, 20, 14, 22, 'phosphorus'); run(200);
ok(n(counts(), 'phosphorus') === 0, 'белый фосфор самовоспламеняется при 40 °C');
fresh(30, 30); floor(); rect(10, 23, 20, 29, 'thermite'); rect(10, 22, 20, 22, 'magnesium'); for (let x = 10; x <= 20; x++) S.put(x, 21, ID.fire); run(400);
ok(n(counts(), 'thermite') < 10 && n(counts(), 'iron') + n(counts(), 'molten_iron') > 20, 'термит даёт железо');

console.log('Электричество и ядерная физика');
fresh(40, 30); rect(2, 10, 30, 10, 'copper'); S.put(31, 10, ID.lamp); S.put(1, 10, ID.battery);
{ let lit = 0; const r = S._raw(); for (let i = 0; i < 120; i++) { S.step(); if (r.LF[10 * r.W + 31] > 0) lit++; } ok(lit > 30, 'ток по меди зажигает лампу'); }
fresh(30, 30); floor(); rect(10, 25, 12, 28, 'saltwater'); rect(5, 20, 20, 28, 'saltwater'); rect(3, 21, 3, 28, 'copper'); rect(3, 21, 8, 21, 'copper'); S.put(2, 21, ID.battery); run(500);
ok(n(counts(), 'hydrogen') + n(counts(), 'acid') > 5, 'электролиз солёной воды даёт газ');
fresh(60, 50); floor(); rect(25, 40, 31, 48, 'plutonium'); S.put(28, 39, ID.neutron); run(300);
ok(n(counts(), 'waste') >= 15, 'плутоний: цепная реакция');
fresh(60, 50); floor(); rect(20, 38, 32, 48, 'uranium'); for (let k = 0; k < 5; k++) S.put(18, 45, ID.neutron); run(600);
ok(n(counts(), 'uranium') > 0, 'уран: куча не взрывается сама без источника');

console.log('Жизнь');
fresh(40, 40); floor(); rect(0, 36, 39, 38, 'dirt'); rect(15, 30, 25, 35, 'water'); S.put(20, 29, ID.seed); run(700);
ok(n(counts(), 'plant') > 8, 'семя у воды вырастает в растение (клеток: ' + n(counts(), 'plant') + ')');
fresh(40, 30); floor(); rect(5, 20, 35, 28, 'wood'); S.put(20, 20, ID.mold); run(1500);
ok(n(counts(), 'mold') > 50, 'плесень растёт по дереву');
fresh(40, 30); floor(); rect(5, 20, 25, 28, 'water'); S.put(10, 28, ID.virus); rect(5, 10, 25, 12, 'alcohol'); run(400);
ok(n(counts(), 'virus') < 15, 'спирт убивает вирус');
fresh(40, 40); floor(); rect(5, 20, 35, 38, 'water'); for (let i = 0; i < 8; i++) S.put(10 + i * 3, 30, ID.fish); run(600);
ok(n(counts(), 'fish') === 8, 'рыбки живут в воде');

console.log('Гравитация и края');
fresh(40, 40, -1); rect(0, 0, 39, 0, 'wall'); rect(10, 30, 15, 35, 'sand'); run(200);
{ const r = S._raw(); let maxY = 0; for (let i = 0; i < r.W * r.H; i++) if (r.T[i] === ID.sand) maxY = Math.max(maxY, (i / r.W) | 0); ok(maxY < 10, 'обратная гравитация: песок «падает» вверх'); }
fresh(30, 30); S.edge = 2; rect(5, 15, 10, 20, 'hydrogen'); run(150);
ok(S.stats() === 0, 'открытые края: газ улетает');

console.log('Сохранение и сцены');
fresh(60, 50); for (let i = 0; i < 800; i++) S.put((i * 37) % 60, (i * 53) % 50, 1 + (i * 7) % (D.N - 1));
{ const r = S._raw(), T0 = r.T.slice(), TP0 = r.TP.slice(); const str = S.serialize(); S.clearAll(); S.deserialize(str); let diff = 0; for (let i = 0; i < r.W * r.H; i++) if (r.T[i] !== T0[i] || Math.abs(r.TP[i] - TP0[i]) > .5) diff++; ok(diff === 0, 'сохранение и загрузка без потерь'); }
for (const sc of G.scenes) { fresh(130, 224); let err = null; try { sc.build(); run(300); } catch (e) { err = e; } ok(!err && S.stats() > 100, 'сцена «' + sc.name + '» строится и работает'); }

console.log('Случайный «фаззинг»: все вещества вперемешку, 3 гравитации × 3 вида краёв');
{
  let bad = 0;
  for (const g of [1, -1, 0]) for (const e of [0, 1, 2]) {
    fresh(70, 60, g); S.edge = e;
    for (let k = 0; k < 1800; k++) S.put((k * 131) % 70, (k * 197) % 60, 1 + (k * 31) % (D.N - 1));
    try {
      for (let f = 0; f < 250; f++) { S.step(); if (f % 80 === 0) { S.blast(35, 30, 10, 1); S.lightning(30, 40); S.sparkTool(35, 30, 15); S.windTool(35, 30, 8, 2, -1); } }
      const r = S._raw();
      for (let i = 0; i < r.W * r.H; i++) { if (r.T[i] >= D.N || r.TP[i] !== r.TP[i]) throw new Error('битые данные'); if (r.T[i] === 0 && (r.BN[i] || r.AX[i] || r.LF[i])) throw new Error('мусор в пустой клетке'); }
    } catch (err) { bad++; console.log('   ' + err.message); }
  }
  ok(bad === 0, 'нет исключений и битых данных');
}

console.log('\n' + (fails ? '✗ провалено: ' + fails + ' из ' + total : '✓ всё в порядке: ' + total + ' проверок'));
process.exit(fails ? 1 : 0);
