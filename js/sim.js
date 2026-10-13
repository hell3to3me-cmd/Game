/* Движок песочницы: клеточный автомат.
   Один слой клеток; у каждой: тип, «вариация цвета», температура, жизнь, доп. значение, горение. */
(function () {
  'use strict';
  const G = globalThis.G;
  const D = (G.D = G.finalize());
  const K = G.KIND, F = G.F, AIR = G.AIR, ID = D.ID;
  const { KIND, DENS, COND, AIRK, HARD, SPREAD, VISC, SLIP, GASB, FL, IG, BL, BT, RES, FM, EXR, EXP, BTO, SMK, HIT, HITT, LOT, LOTT, T0, LIFE0, DIE, DIEP, FLG,
    CR, CG, CB, CA, CVAR, GLR, GLG, GLB, GLA, RADP, DECP, DECT, DECG, EXT, DBR, NAB, NFIS, HASRX, RXI, RXS, N } = D;

  const F_COND = F.COND, F_INDES = F.INDES, F_ORG = F.ORG, F_FIXT = F.FIXT, F_MORTAL = F.MORTAL, F_NOHOT = F.NOHOT, F_FIRE = F.FIRE, F_LAMP = F.LAMP, F_NEON = F.NEON, F_NOMOVE = F.NOMOVE;
  const POW = K.POW, LIQ = K.LIQ, GAS = K.GAS, SOL = K.SOL;

  const I_FIRE = ID.fire, I_PLASMA = ID.plasma, I_SMOKE = ID.smoke, I_STEAM = ID.steam, I_WATER = ID.water, I_SALTWATER = ID.saltwater, I_ASH = ID.ash,
    I_PLANT = ID.plant, I_FLOWER = ID.flower, I_GRASS = ID.grass, I_DIRT = ID.dirt, I_MUD = ID.mud, I_MOLD = ID.mold, I_VIRUS = ID.virus,
    I_NEUTRON = ID.neutron, I_URANIUM = ID.uranium, I_PLUTONIUM = ID.plutonium, I_WASTE = ID.waste, I_CLONE = ID.clone, I_VOID = ID.void,
    I_SPARKLE = ID.sparkle, I_BOLT = ID.bolt, I_H2 = ID.hydrogen, I_CL2 = ID.chlorine, I_LAVA = ID.lava, I_COAL = ID.coal, I_NEON = ID.neon;

  const DX8 = [-1, 0, 1, -1, 1, -1, 0, 1], DY8 = [-1, -1, -1, 0, 0, 1, 1, 1];

  /* ---------- состояние ---------- */
  let W = 0, H = 0, SZ = 0;
  let T, V, TP, LF, AX, BN, ST;
  let fr = 1, amb = 22, gdir = 1, edge = 0;
  const hooks = { blast: null, lightning: null };

  let rs = 0x9e3779b9 | 0;
  function rnd() { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) * 2.3283064365386963e-10; }

  function alloc(w, h) {
    W = w; H = h; SZ = w * h;
    T = new Uint16Array(SZ); V = new Uint8Array(SZ); TP = new Float32Array(SZ).fill(amb);
    LF = new Int16Array(SZ); AX = new Uint16Array(SZ); BN = new Uint8Array(SZ); ST = new Uint8Array(SZ);
  }

  function resize(nw, nh) {
    nw = Math.max(8, nw | 0); nh = Math.max(8, nh | 0);
    if (nw === W && nh === H) return;
    const o = { T, V, TP, LF, AX, BN }, ow = W, oh = H;
    alloc(nw, nh);
    if (!o.T) return;
    const cw = Math.min(ow, nw), ch = Math.min(oh, nh);
    for (let k = 0; k < ch; k++) {          // выравнивание по нижнему левому углу
      const oi = (oh - 1 - k) * ow, ni = (nh - 1 - k) * nw;
      T.set(o.T.subarray(oi, oi + cw), ni); V.set(o.V.subarray(oi, oi + cw), ni); TP.set(o.TP.subarray(oi, oi + cw), ni);
      LF.set(o.LF.subarray(oi, oi + cw), ni); AX.set(o.AX.subarray(oi, oi + cw), ni); BN.set(o.BN.subarray(oi, oi + cw), ni);
    }
  }

  /* ---------- клетки ---------- */
  function clearCell(i) { T[i] = 0; V[i] = 0; LF[i] = 0; AX[i] = 0; BN[i] = 0; TP[i] = amb; }
  function initCell(i, tp) {
    T[i] = tp; V[i] = (rnd() * 256) | 0; AX[i] = 0; BN[i] = 0;
    const l = LIFE0[tp];
    LF[i] = l ? ((l * (0.6 + 0.8 * rnd())) | 0) + 1 : 0;
    const t0 = T0[tp];
    TP[i] = t0 === t0 ? t0 : amb;
  }
  function setType(i, tp, keepT) {
    const t = TP[i], v = V[i];
    initCell(i, tp); V[i] = v;
    if (keepT) TP[i] = t;
  }
  function swap(i, j) {
    let t = T[i]; T[i] = T[j]; T[j] = t;
    t = V[i]; V[i] = V[j]; V[j] = t;
    t = LF[i]; LF[i] = LF[j]; LF[j] = t;
    t = AX[i]; AX[i] = AX[j]; AX[j] = t;
    t = BN[i]; BN[i] = BN[j]; BN[j] = t;
    const f = TP[i]; TP[i] = TP[j]; TP[j] = f;
    ST[i] = fr; ST[j] = fr;
  }
  /* свободная клетка рядом (случайная из 8); -1 если нет */
  function freeNear(x, y) {
    const s = (rnd() * 8) | 0;
    for (let n = 0; n < 8; n++) {
      const k = (s + n) & 7, nx = x + DX8[k], ny = y + DY8[k];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const j = ny * W + nx;
      if (T[j] === 0) return j;
    }
    return -1;
  }
  function spawnAt(x, y, tp, life) {
    const j = freeNear(x, y);
    if (j < 0) return -1;
    initCell(j, tp);
    if (life) LF[j] = life;
    return j;
  }
  function spawnFlame(x, y, ft) {
    const up = gdir === 0 ? (rnd() < .5 ? -1 : 1) : -gdir;
    const nx = x + ((rnd() * 3) | 0) - 1, ny = y + up;
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) return;
    const j = ny * W + nx;
    if (T[j] === 0) { initCell(j, ft); LF[j] = 6 + ((rnd() * 14) | 0); }
  }

  /* ---------- тепло ---------- */
  function heat(i, x, y, tp) {
    const r = (rnd() * 4) | 0;
    let nx = x, ny = y;
    if (r === 0) nx--; else if (r === 1) nx++; else if (r === 2) ny--; else ny++;
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) { TP[i] += (amb - TP[i]) * 0.01; return; }
    const j = ny * W + nx, tj = T[j];
    if (tj === 0) { TP[i] += (amb - TP[i]) * AIRK[tp]; return; }
    const d = TP[j] - TP[i];
    if (d > 0.05 || d < -0.05) {
      const tr = d * (COND[tp] + COND[tj]) * 0.25;
      TP[i] += tr; TP[j] -= tr;
    }
  }

  /* ---------- горение ---------- */
  function ignite(i, x, y) {
    const tp = T[i];
    if (BN[i] !== 0) return;
    const bto = BTO[tp];
    if (bto) {
      const t = Math.max(TP[i], BT[tp]);
      setType(i, bto, true); TP[i] = t;
      if (bto !== ID.rocket) for (let n = 0; n < 3; n++) spawnFlame(x, y, ID.fire_white);
      return;
    }
    const exr = EXR[tp];
    if (exr > 0 && rnd() < EXP[tp]) { clearCell(i); blast(x, y, exr, 1); return; }
    const b = (BL[tp] * (0.75 + rnd() * 0.5)) | 0;
    BN[i] = b < 1 ? 1 : b;
  }

  function burnStep(i, x, y, tp) {
    const k = (rnd() * 8) | 0, nx = x + DX8[k], ny = y + DY8[k];
    if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
      const j = ny * W + nx, tj = T[j];
      if (tj) {
        const e = EXT[tj];
        if (e > 0 && rnd() < e) {                       // потушили
          BN[i] = 0;
          if (KIND[tj] === LIQ && rnd() < .25) { setType(j, I_STEAM, true); TP[j] = 105; }
          return;
        }
        const f = FL[tj];
        if (f > 0 && BN[j] === 0 && rnd() < f) ignite(j, nx, ny);
      }
    }
    if (TP[i] < BT[tp]) TP[i] = BT[tp];
    if (rnd() < .4) spawnFlame(x, y, FM[tp]);
    if (rnd() < SMK[tp] * .1) spawnAt(x, y, I_SMOKE);
    const b = BN[i] - 1;
    if (b <= 0) {
      const res = RES[tp];
      if (res) setType(i, res, true); else clearCell(i);
    } else BN[i] = b;
  }

  function fireSpread(i, x, y, tp) {
    TP[i] = T0[tp];
    const m = tp === I_PLASMA ? 2 : 1;
    for (let n = 0; n < 2; n++) {
      const k = (rnd() * 8) | 0, nx = x + DX8[k], ny = y + DY8[k];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const j = ny * W + nx, tj = T[j];
      if (tj === 0) continue;
      const f = FL[tj];
      if (f > 0 && BN[j] === 0 && rnd() < f * m) ignite(j, nx, ny);
    }
  }

  /* ---------- реакции ---------- */
  function applySpec(i, spec) {
    if (spec === -1) return;
    if (spec === 0) { clearCell(i); return; }
    if (typeof spec === 'number') { setType(i, spec, true); return; }
    setType(i, spec.t, true);
    if (spec.aux) AX[i] = spec.aux;
    if (spec.life) LF[i] = spec.life;
  }
  function react(i, j, x, y, r) {
    if (rnd() >= r.p) return;
    applySpec(i, r.a); applySpec(j, r.b);
    if (r.dT) { if (T[i]) TP[i] += r.dT; if (T[j]) TP[j] += r.dT; }
    if (r.blast) blast(x, y, r.blast, .7);
  }

  /* ---------- взрыв ---------- */
  const offCache = {};
  function offsets(r) {
    if (offCache[r]) return offCache[r];
    const list = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) list.push([dx, dy, d]);
    }
    list.sort((a, b) => b[2] - a[2]);
    return (offCache[r] = list);
  }
  function blast(cx, cy, r, pw) {
    pw = pw || 1;
    const off = offsets(r);
    for (let n = 0; n < off.length; n++) {
      const o = off[n], dx = o[0], dy = o[1], d = o[2];
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = y * W + x, tp = T[i], s = 1 - d / r;
      if (tp === 0) {
        if (s > .45 && rnd() < s * .8) { initCell(i, rnd() < .5 ? I_FIRE : I_PLASMA); LF[i] = 3 + ((rnd() * 8 * s) | 0); }
        continue;
      }
      if (FLG[tp] & F_INDES) continue;
      TP[i] += s * s * pw * 900;
      const kind = KIND[tp];
      const force = s * pw * 1.5 + rnd() * .3;
      if (force < HARD[tp] + .05) continue;
      if (kind === SOL) {
        const db = DBR[tp];
        if (!db) { if (HARD[tp] < .4 && s > .6) clearCell(i); continue; }     // металлы и т.п. выживают
        setType(i, db, true);
      }
      if (s > .65 && rnd() < .45) {                                           // испарилось
        initCell(i, rnd() < .5 ? I_FIRE : (rnd() < .5 ? I_PLASMA : I_SMOKE)); LF[i] = 4 + ((rnd() * 12) | 0);
        continue;
      }
      if (d > 0) {                                                            // отбросило наружу
        const ux = dx / d, uy = dy / d;
        const dist = 1 + (((r - d) * .9 * (.4 + rnd())) | 0);
        let lx = x, ly = y;
        for (let k = 1; k <= dist; k++) {
          const nx = Math.round(x + ux * k), ny = Math.round(y + uy * k);
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) break;
          if (T[ny * W + nx] !== 0) break;
          lx = nx; ly = ny;
        }
        if (lx !== x || ly !== y) swap(i, ly * W + lx);
      }
    }
    if (hooks.blast) hooks.blast(r * pw);
  }

  /* ---------- молния ---------- */
  function lightning(tx, ty) {
    tx = Math.max(0, Math.min(W - 1, tx | 0)); ty = Math.max(0, Math.min(H - 1, ty | 0));
    let x = Math.max(0, Math.min(W - 1, tx + ((rnd() * 24 - 12) | 0))), y = 0;
    let hx = tx, hy = ty;
    const bolt = (xx, yy) => {
      const i = yy * W + xx;
      if (T[i] === 0 || KIND[T[i]] === GAS) { initCell(i, I_BOLT); LF[i] = 5 + ((rnd() * 5) | 0); }
    };
    bolt(x, 0);
    while (y < ty) {
      y++;
      const r = rnd();
      if (r < .4) x += tx > x ? 1 : tx < x ? -1 : 0; else if (r < .65) x += rnd() < .5 ? -1 : 1;
      x = x < 0 ? 0 : x >= W ? W - 1 : x;
      const i = y * W + x;
      if (T[i] !== 0 && KIND[T[i]] !== GAS && T[i] !== I_BOLT) { hx = x; hy = y; break; }
      bolt(x, y);
      hx = x; hy = y;
    }
    strike(hx, hy);
    if (hooks.lightning) hooks.lightning();
  }
  function strike(x, y) {
    blast(x, y, 3, .5);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const i = ny * W + nx, tp = T[i];
      if (!tp) continue;
      if (dx * dx + dy * dy <= 10 && !(FLG[tp] & F_INDES) && KIND[tp] !== GAS) TP[i] += 2800;
      if ((FLG[tp] & F_COND) && AX[i] === 0) AX[i] = 1;
    }
  }

  /* ---------- электричество ---------- */
  const CHG_MAX = 4;
  function conduct(i, x, y, tp) {
    const a = AX[i];
    if (a === 1) {
      for (let k = 0; k < 8; k++) {
        const nx = x + DX8[k], ny = y + DY8[k];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const j = ny * W + nx, tj = T[j];
        if (tj === 0) continue;
        if (FLG[tj] & F_COND) { if (AX[j] === 0) { AX[j] = 1; ST[j] = fr; } }
        else if (FL[tj] >= .3 && rnd() < .15) { ignite(j, nx, ny); if (T[i] !== tp) return; }   // искра поджигает газы и порох
      }
      if (tp === I_SALTWATER && rnd() < .04) {                              // электролиз
        const g = spawnAt(x, y, rnd() < .5 ? I_H2 : I_CL2);
        if (g >= 0) { setType(i, I_WATER, true); AX[i] = 0; return; }
      }
    }
    AX[i] = a >= CHG_MAX ? 0 : a + 1;
  }

  /* ---------- движение ---------- */
  function outside(i, nx, ny) {
    if (edge === 0) return false;
    if (edge === 1) { if (ny < 0) { clearCell(i); return true; } return false; }
    clearCell(i); return true;
  }

  function movePowder(i, x, y, tp) {
    const g = gdir;
    if (g === 0) return;
    const d = DENS[tp], ny = y + g;
    if (ny < 0 || ny >= H) { outside(i, x, ny); return; }
    let j = ny * W + x, tj = T[j];
    if (tj === 0 || (KIND[tj] >= LIQ && DENS[tj] < d && (KIND[tj] === GAS || rnd() < .6))) { swap(i, j); return; }
    if (rnd() < SLIP[tp]) {
      let dir = rnd() < .5 ? -1 : 1;
      for (let n = 0; n < 2; n++, dir = -dir) {
        const nx = x + dir;
        if (nx < 0 || nx >= W) continue;
        j = ny * W + nx; tj = T[j];
        if (tj === 0 || (KIND[tj] >= LIQ && DENS[tj] < d && (KIND[tj] === GAS || rnd() < .5))) { swap(i, j); return; }
      }
    }
    const ay = y - g;                                                       // всплыть, если легче жидкости сверху
    if (ay >= 0 && ay < H) {
      const ja = ay * W + x, ta = T[ja];
      if (ta !== 0 && KIND[ta] === LIQ && DENS[ta] > d && rnd() < .3) swap(i, ja);
    }
  }

  function moveLiquid(i, x, y, tp) {
    const vi = VISC[tp];
    if (vi > 0 && rnd() < vi) return;
    const d = DENS[tp], g = gdir;
    if (g !== 0) {
      const ny = y + g;
      if (ny < 0 || ny >= H) { if (outside(i, x, ny)) return; }
      else {
        let j = ny * W + x, tj = T[j];
        if (tj === 0 || (KIND[tj] >= LIQ && DENS[tj] < d && (KIND[tj] === GAS || rnd() < .7))) { swap(i, j); return; }
        const ay = y - g;
        if (ay >= 0 && ay < H) {
          const ja = ay * W + x, ta = T[ja];
          if (ta !== 0 && KIND[ta] === LIQ && DENS[ta] > d && rnd() < .3) { swap(i, ja); return; }
        }
        let dir = rnd() < .5 ? -1 : 1;
        for (let n = 0; n < 2; n++, dir = -dir) {
          const nx = x + dir;
          if (nx < 0 || nx >= W) continue;
          j = ny * W + nx; tj = T[j];
          if (tj === 0 || (KIND[tj] >= LIQ && DENS[tj] < d && (KIND[tj] === GAS || rnd() < .5))) { swap(i, j); return; }
        }
      }
    }
    const sp = SPREAD[tp];
    if (!sp) return;
    const dir = rnd() < .5 ? -1 : 1;
    let cx = x;
    for (let s = 0; s < sp; s++) {
      const nx = cx + dir;
      if (nx < 0 || nx >= W) { if (s === 0 && edge === 2) { clearCell(i); return; } break; }
      const tj = T[y * W + nx];
      if (tj === 0 || KIND[tj] === GAS) cx = nx; else break;
    }
    if (cx !== x) swap(i, y * W + cx);
  }

  function moveGas(i, x, y, tp) {
    const d = DENS[tp], g = gdir;
    let vy = 0;
    if (g !== 0) vy = d < AIR ? -g : d > AIR ? g : 0;
    if (vy !== 0 && rnd() < GASB[tp]) {
      const ny = y + vy;
      if (ny < 0 || ny >= H) { if (outside(i, x, ny)) return; }
      else {
        const up = vy === -g, dir = rnd() < .5 ? -1 : 1;
        for (let n = 0; n < 3; n++) {                                        // прямо, затем по диагонали
          const nx = n === 0 ? x : n === 1 ? x + dir : x - dir;
          if (nx < 0 || nx >= W) continue;
          const j = ny * W + nx, tj = T[j];
          if (tj === 0 || (tj !== tp && KIND[tj] >= LIQ && (up ? DENS[tj] > d : (KIND[tj] === GAS && DENS[tj] < d)))) { swap(i, j); return; }
        }
      }
    }
    if (rnd() < .5) {                                                        // диффузия
      const nx = x + (rnd() < .5 ? -1 : 1);
      if (nx < 0 || nx >= W) { if (edge === 2) clearCell(i); return; }
      const j = y * W + nx, tj = T[j];
      if (tj === 0 || (tj !== tp && KIND[tj] === GAS && rnd() < .4)) swap(i, j);
    }
  }

  /* ---------- особые вещества ---------- */
  const UPDF = {
    fissile(i, x, y) {
      if (AX[i] > 0 && --AX[i] === 0) fission(i, x, y);
    },
    battery(i, x, y) {
      if (rnd() > .2) return;
      for (let k = 0; k < 8; k++) {
        const nx = x + DX8[k], ny = y + DY8[k];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const j = ny * W + nx;
        if ((FLG[T[j]] & F_COND) && AX[j] === 0) { AX[j] = 1; ST[j] = fr; }
      }
    },
    lamp(i) { if (AX[i] === 1) LF[i] = 10; else if (LF[i] > 0) LF[i]--; },
    clone(i, x, y) {
      if (AX[i] === 0) {
        for (let k = 0; k < 8; k++) {
          const nx = x + DX8[k], ny = y + DY8[k];
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const tj = T[ny * W + nx];
          if (tj && tj !== I_CLONE && tj !== I_VOID) { AX[i] = tj; return; }
        }
      } else if (rnd() < .45) {
        const j = freeNear(x, y);
        if (j >= 0) initCell(j, AX[i]);
      }
    },
    void(i, x, y) {
      for (let k = 0; k < 8; k++) {
        const nx = x + DX8[k], ny = y + DY8[k];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const j = ny * W + nx, tj = T[j];
        if (tj && tj !== I_VOID && !(FLG[tj] & F_INDES)) clearCell(j);
      }
    },
    plant(i, x, y) {
      if (AX[i] < 6) {
        const k = (rnd() * 8) | 0, nx = x + DX8[k], ny = y + DY8[k];
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
          const j = ny * W + nx;
          if (T[j] === I_WATER) { clearCell(j); AX[i] += 4; }
        }
      }
      const lf = LF[i];
      if (lf <= 0 || AX[i] === 0 || rnd() > .12) return;
      const up = gdir === 0 ? -1 : -gdir;
      const r = rnd(), dx = r < .62 ? 0 : r < .81 ? -1 : 1;
      const nx = x + dx, ny = y + up;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) return;
      const j = ny * W + nx;
      if (T[j] !== 0 && T[j] !== I_WATER) return;                          // под водой растёт, вытесняя её
      const flower = lf <= 3 && rnd() < .4;
      initCell(j, flower ? I_FLOWER : I_PLANT);
      if (!flower) { LF[j] = lf - 1; AX[j] = AX[i] > 0 ? AX[i] - 1 : 0; }
      AX[i] = AX[i] > 0 ? AX[i] - 1 : 0;
      const nv = V[i] + ((rnd() * 40) | 0) - 20; V[j] = nv < 0 ? 0 : nv > 255 ? 255 : nv;
      LF[i] = rnd() < .8 ? 0 : lf >> 1;                                  // ветвление делит запас роста
    },
    seed(i, x, y) {
      const g = gdir || 1, by = y + g;
      if (by < 0 || by >= H) return;
      const b = T[by * W + x];
      if (b !== I_DIRT && b !== I_MUD && b !== I_GRASS) return;
      for (let k = 0; k < 8; k++) {
        const nx = x + DX8[k], ny = y + DY8[k];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const j = ny * W + nx;
        if (T[j] === I_WATER) { clearCell(j); setType(i, I_PLANT, false); LF[i] = 16 + ((rnd() * 22) | 0); AX[i] = 12; return; }
      }
    },
    grass(i, x, y) {
      if (rnd() > .02) return;
      const k = (rnd() * 8) | 0, nx = x + DX8[k], ny = y + DY8[k];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) return;
      const j = ny * W + nx;
      if (T[j] === I_DIRT) {
        const ay = ny - (gdir || 1);
        if (ay >= 0 && ay < H && T[ay * W + nx] === 0) setType(j, I_GRASS, true);
      }
      let free = 0;
      if (x > 0 && T[i - 1] === 0) free++;
      if (x < W - 1 && T[i + 1] === 0) free++;
      if (y > 0 && T[i - W] === 0) free++;
      if (y < H - 1 && T[i + W] === 0) free++;
      if (free === 0 && rnd() < .15) setType(i, I_DIRT, true);
    },
    mold(i, x, y) {
      if (TP[i] > 50) { setType(i, I_ASH, true); return; }
      if (rnd() > .08) return;
      const k = (rnd() * 8) | 0, nx = x + DX8[k], ny = y + DY8[k];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) return;
      const j = ny * W + nx, tj = T[j];
      if (tj && tj !== I_MOLD && tj !== I_VIRUS && (FLG[tj] & F_ORG) && rnd() < .15) setType(j, I_MOLD, true);
    },
    virus(i, x, y) {
      if (TP[i] > 70) { clearCell(i); return; }
      const k = (rnd() * 8) | 0, nx = x + DX8[k], ny = y + DY8[k];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) return;
      const j = ny * W + nx, tj = T[j];
      if (tj && tj !== I_VIRUS && ((FLG[tj] & F_ORG) || tj === I_WATER || tj === I_SALTWATER) && rnd() < .05) setType(j, I_VIRUS, true);
    },
    fish(i, x, y) {
      let w = 0;
      for (let k = 0; k < 8; k++) {
        const nx = x + DX8[k], ny = y + DY8[k];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const t = T[ny * W + nx];
        if (t === I_WATER || t === I_SALTWATER) w++;
      }
      if (w === 0) {
        const ny = y + (gdir || 1);
        if (ny >= 0 && ny < H && T[ny * W + x] === 0) swap(i, ny * W + x);
        if (--LF[i] <= 0) setType(i, I_ASH, true);
        return;
      }
      LF[i] = 300;
      if (rnd() < .4) {
        const dir = (AX[i] & 1) ? 1 : -1, r = rnd(), dy = r < .2 ? -1 : r < .4 ? 1 : 0;
        const nx = x + dir, ny = y + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
          const j = ny * W + nx, t = T[j];
          if (t === I_WATER || t === I_SALTWATER) { swap(i, j); return; }
        }
        AX[i] ^= 1;
      }
    },
    neutron(i, x, y) {
      if (--LF[i] <= 0) { clearCell(i); return; }
      for (let s = 0; s < 2; s++) {
        const dir = AX[i], nx = x + DX8[dir], ny = y + DY8[dir];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) { clearCell(i); return; }
        const j = ny * W + nx, tj = T[j];
        if (tj === 0 || KIND[tj] === GAS) { swap(i, j); i = j; x = nx; y = ny; continue; }
        if (NFIS[tj] > 0 && rnd() < NFIS[tj]) { fission(j, nx, ny); clearCell(i); return; }
        if (rnd() < NAB[tj]) { clearCell(i); return; }
        AX[i] = (rnd() * 8) | 0;
        return;
      }
    },
    rocket(i, x, y) {
      if (--LF[i] <= 0) { burst(x, y); clearCell(i); return; }
      const up = gdir === 0 ? -1 : -gdir;
      const nx = x + (rnd() < .2 ? (rnd() < .5 ? -1 : 1) : 0), ny = y + up;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) { burst(x, y); clearCell(i); return; }
      const j = ny * W + nx, tj = T[j];
      if (tj === 0 || KIND[tj] === GAS) {
        swap(i, j);
        if (T[i] === 0) { initCell(i, I_FIRE); LF[i] = 5 + ((rnd() * 5) | 0); }
      } else { burst(x, y); clearCell(i); }
    },
    sparkle(i, x, y) {
      const dir = AX[i] & 15, l = LF[i];
      let nx = x, ny = y;
      if (l > 32 && rnd() < .88) {
        const vx = SPX[dir], vy = SPY[dir];
        if (rnd() < Math.abs(vx)) nx += vx > 0 ? 1 : -1;
        if (rnd() < Math.abs(vy)) ny += vy > 0 ? 1 : -1;
      } else { nx += rnd() < .5 ? -1 : rnd() < .5 ? 1 : 0; ny += rnd() < .6 ? (gdir || 1) : 0; }
      if (nx >= 0 && nx < W && ny >= 0 && ny < H && (nx !== x || ny !== y)) {
        const j = ny * W + nx;
        if (T[j] === 0) swap(i, j);
        else if (rnd() < .1 && FL[T[j]] > .2) ignite(j, nx, ny);
      }
    }
  };
  const SPX = [], SPY = [];
  for (let k = 0; k < 16; k++) {                      // единичные «квадратные» векторы: max(|x|,|y|)=1
    const a = k * Math.PI / 8, c = Math.cos(a), s = Math.sin(a), m = Math.max(Math.abs(c), Math.abs(s));
    SPX.push(c / m); SPY.push(s / m);
  }

  function burst(x, y) {
    const c1 = (rnd() * 8) | 0, c2 = (rnd() * 8) | 0;
    for (let n = 0; n < 150; n++) {
      const dir = (rnd() * 16) | 0, r0 = 1 + ((rnd() * 4) | 0);
      const nx = x + Math.round(SPX[dir] * r0), ny = y + Math.round(SPY[dir] * r0);
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const j = ny * W + nx;
      if (T[j] !== 0 && KIND[T[j]] !== GAS) continue;
      initCell(j, I_SPARKLE); AX[j] = dir | ((rnd() < .5 ? c1 : c2) << 4); LF[j] = 38 + ((rnd() * 44) | 0);
    }
    if (hooks.blast) hooks.blast(3);
  }

  /* Деление: клетка превращается в отходы, соседние делящиеся клетки «взводятся» (поток нейтронов внутри массы),
     а в свободные соседние клетки вылетают настоящие нейтроны. */
  function fission(j, x, y) {
    const pu = T[j] === I_PLUTONIUM;
    setType(j, I_WASTE, true);
    TP[j] += pu ? 1400 : 500;
    const pp = pu ? .38 : .24;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX8[k], ny = y + DY8[k];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const q = ny * W + nx;
      if (NFIS[T[q]] > 0 && AX[q] === 0 && rnd() < pp) AX[q] = 2 + ((rnd() * 4) | 0);
    }
    const n = pu ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const c = spawnAt(x, y, I_NEUTRON);
      if (c >= 0) { AX[c] = (rnd() * 8) | 0; LF[c] = 70; ST[c] = fr; }
    }
    if (pu && rnd() < .3) blast(x, y, 5, .8);
  }

  const UPD = new Array(N).fill(null);
  for (let t = 1; t < N; t++) if (D.UPDN[t]) UPD[t] = UPDF[D.UPDN[t]] || (() => { throw new Error('нет upd ' + D.UPDN[t]); })();

  /* ---------- шаг ---------- */
  function updateCell(i, x, y) {
    let tp = T[i];
    let fl = FLG[tp];
    if (fl & F_FIXT) TP[i] = T0[tp];
    heat(i, x, y, tp);
    const t = TP[i];
    if (t > HIT[tp]) { setType(i, HITT[tp], true); return; }
    if (t < LOT[tp]) { setType(i, LOTT[tp], true); return; }
    if (t >= IG[tp] && BN[i] === 0) { ignite(i, x, y); if (T[i] !== tp) return; }
    if (t > 20000) TP[i] = 20000; else if (t < -273) TP[i] = -273;
    if (BN[i] > 0) { burnStep(i, x, y, tp); if (T[i] !== tp) return; }
    if (fl & F_FIRE) { fireSpread(i, x, y, tp); if (T[i] !== tp) return; }
    if (HASRX[tp]) {
      const k = (rnd() * 8) | 0, nx = x + DX8[k], ny = y + DY8[k];
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
        const j = ny * W + nx, tj = T[j];
        if (tj) {
          const ri = RXI[tp * N + tj];
          if (ri > 0) { react(i, j, x, y, RXS[ri]); if (T[i] !== tp) return; }
        }
      }
    }
    if (RADP[tp] > 0 && rnd() < RADP[tp]) {
      const c = spawnAt(x, y, I_NEUTRON);
      if (c >= 0) { AX[c] = (rnd() * 8) | 0; LF[c] = 60; ST[c] = fr; }
    }
    if (DECP[tp] > 0) {
      let p = DECP[tp];
      if (TP[i] > 60) p *= 15;
      if (rnd() < p) {
        setType(i, DECT[tp], true);
        if (DECG[tp]) spawnAt(x, y, DECG[tp]);
        return;
      }
    }
    if (fl & F_MORTAL) {
      const l = LF[i] - 1;
      if (l <= 0) {
        if (fl & F_FIRE) { const a = AX[i]; if (a) { setType(i, a, true); return; } }
        const dt = DIE[tp];
        if (dt && rnd() < DIEP[tp]) setType(i, dt, true); else clearCell(i);
        return;
      }
      LF[i] = l;
    }
    const u = UPD[tp];
    if (u) { u(i, x, y); if (T[i] !== tp) return; }
    if ((fl & F_COND) && AX[i] > 0) { conduct(i, x, y, tp); if (T[i] !== tp) return; }
    if (fl & F_NOMOVE) return;
    const kind = KIND[tp];
    if (kind === POW) movePowder(i, x, y, tp);
    else if (kind === LIQ) moveLiquid(i, x, y, tp);
    else if (kind === GAS) moveGas(i, x, y, tp);
  }

  function step() {
    fr = fr >= 250 ? 1 : fr + 1;
    const y0 = gdir >= 0 ? H - 1 : 0, y1 = gdir >= 0 ? -1 : H, dy = gdir >= 0 ? -1 : 1;
    for (let y = y0; y !== y1; y += dy) {
      const ltr = ((fr + y) & 1) === 0, row = y * W;
      for (let k = 0; k < W; k++) {
        const x = ltr ? k : W - 1 - k, i = row + x;
        if (T[i] === 0 || ST[i] === fr) continue;
        updateCell(i, x, y);
      }
    }
  }

  /* ---------- инструменты ---------- */
  function bump() { fr = fr >= 250 ? 1 : fr + 1; }

  function paint(cx, cy, r, shape, tp, replace) {
    const kind = tp ? KIND[tp] : 0;
    const prob = tp === 0 ? 1 : kind === SOL ? 1 : kind === GAS ? .12 : .3;
    const rr = r * r + r * .8 + .3;
    for (let dy = -r; dy <= r; dy++) {
      const y = cy + dy; if (y < 0 || y >= H) continue;
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx; if (x < 0 || x >= W) continue;
        if (shape === 0 && dx * dx + dy * dy > rr) continue;
        if (prob < 1 && rnd() > prob) continue;
        const i = y * W + x, cur = T[i];
        if (tp === 0) { if (cur) clearCell(i); continue; }
        if (cur !== 0 && !replace && !(KIND[cur] === GAS && kind !== GAS)) continue;
        if (cur === tp) continue;
        initCell(i, tp);
        if (tp === I_NEUTRON) AX[i] = (rnd() * 8) | 0;
      }
    }
  }
  function put(x, y, tp) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = y * W + x;
    if (tp === 0) clearCell(i); else { initCell(i, tp); if (tp === I_NEUTRON) AX[i] = (rnd() * 8) | 0; }
  }
  function setAux(x, y, v) { if (x >= 0 && x < W && y >= 0 && y < H) AX[y * W + x] = v; }
  function heatTool(cx, cy, r, delta) {
    const rr = r * r + r * .8 + .3;
    for (let dy = -r; dy <= r; dy++) {
      const y = cy + dy; if (y < 0 || y >= H) continue;
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx; if (x < 0 || x >= W) continue;
        const d2 = dx * dx + dy * dy; if (d2 > rr) continue;
        const i = y * W + x; if (!T[i]) continue;
        let t = TP[i] + delta * (1 - d2 / (rr + 1) * .6);
        TP[i] = t < -273 ? -273 : t > 20000 ? 20000 : t;
      }
    }
  }
  function sparkTool(cx, cy, r) {
    const rr = r * r + r * .8 + .3;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= W || y < 0 || y >= H || dx * dx + dy * dy > rr) continue;
      const i = y * W + x, tp = T[i];
      if (!tp) continue;
      if ((FLG[tp] & F_COND) && AX[i] === 0) AX[i] = 1;
      else if (FL[tp] > .3 && rnd() < .5) ignite(i, x, y);
    }
  }
  function windTool(cx, cy, r, vx, vy) {
    const sx = Math.abs(vx) < .3 ? 0 : vx > 0 ? 1 : -1, sy = Math.abs(vy) < .3 ? 0 : vy > 0 ? 1 : -1;
    if (!sx && !sy) return;
    bump();
    const rr = r * r + r * .8 + .3, mag = Math.min(3, Math.ceil(Math.hypot(vx, vy)));
    const ys = sy > 0 ? [cy + r, cy - r, -1] : [cy - r, cy + r, 1], xs = sx > 0 ? [cx + r, cx - r, -1] : [cx - r, cx + r, 1];
    for (let y = ys[0]; y !== ys[1] + ys[2]; y += ys[2]) {
      if (y < 0 || y >= H) continue;
      for (let x = xs[0]; x !== xs[1] + xs[2]; x += xs[2]) {
        if (x < 0 || x >= W) continue;
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > rr) continue;
        let i = y * W + x, tp = T[i];
        if (!tp || ST[i] === fr || KIND[tp] === SOL) continue;
        const steps = KIND[tp] === GAS ? mag + 1 : KIND[tp] === LIQ ? mag : 1;
        let px = x, py = y;
        for (let s = 0; s < steps; s++) {
          const nx = px + sx, ny = py + sy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) break;
          const j = ny * W + nx;
          if (T[j] !== 0) break;
          swap(i, j); i = j; px = nx; py = ny;
        }
      }
    }
  }

  function cellInfo(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return null;
    const i = y * W + x, tp = T[i];
    return { x, y, type: tp, name: tp ? D.names[tp] : 'Пустота', formula: tp ? D.formulas[tp] : '', temp: TP[i], burning: BN[i] > 0, life: LF[i], aux: AX[i] };
  }
  function typeAt(x, y) { return (x < 0 || x >= W || y < 0 || y >= H) ? 0 : T[y * W + x]; }

  function stats() { let n = 0; for (let i = 0; i < SZ; i++) if (T[i]) n++; return n; }
  function clearAll() { T.fill(0); V.fill(0); LF.fill(0); AX.fill(0); BN.fill(0); TP.fill(amb); }

  /* ---------- рендер ---------- */
  const HEATLUT = new Uint32Array(256);
  (function () {
    const stops = [[-100, 30, 40, 150], [0, 30, 120, 220], [22, 30, 170, 190], [120, 60, 200, 90], [400, 235, 215, 50], [800, 240, 60, 30], [1600, 255, 245, 235]];
    for (let n = 0; n < 256; n++) {
      const t = n / 255 * 1700 - 100;
      let a = stops[0], b = stops[stops.length - 1];
      for (let k = 0; k < stops.length - 1; k++) if (t >= stops[k][0] && t <= stops[k + 1][0]) { a = stops[k]; b = stops[k + 1]; break; }
      const f = b[0] === a[0] ? 0 : Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
      const r = a[1] + (b[1] - a[1]) * f | 0, g = a[2] + (b[2] - a[2]) * f | 0, bl = a[3] + (b[3] - a[3]) * f | 0;
      HEATLUT[n] = (255 << 24) | (bl << 16) | (g << 8) | r;
    }
  })();
  const HEAT_EMPTY = (255 << 24) | (26 << 16) | (15 << 8) | 11;
  const SPARK_COL = [[255, 70, 70], [255, 200, 70], [90, 255, 120], [80, 220, 255], [190, 120, 255], [255, 255, 255], [255, 110, 200], [255, 150, 50]];
  const cl = (v) => v < 0 ? 0 : v > 255 ? 255 : v | 0;

  function render(px, gpx, mode, glowOn) {
    const heatView = mode === 1;
    for (let i = 0; i < SZ; i++) {
      const tp = T[i];
      if (tp === 0) { px[i] = heatView ? HEAT_EMPTY : 0; if (glowOn) gpx[i] = 0; continue; }
      if (heatView) {
        let h = ((TP[i] + 100) * .15) | 0; h = h < 0 ? 0 : h > 255 ? 255 : h;
        px[i] = HEATLUT[h]; if (glowOn) gpx[i] = 0; continue;
      }
      let r = CR[tp], g = CG[tp], b = CB[tp], a = CA[tp];
      const va = CVAR[tp];
      if (va) { const dv = ((V[i] - 128) * va) >> 7; r += dv; g += dv; b += dv; }
      const fl = FLG[tp];
      let gr = GLR[tp], gg = GLG[tp], gb = GLB[tp], ga = GLA[tp];
      if (fl & F_FIRE) {
        const l0 = LIFE0[tp] || 1; let lr = LF[i] / l0; lr = lr > 1 ? 1 : lr < 0 ? 0 : lr;
        const w = lr * lr * .55; r += (255 - r) * w; g += (255 - g) * w; b += (255 - b) * w;
        const br = .55 + .45 * lr; r *= br; g *= br; b *= br;
        a = (90 + 165 * lr) | 0; ga *= (.4 + .6 * lr);
      } else {
        if (tp === I_SPARKLE) {
          const c = SPARK_COL[(AX[i] >> 4) & 7], lr = Math.min(1, LF[i] / 40);
          r = c[0] * lr; g = c[1] * lr; b = c[2] * lr; a = 255; gr = c[0]; gg = c[1]; gb = c[2]; ga = .7 * lr;
        } else if (fl & F_MORTAL) {
          const lr = Math.min(1, LF[i] / (LIFE0[tp] || 1));
          a = (a * (.25 + .75 * lr)) | 0;
        }
        if (tp === I_LAVA) {
          const f = Math.max(0, Math.min(1, (TP[i] - 450) / 800));
          r = 90 + (r - 90) * f; g = 28 + (g - 28) * f; b = 20 + (b - 20) * f; ga *= f;
        }
        if (BN[i] > 0) {
          const fk = ((V[i] * 7 + fr * 13) & 63) / 63;
          r = r * .45 + 255 * .55 * (.75 + .25 * fk); g = g * .45 + (110 + 90 * fk) * .55; b = b * .45 + 30 * .55;
          if (KIND[tp] === GAS) a = 230;
          if (ga < .5) { gr = 255; gg = 130; gb = 30; ga = .5; }
        }
        if (tp === I_CLONE && AX[i]) { const o = AX[i]; r = (r + CR[o]) >> 1; g = (g + CG[o]) >> 1; b = (b + CB[o]) >> 1; }
        const ax = AX[i];
        if ((fl & F_COND) && ax > 0 && ax <= CHG_MAX) {
          const w = ax === 1 ? 1 : ax === 2 ? .65 : ax === 3 ? .35 : .15;
          if (fl & F_NEON) { r += (255 - r) * w; g += (140 - g) * w; b += (70 - b) * w; a = (a + (255 - a) * w) | 0; gr = 255; gg = 120; gb = 50; ga = .9 * w; }
          else { r += (255 - r) * w; g += (250 - g) * w; b += (160 - b) * w; if (ga < .6 * w) { gr = 255; gg = 240; gb = 140; ga = .6 * w; } }
        }
        if ((fl & F_LAMP) && LF[i] > 0) { r = 255; g = 238; b = 150; gr = 255; gg = 225; gb = 120; ga = .9; }
        if (!(fl & F_NOHOT)) {
          const t = TP[i];
          if (t > 450) {
            let f = (t - 450) / 900; f = f > 1 ? 1 : f;
            r += (255 - r) * f; g += (90 + 130 * f * f - g) * f; b += (20 + 110 * f * f * f - b) * f;
            if (f > .35 && ga < f * .6) { gr = 255; gg = 120; gb = 40; ga = f * .6; }
          }
        }
      }
      px[i] = (cl(a) << 24) | (cl(b) << 16) | (cl(g) << 8) | cl(r);
      if (glowOn) gpx[i] = ga > .01 ? (cl(ga * 255) << 24) | (gb << 16) | (gg << 8) | gr : 0;
    }
  }

  /* ---------- сохранение ---------- */
  function rle(arr) {
    const out = []; const n = arr.length; let i = 0;
    while (i < n) { const v = arr[i]; let c = 1; while (i + c < n && c < 65535 && arr[i + c] === v) c++; out.push(c, v); i += c; }
    return out;
  }
  function unrle(data, from, len, dst) {
    let p = 0, k = from;
    while (p < dst.length && k < from + len) { const c = data[k], v = data[k + 1]; dst.fill(v, p, p + c); p += c; k += 2; }
  }
  function serialize() {
    const q = new Uint16Array(SZ), q2 = new Uint16Array(SZ);
    const parts = [];
    parts.push(rle(T));
    q.set(V); parts.push(rle(q));
    for (let i = 0; i < SZ; i++) { const t = Math.round(TP[i]); q[i] = (t < -30000 ? -30000 : t > 30000 ? 30000 : t) + 32768; }
    parts.push(rle(q));
    for (let i = 0; i < SZ; i++) q2[i] = LF[i] + 32768;
    parts.push(rle(q2));
    parts.push(rle(AX));
    q.set(BN); parts.push(rle(q));
    const head = [W, H, Math.round(amb) + 1000, parts.length];
    let total = head.length; parts.forEach(p => total += 2 + p.length);
    const out = new Uint16Array(total); let o = 0;
    head.forEach(v => out[o++] = v);
    parts.forEach(p => { out[o++] = p.length & 0xffff; out[o++] = p.length >>> 16; for (let k = 0; k < p.length; k++) out[o++] = p[k]; });
    const bytes = new Uint8Array(out.buffer); let s = '';
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(s);
  }
  /* keys — список названий веществ на момент сохранения (идентификаторы могут сдвинуться после обновления игры) */
  function deserialize(str, keys) {
    const bin = atob(str), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const data = new Uint16Array(bytes.buffer, 0, bytes.length >> 1);
    const sw = data[0], sh = data[1];
    if (!sw || !sh || sw * sh > 4e6) throw new Error('bad save');
    let o = 4;
    const tmp = [];
    const sz = sw * sh;
    for (let n = 0; n < data[3]; n++) {
      const len = data[o] | (data[o + 1] << 16); o += 2;
      const dst = new Uint16Array(sz); unrle(data, o, len, dst); o += len; tmp.push(dst);
    }
    const prevT = T;
    const w = W, h = H;
    // загружаем в массивы нужного размера (выравнивание по нижнему левому углу)
    const cw = Math.min(sw, w), ch = Math.min(sh, h);
    clearAll();
    for (let k = 0; k < ch; k++) {
      const si = (sh - 1 - k) * sw, di = (h - 1 - k) * w;
      for (let x = 0; x < cw; x++) {
        const s = si + x, d = di + x;
        if (tmp[0][s] >= N) continue;
        T[d] = tmp[0][s]; V[d] = tmp[1][s]; TP[d] = tmp[2][s] - 32768; LF[d] = tmp[3][s] - 32768; AX[d] = tmp[4][s]; BN[d] = tmp[5][s];
      }
    }
    if (keys && keys.length) {
      const map = new Uint16Array(keys.length + 1);
      let same = true;
      for (let k = 0; k < keys.length; k++) { map[k + 1] = ID[keys[k]] || 0; if (map[k + 1] !== k + 1) same = false; }
      if (!same || keys.length + 1 !== N) {
        for (let i = 0; i < SZ; i++) {
          const t = T[i]; if (!t) continue;
          const nt = t < map.length ? map[t] : 0;
          if (!nt) { clearCell(i); continue; }
          T[i] = nt;
        }
        for (let i = 0; i < SZ; i++) {                    // AX хранит id вещества у клонера и у пламени (остаток после горения)
          const t = T[i];
          if (t && AX[i] && (t === I_CLONE || (FLG[t] & F_FIRE))) AX[i] = AX[i] < map.length ? map[AX[i]] : 0;
        }
      }
    }
    amb = data[2] - 1000;
    void prevT;
    return { amb };
  }
  function snapshot() { return { w: W, h: H, T: T.slice(), V: V.slice(), TP: TP.slice(), LF: LF.slice(), AX: AX.slice(), BN: BN.slice() }; }
  function restore(s) {
    if (!s || s.w !== W || s.h !== H) return false;
    T.set(s.T); V.set(s.V); TP.set(s.TP); LF.set(s.LF); AX.set(s.AX); BN.set(s.BN);
    return true;
  }

  alloc(64, 64);
  G.sim = {
    resize, step, render, paint, put, setAux, heatTool, sparkTool, windTool, blast, lightning, cellInfo, typeAt, stats, clearAll, snapshot, restore, serialize, deserialize, bump,
    hooks,
    get w() { return W; }, get h() { return H; },
    get ambient() { return amb; }, set ambient(v) { amb = +v; },
    get gravity() { return gdir; }, set gravity(v) { gdir = v; },
    get edge() { return edge; }, set edge(v) { edge = v; },
    _raw() { return { T, V, TP, LF, AX, BN, W, H }; }
  };
})();
