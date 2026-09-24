window.DM = window.DM || {};

(function (DM) {
  'use strict';

  DM.W = 900;
  DM.H = 660;
  DM.WALL = 18;
  DM.CEIL = 14;
  DM.MUZZLE = { x: DM.W / 2, y: 54 };
  DM.FLOOR_Y = DM.H - 26;
  DM.BALL_R = 9;
  DM.PEG_R = 8.5;
  DM.GRAVITY = 650;
  DM.LAUNCH_MIN = 400;
  DM.LAUNCH_MAX = 640;
  DM.MAX_SPEED = 1500;
  DM.STEP = 1 / 240;
  DM.PEG_HIT_E = 0.9;
  DM.WALL_E = 0.95;

  var SAVE_KEY = 'danmo.save.v1';

  DM.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  DM.lerp = function (a, b, t) { return a + (b - a) * t; };
  DM.rand = function (a, b) { return a + Math.random() * (b - a); };
  DM.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  DM.pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };
  DM.dist = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); };
  DM.dist2 = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  DM.approach = function (v, target, rate) {
    if (v < target) return Math.min(target, v + rate);
    return Math.max(target, v - rate);
  };

  DM.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0, t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  // 从数组里按权重抽取
  DM.weightedPick = function (list, weightFn) {
    var total = 0, i, w;
    for (i = 0; i < list.length; i++) { w = weightFn(list[i]); total += w; }
    if (total <= 0) return list.length ? DM.pick(list) : null;
    var r = Math.random() * total;
    for (i = 0; i < list.length; i++) {
      r -= weightFn(list[i]);
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  };

  DM.save = {
    data: {
      bestDepth: 0, bestScore: 0, totalScore: 0, runs: 0, clears: 0,
      marrow: 0, unlocked: {}, perks: {}, lastChar: 'yiantong', seenHelp: false,
      vol: { master: 0.8, sfx: 0.95, music: 0.55 }, music: 'xingmo', muted: false
    },
    load: function () {
      try {
        var raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
          var o = JSON.parse(raw);
          for (var k in this.data) { if (o[k] !== undefined) this.data[k] = o[k]; }
        }
      } catch (e) { /* 隐私模式下忽略 */ }
      return this.data;
    },
    flush: function () {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { }
    },
    slotKey: 'danmo.slot.v1',
    writeSlot: function (obj) {
      try { localStorage.setItem(this.slotKey, JSON.stringify(obj)); return true; } catch (e) { return false; }
    },
    readSlot: function () {
      try { var raw = localStorage.getItem(this.slotKey); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
    },
    clearSlot: function () {
      try { localStorage.removeItem(this.slotKey); } catch (e) { }
    }
  };
})(DM);
