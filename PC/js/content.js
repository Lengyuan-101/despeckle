window.DM = window.DM || {};

(function (DM) {
  'use strict';

  var R = ['凡', '珍', '绝', '神'];
  DM.RARITY = R;

  /* ───────────── 墨诀（构筑） ───────────── */
  // fx: 在 game.js 中通过 st.lv(id) 读取层数生效
  DM.UPGRADES = [
    { id: '韵', r: 0, max: 5, name: '墨韵', d: '每一点墨的所得加深 15%。' },
    { id: '备', r: 0, max: 3, name: '备墨', d: '每层多携 1 颗墨珠。' },
    { id: '广', r: 0, max: 3, name: '广袖', d: '底部墨壶加宽 34%。' },
    { id: '疾', r: 0, max: 3, name: '疾风', d: '珠行更急；每次落壶额外多续一珠。' },
    { id: '窥', r: 0, max: 3, name: '窥墨', d: '瞄准虚线多推演一段弹路，长一寸。' },

    { id: '溅', r: 1, max: 4, name: '溅墨', d: '撞碎时向四周飞溅墨屑，波及邻近墨点。' },
    { id: '脆', r: 1, max: 3, name: '脆裂', d: '硬物耐久削减一层；碎时青屑四散，波及近邻。' },
    { id: '复', r: 1, max: 3, name: '复写', d: '同一点墨的分数翻倍再叠。' },
    { id: '沉', r: 1, max: 3, name: '沉坠', d: '墨珠愈重：下坠更快，撞击更狠。' },
    { id: '穿', r: 1, max: 3, name: '贯墨', d: '墨珠贯穿墨点而不被弹开，硬物亦受创。' },
    { id: '吟', r: 1, max: 3, name: '长吟', d: '连击倍率的上限拔高，余音更久不散。' },
    { id: '金', r: 1, max: 2, name: '流金', d: '墨阵间多出金粉点，触之得分且易续珠。' },
    { id: '润', r: 1, max: 3, name: '润砚', d: '砚台复原一角，容你多失手一次。' },

    { id: '分', r: 2, max: 3, name: '分墨', d: '首次撞点时裂出一颗小珠，各自寻路。' },
    { id: '响', r: 2, max: 3, name: '余响', d: '一颗墨珠落尽后，凭其战绩自壶中跃回数颗。' },
    { id: '井', r: 2, max: 3, name: '引魂井', d: '珠行处生引力，将周遭墨点悄悄拽来。' },
    { id: '双', r: 2, max: 2, name: '双生', d: '每次出墨并射两珠，角度微岔。' },
    { id: '痕', r: 2, max: 3, name: '汲痕', d: '珠后拖曳墨迹，沿途墨点被缓缓蚀去。' },
    { id: '归', r: 2, max: 2, name: '归一', d: '珠力将竭时，会自主寻向最近的墨点。' },
    { id: '炸', r: 2, max: 3, name: '炸墨', d: '连击每积满一段，轰开方圆之内诸墨。' },

    { id: '雷', r: 3, max: 2, name: '雷络', d: '碎点引雷，弧光窜向邻近数点未触之墨。' },
    { id: '噬', r: 3, max: 2, name: '吞星', d: '珠随身畔凝出一口黑渊，吞尽贴近的墨。' },
    { id: '魂', r: 3, max: 2, name: '还魂', d: '珠坠深渊时高几率自壶中再度弹起。' },
    { id: '尽', r: 3, max: 1, name: '无尽', d: '连击倍率不再封顶，音阶一路攀升不歇。' },
    { id: '印', r: 3, max: 2, name: '破印', d: '朱印之效倍增，且一次出墨可连触数印。' },
    { id: '滞', r: 3, max: 1, name: '凝滞', d: '珠快时天地为之放缓，让你看清每一场连锁。' }
  ];

  DM.upById = {};
  DM.UPGRADES.forEach(function (u) { DM.upById[u.id] = u; });

  /* ───────────── 朱印（场上红色特殊点） ───────────── */
  DM.SEALS = [
    { id: 'burst', name: '爆印', d: '轰开方圆墨点' },
    { id: 'rain', name: '落雨印', d: '自天而降数珠' },
    { id: 'slow', name: '凝光印', d: '全场时间放缓' },
    { id: 'score', name: '积墨印', d: '当发分数大涨' },
    { id: 'move', name: '移壶印', d: '墨壶移至珠下' },
    { id: 'chain', name: '引雷印', d: '雷弧串碎诸墨' }
  ];

  /* ───────────── 角色 ───────────── */
  DM.CHARS = [
    { id: 'yiantong', name: '砚童', ink: '226,226,220', desc: '无所长，无所短。开局即入深渊。', free: true },
    { id: 'zhusha', name: '朱砂', ink: '206,64,48', desc: '连击倍率上限 +2.5，音阶更疯；每层少 1 颗珠。', unlock: 'depth', cost: 3 },
    { id: 'qingdai', name: '青黛', ink: '104,196,196', desc: '开局自带一层「分墨」；墨点更硬一分。', unlock: 'depth', cost: 6 },
    { id: 'xuanmo', name: '玄墨', ink: '150,150,168', desc: '墨壶极宽，接珠更易；墨迹折算 -12%。', unlock: 'depth', cost: 10 },
    { id: 'baihao', name: '白毫', ink: '245,245,238', desc: '砚台 5 点，容错极高；每层墨点稀薄。', unlock: 'clear', cost: 4 }
  ];

  /* ───────────── 永久解锁（墨髓消费） ───────────── */
  DM.PERKS = [
    { id: 'start_ball', name: '宿墨', cost: 3, max: 3, d: '每局起始多携 1 颗珠' },
    { id: 'start_up', name: '祖诀', cost: 5, max: 1, d: '每局开局随机获一珍诀' },
    { id: 'revive', name: '续砚', cost: 8, max: 1, d: '砚尽时可免费还魂一次' },
    { id: 'rich', name: '藏锋', cost: 4, max: 3, d: '墨髓产出 +25%' },
    { id: 'sealmore', name: '多印', cost: 6, max: 2, d: '每层朱印 +1' }
  ];

  /* ───────────── 阵型模板 ───────────── */
  function P(x, y, type, hp) { return { x: x, y: y, type: type || 'dot', hp: hp || 1 }; }

  // o: {x,y,sx,rowGap,cx,cy,r,ys,n,cols,rows,seg,arms,step,turns,grow,rot,len,r1,r2,gap}
  var PATTERNS = {
    plum: function (o) { // 梅花桩
      var out = [];
      for (var r = 0; r < o.rows; r++) {
        for (var c = 0; c < o.cols; c++) {
          out.push(P(o.x + (c + (r % 2 ? 0.5 : 0)) * o.sx, o.y + r * o.rowGap));
        }
      }
      return out;
    },
    ring: function (o) { // 环
      var out = [], n = o.n, R0 = o.r;
      for (var i = 0; i < n; i++) {
        var a = (i / n) * 6.2832 + o.rot;
        out.push(P(o.cx + Math.cos(a) * R0, o.cy + Math.sin(a) * R0 * o.ys));
      }
      if (o.rows > 2) for (var k = 0; k < (n >> 1); k++) {
        var a2 = (k / (n >> 1)) * 6.2832 + o.rot * 0.5;
        out.push(P(o.cx + Math.cos(a2) * R0 * 0.55, o.cy + Math.sin(a2) * R0 * 0.55 * o.ys));
      }
      return out;
    },
    falls: function (o) { // 斜瀑
      var out = [], n = o.n;
      for (var i = 0; i < n; i++) {
        for (var k = 0; k < 2; k++) out.push(P(o.x + i * o.sx + k * o.sx * 0.34, o.y + i * o.rowGap + k * o.gap));
      }
      return out;
    },
    star: function (o) { // 星芒
      var out = [];
      for (var a = 0; a < o.arms; a++) {
        var ang = (a / o.arms) * 6.2832 + o.rot;
        for (var s = 1; s <= o.seg; s++) {
          out.push(P(o.cx + Math.cos(ang) * s * o.step, o.cy + Math.sin(ang) * s * o.step * o.ys));
        }
      }
      return out;
    },
    spiral: function (o) { // 云纹
      var out = [], n = o.n;
      for (var i = 0; i < n; i++) {
        var t = i / n, ang = t * 6.2832 * o.turns + o.rot;
        var rad = 16 + t * o.grow;
        out.push(P(o.cx + Math.cos(ang) * rad, o.cy + Math.sin(ang) * rad * 0.72));
      }
      return out;
    },
    eye: function (o) { // 阵眼
      var out = [], n = o.n;
      for (var i = 0; i < n; i++) {
        var a = (i / n) * 6.2832 + o.rot;
        out.push(P(o.cx + Math.cos(a) * o.r1, o.cy + Math.sin(a) * o.r1 * 0.72));
        if (i % 2 === 0) out.push(P(o.cx + Math.cos(a) * o.r2, o.cy + Math.sin(a) * o.r2 * 0.72));
      }
      return out;
    },
    comb: function (o) { // 梳齿
      var out = [], n = o.n;
      for (var i = 0; i < n; i++) {
        var x = o.x + i * o.sx;
        for (var k = 0; k < o.len; k++) out.push(P(x, o.y + k * o.rowGap));
      }
      return out;
    },
    wallp: function (o) { // 横墙
      var out = [], n = o.n;
      for (var i = 0; i < n; i++) {
        out.push(P(o.x + i * o.sx, o.y + (i % 2 ? o.rowGap * 0.4 : 0)));
      }
      return out;
    },
    diamond: function (o) { // 菱阵
      var out = [], rows = o.rows + 1;
      for (var r = 0; r < rows; r++) {
        var span = (rows - 1 - r);
        for (var c = -span; c <= span; c++) {
          out.push(P(o.cx + c * o.sx, o.cy + r * o.rowGap - (rows - 1) * o.rowGap * 0.5));
        }
      }
      return out;
    }
  };

  DM.PATTERN_KEYS = Object.keys(PATTERNS);

  /* ───────── 建层 ───────── */
  DM.buildLayer = function (depth, st) {
    var pegs = [], hazards = [];
    var bandY = [104, 182, 260, 340, 418, 494];
    var bands = depth < 3 ? 4 : depth < 8 ? 5 : 6;
    var used = DM.shuffle(DM.PATTERN_KEYS.slice()).slice(0, bands);

    for (var b = 0; b < bands; b++) {
      var key = used[b];
      var o = {
        x: DM.rand(40, 120), y: bandY[b] + DM.rand(-6, 6),
        sx: DM.rand(38, 48), rowGap: DM.rand(32, 42), gap: DM.rand(28, 42),
        cx: DM.W * DM.rand(0.26, 0.74), cy: bandY[b] + DM.rand(8, 26),
        r: DM.rand(66, 104), ys: DM.rand(0.6, 1.0),
        n: 16, cols: 12, rows: 2, seg: 4, arms: 6, step: DM.rand(24, 34),
        turns: DM.rand(2.0, 3.2), grow: DM.rand(64, 104), rot: DM.rand(0, 6.28),
        len: 3, r1: DM.rand(44, 72), r2: DM.rand(92, 128)
      };
      if (key === 'plum') { o.cols = DM.randInt(10, 13); o.rows = DM.randInt(2, 3); }
      else if (key === 'ring') { o.n = DM.randInt(13, 17); o.rows = Math.random() < 0.5 ? 3 : 1; o.r = DM.rand(62, 100); }
      else if (key === 'falls') { o.n = DM.randInt(8, 11); }
      else if (key === 'star') { o.arms = DM.randInt(5, 7); o.seg = DM.randInt(3, 5); }
      else if (key === 'spiral') { o.n = DM.randInt(18, 26); }
      else if (key === 'eye') { o.n = DM.randInt(12, 16); }
      else if (key === 'comb') { o.n = DM.randInt(8, 11); o.len = DM.randInt(2, 3); }
      else if (key === 'wallp') { o.n = DM.randInt(13, 17); }
      else if (key === 'diamond') { o.rows = DM.randInt(2, 3); o.sx = DM.rand(34, 44); }

      var got = PATTERNS[key](o) || [];
      got = ensureCount(got, 26);
      var xoff = DM.rand(-26, 26);
      for (var i = 0; i < got.length; i++) {
        var p = got[i];
        p.x += xoff + DM.rand(-5, 5); p.y += DM.rand(-5, 5);
        if (p.y < 88 || p.y > DM.FLOOR_Y - 30) continue;
        if (p.x < DM.WALL + 15 || p.x > DM.W - DM.WALL - 15) continue;
        pegs.push(p);
      }
    }

    // 去重（保证球能穿过缝隙）
    pegs = dedupe(pegs, 25);
    // 补隙：消灭让球直接坠落的大空洞
    pegs = fillGaps(pegs, DM.clamp(0.24 + depth * 0.016, 0.24, 0.42));
    pegs = dedupe(pegs, 24);
    if (pegs.length > 145) pegs = thinOut(pegs, (pegs.length - 145) / pegs.length);

    // 硬物 / 特殊点配比
    var hardChance = DM.clamp(0.04 + depth * 0.013, 0, 0.16);
    var mawChance = depth >= 4 ? DM.clamp(0.03 + (depth - 4) * 0.018, 0, 0.1) : 0;
    var goldN = st.lv('金') > 0 ? 3 + st.lv('金') * 2 : 0;
    var hard = 0, maw = 0, gold = 0;
    var order = DM.shuffle(pegs.slice());
    for (var k = 0; k < order.length; k++) {
      var g = order[k];
      if (g.type !== 'dot') continue;
      if (hard < Math.floor(pegs.length * hardChance) && Math.random() < 0.6) { g.type = 'hard'; g.hp = 2; hard++; continue; }
      if (maw < Math.floor(pegs.length * mawChance * 4) && Math.random() < 0.35) { g.type = 'maw'; maw++; continue; }
      if (gold < goldN) { g.type = 'gold'; gold++; }
    }
    if (st.lv('脆') > 0) {
      pegs.forEach(function (p) { if (p.type === 'hard') p.hp = Math.max(1, p.hp - st.lv('脆')); });
    }

    // 朱印
    var sealN = 2 + (depth % 3 === 0 ? 1 : 0) + st.lv('印') + (st.perk('sealmore') || 0);
    sealN = Math.min(sealN, 5);
    placeSeals(pegs, sealN);

    // 险物
    if (depth >= 3 && Math.random() < DM.clamp(0.22 + depth * 0.06, 0, 0.8)) {
      hazards.push({
        kind: 'spinner', x: DM.rand(180, DM.W - 180), y: DM.rand(200, 420),
        len: DM.rand(58, 100), ang: DM.rand(0, 3.14), spd: DM.rand(0.7, 1.5) * (Math.random() < 0.5 ? -1 : 1)
      });
    }
    if (depth >= 5 && Math.random() < DM.clamp((depth - 4) * 0.16, 0, 0.6)) {
      hazards.push({
        kind: 'vortex', x: DM.rand(160, DM.W - 160), y: DM.rand(220, 440),
        r: DM.rand(88, 130), spd: (Math.random() < 0.5 ? -1 : 1) * DM.rand(1.1, 2.1)
      });
    }
    if (depth >= 7 && Math.random() < 0.4) {
      hazards.push({
        kind: 'spinner', x: DM.rand(160, DM.W - 160), y: DM.rand(320, 470),
        len: DM.rand(70, 120), ang: DM.rand(0, 3.14), spd: DM.rand(0.5, 1.1) * (Math.random() < 0.5 ? -1 : 1)
      });
    }

    var boss = depth % 5 === 0;
    if (boss) pegs = thinOut(pegs, 0.25);
    var balls = DM.clamp(10 + Math.floor(depth * 0.45), 10, 16) + st.lv('备') + (st.char.ballsBonus || 0);
    if (st.char.id === 'zhusha') balls -= 1;
    if (st.char.id === 'baihao') { balls -= 1; pegs = thinOut(pegs, 0.16); }
    balls += st.perk('start_ball') || 0;

    // 绝对配额：深渊的墨会自行渗出，所以深度越深要碎得越多
    // 配额由「单珠上限 × 目标用珠数」推导:供给不再断流,难度就得靠这里给
    // 配额不在此定:由 game 依玩家实际单珠碎墨能力自适应
    return { pegs: pegs, hazards: hazards, balls: balls, boss: boss };
  };

  // 阵型点数保底：以左右镜像补，保持对称观感
  function ensureCount(got, minN) {
    if (got.length >= minN) return got;
    var src = got.slice(), i = 0;
    while (got.length < minN && i < src.length * 6) {
      var p = src[i % src.length];
      got.push(P(DM.W - p.x + DM.rand(-10, 10), p.y + DM.rand(-8, 8)));
      i++;
    }
    return got;
  }

  // 补隙：网格扫描，在空旷处补墨点，避免球一路直落
  function fillGaps(pegs, chance) {
    var gx = 42, gy = 40;
    for (var y = 96; y < DM.FLOOR_Y - 34; y += gy) {
      var rowShift = ((y / gy) | 0) % 2 ? gx * 0.5 : 0;
      for (var x = DM.WALL + 26; x < DM.W - DM.WALL - 26; x += gx) {
        if (Math.random() > chance) continue;
        var jx = x + rowShift + DM.rand(-11, 11), jy = y + DM.rand(-9, 9);
        var near = 1e9;
        for (var i = 0; i < pegs.length; i++) {
          var d = DM.dist2(jx, jy, pegs[i].x, pegs[i].y);
          if (d < near) near = d;
          if (near < 21 * 21) break;
        }
        if (near < 21 * 21) continue;
        pegs.push(P(jx, jy));
      }
    }
    return pegs;
  }

  function thinOut(pegs, ratio) {
    var out = [];
    for (var i = 0; i < pegs.length; i++) if (pegs[i].type !== 'seal' && Math.random() > ratio) out.push(pegs[i]);
    return out;
  }

  function dedupe(pegs, min) {
    var out = [], m2 = min * min;
    for (var i = 0; i < pegs.length; i++) {
      var ok = true, p = pegs[i];
      for (var j = 0; j < out.length; j++) {
        if (DM.dist2(p.x, p.y, out[j].x, out[j].y) < m2) { ok = false; break; }
      }
      if (ok) out.push(p);
    }
    return out;
  }

  function placeSeals(pegs, n) {
    if (!pegs.length) return;
    var cand = DM.shuffle(pegs.map(function (p, i) { return i; }));
    var placed = 0, tries = 0;
    for (var i = 0; i < cand.length && placed < n; i++) {
      var p = pegs[cand[i]];
      if (p.type !== 'dot') continue;
      var far = true;
      for (var k = 0; k < pegs.length; k++) {
        if (pegs[k].type === 'seal' && DM.dist2(p.x, p.y, pegs[k].x, pegs[k].y) < 150 * 150) { far = false; break; }
      }
      if (!far && tries++ > 40) continue;
      p.type = 'seal'; p.hp = 1;
      p.seal = DM.SEALS[(placed + (pegs.length)) % DM.SEALS.length].id;
      placed++;
    }
  }

  DM.BOSS_NAMES = ['墨魇', '枯砚', '残章', '溺书', '无题', '断简', '泣砚', '玄毫'];
})(DM);
