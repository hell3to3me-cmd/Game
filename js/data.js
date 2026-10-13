/* Данные песочницы: вещества, реакции, периодическая таблица.
   Здесь нет DOM — файл можно запускать и в Node для тестов. */
(function () {
  'use strict';
  const G = (globalThis.G = globalThis.G || {});

  const KIND = { SOL: 1, POW: 2, LIQ: 3, GAS: 4 };
  const F = {
    COND: 1,     // проводит ток
    INDES: 2,    // неразрушимо (взрыв, кислота, чёрная дыра)
    ORG: 4,      // органика (плесень, вирус)
    METAL: 8,
    FIXT: 32,    // постоянная температура
    MORTAL: 64,  // живёт LF кадров
    NOHOT: 128,  // не раскаляется
    EXT: 256,    // гасит огонь
    FIRE: 512,   // пламя: поджигает соседей
    LAMP: 1024,
    NEON: 2048,
    NOMOVE: 4096 // двигается сам (особые частицы)
  };
  const FLAGMAP = { cond: F.COND, indes: F.INDES, org: F.ORG, metal: F.METAL, fixt: F.FIXT, mortal: F.MORTAL, nohot: F.NOHOT, ext: F.EXT, fire: F.FIRE, lamp: F.LAMP, neon: F.NEON, nomove: F.NOMOVE };
  G.KIND = KIND; G.F = F; G.AIR = 1.2;

  const defs = [];
  const byKey = Object.create(null);

  function rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* o: d плотность, c теплопроводность, v разброс цвета, h стойкость к взрыву, sp растекание,
     vi вязкость, sl осыпание порошка, fl воспламеняемость (шанс заражения огнём), ig t° воспламенения,
     bl длительность горения, bt t° горения, res остаток, fm цвет пламени, ex радиус взрыва при поджиге,
     ep вероятность взрыва, bto во что превращается при поджиге, hi/lo [t°, ключ], t0 начальная t°,
     life ЖЦ частицы, die/diep во что умирает, glow [r,g,b,a], a прозрачность, rad шанс излучить нейтрон,
     dec [p, ключ, газ], ext сила тушения, dbr обломки, upd, f флаги, info, z, smk шанс дыма */
  function def(key, name, formula, cat, kind, color, o) {
    o = o || {};
    if (byKey[key]) throw new Error('dup ' + key);
    const d = Object.assign({ key, name, formula, cat, kind, color: rgb(color) }, o);
    d.flags = 0;
    (o.f || '').split(/\s+/).filter(Boolean).forEach(s => {
      if (!(s in FLAGMAP)) throw new Error('flag ' + s);
      d.flags |= FLAGMAP[s];
    });
    defs.push(d);
    byKey[key] = d;
    d.id = defs.length;
    return d;
  }
  G.def = def;

  /* ===================== СТРОЙ ===================== */
  def('wall', 'Стена', 'неразр.', 'build', 1, '#4b5163', { v: 5, d: 9999, h: 1, c: .1, f: 'indes nohot', info: 'Неразрушимая стена.' });
  def('stone', 'Камень', 'CaCO₃', 'build', 1, '#80838d', { v: 16, d: 2600, c: .18, h: .5, hi: [1150, 'lava'], dbr: 'gravel', info: 'Плавится в лаву. Шипит в кислоте.' });
  def('concrete', 'Бетон', 'бетон', 'build', 1, '#a5a59e', { v: 9, d: 2400, h: .72, c: .25, hi: [1500, 'lava'], dbr: 'gravel', info: 'Прочный, но взрывчатка его крошит.' });
  def('glass', 'Стекло', 'SiO₂', 'build', 1, '#aee3f0', { v: 7, d: 2500, h: .08, c: .2, a: 215, hi: [1450, 'molten_glass'], dbr: 'sand', info: 'Хрупкое. Плавится при высокой t°.' });
  def('wood', 'Дерево', 'дерево', 'build', 1, '#8c5a2b', { v: 18, d: 600, c: .08, h: .22, fl: .25, ig: 330, bl: 200, bt: 650, res: 'ash', smk: .12, f: 'org', dbr: 'ash', info: 'Горит. Любит плесень.' });
  def('ice', 'Лёд', 'H₂O', 'build', 1, '#a7dcf3', { v: 10, d: 920, c: .4, h: .15, t0: -12, hi: [1, 'water'], dbr: 'snow', info: 'Тает при t° > 0 °C.' });
  def('diamond', 'Алмаз', 'C', ['build', 'chem'], 1, '#bff3ff', { v: 22, d: 3500, c: .9, f: 'indes nohot', z: 6, info: 'Самый стойкий материал.' });
  def('gravel', 'Щебень', 'щебень', 'powder', 2, '#8b8b90', { v: 22, d: 1800, sl: .8, c: .2 });

  /* ===================== МЕТАЛЛЫ ===================== */
  def('iron', 'Железо', 'Fe', ['metal', 'build'], 1, '#8f949e', { v: 10, d: 7870, c: .8, h: .85, hi: [1538, 'molten_iron'], f: 'cond metal', z: 26, info: 'Проводит ток. Ржавеет в солёной воде.' });
  def('copper', 'Медь', 'Cu', ['metal', 'energy'], 1, '#c8703b', { v: 10, d: 8960, c: .95, h: .85, hi: [1085, 'molten_copper'], f: 'cond metal', z: 29, info: 'Отличный провод — рисуй цепи.' });
  def('gold', 'Золото', 'Au', 'metal', 1, '#f4c430', { v: 12, d: 19300, c: .9, h: .8, hi: [1064, 'molten_gold'], f: 'cond metal', z: 79, info: 'Не боится кислот.' });
  def('aluminum', 'Алюминий', 'Al', 'metal', 1, '#c1c6ce', { v: 8, d: 2700, c: .9, h: .75, hi: [660, 'molten_aluminum'], f: 'cond metal', z: 13, info: 'Легко плавится. Растворяется в щёлочи и ртути.' });
  def('lead', 'Свинец', 'Pb', 'metal', 1, '#5e6571', { v: 8, d: 11340, c: .45, h: .7, hi: [327, 'molten_lead'], f: 'cond metal', z: 82, nab: .35, info: 'Тяжёлый, плавится при 327 °C. Поглощает нейтроны.' });
  def('magnesium', 'Магний', 'Mg', ['metal', 'chem'], 1, '#d5d9e0', { v: 6, d: 1740, c: .8, h: .7, fl: .15, ig: 650, bl: 120, bt: 2200, fm: 'fire_white', res: 'slaked_lime', f: 'cond metal', z: 12, info: 'Горит ослепительным белым пламенем.' });
  def('mercury', 'Ртуть', 'Hg', ['metal', 'liquid'], 3, '#cfd3da', { v: 7, d: 13500, c: .8, sp: 8, f: 'cond metal', z: 80, info: 'Жидкий металл. Разъедает алюминий.' });
  def('rust', 'Ржавчина', 'Fe₂O₃', 'powder', 2, '#9d4b25', { v: 22, d: 5200, sl: .8 });

  /* ===================== ПОРОШКИ ===================== */
  def('sand', 'Песок', 'SiO₂', 'powder', 2, '#e1c681', { v: 18, d: 1600, c: .2, hi: [1700, 'molten_glass'], info: 'Плавится в стекло. Молния даёт фульгурит.' });
  def('dirt', 'Земля', 'почва', ['powder', 'life'], 2, '#6d4a30', { v: 16, d: 1300, sl: .6, f: 'org', info: 'С водой превращается в грязь.' });
  def('salt', 'Соль', 'NaCl', 'powder', 2, '#f1f1f4', { v: 8, d: 2160, c: .2, info: 'Растворяется в воде.' });
  def('coal', 'Уголь', 'C', 'powder', 2, '#2b2b30', { v: 9, d: 1400, c: .2, fl: .08, ig: 440, bl: 250, bt: 850, res: 'ash', smk: .15, z: 6, info: 'Горит долго и жарко.' });
  def('ash', 'Пепел', 'пепел', 'powder', 2, '#929296', { v: 16, d: 600, sl: .8, c: .1 });
  def('snow', 'Снег', 'H₂O', 'powder', 2, '#f2f7ff', { v: 6, d: 100, sl: .35, c: .1, t0: -8, hi: [1, 'water'], info: 'Тает.' });
  def('dry_ice', 'Сухой лёд', 'CO₂', 'powder', 2, '#dfe9ef', { v: 8, d: 1560, c: .3, t0: -78, hi: [-72, 'co2'], info: 'Возгоняется в углекислый газ, сильно морозит.' });
  def('sulfur', 'Сера', 'S', ['powder', 'chem'], 2, '#e8d948', { v: 10, d: 2000, fl: .08, ig: 245, bl: 110, bt: 600, fm: 'fire_blue', res: 'smoke', smk: .5, z: 16, info: 'Горит голубым пламенем.' });
  def('quicklime', 'Негашёная известь', 'CaO', 'chem', 2, '#ece8df', { v: 8, d: 3300, info: 'С водой сильно нагревается.' });
  def('slaked_lime', 'Гашёная известь', 'Ca(OH)₂', 'chem', 2, '#dcd9d2', { v: 8, d: 2200 });
  def('phosphorus', 'Фосфор', 'P', ['chem', 'powder'], 2, '#ebe2b2', { v: 8, d: 1820, fl: .5, ig: 34, bl: 130, bt: 900, fm: 'fire_yellow', res: 'smoke', smk: .8, z: 15, info: 'Белый фосфор самовоспламеняется на воздухе при ~34 °C.' });

  /* щелочные и щёлочноземельные металлы: порошки, чтобы падали в воду */
  def('lithium', 'Литий', 'Li', 'chem', 2, '#c9ccd3', { v: 8, d: 534, sl: .9, c: .5, f: 'cond metal', z: 3, info: 'Легче воды. Реагирует с водой, пламя красное.' });
  def('sodium', 'Натрий', 'Na', 'chem', 2, '#d0d4dd', { v: 8, d: 968, sl: .9, c: .5, f: 'cond metal', z: 11, info: 'С водой — водород и огонь. С хлором — соль.' });
  def('potassium', 'Калий', 'K', 'chem', 2, '#b8bed2', { v: 8, d: 862, sl: .9, c: .5, f: 'cond metal', z: 19, info: 'Бурнее натрия, пламя сиреневое.' });
  def('rubidium', 'Рубидий', 'Rb', 'chem', 2, '#a7a6c8', { v: 8, d: 1532, sl: .9, c: .5, f: 'cond metal', z: 37, info: 'Ещё активнее калия.' });
  def('cesium', 'Цезий', 'Cs', 'chem', 2, '#e3cf9a', { v: 8, d: 1930, sl: .9, c: .5, f: 'cond metal', z: 55, info: 'С водой взрывается.' });
  def('calcium', 'Кальций', 'Ca', 'chem', 2, '#d8d8cf', { v: 8, d: 1550, sl: .9, c: .5, f: 'cond metal', z: 20, info: 'С водой спокойно выделяет водород.' });

  /* радиоактивное */
  def('uranium', 'Уран', 'U', 'energy', 2, '#62c84a', { v: 14, d: 19000, sl: .9, c: .3, glow: [90, 255, 70, .3], rad: .0007, nfis: .4, upd: 'fissile', z: 92, info: 'Излучает нейтроны. В куче — цепная реакция.' });
  def('plutonium', 'Плутоний', 'Pu', 'energy', 2, '#8fc5ff', { v: 10, d: 19800, sl: .9, c: .3, glow: [120, 170, 255, .4], rad: .0025, nfis: .8, upd: 'fissile', z: 94, info: 'Критическая масса — ядерный взрыв.' });
  def('waste', 'Радиоотходы', 'отходы', 'energy', 2, '#7d9a3d', { v: 14, d: 3000, sl: .8, glow: [120, 220, 80, .12], rad: .0004 });

  /* ===================== ЖИДКОСТИ ===================== */
  def('water', 'Вода', 'H₂O', ['liquid', 'life'], 3, '#3b87e8', { v: 10, d: 1000, c: .35, sp: 6, a: 235, lo: [-1, 'ice'], hi: [101, 'steam'], f: 'ext', ext: .35, info: 'Кипит при 100 °C, замерзает при 0 °C.' });
  def('saltwater', 'Солёная вода', 'NaCl·H₂O', 'liquid', 3, '#4c9bdc', { v: 10, d: 1030, c: .35, sp: 6, a: 235, lo: [-9, 'ice'], hi: [104, 'steam'], f: 'ext cond', ext: .3, info: 'Проводит ток. Электролиз даёт H₂ и Cl₂.' });
  def('oil', 'Нефть', 'CₓHᵧ', 'liquid', 3, '#4a3415', { v: 10, d: 880, vi: .35, sp: 4, fl: .035, ig: 290, bl: 255, bt: 750, smk: .3, info: 'Легче воды — плавает и горит.' });
  def('gasoline', 'Бензин', 'C₈H₁₈', 'liquid', 3, '#d9c45c', { v: 8, d: 740, sp: 7, fl: .22, ig: 225, bl: 70, bt: 850, smk: .1, a: 230, info: 'Очень горюч.' });
  def('alcohol', 'Спирт', 'C₂H₅OH', 'liquid', 3, '#d8ecff', { v: 5, d: 790, sp: 7, fl: .1, ig: 360, bl: 45, bt: 600, fm: 'fire_blue', a: 215, info: 'Горит голубым. Дезинфицирует.' });
  def('lava', 'Лава', 'расплав', 'liquid', 3, '#ff5a12', { v: 30, d: 2700, vi: .65, sp: 3, c: .08, t0: 1300, lo: [450, 'stone'], glow: [255, 90, 20, .6], f: 'nohot', info: 'Остывая, превращается в камень.' });
  def('ln2', 'Жидкий азот', 'N₂', 'liquid', 3, '#c4ebff', { v: 6, d: 808, sp: 7, c: .35, t0: -196, hi: [-190, 'nitrogen'], a: 225, info: 'Сильно морозит и испаряется.' });
  def('mud', 'Грязь', 'грязь', 'liquid', 3, '#4e3823', { v: 12, d: 1500, vi: .8, sp: 2, hi: [90, 'dirt'], f: 'org' });
  def('slime', 'Слизь', 'слизь', 'liquid', 3, '#72e24f', { v: 14, d: 1100, vi: .85, sp: 2, f: 'org' });
  def('blood', 'Кровь', 'кровь', 'liquid', 3, '#a1131d', { v: 10, d: 1060, vi: .3, sp: 4, f: 'org' });

  /* ===================== ГАЗЫ ===================== */
  def('steam', 'Пар', 'H₂O', 'gas', 4, '#e6edf8', { d: .6, c: .1, a: 150, lo: [70, 'water'], info: 'Конденсируется в воду.' });
  def('smoke', 'Дым', 'сажа', 'gas', 4, '#5b5b64', { d: 1.0, a: 170, life: 240, f: 'mortal', gb: .22 });
  def('hydrogen', 'Водород', 'H₂', 'gas', 4, '#cfe8ff', { d: .085, c: .3, a: 110, fl: .8, ig: 480, bl: 5, bt: 1200, fm: 'fire_blue', res: 'steam', ex: 3, ep: .22, z: 1, info: 'Легчайший газ, взрывоопасен.' });
  def('helium', 'Гелий', 'He', 'gas', 4, '#ffd0ee', { d: .17, c: .3, a: 110, z: 2, info: 'Инертный, летит вверх.' });
  def('oxygen', 'Кислород', 'O₂', 'gas', 4, '#9fd8ff', { d: 1.33, a: 100, z: 8, info: 'Поддерживает горение.' });
  def('nitrogen', 'Азот', 'N₂', 'gas', 4, '#cad6e6', { d: 1.16, a: 100, z: 7, f: 'ext', ext: .15, info: 'Тушит огонь.' });
  def('co2', 'Углекислый газ', 'CO₂', 'gas', 4, '#aeb9c4', { d: 1.84, a: 130, f: 'ext', ext: .35, info: 'Тяжелее воздуха, тушит огонь.' });
  def('methane', 'Метан', 'CH₄', 'gas', 4, '#bfe7a8', { d: .66, a: 110, fl: .6, ig: 540, bl: 7, bt: 1100, fm: 'fire_blue', res: 'co2', ex: 2, ep: .1, info: 'Горючий газ.' });
  def('chlorine', 'Хлор', 'Cl₂', ['gas', 'chem'], 4, '#c6e54b', { d: 2.9, a: 150, z: 17, info: 'Ядовит: убивает живое, реагирует с металлами.' });
  def('fluorine', 'Фтор', 'F₂', ['gas', 'chem'], 4, '#eaf08c', { d: 1.55, a: 150, z: 9, info: 'Самый активный: поджигает почти всё.' });
  def('neon', 'Неон', 'Ne', ['gas', 'energy'], 4, '#ff7b3d', { d: .84, a: 90, f: 'cond neon', z: 10, info: 'Светится, когда через него идёт ток.' });

  /* ===================== ХИМИЯ ===================== */
  def('acid', 'Соляная кислота', 'HCl', 'chem', 3, '#b6ef3d', { v: 8, d: 1180, sp: 5, a: 230, info: 'Разъедает металлы, камень, органику.' });
  def('sulfuric', 'Серная кислота', 'H₂SO₄', 'chem', 3, '#dede7e', { v: 8, d: 1830, vi: .3, sp: 4, a: 235, info: 'Обугливает дерево и растения.' });
  def('base', 'Щёлочь', 'NaOH', 'chem', 3, '#c8a2ff', { v: 8, d: 1100, sp: 5, a: 230, info: 'Нейтрализует кислоту, растворяет алюминий.' });
  def('peroxide', 'Перекись', 'H₂O₂', 'chem', 3, '#d8f8ff', { v: 6, d: 1450, sp: 5, a: 220, dec: [.0015, 'water', 'oxygen'], info: 'Разлагается на воду и кислород.' });

  /* ===================== ВЗРЫВЧАТКА ===================== */
  def('tnt', 'Тротил', 'C₇H₅N₃O₆', 'boom', 1, '#c2392b', { v: 10, d: 1650, fl: .3, ig: 330, bl: 1, ex: 9, h: .2, info: 'Взрывается от огня. Цепная реакция.' });
  def('c4', 'C4', 'C4', 'boom', 1, '#dbdbc8', { v: 6, d: 1700, fl: .12, ig: 420, bl: 1, ex: 15, h: .3, info: 'Мощный заряд.' });
  def('gunpowder', 'Порох', 'порох', 'boom', 2, '#37373d', { v: 8, d: 1700, sl: .9, fl: .9, ig: 270, bl: 3, bt: 900, ex: 2, ep: .7, info: 'Быстро сгорает.' });
  def('flour', 'Мука', 'мука', 'boom', 2, '#f0e7d3', { v: 8, d: 600, sl: .5, fl: .35, ig: 380, bl: 8, bt: 800, ex: 2, ep: .4, f: 'org', info: 'Мучная пыль взрывоопасна.' });
  def('thermite', 'Термит', 'Fe₂O₃+Al', 'boom', 2, '#9b5639', { v: 16, d: 2500, sl: .8, ig: 900, bl: 1, bt: 2600, bto: 'molten_iron', info: 'Загорается от магния, лавы или молнии. 2500 °C!' });
  def('nitro', 'Нитроглицерин', 'C₃H₅N₃O₉', 'boom', 3, '#f2e37b', { v: 8, d: 1600, sp: 4, vi: .2, fl: .1, ig: 160, bl: 1, ex: 5, a: 235, info: 'Взрывается от тепла.' });
  def('napalm', 'Напалм', 'напалм', 'boom', 3, '#ff8c2e', { v: 12, d: 900, vi: .8, sp: 2, fl: .35, ig: 150, bl: 255, bt: 950, smk: .3, info: 'Липкое горящее топливо.' });
  def('firework', 'Фейерверк', 'салют', 'boom', 2, '#e03a8c', { v: 28, d: 1200, sl: .9, fl: .5, ig: 160, bl: 1, bto: 'rocket', info: 'Поджги — взлетит и рассыпется салютом.' });

  /* ===================== ЭНЕРГИЯ ===================== */
  const fl = (k, name, c, extra) => def(k, name, 'пламя', k === 'fire' ? 'energy' : null, 4, c, Object.assign({ d: .3, c: .7, a: 235, life: 26, die: 'smoke', diep: .1, t0: 650, bt: 650, glow: [255, 130, 30, .55], f: 'mortal fire nohot', gb: .3 }, extra || {}));
  fl('fire', 'Огонь', '#ff7a1a');
  fl('fire_blue', 'Голубой огонь', '#5aa9ff', { glow: [90, 160, 255, .55] });
  fl('fire_purple', 'Сиреневый огонь', '#b47dff', { glow: [170, 110, 255, .55] });
  fl('fire_red', 'Красный огонь', '#ff3a3a', { glow: [255, 50, 50, .55] });
  fl('fire_green', 'Зелёный огонь', '#52e07c', { glow: [70, 230, 120, .55] });
  fl('fire_white', 'Белый огонь', '#fff3de', { glow: [255, 245, 220, .7], t0: 1800, bt: 1800 });
  fl('fire_yellow', 'Жёлтый огонь', '#ffd23a', { glow: [255, 210, 60, .55] });
  def('plasma', 'Плазма', 'плазма', 'energy', 4, '#bcc8ff', { d: .15, a: 240, life: 14, die: 'fire', diep: .35, t0: 3500, bt: 3500, glow: [170, 190, 255, .8], f: 'mortal fire nohot', gb: .7, info: 'Раскалённый ионизированный газ.' });
  def('bolt', 'Молния', 'разряд', null, 1, '#f2f6ff', { c: .7, life: 6, t0: 4500, bt: 4500, glow: [200, 215, 255, .9], f: 'mortal fire nohot nomove' });
  def('battery', 'Батарея', 'источник', 'energy', 1, '#3dae5b', { v: 6, d: 5000, c: .4, upd: 'battery', f: 'nohot', info: 'Подаёт импульсы в провода.' });
  def('lamp', 'Лампа', 'лампа', 'energy', 1, '#d9d38e', { v: 6, d: 2500, c: .3, upd: 'lamp', f: 'cond lamp nohot', glow: [255, 235, 140, 0], info: 'Загорается, когда по ней идёт ток.' });
  def('heater', 'Нагреватель', '+600 °C', 'energy', 1, '#e0502f', { v: 8, d: 5000, c: 1, t0: 600, f: 'fixt nohot', glow: [255, 80, 30, .25], info: 'Держит +600 °C.' });
  def('cooler', 'Холодильник', '−120 °C', 'energy', 1, '#3fa7e9', { v: 8, d: 5000, c: 1, t0: -120, f: 'fixt nohot', info: 'Держит −120 °C.' });
  def('neutron', 'Нейтрон', 'n', 'energy', 1, '#ffffff', { life: 80, upd: 'neutron', f: 'nohot nomove', glow: [255, 255, 255, .7], info: 'Летит сквозь вещество и расщепляет уран.' });
  def('clone', 'Клонер', 'копия', 'energy', 1, '#e3a53b', { v: 8, d: 5000, upd: 'clone', f: 'indes nohot', info: 'Копирует вещество рядом с собой.' });
  def('void', 'Чёрная дыра', 'пустота', 'energy', 1, '#1c0a30', { v: 6, d: 5000, upd: 'void', f: 'indes nohot', glow: [120, 40, 255, .3], info: 'Стирает всё вокруг.' });
  def('rocket', 'Ракета', 'ракета', null, 1, '#ffe9a0', { life: 40, upd: 'rocket', f: 'nohot nomove', glow: [255, 200, 90, .5] });
  def('sparkle', 'Искра салюта', 'искра', null, 4, '#ffffff', { life: 70, upd: 'sparkle', f: 'mortal nohot nomove', glow: [255, 255, 255, .6], d: 1.1 });

  /* расплавы */
  const mol = (k, name, c, d, lo, gl) => def(k, name, 'расплав', null, 3, c, { v: 18, d, vi: .82, sp: 2, c: .4, lo, glow: gl, f: 'cond' });
  mol('molten_glass', 'Расплавленное стекло', '#ffb347', 2400, [1100, 'glass'], [255, 160, 60, .5]);
  mol('molten_iron', 'Расплавленное железо', '#ff6a1c', 6980, [1400, 'iron'], [255, 110, 30, .6]);
  mol('molten_copper', 'Расплавленная медь', '#ff7f2a', 8000, [1000, 'copper'], [255, 120, 40, .6]);
  mol('molten_gold', 'Расплавленное золото', '#ffc93c', 17000, [1000, 'gold'], [255, 200, 60, .6]);
  mol('molten_aluminum', 'Расплавленный алюминий', '#ff9a3a', 2400, [600, 'aluminum'], [255, 150, 60, .5]);
  mol('molten_lead', 'Расплавленный свинец', '#b9c3da', 10700, [300, 'lead'], [150, 170, 220, .3]);

  /* ===================== ЖИЗНЬ ===================== */
  def('seed', 'Семя', 'семя', 'life', 2, '#a0822f', { v: 16, d: 700, sl: .9, f: 'org', fl: .05, ig: 260, bl: 40, res: 'ash', upd: 'seed', info: 'Посади в землю у воды.' });
  def('plant', 'Растение', 'флора', 'life', 1, '#3fae3a', { v: 24, d: 800, c: .1, f: 'org', fl: .2, ig: 260, bl: 100, bt: 650, res: 'ash', upd: 'plant', life: 24, smk: .2, info: 'Пьёт воду и растёт вверх.' });
  def('flower', 'Цветок', 'цветок', 'life', 1, '#e8569b', { v: 60, d: 800, c: .1, f: 'org', fl: .05, ig: 260, bl: 60, res: 'ash' });
  def('grass', 'Трава', 'трава', 'life', 1, '#52c040', { v: 16, d: 800, c: .1, f: 'org', fl: .15, ig: 250, bl: 60, res: 'ash', upd: 'grass', info: 'Медленно зарастает землю.' });
  def('mold', 'Плесень', 'гриб', 'life', 1, '#6f9477', { v: 22, d: 800, c: .1, f: 'org', fl: .03, ig: 260, bl: 60, res: 'ash', upd: 'mold', info: 'Растёт на органике. Боится спирта и жара.' });
  def('virus', 'Вирус', 'вирус', 'life', 3, '#b45bff', { v: 16, d: 1000, vi: .5, sp: 3, upd: 'virus', glow: [180, 90, 255, .15], info: 'Заражает органику и воду. Боится жара, спирта, хлора.' });
  def('fish', 'Рыбка', 'рыбка', 'life', 1, '#ff9a3c', { v: 24, d: 1000, life: 300, upd: 'fish', f: 'org nomove', info: 'Плавает в воде.' });

  /* ===================== РЕАКЦИИ ===================== */
  const GRP = {
    fire: ['fire', 'fire_blue', 'fire_purple', 'fire_red', 'fire_green', 'fire_white', 'fire_yellow'],
    water: ['water', 'saltwater'],
    living: ['plant', 'flower', 'grass', 'seed', 'mold', 'fish', 'virus', 'slime', 'blood'],
    acidmetals: [],
    fluorine_targets: ['water', 'saltwater', 'wood', 'plant', 'grass', 'flower', 'seed', 'coal', 'sand', 'glass', 'stone', 'concrete', 'salt', 'ash', 'dirt', 'ice', 'snow', 'oil', 'gasoline', 'alcohol', 'iron', 'aluminum', 'magnesium', 'sulfur', 'phosphorus', 'lead', 'rust', 'slime', 'blood', 'mud', 'gravel', 'flour', 'gunpowder', 'virus', 'mold', 'fish']
  };
  const rx = [];
  const U = undefined;
  function R(a, b, p, oa, ob, dT, o) { rx.push({ a, b, p, oa, ob, dT: dT || 0, o: o || {} }); }

  /* тушение */
  R('@fire', '@water', .35, 'steam', U);
  R('plasma', '@water', .5, 'steam', 'steam');
  R('@fire', ['co2', 'nitrogen'], .22, null, U);
  R('@fire', 'ln2', .6, null, 'nitrogen');
  /* вода */
  R('salt', 'water', .07, null, 'saltwater');
  R('dirt', 'water', .012, 'mud', null);
  R('quicklime', '@water', .15, 'slaked_lime', 'steam', 70);
  R('sulfuric', '@water', .2, 'water', 'steam', 110);
  R('iron', 'water', .0004, 'rust', U);
  R('iron', 'saltwater', .004, 'rust', U);
  R('magnesium', '@water', .002, 'slaked_lime', 'hydrogen', 20);
  /* щелочные металлы с водой */
  R('lithium', '@water', .10, { t: 'fire_red', aux: 'base' }, 'hydrogen', 40);
  R('sodium', '@water', .25, { t: 'fire_yellow', aux: 'base' }, 'hydrogen', 80);
  R('potassium', '@water', .5, { t: 'fire_purple', aux: 'base' }, 'hydrogen', 160, { blast: 2 });
  R('rubidium', '@water', .6, { t: 'fire_purple', aux: 'base' }, 'hydrogen', 220, { blast: 3 });
  R('cesium', '@water', .8, { t: 'fire_blue', aux: 'base' }, 'hydrogen', 300, { blast: 5 });
  R('calcium', '@water', .05, 'slaked_lime', 'hydrogen', 30);
  /* хлор */
  R('sodium', 'chlorine', .5, { t: 'fire_yellow', aux: 'salt' }, null, 200);
  R('potassium', 'chlorine', .5, { t: 'fire_purple', aux: 'salt' }, null, 200);
  R('lithium', 'chlorine', .5, { t: 'fire_red', aux: 'salt' }, null, 200);
  R('hydrogen', 'chlorine', .03, { t: 'fire_blue', aux: 'acid' }, null, 100);
  R('phosphorus', 'chlorine', .25, { t: 'fire_white', aux: 'smoke' }, null, 200);
  R('chlorine', 'water', .01, null, 'acid');
  R('chlorine', ['plant', 'flower', 'grass', 'seed', 'mold', 'fish', 'virus', 'slime', 'blood'], .1, null, 'ash');
  R('phosphorus', 'oxygen', .05, { t: 'fire_white', aux: 'smoke' }, U, 100);
  /* фтор */
  R('fluorine', '@fluorine_targets', .22, 'fire_white', 'fire_white', 400);
  /* кислоты и щёлочи */
  R('acid', 'base', .5, 'saltwater', 'saltwater', 40);
  R('sulfuric', 'base', .5, 'saltwater', 'saltwater', 60);
  R('acid', ['iron', 'el_Zn'], .03, 'hydrogen', null, 20);
  R('acid', 'aluminum', .05, 'hydrogen', null, 20);
  R('acid', 'magnesium', .1, 'hydrogen', null, 30);
  R('acid', 'lead', .005, 'hydrogen', null, 10);
  R('acid', ['sodium', 'potassium', 'lithium', 'calcium'], .35, 'hydrogen', null, 100);
  R('acid', 'stone', .015, 'co2', null);
  R('acid', 'concrete', .012, 'co2', null);
  R('acid', 'rust', .2, 'saltwater', null);
  R('acid', ['quicklime', 'slaked_lime'], .25, 'saltwater', null, 30);
  R('acid', ['plant', 'flower', 'grass', 'seed', 'mold', 'fish', 'virus', 'slime', 'blood'], .05, U, null);
  R('acid', 'wood', .01, U, null);
  R('sulfuric', ['iron', 'aluminum', 'magnesium'], .03, 'hydrogen', null, 30);
  R('sulfuric', 'stone', .02, 'co2', null);
  R('sulfuric', ['wood', 'plant', 'grass', 'flower', 'seed', 'flour'], .06, 'water', 'coal', 30);
  R('base', 'aluminum', .04, 'hydrogen', null, 20);
  R('base', ['plant', 'flower', 'grass', 'mold', 'virus', 'slime'], .02, U, null);
  R('mercury', 'aluminum', .03, U, 'ash');
  R('peroxide', 'rust', .12, 'oxygen', U, 40);
  R('alcohol', ['virus', 'mold'], .25, U, null);

  /* ===================== ПЕРИОДИЧЕСКАЯ ТАБЛИЦА ===================== */
  const SYM = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
  const NAME = 'Водород|Гелий|Литий|Бериллий|Бор|Углерод|Азот|Кислород|Фтор|Неон|Натрий|Магний|Алюминий|Кремний|Фосфор|Сера|Хлор|Аргон|Калий|Кальций|Скандий|Титан|Ванадий|Хром|Марганец|Железо|Кобальт|Никель|Медь|Цинк|Галлий|Германий|Мышьяк|Селен|Бром|Криптон|Рубидий|Стронций|Иттрий|Цирконий|Ниобий|Молибден|Технеций|Рутений|Родий|Палладий|Серебро|Кадмий|Индий|Олово|Сурьма|Теллур|Иод|Ксенон|Цезий|Барий|Лантан|Церий|Празеодим|Неодим|Прометий|Самарий|Европий|Гадолиний|Тербий|Диспрозий|Гольмий|Эрбий|Тулий|Иттербий|Лютеций|Гафний|Тантал|Вольфрам|Рений|Осмий|Иридий|Платина|Золото|Ртуть|Таллий|Свинец|Висмут|Полоний|Астат|Радон|Франций|Радий|Актиний|Торий|Протактиний|Уран|Нептуний|Плутоний|Америций|Кюрий|Берклий|Калифорний|Эйнштейний|Фермий|Менделевий|Нобелий|Лоуренсий|Резерфордий|Дубний|Сиборгий|Борий|Хассий|Мейтнерий|Дармштадтий|Рентгений|Коперниций|Нихоний|Флеровий|Московий|Ливерморий|Теннессин|Оганесон'.split('|');
  const set = (a) => new Set(a);
  const CATS = [
    ['alkali', 'Щелочной металл', '#c9b8ee', set([3, 11, 19, 37, 55, 87])],
    ['alkaline', 'Щёлочноземельный металл', '#eccb7c', set([4, 12, 20, 38, 56, 88])],
    ['metalloid', 'Полуметалл', '#8fc2a4', set([5, 14, 32, 33, 51, 52])],
    ['nonmetal', 'Неметалл', '#8fd3a0', set([1, 6, 7, 8, 15, 16, 34])],
    ['halogen', 'Галоген', '#e0df72', set([9, 17, 35, 53, 85, 117])],
    ['noble', 'Благородный газ', '#d6a6ee', set([2, 10, 18, 36, 54, 86, 118])],
    ['post', 'Постпереходный металл', '#a2b0ac', set([13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116])],
    ['transition', 'Переходный металл', '#9fb7d8', set([].concat(rng(21, 30), rng(39, 48), rng(72, 80), rng(104, 112)))],
    ['lanthanide', 'Лантаноид', '#eaa5bc', set(rng(57, 71))],
    ['actinide', 'Актиноид', '#e28d80', set(rng(89, 103))]
  ];
  function rng(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }
  const GAS_Z = set([1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86]);
  const LIQ_Z = set([35, 80]);
  const POW_Z = set([5, 14, 33, 34, 52, 53, 85]);
  function catOf(z) {
    for (const c of CATS) if (c[3].has(z)) return c;
    return ['super', 'Сверхтяжёлый (синтетический)', '#a0a0b4', null];
  }
  function isRadio(z) { return z === 43 || z === 61 || z >= 84; }

  /* положение в таблице: [ряд, колонка]; строки 9 и 10 — лантаноиды и актиноиды */
  function tablePos(z) {
    if (z === 1) return [1, 1];
    if (z === 2) return [1, 18];
    if (z <= 4) return [2, z - 2];
    if (z <= 10) return [2, z + 8];
    if (z <= 12) return [3, z - 10];
    if (z <= 18) return [3, z];
    if (z <= 36) return [4, z - 18];
    if (z <= 54) return [5, z - 36];
    if (z <= 56) return [6, z - 54];
    if (z <= 70) return [9, z - 54];       // La..Yb — ряд лантаноидов, колонки 3..16
    if (z === 71) return [6, 3];
    if (z <= 86) return [6, z - 68];       // Hf..Rn: 72→4 … 86→18
    if (z <= 88) return [7, z - 86];
    if (z <= 102) return [10, z - 86];     // Ac..No — ряд актиноидов, колонки 3..16
    if (z === 103) return [7, 3];
    return [7, z - 100];                   // Rf..Og: 104→4 … 118→18
  }

  /* какие реальные элементы уже имеют «подробную» модель */
  const detailed = {};
  defs.forEach(d => { if (d.z) (Array.isArray(d.z) ? d.z : [d.z]).forEach(z => (detailed[z] = detailed[z] || []).push(d.key)); });

  const table = [];
  for (let z = 1; z <= 118; z++) {
    const sym = SYM[z - 1], nm = NAME[z - 1];
    const c = catOf(z);
    const state = GAS_Z.has(z) ? 'gas' : LIQ_Z.has(z) ? 'liquid' : z >= 104 ? 'unknown' : 'solid';
    const radio = isRadio(z);
    const p = tablePos(z);
    const entry = { z, sym, name: nm, cat: c[0], catName: c[1], catColor: c[2], state, radio, row: p[0], col: p[1], keys: detailed[z] || null, generic: false };
    if (!entry.keys) {
      /* простая модель: инертное вещество с признаками своего класса */
      const key = 'el_' + sym;
      const base = rgb(c[2]);
      const h = ((z * 2654435761) >>> 0) % 31 - 15;
      const col = '#' + base.map(x => Math.max(0, Math.min(255, x + h)).toString(16).padStart(2, '0')).join('');
      const metal = (state === 'solid' || state === 'unknown') && !POW_Z.has(z);
      const o = { z, v: 12, d: 5000, c: metal ? .6 : .2, f: metal ? 'cond metal' : '', info: 'Упрощённая модель: инертное вещество своего класса.' };
      if (radio) { o.rad = .00012; o.glow = [140, 255, 120, .16]; o.info += ' Радиоактивен — изредка излучает нейтроны.'; }
      let kind = state === 'gas' ? 4 : state === 'liquid' ? 3 : POW_Z.has(z) ? 2 : 1;
      if (kind === 4) { o.d = 1.2 + (z % 7) * .4; o.a = 120; delete o.v; }
      if (kind === 3) { o.sp = 5; o.d = 3100; o.a = 235; }
      if (kind === 2) { o.d = 2000; o.sl = .8; }
      def(key, nm, sym, 'table', kind, col, o);
      entry.keys = [key];
      entry.generic = true;
    }
    table.push(entry);
  }
  G.table = table;
  G.tableCats = CATS.map(c => ({ id: c[0], name: c[1], color: c[2] })).concat([{ id: 'super', name: 'Сверхтяжёлый (синтетический)', color: '#a0a0b4' }]);

  /* ===================== ФИНАЛИЗАЦИЯ: плоские массивы для скорости ===================== */
  G.finalize = function () {
    const N = defs.length + 1;
    const D = {
      N, defs, byKey, ID: Object.create(null), names: ['—'], formulas: [''], infos: [''], cats: [null],
      KIND: new Uint8Array(N), DENS: new Float32Array(N), COND: new Float32Array(N), AIRK: new Float32Array(N), HARD: new Float32Array(N),
      SPREAD: new Uint8Array(N), VISC: new Float32Array(N), SLIP: new Float32Array(N), GASB: new Float32Array(N),
      FL: new Float32Array(N), IG: new Float32Array(N).fill(1e9), BL: new Uint8Array(N), BT: new Float32Array(N), RES: new Uint16Array(N),
      FM: new Uint16Array(N), EXR: new Uint8Array(N), EXP: new Float32Array(N), BTO: new Uint16Array(N), SMK: new Float32Array(N),
      HIT: new Float32Array(N).fill(Infinity), HITT: new Uint16Array(N), LOT: new Float32Array(N).fill(-Infinity), LOTT: new Uint16Array(N),
      T0: new Float32Array(N).fill(NaN), LIFE0: new Uint16Array(N), DIE: new Uint16Array(N), DIEP: new Float32Array(N),
      FLG: new Uint32Array(N),
      CR: new Uint8Array(N), CG: new Uint8Array(N), CB: new Uint8Array(N), CA: new Uint8Array(N), CVAR: new Uint8Array(N),
      GLR: new Uint8Array(N), GLG: new Uint8Array(N), GLB: new Uint8Array(N), GLA: new Float32Array(N),
      RADP: new Float32Array(N), DECP: new Float32Array(N), DECT: new Uint16Array(N), DECG: new Uint16Array(N),
      EXT: new Float32Array(N), DBR: new Uint16Array(N), NAB: new Float32Array(N), NFIS: new Float32Array(N),
      HASRX: new Uint8Array(N), RXI: new Int32Array(N * N), RXS: [null], UPDN: new Array(N).fill(null)
    };
    const id = (k) => {
      if (k == null) return 0;
      const d = byKey[k];
      if (!d) throw new Error('Неизвестный ключ вещества: ' + k);
      return d.id;
    };
    defs.forEach(d => { D.ID[d.key] = d.id; });
    const dflt = { 1: { d: 3000, c: .3, v: 12 }, 2: { d: 1500, c: .15, v: 16 }, 3: { d: 1000, c: .3, v: 8 }, 4: { d: 1.2, c: .06, v: 6 } };
    defs.forEach(d => {
      const i = d.id, k = d.kind, df = dflt[k];
      D.names[i] = d.name; D.formulas[i] = d.formula; D.infos[i] = d.info || ''; D.cats[i] = d.cat;
      D.KIND[i] = k;
      D.DENS[i] = d.d != null ? d.d : df.d;
      D.COND[i] = d.c != null ? d.c : df.c;
      D.AIRK[i] = .002 + D.COND[i] * .008;
      D.HARD[i] = d.h != null ? d.h : .3;
      D.SPREAD[i] = d.sp != null ? d.sp : (k === 3 ? 5 : 0);
      D.VISC[i] = d.vi || 0;
      D.SLIP[i] = d.sl != null ? d.sl : 1;
      const gb = Math.min(1, Math.abs(D.DENS[i] - G.AIR) / G.AIR);
      D.GASB[i] = d.gb != null ? d.gb : Math.max(.08, gb);
      D.FL[i] = d.fl || 0;
      D.IG[i] = d.ig != null ? d.ig : 1e9;
      D.BL[i] = Math.min(255, d.bl != null ? d.bl : 60);
      D.BT[i] = d.bt != null ? d.bt : 700;
      D.RES[i] = id(d.res);
      D.FM[i] = id(d.fm || 'fire');
      D.EXR[i] = d.ex || 0;
      D.EXP[i] = d.ep != null ? d.ep : 1;
      D.BTO[i] = id(d.bto);
      D.SMK[i] = d.smk != null ? d.smk : .05;
      if (d.hi) { D.HIT[i] = d.hi[0]; D.HITT[i] = id(d.hi[1]); }
      if (d.lo) { D.LOT[i] = d.lo[0]; D.LOTT[i] = id(d.lo[1]); }
      if (d.t0 != null) D.T0[i] = d.t0;
      D.LIFE0[i] = d.life || 0;
      D.DIE[i] = id(d.die); D.DIEP[i] = d.diep != null ? d.diep : 0;
      D.FLG[i] = d.flags;
      D.CR[i] = d.color[0]; D.CG[i] = d.color[1]; D.CB[i] = d.color[2];
      D.CA[i] = d.a != null ? d.a : (k === 4 ? 140 : 255);
      D.CVAR[i] = d.v != null ? d.v : df.v;
      if (d.glow) { D.GLR[i] = d.glow[0]; D.GLG[i] = d.glow[1]; D.GLB[i] = d.glow[2]; D.GLA[i] = d.glow[3]; }
      D.RADP[i] = d.rad || 0;
      if (d.dec) { D.DECP[i] = d.dec[0]; D.DECT[i] = id(d.dec[1]); D.DECG[i] = id(d.dec[2]); }
      D.EXT[i] = d.ext || 0;
      D.DBR[i] = id(d.dbr);
      D.NAB[i] = d.nab != null ? d.nab : (k === 4 ? 0 : .04);
      D.NFIS[i] = d.nfis || 0;
      D.UPDN[i] = d.upd || null;
    });

    /* реакции: имена → id, группы → списки; регистрируем в обе стороны */
    const expand = (x) => {
      const out = [];
      (Array.isArray(x) ? x : [x]).forEach(s => {
        if (typeof s === 'string' && s[0] === '@') {
          const g = GRP[s.slice(1)];
          if (!g) throw new Error('Нет группы ' + s);
          g.forEach(k => out.push(id(k)));
        } else out.push(id(s));
      });
      return out;
    };
    const norm = (o) => {
      if (o === undefined) return -1;
      if (o === null) return 0;
      if (typeof o === 'string') return { t: id(o) };
      const r = { t: id(o.t) };
      if (o.aux) r.aux = id(o.aux);
      if (o.life) r.life = o.life;
      return r;
    };
    const normSpec = (o) => { const n = norm(o); return typeof n === 'number' ? n : (n.aux || n.life ? n : n.t); };
    const add = (ta, tb, p, oa, ob, dT, o) => {
      const key = ta * N + tb;
      if (D.RXI[key]) return;
      D.RXS.push({ p, a: oa, b: ob, dT, blast: o.blast || 0 });
      D.RXI[key] = D.RXS.length - 1;
      D.HASRX[ta] = 1;
    };
    rx.forEach(r => {
      const A = expand(r.a), B = expand(r.b);
      const oa = normSpec(r.oa), ob = normSpec(r.ob);
      A.forEach(ta => B.forEach(tb => {
        add(ta, tb, r.p, oa, ob, r.dT, r.o);
        add(tb, ta, r.p, ob, oa, r.dT, r.o);
      }));
    });
    return D;
  };

  /* для UI — кратко */
  G.defs = defs;
  G.byKey = byKey;
})();
