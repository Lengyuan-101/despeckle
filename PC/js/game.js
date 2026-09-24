window.DM = window.DM || {};

(function (DM) {
  'use strict';

  var TAU = Math.PI * 2;
  var BASE = { dot: 12, hard: 18, gold: 44, maw: 9, seal: 15, stone: 0 };
  var GRADES = ['凡', '珍', '绝', '神'];

  DM.getChar = function (id) {
    for (var i = 0; i < DM.CHARS.length; i++) if (DM.CHARS[i].id === id) return DM.CHARS[i];
    return DM.CHARS[0];
  };

  var CHAR_FX = {
    yiantong: {},
    zhusha: { capBonus: 2.5 },
    qingdai: { harden: 1, startUp: '分' },
    xuanmo: { bucketMul: 1.45, scoreMul: 0.88 },
    baihao: { lives: 5 }
  };

  var Game = DM.Game = {
    canvas: null, ctx: null, state: 'title', t: 0, acc: 0,
    tsNow: 1, tsTarget: 1, tsLock: 0,
    balls: [], world: null, aim: { ang: 1.5708, power: 0.55, charging: false, charge: 0 },
    aimPath: [], mouse: { x: DM.W / 2, y: DM.H * 0.6, has: false },
    st: null, layer: { total: 0, dead: 0, need: 60, regen: 20, since: 0, boss: false },
    combo: { hits: 0, mult: 1, step: 0, cap: 26 },
    shot: null, pending: null, lastTs: 0, demoT: 0,

    init: function (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.pat1 = DM.tilePattern(this.ctx);
      DM.fx.init();
      this.newWorld(1, this.dummyState());
      this.state = 'title';
      DM.ui.init(this);
      this.bindInput();
      requestAnimationFrame(this.frame.bind(this));
    },

    dummyState: function () {
      return { depth: 1, char: DM.getChar('yiantong'), fx: {}, up: {}, lv: function () { return 0; }, perk: function () { return 0; }, score: 0, balls: 8, ballsLeft: 8, lives: 3, maxLives: 3, scoreMul: 1, gravityMul: 1 };
    },

    /* ───────── 生命周期 ───────── */
    toTitle: function () {
      this.state = 'title';
      this.st = null;
      this.balls.length = 0;
      this.newWorld(1 + (Math.random() * 4 | 0), this.dummyState());
      DM.ui.show('title');
      DM.audio.stopDrone();
    },

    startRun: function () {
      this.clearSlot();
      var cid = DM.save.data.lastChar || 'yiantong';
      var ch = DM.getChar(cid);
      if (!this.charUnlocked(ch)) ch = DM.CHARS[0];
      var fx = CHAR_FX[ch.id] || {};
      this.st = {
        char: ch, fx: fx, depth: 1, score: 0, bestGrade: 0,
        up: {}, order: [], perfects: 0, hits: 0, shots: 0, rerolls: 2,
        lives: fx.lives || 3, maxLives: fx.lives || 3,
        scoreMul: fx.scoreMul || 1, gravityMul: 1, marrow: 0, avgKill: 11,
        lv: function (id) { return this.up[id] || 0; },
        perk: function (id) { return DM.save.data.perks[id] || 0; }
      };
      if (fx.startUp) this.st.up[fx.startUp] = 1;
      if (this.st.perk('start_up') > 0) {
        var pool = DM.UPGRADES.filter(function (u) { return u.r <= 1; });
        var u = DM.pick(pool); if (u) this.st.up[u.id] = (this.st.up[u.id] || 0) + 1;
      }
      if (fx.startUp) this.st.order.push(fx.startUp);
      DM.save.data.runs++;
      DM.save.flush();
      this.newLayer();
      DM.ui.hide();
      DM.audio.unlock();
      DM.audio.updateDrone(1);
      DM.ui.toast('第 一 层', 'rgba(226,226,220,.8)', true);
      if (DM.save.data.runs <= 1) {
        setTimeout(function () { DM.ui.toast('按 住 蓄 力 · 松 开 出 珠', 'rgba(232,190,110,.92)'); }, 1700);
      }
    },

    charUnlocked: function (c) {
      if (c.free) return true;
      if (c.unlock === 'depth') return DM.save.data.bestDepth >= c.cost;
      if (c.unlock === 'clear') return DM.save.data.clears >= c.cost;
      return false;
    },

    shotCap: function () { return Math.round(20 + this.st.depth * 2.2); },

    recalcCap: function () {
      var st = this.st;
      this.combo.cap = 26 + st.lv('吟') * 18 + ((st.fx && st.fx.capBonus) || 0) + (st.lv('尽') ? 99999 : 0);
    },

    /* ───────── 悬渊存档：局内进度 ───────── */
    saveSlot: function (flew) {
      var st = this.st;
      if (!st || this.state === 'over' || this.state === 'title') return false;
      var ballsLeft = st.ballsLeft + (flew ? 1 : 0);
      return DM.save.writeSlot({
        v: 1, at: Date.now(), char: st.char.id,
        st: {
          depth: st.depth, score: st.score, bestGrade: st.bestGrade,
          up: st.up, order: st.order, perfects: st.perfects, hits: st.hits,
          shots: st.shots, rerolls: st.rerolls, lives: st.lives, maxLives: st.maxLives,
          marrow: st.marrow, usedRevive: !!st.usedRevive, avgKill: st.avgKill,
          balls: st.balls, ballsLeft: ballsLeft
        },
        layer: {
          total: this.layer.total, dead: this.layer.dead, need: this.layer.need,
          regen: this.layer.regen, since: this.layer.since,
          boss: !!this.layer.boss, bossKill: !!this.layer.bossKill
        },
        world: { pegs: this.world.pegs, hazards: this.world.hazards, boss: this.world.boss },
        bucket: this.world.bucket
      });
    },

    slotInfo: function () {
      var o = DM.save.readSlot();
      if (!o || o.v !== 1 || !o.st || !o.world || !Array.isArray(o.world.pegs)) return null;
      var ch = DM.getChar(o.char);
      if (!ch || ch.id !== o.char || !this.charUnlocked(ch)) return null;
      return { depth: o.st.depth, score: o.st.score, charName: ch.name, ups: (o.st.order || []).length, lives: o.st.lives };
    },

    clearSlot: function () { DM.save.clearSlot(); },

    resumeRun: function () {
      var o = DM.save.readSlot();
      if (!o || o.v !== 1 || !o.st || !o.world || !Array.isArray(o.world.pegs)) { this.clearSlot(); return false; }
      var ch = DM.getChar(o.char);
      if (!ch || ch.id !== o.char || !this.charUnlocked(ch)) { this.clearSlot(); return false; }
      var fx = CHAR_FX[ch.id] || {}, st = o.st;
      st.avgKill = st.avgKill || 11;
      st.char = ch; st.fx = fx;
      st.lv = function (id) { return this.up[id] || 0; };
      st.perk = function (id) { return DM.save.data.perks[id] || 0; };
      st.scoreMul = fx.scoreMul || 1;
      st.gravityMul = 1;
      this.st = st;
      this.world = {
        pegs: o.world.pegs, hazards: o.world.hazards || [],
        boss: o.world.boss || null, bucket: o.bucket
      };
      this.layer = o.layer;
      this.balls.length = 0;
      this.shot = null;
      this.pending = null;
      this.perfectShot = false;
      this.combo = { hits: 0, mult: 1, step: 0, cap: 26 };
      this.recalcCap();
      this.aimPath.length = 0;
      this.aim.charging = false; this.aim.charge = 0;
      this.tsNow = 1; this.tsTarget = 1; this.tsLock = 0;
      DM.fx.reset();
      this.state = 'aim';
      DM.ui.hide();
      DM.audio.unlock();
      DM.audio.updateDrone(Math.min(6, st.depth / 2));
      DM.ui.toast('自 悬 处 继 渊 · 第 ' + st.depth + ' 层', 'rgba(232,190,110,.92)', true);
      return true;
    },

    selectChar: function (id) {
      var c = DM.getChar(id);
      if (!this.charUnlocked(c)) return;
      DM.save.data.lastChar = id;
      DM.save.flush();
      DM.ui.show('chars');
    },

    buyPerk: function (id) {
      var s = DM.save.data, p = null;
      DM.PERKS.forEach(function (x) { if (x.id === id) p = x; });
      if (!p) return;
      var lv = s.perks[id] || 0;
      if (lv >= p.max) return;
      var cost = p.cost * (lv + 1);
      if (s.marrow < cost) return;
      s.marrow -= cost; s.perks[id] = lv + 1;
      DM.save.flush();
      DM.ui.show('shop');
    },

    /* ───────── 关卡 ───────── */
    newLayer: function () {
      var st = this.st;
      var lay = DM.buildLayer(st.depth, st);
      this.newWorld2(lay, st);
      st.balls = lay.balls;
      st.ballsLeft = lay.balls;
      // 自适应配额:用「你实际的单珠碎墨量」推目标,再夹在 [下限, 单珠上限] 之间防波动
      var targetShots = st.balls * (0.55 + st.depth * 0.024);
      var floor = 8 + st.depth * 1.6;
      var eff = Math.max(st.avgKill || 11, floor);
      var need = Math.round(eff * targetShots * 0.9);
      if (lay.boss) need = Math.round(need * 1.25);
      this.layer.total = lay.pegs.length;
      this.layer.dead = 0;
      this.layer.need = need;
      this.layer.regen = Math.max(6, 14 - Math.floor(st.depth / 3));
      this.layer.since = 0;
      this.layer.boss = lay.boss;
      this.layer.bossKill = false;
      this._fatigue = false;
      this.combo.step = 0; this.combo.hits = 0; this.combo.mult = 1;
      this.recalcCap();
      this.state = 'aim';
      this.balls.length = 0;
      DM.fx.reset();
      this.aim.ang = 1.5708;
      if (lay.boss) {
        var nm = DM.BOSS_NAMES[(st.depth / 5 - 1) % DM.BOSS_NAMES.length | 0];
        var hp = 9 + st.depth * 1.4;
        st.balls += 3; st.ballsLeft += 3;
        this.world.boss = { x: DM.W / 2, y: 200, r: 42, hp: hp, maxHp: hp, name: nm, hitFlash: 0, eat: 3.2, dead: false, dir: 1, t: 0 };
        DM.audio.boss();
        DM.ui.toast('墨 魇 当 路 · 斩 之 ,或 尽 碎 其 墨', 'rgba(206,64,48,.95)', true);
      } else {
        DM.ui.toast('第 ' + this.numText(st.depth) + ' 层 · 需 碎 墨 ' + this.layer.need + ' 点', 'rgba(226,226,220,.75)', false, 'layer');
      }
      this.saveSlot(false);
    },

    numText: function (n) { return n <= 10 ? ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n - 1] : n; },

    newWorld: function (depth, st) {
      this.newWorld2(DM.buildLayer(depth, st), st);
    },

    newWorld2: function (lay, st) {
      var pegs = lay.pegs;
      for (var i = 0; i < pegs.length; i++) {
        var p = pegs[i];
        if (p.type === 'maw') p.hp = 3;
        if (st.char && st.fx && st.fx.harden && p.type === 'dot' && Math.random() < 0.4) { p.type = 'hard'; p.hp = 2; }
        p.maxHp = p.hp;
        p.glow = 0; p.shake = 0; p.pop = 1; p.phase = Math.random() * TAU; p.wob = Math.random() * TAU;
      }
      var bw = (110 + (st.lv ? st.lv('广') : 0) * 37) * ((st.fx && st.fx.bucketMul) || 1);
      this.world = {
        pegs: pegs, hazards: lay.hazards || [], boss: null,
        bucket: { x: DM.W * 0.5, w: bw, dir: 1, spd: 22 + lay.pegs.length * 0.5, glow: 0 }
      };
      this.balls.length = 0;
    },

    /* ───────── 发射 ───────── */
    makeBall: function (ang, spd, small, col) {
      return {
        x: DM.MUZZLE.x + Math.cos(ang) * 30, y: DM.MUZZLE.y + Math.sin(ang) * 30,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        r: small ? 6.4 : DM.BALL_R, age: 0, depth: small ? 99 : 0, iframe: 0,
        pierce: (this.st && this.st.lv) ? 3 + this.st.lv('穿') * 4 : 0,
        slowed: 0, swirled: 0, hot: 0, small: !!small, col: col || null,
        trail: [], dead: false, lastT: 0
      };
    },

    launch: function (power) {
      if (this.state !== 'aim') return;
      var st = this.st;
      if (st.ballsLeft <= 0) return;
      var spd = (DM.LAUNCH_MIN + (DM.LAUNCH_MAX - DM.LAUNCH_MIN) * power) * (1 + st.lv('疾') * 0.09);
      var ang = this.aim.ang;
      st.ballsLeft--; st.shots++;
      this.shot = { hits: 0, kills: 0, killCap: this.shotCap(), score: 0, seals: 0, sealAllow: 1 + st.lv('印'), revive: st.lv('魂'), echoDone: false, keptCombo: false };
      this.combo.step = 0; this.combo.hits = 0; this.combo.mult = 1;
      this.balls.push(this.makeBall(ang, spd, false, st.char.ink === '226,226,220' ? null : st.char.ink));
      if (st.lv('双')) {
        this.balls.push(this.makeBall(ang + 0.13, spd * 0.96, true, '232,190,110'));
        if (st.lv('双') > 1) this.balls.push(this.makeBall(ang - 0.13, spd * 0.96, true, '232,190,110'));
      }
      DM.audio.launch(power);
      DM.fx.splash(DM.MUZZLE.x + Math.cos(ang) * 26, DM.MUZZLE.y + Math.sin(ang) * 26, 12, 'ink', 220, 0.4);
      DM.fx.ring(DM.MUZZLE.x + Math.cos(ang) * 26, DM.MUZZLE.y + Math.sin(ang) * 26, 4, 40, 0.3, '226,226,220', 2);
      DM.fx.shake(3, 0.16);
      this.state = 'fly';
      this.aim.charging = false; this.aim.charge = 0;
    },

    /* ───────── 命中结算 ───────── */
    onHit: function (p, b, quiet) {
      if (p.dead || !this.st) return;
      var st = this.st;
      if (p.hp > 0) {
        if (p.type === 'seal') { this.fireSeal(p, b); return; }
        p.glow = 1;
        this.addCombo(p, b, 0.45, quiet);
        DM.fx.splash(p.x, p.y, 3, 'white', 90, 0.34);
        return;
      }
      if (p.type === 'seal') { this.fireSeal(p, b); }
      p.dead = true;
      st.hits++;
      this.layer.dead++;
      if (this.shot) this.shot.kills++;
      this.addCombo(p, b, 1, quiet);
      var col = p.type === 'gold' ? 'gold' : p.type === 'hard' ? 'cyan' : p.type === 'maw' ? 'ink' : 'white';
      DM.fx.splash(p.x, p.y, p.type === 'gold' ? 16 : 9, col, 190, 0.6);
      DM.fx.ripple(p.x, p.y, p.type === 'hard' ? '150,200,214' : p.type === 'gold' ? '232,190,110' : null);
      DM.fx.stain(p.x, p.y, 18 + Math.random() * 10, 0.16, p.type === 'hard' ? '40,60,74' : '20,24,34');
      if (p.type === 'gold' && Math.random() < 0.24) {
        st.ballsLeft++;
        DM.ui.toast('流 金 · 得 珠', 'rgba(232,190,110,.95)', false, 'gold', true);
        DM.audio.bucket();
      }
      // 溅墨 / 雷络 / 炸墨 —— 只传播一层，避免自我供能的无限连锁
      var chainable = !this._cd;
      var sp = st.lv('溅');
      if (sp && chainable) this.splashAround(p.x, p.y, 46 + sp * 14, 0.8, b);
      if (chainable && p.type === 'hard' && st.lv('脆')) this.splashAround(p.x, p.y, 46, 1, b);
      var lz = st.lv('雷');
      if (lz && chainable) this.chainBolt(p.x, p.y, 2 + lz * 2, 170, b);
      var bz = st.lv('炸');
      if (bz && chainable && this.combo.step > 0 && this.combo.step % (13 - bz * 2) === 0) {
        this.explode(p.x, p.y, 84 + bz * 16, b);
      }
      // 渊墨复渗（在帧末进行，先让绝墨判定完成）
      if (this.st && !this.layer.boss) this.layer.since++;
      this.checkClear();
    },

    seep: function (want) {
      var pegs = this.world.pegs, L = this.layer;
      var surge = !!want;
      if (!want) want = DM.clamp(2 + Math.floor(this.st.depth / 4), 2, 4);
      var made = 0;

      for (var tries = 0; tries < 90 && made < want && pegs.length < 320; tries++) {
        var x = DM.rand(DM.WALL + 26, DM.W - DM.WALL - 26);
        var y = DM.rand(92, DM.FLOOR_Y - 34);
        var near = 1e9;
        for (var i = 0; i < pegs.length; i++) {
          if (pegs[i].dead) continue;
          var d = DM.dist2(x, y, pegs[i].x, pegs[i].y);
          if (d < near) near = d;
          if (near < 25 * 25) break;
        }
        if (near < 25 * 25) continue;
        pegs.push({
          x: x, y: y, type: 'dot', hp: 1, maxHp: 1, glow: 0.9, shake: 0.5, pop: 0.12,
          phase: Math.random() * 6.2832, wob: Math.random() * 6.2832
        });
        L.total++; made++;
        DM.fx.ring(x, y, 2, 20, 0.45, '160,170,190', 1.4);
        DM.fx.stain(x, y, 16, 0.14, '22,28,40');
      }

      // 数组已满：让碎掉的旧墨重新渗出（碎墨累计制,进度不倒退）
      if (made < want) {
        var deads = [];
        for (var di = 0; di < pegs.length; di++) if (pegs[di].dead && pegs[di].type !== 'seal') deads.push(pegs[di]);
        DM.shuffle(deads);
        for (var k = 0; k < deads.length && made < want; k++) {
          var rp = deads[k];
          rp.dead = false; rp.hp = rp.maxHp; rp.pop = 0.12; rp.glow = 1;
          made++;
          DM.fx.ring(rp.x, rp.y, 2, 22, 0.5, '150,160,190', 1.6);
          DM.fx.stain(rp.x, rp.y, 14, 0.12, '22,28,40');
        }
      }
      if (made) {
        DM.audio.wall();
        if (!surge && this.st.depth >= 3) DM.ui.toast('渊 墨 复 渗', 'rgba(150,160,190,.85)', false, 'seep', true);
      }
    },

    waterline: function () {
      return Math.min(150, 46 + this.st.depth * 5);
    },

    aliveCount: function () {
      var a = 0, p = this.world.pegs;
      for (var i = 0; i < p.length; i++) if (!p[i].dead) a++;
      return a;
    },

    // 渊底翻墨：活墨低于水位线即补，与击杀数解耦，打破「没墨→碎不动→不渗墨」的死锁
    surgeTick: function (dt) {
      if (!this.st) return;
      this._surgeT = (this._surgeT || 0) + dt;
      if (this._surgeT < 0.16) return;
      this._surgeT = 0;
      var line = this.waterline(), alive = this.aliveCount();
      if (alive >= line) return;
      this.seep(Math.min(22, 10 + Math.floor(this.st.depth * 0.7)));
      if (alive < line * 0.4) {
        DM.ui.toast('渊 底 翻 墨', 'rgba(104,196,196,.92)', false, 'surge', true);
        DM.fx.ring(DM.W / 2, DM.FLOOR_Y - 16, 24, 320, 0.85, '104,196,196', 3);
      }
    },

    splashAround: function (x, y, r, dmg, b) {
      var pegs = this.world.pegs;
      this._cd = 1;
      for (var i = 0; i < pegs.length; i++) {
        var p = pegs[i];
        if (p.dead || p.type === 'seal') continue;
        if (DM.dist2(x, y, p.x, p.y) < r * r) {
          p.hp -= dmg; p.glow = 0.7; p.shake = 0.6;
          if (p.hp <= 0) this.onHit(p, b, true);
          else this.addCombo(p, b, 0.3, true);
        }
      }
      this._cd = 0;
    },

    chainBolt: function (x, y, n, r, b) {
      var pegs = this.world.pegs, got = [];
      for (var i = 0; i < pegs.length; i++) {
        var p = pegs[i];
        if (p.dead) continue;
        var d = DM.dist(x, y, p.x, p.y);
        if (d < r && d > 6) got.push({ p: p, d: d });
      }
      got.sort(function (a, c) { return a.d - c.d; });
      var m = Math.min(n, got.length);
      for (var k = 0; k < m; k++) {
        var pp = got[k].p;
        DM.fx.bolt(x, y, pp.x, pp.y, null, k * 0.05);
        pp.hp -= 1; pp.glow = 1;
        this._cd = 1;
        if (pp.hp <= 0) this.onHit(pp, b, true);
        else this.addCombo(pp, b, 0.5, true);
        this._cd = 0;
      }
    },

    explode: function (x, y, r, b) {
      DM.fx.ring(x, y, 6, r, 0.42, '206,64,48', 5);
      DM.fx.splash(x, y, 26, 'red', 320, 0.7);
      DM.fx.flash('240,220,200', 0.24);
      DM.fx.shake(9, 0.3);
      DM.audio.crack(this.combo.step);
      this.splashAround(x, y, r, 3, b);
    },

    addCombo: function (p, b, frac, quiet) {
      var st = this.st;
      if (!st) return;
      this.combo.step++;
      this.combo.hits++;
      if (this.shot) this.shot.hits++;
      var cs = this.combo.step, cp = this.combo.cap;
      var m = 1 + (cs <= cp ? cs : cp + Math.sqrt((cs - cp) * Math.max(1, cp))) * 0.085;
      this.combo.mult = m;
      var base = (BASE[p.type] || 12) * frac;
      var rep = Math.pow(1.7, st.lv('复'));
      var sc = base * m * rep * st.scoreMul * (b && b.small ? 0.5 : 1);
      st.score += sc;
      if (this.shot) this.shot.score += sc;
      if (!quiet) {
        DM.audio.hit(this.combo.step, frac > 0.9);
        if (frac > 0.9 && this.combo.step % 10 === 0) {
          DM.ui.toast(this.combo.step + ' 连', 'rgba(232,190,110,.95)', true, 'combo');
          DM.fx.shake(4, 0.2);
        }
        if (frac > 0.9 && this.combo.step % 2 === 0) {
          DM.fx.text(p.x, p.y - 12, '+' + Math.round(sc),
            this.combo.step > 18 ? '232,190,110' : '236,236,228', 14 + Math.min(9, this.combo.step * 0.3), 0.75);
        }
      }
    },

    fireSeal: function (p, b) {
      if (p.sealDone) return;
      var st = this.st;
      if (this.shot && this.shot.seals >= this.shot.sealAllow) {
        DM.ui.toast('印 已 应 验 数 尽', 'rgba(226,226,220,.6)', false, 'sealmax', true);
        p.glow = 0.5;
        return;
      }
      if (p.hp <= 0) { p.dead = true; this.layer.dead++; }
      p.sealDone = true;
      if (this.shot) this.shot.seals++;
      var times = 1 + st.lv('印');
      DM.fx.ring(p.x, p.y, 8, 130, 0.5, '206,64,48', 4);
      DM.fx.splash(p.x, p.y, 20, 'red', 260, 0.7);
      DM.fx.text(p.x, p.y - 26, sealName(p.seal), '206,90,70', 20, 1.0, -26);
      DM.audio.crack(this.combo.step + 3);
      DM.fx.shake(6, 0.25);
      for (var i = 0; i < times; i++) this.applySeal(p.seal, p, b, i);
    },

    applySeal: function (id, p, b, k) {
      var st = this.st;
      if (id === 'burst') this.explode(p.x, p.y, 96 + k * 20, b);
      else if (id === 'rain') {
        for (var i = 0; i < 4 + k * 2; i++) {
          if (this.balls.length > 13) break;
          var ang = -0.4 + i * 0.2 + DM.rand(-0.06, 0.06);
          this.balls.push(this.makeBall(Math.PI / 2 + ang * 0.3, DM.rand(320, 520), true, '206,64,48'));
        }
      }
      else if (id === 'slow') { this.tsLock = 2.4; this.tsTarget = 0.42; }
      else if (id === 'score') {
        var add = 220 + st.depth * 60;
        st.score += add;
        DM.fx.text(p.x, p.y - 44, '+' + add, '232,190,110', 24, 1.1, -30);
      }
      else if (id === 'move') {
        var target = b ? b.x : DM.W / 2;
        this.world.bucket.x = DM.clamp(target, DM.WALL + 60, DM.W - DM.WALL - 60);
        this.world.bucket.glow = 1;
        DM.ui.toast('移 壶 · 待 珠 归 壶', 'rgba(226,226,220,.8)', false, 'move');
      }
      else if (id === 'chain') this.chainBolt(p.x, p.y, 6 + k * 3, 260, b);
    },

    /* ───────── 一发结束 ───────── */
    checkClear: function () {
      var L = this.layer;
      if (this.state !== 'fly') return;
      if (!this.world.boss && L.dead >= L.need) {
        if (!this.pending) { this.pending = { kind: 'clear', t: 0.85 }; this.slowFor(0.7, 0.35); }
      }
    },

    slowFor: function (dur, ts) {
      this.tsLock = Math.max(this.tsLock, dur);
      this.tsTarget = Math.min(this.tsTarget, ts);
    },

    onBucket: function (b) {
      var st = this.st;
      // 落壶奖励每发只给一次,且只加剩余珠(不动本层总珠,否则评级分母虚增)
      if (this.shot && !this.shot.bucketed) {
        st.ballsLeft++;
        var j = st.lv('疾');
        if (j) st.ballsLeft += j;
      }
      if (this.shot) this.shot.bucketed = true;
      this.world.bucket.glow = 1;
      DM.audio.bucket();
      DM.fx.ring(b.x, DM.FLOOR_Y + 6, 8, 90, 0.5, '236,236,228', 3);
      DM.fx.splash(b.x, DM.FLOOR_Y, 22, 'white', 240, 0.8);
      DM.fx.text(b.x, DM.FLOOR_Y - 20, '续 墨', '236,236,228', 22, 1.1, -34);
      DM.ui.toast('落 壶 · 续 珠', 'rgba(226,226,220,.9)', false, 'bucket', true);
      if (this.shot) this.shot.keptCombo = true;
      b.dead = true;
      DM.fx.shake(5, 0.25);
    },

    onLost: function (b) {
      var st = this.st;
      if (!b.small) DM.fx.stain(b.x, DM.H - 10, 26, 0.2, '16,18,26');
      if (st.lv('魂') && this.shot && this.shot.revive > 0 && Math.random() < 0.34 + st.lv('魂') * 0.14) {
        this.shot.revive--;
        var bk = this.world.bucket;
        b.x = bk.x; b.y = DM.FLOOR_Y - 4;
        b.vx = DM.rand(-90, 90); b.vy = -DM.rand(760, 940);
        b.dead = false; b.age = 0; b.depth = 99;
        DM.fx.ring(bk.x, DM.FLOOR_Y, 6, 70, 0.4, '232,190,110', 3);
        DM.audio.pick(2);
        DM.ui.toast('还 魂', 'rgba(232,190,110,.95)', false, 'revive', true);
        return false;
      }
      b.dead = true;
      return true;
    },

    endShot: function () {
      var st = this.st, L = this.layer;
      this.balls.length = 0;
      var hits = this.shot ? this.shot.hits : 0;
      if (!L.boss) {
        var k = this.shot ? this.shot.kills : 0;
        // 能力估计跟随真实产出,但单珠爆发最多拉动 4 倍,免得一次神球把下层配额顶上天
        var guard = Math.max(this.shotCap(), st.avgKill * 4);
        st.avgKill = st.avgKill * 0.76 + Math.min(k, guard) * 0.24;
      }

      // 余响
      var echo = st.lv('响');
      if (echo && !this.shot.echoDone && hits >= 4) {
        var n = Math.min(9, Math.ceil(hits / 5) * echo);
        this.shot.echoDone = true;
        st.ballsLeft += 0;
        DM.ui.toast('余 响 · ' + n + ' 珠 自 壶 起', 'rgba(104,196,196,.95)', false, 'echo', true);
        DM.audio.pick(1);
        for (var i = 0; i < n; i++) {
          if (this.balls.length > 12) break;
          var ang = -Math.PI / 2 + DM.rand(-0.55, 0.55);
          var bb = this.makeBall(ang, DM.rand(680, 940), true, '104,196,196');
          bb.x = this.world.bucket.x + DM.rand(-30, 30);
          bb.y = DM.FLOOR_Y - 2;
          this.balls.push(bb);
        }
        this.state = 'fly';
        return;
      }

      if (L.dead >= L.need || L.bossKill) return this.clearLayer();

      // 渊力衰竭:珠池将尽而配额未达,深渊的抵抗开始松动。
      // 保证「凑不齐目标」不可能发生,压力改由评级与分数承担。
      if (st.ballsLeft <= Math.max(1, Math.ceil(st.balls * 0.18)) && !L.boss) {
        var before = L.need;
        L.need = Math.max(L.dead + 10, Math.round(L.need * 0.86));
        if (L.need < before && !this._fatigue) { this._fatigue = true; DM.ui.toast('渊 力 衰 竭', 'rgba(150,160,190,.85)', false, 'fatigue', true); }
      }

      if (st.ballsLeft <= 0) return this.breakInk();

      if (!(this.shot && this.shot.keptCombo)) { this.combo.step = 0; this.combo.hits = 0; this.combo.mult = 1; }
      this.state = 'aim';
      this.saveSlot(false);
    },

    breakInk: function () {
      var st = this.st;
      st.lives--;
      DM.audio.hurt();
      DM.fx.flash('206,64,48', 0.4);
      DM.fx.shake(16, 0.6);
      if (st.lives <= 0) {
        if (st.perk('revive') > 0 && !st.usedRevive) {
          st.usedRevive = true; st.lives = 1;
          DM.ui.toast('续 砚 · 最后 一 角', 'rgba(232,190,110,.95)', true);
        } else return this.gameOver();
      }
      DM.ui.toast('砚 裂 · 残 珠 相 济', 'rgba(206,64,48,.95)', true, 'inkbreak', true);
      var give = st.lives >= 2 ? 2 : 1;
      st.ballsLeft += give;
      st.balls = Math.max(st.balls, st.ballsLeft);
      this.state = 'aim';
      this.pending = null;
      this.saveSlot(false);
    },

    clearLayer: function () {
      var st = this.st, L = this.layer;
      if (this.state === 'clear') return;
      this.state = 'clear';
      this.balls.length = 0;
      this.pending = null;
      this.tsTarget = 1; this.tsLock = 0;
      var ratio = st.balls ? DM.clamp(st.ballsLeft / st.balls, 0, 1) : 0;
      var gi = ratio > 0.62 ? 3 : ratio > 0.36 ? 2 : ratio > 0.12 ? 1 : 0;
      var bonus = Math.round((180 + st.depth * 95) * (1 + ratio * 2.2) * (gi === 3 ? 1.45 : 1) + L.dead * 3);
      var pg = this.world.pegs, alive = 0;
      for (var ai = 0; ai < pg.length; ai++) if (!pg[ai].dead) alive++;
      var perfect = !!this.perfectShot || alive === 0;
      if (perfect) { bonus += 500 + st.depth * 130; st.perfects++; }
      st.score += bonus;
      st.marrow += 1 + (st.depth % 3 === 0 ? 1 : 0);
      st.bestGrade = Math.max(st.bestGrade, gi);
      DM.save.data.bestDepth = Math.max(DM.save.data.bestDepth, st.depth);
      DM.audio.clear();
      DM.fx.flash('236,236,228', 0.5);
      DM.fx.shake(12, 0.5);
      // 全屏水墨绽放
      for (var i = 0; i < 26; i++) {
        var x = DM.rand(60, DM.W - 60), y = DM.rand(90, DM.FLOOR_Y - 30);
        DM.fx.splash(x, y, 6, i % 4 === 0 ? 'red' : i % 5 === 0 ? 'gold' : 'white', 200, 0.9);
        DM.fx.stain(x, y, DM.rand(24, 60), 0.2, '18,22,32');
      }
      this.perfectShot = false;
      DM.audio.updateDrone(Math.min(6, st.depth / 2));
      var self = this;
      setTimeout(function () {
        if (!self.st || self.state !== 'clear') return;
        DM.ui.show('clear', {
          depth: st.depth, dead: L.dead, left: st.ballsLeft, bonus: bonus,
          score: st.score, gradeW: GRADES[gi], perfect: perfect,
          note: perfect ? '绝 墨 一 击 · 全 场 皆 碎' : (gi === 3 ? '举 重 若 轻' : '')
        });
      }, 900);
    },

    afterClear: function () { this.offerChoice(); },

    offerChoice: function () {
      var st = this.st;
      var pool = DM.UPGRADES.filter(function (u) {
        if ((st.lv(u.id) || 0) >= u.max) return false;
        if (u.id === '润' && st.lives >= st.maxLives) return false;
        return true;
      });
      var cards = [], guard = 0;
      var depthBias = DM.clamp(st.depth / 26, 0, 0.82);
      while (cards.length < 3 && guard++ < 300) {
        var cand = pool.length ? pool : DM.UPGRADES;
        var u = DM.weightedPick(cand, function (x) {
          var w = [10, 6, 3, 1.1][x.r];
          if (x.r >= 2) w *= 0.3 + depthBias * 2.6;
          var have = st.lv(x.id);
          if (have) w *= 0.55;
          return w;
        });
        if (!u || cards.indexOf(u) >= 0) continue;
        if (u.r === 0 && cards.filter(function (c) { return c.r === 0; }).length >= 2) continue;
        cards.push(u);
      }
      this.choiceCards = cards;
      this.state = 'choice';
      DM.ui.show('choice', { cards: cards, depth: st.depth, rerolls: st.rerolls });
    },

    reroll: function () {
      var st = this.st;
      if (st.rerolls <= 0) return;
      st.rerolls--;
      DM.audio.ui(false);
      this.offerChoice();
    },

    choose: function (id) {
      var st = this.st, u = DM.upById[id];
      if (!u || st.lv(id) >= u.max) return;
      st.up[id] = (st.up[id] || 0) + 1;
      if (st.order.indexOf(id) < 0) st.order.push(id);
      if (id === '润') { st.lives = Math.min(st.maxLives + 1, st.lives + 1); st.maxLives = Math.max(st.maxLives, st.lives); }
      DM.audio.pick(u.r);
      DM.save.data.bestScore = Math.max(DM.save.data.bestScore, Math.round(st.score));
      DM.save.flush();
      DM.ui.hide();
      this.state = 'aim';
      st.depth++;
      st.rerolls = Math.max(st.rerolls, 1 + (st.depth % 4 === 0 ? 1 : 0));
      this.newLayer();
    },

    // 本局结算:死亡与中途弃墨走同一条账
    settle: function () {
      var st = this.st;
      if (!st) return null;
      var s = DM.save.data;
      var earned = st.marrow + Math.floor(st.depth / 2);
      s.marrow += earned;
      s.bestDepth = Math.max(s.bestDepth, st.depth);
      s.bestScore = Math.max(s.bestScore, Math.round(st.score));
      s.totalScore += Math.round(st.score);
      if (st.depth > 1) s.clears += st.depth - 1;
      var rec = st.depth > 1 && st.depth >= s.bestDepth;
      DM.save.flush();
      this.st = null;
      return { earned: earned, rec: rec, depth: st.depth, score: st.score, hits: st.hits, perfects: st.perfects };
    },

    gameOver: function () {
      var st = this.st;
      this.state = 'over';
      this.clearSlot();
      var r = this.settle() || {};
      DM.audio.hurt();
      DM.audio.stopDrone();
      DM.fx.fade('10,11,16', 0.9);
      var self = this;
      setTimeout(function () {
        if (self.state !== 'over') return;
        DM.ui.show('over', {
          depth: r.depth, score: r.score, hits: r.hits, perfects: r.perfects,
          marrow: r.earned, record: r.rec
        });
      }, 700);
    },

    togglePause: function () {
      if (this.state === 'pause') {
        this.state = this.prevState || 'aim';
        DM.ui.hide();
      } else if (this.state === 'aim' || this.state === 'fly') {
        var flew = this.state === 'fly';
        this.prevState = this.state;
        this.state = 'pause';
        DM.ui.show('pause', { depth: this.st.depth, score: this.st.score, saved: this.saveSlot(flew) });
      }
    },

    /* ───────── 输入 ───────── */
    bindInput: function () {
      var self = this, cv = this.canvas;
      function pos(e) {
        var r = cv.getBoundingClientRect();
        if (!r.width || !r.height) return { x: DM.MUZZLE.x, y: DM.H * 0.6 };
        var t = e.touches ? e.touches[0] : e;
        return { x: (t.clientX - r.left) / r.width * DM.W, y: (t.clientY - r.top) / r.height * DM.H };
      }
      function move(e) {
        var p = pos(e);
        self.mouse.x = p.x; self.mouse.y = p.y; self.mouse.has = true;
        self.updateAim();
        if (e.cancelable) e.preventDefault();
      }
      function down(e) {
        DM.audio.unlock();
        if (self.state !== 'aim') return;
        move(e);
        self.aim.charging = true; self.aim.charge = 0;
        if (e.cancelable) e.preventDefault();
      }
      function up(e) {
        if (self.state === 'aim' && self.aim.charging) {
          self.launch(self.aim.power);
        }
        self.aim.charging = false;
      }
      cv.addEventListener('pointermove', move);
      cv.addEventListener('pointerdown', down);
      window.addEventListener('pointerup', up);
      cv.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('contextmenu', function (e) { if (e.target === cv) e.preventDefault(); });
      window.addEventListener('keydown', function (e) { self.key(e); });
    },

    key: function (e) {
      var k = e.key.toLowerCase();
      if (this.state === 'title') {
        if (k === 'enter' || k === ' ') { DM.audio.unlock(); this.startRun(); e.preventDefault(); }
        return;
      }
      if (this.state === 'choice' || this.state === 'over' || this.state === 'clear') {
        if (k === '1' || k === '2' || k === '3') {
          var idx = +k - 1;
          if (this.state === 'choice' && this.choiceCards && this.choiceCards[idx]) {
            var uu = this.choiceCards[idx];
            if (this.st.lv(uu.id) < uu.max) { DM.audio.unlock(); this.choose(uu.id); }
          }
        }
        if (k === 'r' && this.state === 'choice') this.reroll();
        if (k === 'enter' || k === ' ') {
          if (this.state === 'clear') this.afterClear();
          else if (this.state === 'over') this.startRun();
        }
        return;
      }
      if (k === 'p' || k === 'escape') { this.togglePause(); return; }
      if (k === 'm') { DM.audio.unlock(); DM.audio.toggle(); DM.ui.syncVol(); return; }
      if (this.state !== 'aim') return;
      if (k === 'arrowleft' || k === 'a') { this.aim.ang = DM.clamp(this.aim.ang - 0.035, 0.14, Math.PI - 0.14); this.updateAim(); }
      else if (k === 'arrowright' || k === 'd') { this.aim.ang = DM.clamp(this.aim.ang + 0.035, 0.14, Math.PI - 0.14); this.updateAim(); }
      else if (k === ' ') { this.launch(this.aim.charging ? this.aim.power : 0.55); e.preventDefault(); }
    },

    updateAim: function () {
      if (this.state !== 'aim' || !this.mouse.has) return;
      var dx = this.mouse.x - DM.MUZZLE.x, dy = this.mouse.y - DM.MUZZLE.y;
      if (dy < 18) dy = 18;
      var a = Math.atan2(dy, dx);
      this.aim.ang = DM.clamp(a, 0.14, Math.PI - 0.14);
    },

    buildAimPath: function () {
      this.aimPath.length = 0;
      if (this.state !== 'aim') return;
      var st = this.st;
      var spd = (DM.LAUNCH_MIN + (DM.LAUNCH_MAX - DM.LAUNCH_MIN) * this.aim.power) * (1 + (st ? st.lv('疾') : 0) * 0.09);
      var b = this.makeBall(this.aim.ang, spd, false);
      var gm = st ? st.gravityMul : 1;
      var maxB = 1 + (st ? st.lv('窥') : 0);
      var bounces = 0, dt = 1 / 110, i, pegs = this.world.pegs;
      for (i = 0; i < 240 + maxB * 70 && bounces <= maxB; i++) {
        b.vy += DM.GRAVITY * gm * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        var hitWall = false;
        var L = DM.WALL + b.r, R = DM.W - DM.WALL - b.r, T = DM.CEIL + b.r;
        if (b.x < L) { b.x = L; b.vx = -b.vx * 0.95; hitWall = true; }
        else if (b.x > R) { b.x = R; b.vx = -b.vx * 0.95; hitWall = true; }
        if (b.y < T) { b.y = T; b.vy = -b.vy * 0.95; hitWall = true; }
        if (hitWall) bounces++;
        for (var k = 0; k < pegs.length; k++) {
          var p = pegs[k];
          if (p.dead) continue;
          var rr = b.r + (p.r || DM.PEG_R);
          var dx2 = b.x - p.x, dy2 = b.y - p.y, d2 = dx2 * dx2 + dy2 * dy2;
          if (d2 < rr * rr) {
            var d = Math.max(0.01, Math.sqrt(d2));
            var nx = dx2 / d, ny = dy2 / d, vn = b.vx * nx + b.vy * ny;
            b.x = p.x + nx * (rr + 0.6);
            b.y = p.y + ny * (rr + 0.6);
            if (vn < 0) { b.vx -= 1.62 * vn * nx; b.vy -= 1.62 * vn * ny; bounces++; }
            break;
          }
        }
        if (b.y > DM.FLOOR_Y) break;
        if (i % 2 === 0 && this.aimPath.length < 70) this.aimPath.push({ x: b.x, y: b.y });
      }
    },

    /* ───────── 帧 ───────── */
    frame: function (ts) {
      requestAnimationFrame(this.frame.bind(this));
      var dt = (ts - this.lastTs) / 1000;
      this.lastTs = ts;
      if (!(dt > 0)) dt = 1 / 60;
      dt = Math.min(dt, 0.05);
      this.update(dt);
      var c = this.ctx;
      var dpr = this.dpr || 1;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      DM.render(c, this);
      if (this.st) DM.ui.setHud();
    },

    update: function (dt) {
      this.t += dt;
      var st = this.st;

      // 时间缩放
      if (this.tsLock > 0) { this.tsLock -= dt; if (this.tsLock <= 0) this.tsTarget = 1; }
      var want = this.tsTarget;
      if (st && st.lv('滞') && this.state === 'fly') {
        var mx = 0;
        for (var q = 0; q < this.balls.length; q++) mx = Math.max(mx, Math.hypot(this.balls[q].vx, this.balls[q].vy));
        if (mx > 900) want = Math.min(want, 0.62);
      }
      this.tsNow = DM.approach(this.tsNow, want, dt * 3.4);

      if (this.state === 'pause' || this.state === 'over' || this.state === 'choice' || this.state === 'clear') {
        DM.fx.update(dt * 0.35);
        return;
      }

      // 墨壶往复
      var bk = this.world.bucket;
      if (bk) {
        bk.x += bk.dir * bk.spd * dt;
        var lim = DM.W - DM.WALL - bk.w / 2 - 8;
        if (bk.x > lim) { bk.x = lim; bk.dir = -1; }
        if (bk.x < DM.WALL + bk.w / 2 + 8) { bk.x = DM.WALL + bk.w / 2 + 8; bk.dir = 1; }
        bk.glow = Math.max(0, bk.glow - dt * 1.6);
      }
      // 险物
      var haz = this.world.hazards;
      for (var h = 0; h < haz.length; h++) if (haz[h].kind === 'spinner') haz[h].ang += haz[h].spd * dt;

      // Boss
      var bs = this.world.boss;
      if (bs && !bs.dead) {
        bs.t += dt;
        bs.hitFlash = Math.max(0, bs.hitFlash - dt * 2.4);
        bs.x += Math.sin(bs.t * 0.55) * 42 * dt * bs.dir;
        bs.y = 190 + Math.sin(bs.t * 0.9) * 26;
        bs.x = DM.clamp(bs.x, 120, DM.W - 120);
        bs.eat -= dt * (this.state === 'fly' ? 1 : 0.35);
        if (bs.eat <= 0) {
          bs.eat = DM.clamp(4.2 - st.depth * 0.06, 1.6, 4.2);
          var cand = null, cd = 1e9;
          for (var pi = 0; pi < this.world.pegs.length; pi++) {
            var pg = this.world.pegs[pi];
            if (pg.dead || pg.type === 'seal') continue;
            var dd = DM.dist2(bs.x, bs.y, pg.x, pg.y);
            if (dd < cd) { cd = dd; cand = pg; }
          }
          if (cand) {
            cand.dead = true;
            this.layer.total = Math.max(1, this.layer.total - 1);
            DM.fx.splash(cand.x, cand.y, 8, 'ink', 130, 0.5);
            DM.fx.ring(bs.x, bs.y, bs.r, bs.r + 30, 0.4, '150,110,190', 2);
            DM.audio.wall();
          }
        }
      }

      // 物理
      if (this.state === 'fly') {
        var self = this;
        this.acc += dt;
        var guard = 0;
        var ev = {
          hit: function (p, b, q) { self.onHit(p, b, q); },
          wall: function (b, s) { DM.audio.wall(); DM.fx.splash(b.x, b.y, 3, 'white', 90, 0.25); void s; },
          clank: function (b) { DM.audio.clank(); DM.fx.shake(3, 0.1); DM.fx.splash(b.x, b.y, 4, 'white', 140, 0.3); },
          bossHit: function (bo, b) { self.bossHit(bo, b); },
          canSplit: function () { return self.balls.length < 13; },
          split: function (b, vx, vy) {
            var nb = {
              x: b.x, y: b.y, vx: vx * 0.9, vy: vy * 0.9, r: 6.6, age: 0, depth: b.depth,
              iframe: 0, slowed: 0, swirled: 0, hot: 1, small: true, col: '206,64,48', trail: [], dead: false, lastT: 0, pierce: b.pierce
            };
            self.balls.push(nb);
            DM.fx.ring(b.x, b.y, 4, 34, 0.3, '206,64,48', 2);
            DM.audio.ui(true);
          },
          bucket: function (b) { self.onBucket(b); },
          lost: function (b) { return self.onLost(b); }
        };
        while (this.acc >= DM.STEP && guard++ < 12) {
          this.acc -= DM.STEP;
          var sdt = DM.STEP * this.tsNow;
          for (var i = this.balls.length - 1; i >= 0; i--) {
            var b = this.balls[i];
            if (b.dead) { this.balls.splice(i, 1); continue; }
            if (b.iframe > 0) b.iframe -= sdt;
            DM.Physics.step(b, this.world, st, ev, sdt);
            if (b.slowed > 0) b.slowed = Math.max(0, b.slowed - sdt);
            if (b.hot > 0) b.hot = Math.max(0, b.hot - sdt * 2);
          }
        }
        // 尾迹 + 汲痕
        var dlv = st.lv('痕');
        for (var bi = this.balls.length - 1; bi >= 0; bi--) {
          var bb = this.balls[bi];
          if (bb.lastT === undefined) bb.lastT = 0;
          bb.lastT += dt;
          if (bb.lastT > 0.012) {
            bb.lastT = 0;
            bb.trail.push({ x: bb.x, y: bb.y });
            if (bb.trail.length > 26) bb.trail.shift();
            DM.fx.stain(bb.x, bb.y, 12, 0.05, '16,20,30');
          }
          if (dlv && bb.trail.length > 3) {
            var pts = bb.trail;
            for (var ti = pts.length - 1, tn = 0; ti >= 0 && tn < 2; ti -= 9, tn++) {
              var tp = pts[ti];
              for (var pk = 0; pk < this.world.pegs.length; pk++) {
                var pp = this.world.pegs[pk];
                if (pp.dead || pp.type === 'hard') continue;
                if (DM.dist2(tp.x, tp.y, pp.x, pp.y) < 640) {
                  pp.hp -= dt * dlv * 0.62;
                  pp.glow = Math.max(pp.glow, 0.4);
                  if (pp.hp <= 0) this.onHit(pp, bb, true);
                }
              }
            }
          }
        }
        if (this.layer.since >= this.layer.regen && !this.world.boss) {
          this.layer.since = 0; this.seep();
        }
        if (!this.balls.length && !this.pending) this.endShot();
      } else if (this.state === 'aim') {
        if (this.aim.charging) {
          this.aim.charge = Math.min(1, this.aim.charge + dt / 0.85);
          this.aim.power = this.aim.charge;
        } else {
          this.aim.power = DM.approach(this.aim.power, 0.55, dt * 1.5);
        }
        this.buildAimPath();
      } else if (this.state === 'title') {
        this.demoT -= dt;
        if (this.demoT <= 0 && this.world.pegs.length) {
          this.demoT = DM.rand(0.5, 1.4);
          var pickPeg = DM.pick(this.world.pegs);
          if (pickPeg) {
            pickPeg.glow = 1;
            DM.fx.ripple(pickPeg.x, pickPeg.y);
            DM.audio.hit(Math.random() * 9 | 0, false);
          }
        }
      }

      // pending 结算倒计时
      if (this.pending) {
        this.pending.t -= dt;
        if (this.pending.t <= 0) {
          if (this.pending.kind === 'clear') { this.pending = null; this.clearLayer(); }
          else if (this.pending.kind === 'perfect') { this.pending = null; this.perfectBlast(); }
        }
      }
      if (this.world.boss && this.world.boss.dead && this.state === 'fly' && !this.balls.length) this.endShot();
      if (this.state === 'fly' || this.state === 'aim') this.surgeTick(dt);

      // 渗出：新墨缓缓涨满
      var pegs = this.world.pegs;
      for (var d = 0; d < pegs.length; d++) {
        var pg2 = pegs[d];
        if (pg2.pop < 1) pg2.pop = Math.min(1, pg2.pop + dt * 2.4);
      }

      DM.fx.update(dt);
      if (!this._stainT || this.t - this._stainT > 0.5) { this._stainT = this.t; }
    },

    bossHit: function (bs, b) {
      var st = this.st;
      bs.hp -= b.small ? 0.85 : 1.6 + st.lv('沉') * 0.5;
      bs.hitFlash = 1;
      this.addCombo({ type: 'hard', x: bs.x + (b.x - bs.x) * 0.6, y: bs.y + (b.y - bs.y) * 0.6 }, b, 1, false);
      DM.fx.splash(b.x, b.y, 12, 'red', 240, 0.6);
      DM.fx.shake(6, 0.2);
      DM.audio.hit(this.combo.step, true);
      if (bs.hp <= 0 && !bs.dead) {
        bs.dead = true;
        this.layer.bossKill = true;
        DM.fx.flash('236,236,228', 0.7);
        DM.fx.shake(20, 0.8);
        for (var i = 0; i < 40; i++) {
          DM.fx.splash(bs.x + DM.rand(-40, 40), bs.y + DM.rand(-40, 40), 5, i % 3 ? 'red' : 'gold', 320, 1.1);
        }
        DM.audio.clear();
        DM.ui.toast('墨 魇 已 灭', 'rgba(206,64,48,.95)', true);
        this.slowFor(0.9, 0.3);
        this.pending = { kind: 'clear', t: 1.1 };
      }
    },

    perfectBlast: function () {
      var st = this.st;
      this.perfectShot = true;
      st.ballsLeft += 2;
      st.balls += 2;
      DM.fx.flash('236,236,228', 0.6);
      DM.ui.toast('绝 墨 · 全 场 尽 碎', 'rgba(232,190,110,.98)', true);
      this.checkClear();
      if (this.state === 'fly' && !this.pending) this.pending = { kind: 'clear', t: 0.7 };
    },

    onAllCleared: function () {
      if (this.perfectPending) return;
      this.perfectPending = true;
      var self = this;
      setTimeout(function () { self.perfectPending = false; self.perfectBlast(); }, 260);
    }
  };

  // 补：完美清场检测
  var _origOnHit = Game.onHit;
  Game.onHit = function (p, b, quiet) {
    _origOnHit.call(this, p, b, quiet);
    if (!this.st || this.state !== 'fly') return;
    var alive = 0;
    for (var i = 0; i < this.world.pegs.length; i++) if (!this.world.pegs[i].dead) alive++;
    if (!alive && !this.perfectShot) this.onAllCleared();
  };

  // 印章名称
  function sealName(id) {
    for (var i = 0; i < DM.SEALS.length; i++) if (DM.SEALS[i].id === id) return DM.SEALS[i].name;
    return '朱印';
  }
})(DM);
