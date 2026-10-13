/* Готовые сцены: строятся относительно размера мира, поэтому подходят любому экрану. */
(function () {
  'use strict';
  const G = globalThis.G, S = G.sim, ID = G.D.ID;

  function kit() {
    const W = S.w, H = S.h;
    const put = (x, y, k) => S.put(Math.round(x), Math.round(y), ID[k]);
    const B = (b) => H - 1 - b;                                        // строка на высоте b клеток от низа
    const R = (x0, y0, x1, y1, k, onlyEmpty) => {
      x0 = Math.round(x0); x1 = Math.round(x1); y0 = Math.round(y0); y1 = Math.round(y1);
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        if (onlyEmpty && S.typeAt(x, y)) continue;
        put(x, y, k);
      }
    };
    const clear = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) S.put(x, y, 0); };
    const ground = (k, n) => R(0, B(n - 1), W - 1, B(0), k || 'stone');
    return { W, H, put, B, R, clear, ground };
  }

  const SCENES = [
    {
      id: 'aquarium', name: 'Аквариум', sub: 'рыбки и водоросли',
      build() {
        const { W, B, R, put, ground } = kit();
        ground('stone', 3);
        const cw = Math.min(W - 10, 96), x0 = Math.round((W - cw) / 2), x1 = x0 + cw - 1, top = B(52);
        R(x0, top, x0, B(3), 'glass'); R(x1, top, x1, B(3), 'glass'); R(x0, B(3), x1, B(3), 'glass');
        R(x0 + 1, B(6), x1 - 1, B(4), 'dirt');
        R(x0 + 1, top + 5, x1 - 1, B(7), 'water');
        for (let i = 0; i < 9; i++) put(x0 + 8 + i * ((cw - 16) / 8), B(7), 'seed');
        for (let i = 0; i < 7; i++) put(x0 + 10 + ((i * 11) % (cw - 20)), top + 14 + (i * 7) % 22, 'fish');
        R(x0 + 4, B(8), x0 + 10, B(9), 'gravel');
        return 'Рыбки плавают, а семена на дне прорастают водорослями.';
      }
    },
    {
      id: 'volcano', name: 'Вулкан', sub: 'лава, пар и камень',
      build() {
        const { W, H, B, R, put, ground } = kit();
        ground('dirt', 5); R(0, B(1), W - 1, B(0), 'stone');
        const cx = Math.round(W * .56), base = Math.min(W * .4, 60), h = Math.min(H * .42, 90);
        for (let k = 0; k < h; k++) {
          const hw = base * (1 - k / h);
          R(cx - hw, B(4 + k), cx + hw, B(4 + k), 'stone');
        }
        for (let k = 1; k < h * .7; k++) {                                   // раскалённая камера внутри
          const hw = Math.max(2, base * .3 * (1 - k / (h * .85)));
          R(cx - hw, B(4 + k), cx + hw, B(4 + k), 'lava');
        }
        const topY = B(4 + Math.round(h)) + 1;                               // клонер на вершине льёт лаву по склонам
        for (let x = cx - 2; x <= cx + 2; x++) R(x, topY, x, topY + 1, 'stone');
        for (let x = cx - 2; x <= cx + 2; x++) { put(x, topY - 1, 'clone'); S.setAux(Math.round(x), Math.round(topY - 1), ID.lava); }
        R(2, B(14), Math.round(W * .2), B(5), 'water');
        R(0, B(18), 2, B(5), 'stone'); R(Math.round(W * .2), B(14), Math.round(W * .2) + 2, B(5), 'stone');
        return 'Клонер на вершине льёт лаву по склонам. Слева озеро — смотри, как лава встречает воду.';
      }
    },
    {
      id: 'lab', name: 'Химлаборатория', sub: 'реакции в стаканах',
      build() {
        const { W, B, R, put, ground } = kit();
        ground('stone', 3);
        const n = 5, gap = 4, cw = Math.max(14, Math.min(24, Math.floor((W - 10 - gap * (n - 1)) / n)));
        const total = n * cw + (n - 1) * gap, x00 = Math.round((W - total) / 2);
        const cups = [
          ['acid', 'iron'], ['water', 'sodium'], ['sulfuric', 'wood'], ['mercury', 'aluminum'], ['peroxide', 'rust']
        ];
        const ch = 22;
        cups.forEach((c, i) => {
          const x0 = x00 + i * (cw + gap), x1 = x0 + cw - 1, y0 = B(3 + ch), mid = (x0 + x1) / 2;
          R(x0, y0, x0, B(3), 'glass'); R(x1, y0, x1, B(3), 'glass'); R(x0, B(3), x1, B(3), 'glass');
          if (c[1] === 'iron' || c[1] === 'wood' || c[1] === 'aluminum') R(mid - 2, B(4), mid + 2, B(8), c[1]);   // твёрдое — на дно
          R(x0 + 1, B(3 + ch * .5), x1 - 1, B(4), c[0], true);
          if (c[1] === 'iron' || c[1] === 'wood' || c[1] === 'aluminum') R(mid - 2, B(4), mid + 2, B(8), c[1]);
          else R(mid - 2, B(4 + ch * .8), mid + 2, B(4 + ch * .8) + 2, c[1]);
        });
        put(x00 - 3, B(4), 'stone');
        return 'Слева направо: кислота + железо, вода + натрий, серная кислота + дерево, ртуть + алюминий, перекись + ржавчина.';
      }
    },
    {
      id: 'electric', name: 'Электричество', sub: 'батарея, лампы, неон',
      build() {
        const { W, B, R, put, ground } = kit();
        ground('stone', 3);
        const x0 = 8, x1 = W - 9, y = B(40);
        put(x0 - 1, y, 'battery'); R(x0, y, x1, y, 'copper');
        // лампы в цепи
        [0.3, 0.45, 0.7].forEach(f => { const x = Math.round(W * f); R(x - 2, y - 2, x + 1, y + 1, 'lamp'); });
        // ответвление к неоновой трубке
        const tx = Math.round(W * .2);
        R(tx, y, tx, B(32), 'copper'); R(tx - 3, B(31), tx + 3, B(31), 'glass'); R(tx - 3, B(31), tx - 3, B(12), 'glass'); R(tx + 3, B(31), tx + 3, B(12), 'glass'); R(tx - 3, B(12), tx + 3, B(12), 'glass');
        R(tx - 2, B(30), tx + 2, B(13), 'neon'); R(tx, B(31), tx, B(30), 'copper'); R(tx, B(12), tx, B(5), 'copper');
        R(tx - 14, B(5), tx, B(5), 'copper');
        // электролиз
        const ex = Math.round(W * .62), ew = Math.min(36, W - ex - 8);
        R(ex, B(26), ex, B(3), 'glass'); R(ex + ew, B(26), ex + ew, B(3), 'glass'); R(ex, B(3), ex + ew, B(3), 'glass');
        R(ex + 1, B(20), ex + ew - 1, B(4), 'saltwater');
        R(ex + 6, B(24), ex + 6, B(6), 'iron'); R(ex + ew - 6, B(24), ex + ew - 6, B(6), 'iron');
        R(ex + 6, y, ex + 6, B(24), 'copper'); R(ex + ew - 6, B(24), ex + ew - 6, B(26), 'copper');
        R(ex + ew - 6, B(26), x1, B(26), 'copper'); R(x1, B(26), x1, y, 'copper');
        return 'Ток бежит по меди и зажигает лампы и неон. В солёной воде идёт электролиз — пузырьки H₂ и Cl₂.';
      }
    },
    {
      id: 'boom', name: 'Склад взрывчатки', sub: 'порох, тротил, салют',
      build() {
        const { W, B, R, put, ground } = kit();
        ground('concrete', 3);
        const tx = Math.round(W * .62);
        R(tx, B(24), tx + 16, B(4), 'tnt');
        R(tx + 20, B(10), tx + 28, B(4), 'c4');
        R(8, B(4), tx - 2, B(4), 'gunpowder');
        R(tx - 14, B(5), tx - 2, B(5), 'nitro');
        R(tx - 15, B(12), tx - 15, B(5), 'glass'); R(tx - 1, B(12), tx - 1, B(5), 'glass');
        for (let i = 0; i < 4; i++) put(Math.round(W * .15) + i * 7, B(5), 'firework');
        put(8, B(5), 'fire'); put(9, B(5), 'fire');
        return 'Фитиль из пороха уже подожжён. Потом можно бахнуть молнией или бомбой!';
      }
    },
    {
      id: 'reactor', name: 'Ядерный котёл', sub: 'уран, свинец, вода',
      build() {
        const { W, B, R, put, ground } = kit();
        ground('concrete', 3);
        const cw = Math.min(W - 16, 74), x0 = Math.round((W - cw) / 2), x1 = x0 + cw - 1;
        R(x0, B(46), x0 + 3, B(3), 'concrete'); R(x1 - 3, B(46), x1, B(3), 'concrete'); R(x0, B(6), x1, B(3), 'concrete');
        R(x0 + 4, B(30), x1 - 4, B(7), 'water');
        const mid = Math.round((x0 + x1) / 2);
        R(mid - 8, B(22), mid - 8, B(7), 'concrete'); R(mid + 8, B(22), mid + 8, B(7), 'concrete');   // стакан для топлива
        R(mid - 7, B(21), mid + 7, B(7), 'uranium');
        R(mid - 14, B(26), mid - 11, B(24), 'lead'); R(mid + 11, B(26), mid + 14, B(24), 'lead');    // защитные блоки
        for (let i = 0; i < 4; i++) put(mid - 3 + i * 2, B(21), 'neutron');       // источник нейтронов в топливе
        return 'Нейтроны запускают цепную реакцию в уране — он греет воду до кипения. Свинец поглощает нейтроны.';
      }
    }
  ];

  G.scenes = SCENES;
  G.loadScene = function (id) {
    const sc = SCENES.find(s => s.id === id); if (!sc) return null;
    S.clearAll();
    return sc.build();
  };
})();
