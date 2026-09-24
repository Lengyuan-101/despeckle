window.DM = window.DM || {};

(function (DM) {
  'use strict';

  var parts = [], rings = [], texts = [], shards = [], bolts = [];
  var SHAKE_SCALE = 0.8;   // 震屏总强度:所有碰撞反馈统一走这里
  var shakeMag = 0, shakeT = 0, shakeDur = 1, flashCol = null, flashA = 0, flashEdge = false;
  var stainCv = null, stainCtx = null;

  function newPart() {
    if (parts.length > 620) return null;
    var p = parts.pop();
    if (!p) p = {};
    return p;
  }

  DM.fx = {
    init: function () {
      stainCv = document.createElement('canvas');
      stainCv.width = DM.W; stainCv.height = DM.H;
      stainCtx = stainCv.getContext('2d');
    },
    reset: function () {
      parts.length = 0; rings.length = 0; texts.length = 0; shards.length = 0; bolts.length = 0;
      shakeMag = 0; flashA = 0;
      if (stainCtx) stainCtx.clearRect(0, 0, DM.W, DM.H);
    },
    stain: function (x, y, r, alpha, col) {
      if (!stainCtx) return;
      var g = stainCtx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(' + (col || '18,22,34') + ',' + alpha + ')');
      g.addColorStop(0.6, 'rgba(' + (col || '18,22,34') + ',' + alpha * 0.4 + ')');
      g.addColorStop(1, 'rgba(' + (col || '18,22,34') + ',0)');
      stainCtx.fillStyle = g;
      stainCtx.beginPath();
      stainCtx.arc(x, y, r, 0, 6.2832);
      stainCtx.fill();
    },
    splash: function (x, y, n, col, spd, life) {
      for (var i = 0; i < n; i++) {
        var p = newPart(); if (!p) return;
        var a = Math.random() * 6.2832, s = (spd || 190) * (0.25 + Math.random());
        p.x = x; p.y = y;
        p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - (col === 'ink' ? 40 : 0);
        p.r = 1.2 + Math.random() * 3.4;
        p.life = p.maxLife = (life || 0.62) * (0.5 + Math.random());
        p.g = col === 'gold' ? 420 : 720;
        p.col = col;
        parts.push(p);
      }
    },
    shards: function (x, y, n, col, spd) {
      for (var i = 0; i < n; i++) {
        if (shards.length > 160) return;
        var a = Math.random() * 6.2832, s = (spd || 240) * (0.3 + Math.random());
        shards.push({
          x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 14,
          w: 3 + Math.random() * 8, h: 2 + Math.random() * 4,
          life: 0.5 + Math.random() * 0.5, col: col
        });
      }
    },
    ring: function (x, y, r0, r1, life, col, w) {
      rings.push({ x: x, y: y, r0: r0, r1: r1, r: r0, t: 0, life: life, col: col || '236,236,232', w: w || 2 });
    },
    ripple: function (x, y, col) {
      // 大量碎墨时双环会糊成一片空心的圆,过密就只留单环
      if (rings.length > 46) return;
      DM.fx.ring(x, y, 3, 30, 0.34, col || '200,205,215', 1.2);
    },
    bolt: function (x1, y1, x2, y2, col, delay) {
      if (bolts.length > 40) return;
      var pts = [], n = 7;
      for (var i = 0; i <= n; i++) {
        var t = i / n, jx = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 26;
        var jy = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 26;
        pts.push({ x: DM.lerp(x1, x2, t) + jx, y: DM.lerp(y1, y2, t) + jy });
      }
      bolts.push({ pts: pts, t: -(delay || 0), life: 0.26 + (delay || 0), col: col || '232,190,110' });
    },
    text: function (x, y, str, col, size, life, vy) {
      texts.push({
        x: x + (Math.random() - 0.5) * 8, y: y, s: str, col: col || '236,236,232',
        size: size || 16, t: 0, life: life || 0.85, vy: vy === undefined ? -46 : vy, vx: (Math.random() - 0.5) * 22
      });
    },
    shake: function (mag, dur) {
      mag *= SHAKE_SCALE;
      if (mag > shakeMag * shakeDur) { shakeMag = mag; shakeDur = dur || 0.3; }
      else shakeDur = Math.max(shakeDur * 0.5, dur || 0.3);
      shakeT = shakeDur;
    },
    // 打击高亮:统一压暗并设上限,大量碎墨时连爆才不会晃眼
    flash: function (col, a) {
      flashCol = col; flashEdge = true;
      flashA = Math.max(flashA, Math.min(0.26, a * 0.5));
    },
    // 转场淡入淡出:不压缩,需要铺满时用它
    fade: function (col, a) {
      flashCol = col; flashEdge = false;
      flashA = Math.max(flashA, a);
    },
    clearStain: function () { if (stainCtx) stainCtx.clearRect(0, 0, DM.W, DM.H); },
    fadeStain: function (amt) {
      if (!stainCtx) return;
      stainCtx.globalCompositeOperation = 'destination-out';
      stainCtx.fillStyle = 'rgba(0,0,0,' + amt + ')';
      stainCtx.fillRect(0, 0, DM.W, DM.H);
      stainCtx.globalCompositeOperation = 'source-over';
    },
    update: function (dt) {
      var i, p;
      for (i = parts.length - 1; i >= 0; i--) {
        p = parts[i];
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.vy += p.g * dt;
        p.vx *= 0.995;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      for (i = shards.length - 1; i >= 0; i--) {
        p = shards[i]; p.life -= dt;
        if (p.life <= 0) { shards.splice(i, 1); continue; }
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
      for (i = rings.length - 1; i >= 0; i--) {
        p = rings[i]; p.t += dt;
        if (p.t >= p.life) { rings.splice(i, 1); continue; }
        p.r = DM.lerp(p.r0, p.r1, Math.pow(p.t / p.life, 0.45));
      }
      for (i = texts.length - 1; i >= 0; i--) {
        p = texts[i]; p.t += dt;
        if (p.t >= p.life) { texts.splice(i, 1); continue; }
        p.y += p.vy * dt; p.x += p.vx * dt; p.vy *= 0.94; p.vx *= 0.96;
      }
      for (i = bolts.length - 1; i >= 0; i--) {
        bolts[i].t += dt;
        if (bolts[i].t >= bolts[i].life) bolts.splice(i, 1);
      }
      if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
      else shakeMag = 0;
      if (flashA > 0) flashA = Math.max(0, flashA - dt * 2.6);
      DM.fx.fadeStain(0.012);
    },
    shakeOffset: function () {
      if (shakeT <= 0 || shakeMag <= 0) return { x: 0, y: 0 };
      var k = shakeMag * (shakeT / shakeDur);
      return { x: (Math.random() - 0.5) * 2 * k, y: (Math.random() - 0.5) * 2 * k };
    },
    drawStain: function (c) { if (stainCv) c.drawImage(stainCv, 0, 0); },
    draw: function (c) {
      var i, p, k;
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (i = 0; i < rings.length; i++) {
        p = rings[i]; k = 1 - p.t / p.life;
        c.strokeStyle = 'rgba(' + p.col + ',' + (k * 0.75) + ')';
        c.lineWidth = p.w * k + 0.4;
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.2832); c.stroke();
      }
      c.restore();
      for (i = 0; i < parts.length; i++) {
        p = parts[i]; k = p.life / p.maxLife;
        var col = p.col === 'gold' ? '232,190,110' : p.col === 'red' ? '206,64,48' :
          p.col === 'cyan' ? '104,196,196' : p.col === 'ink' ? '22,26,38' : '226,226,220';
        c.fillStyle = 'rgba(' + col + ',' + (0.28 + k * 0.62) + ')';
        c.beginPath(); c.arc(p.x, p.y, p.r * (0.35 + k * 0.75), 0, 6.2832); c.fill();
      }
      for (i = 0; i < shards.length; i++) {
        p = shards[i]; k = p.life;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.fillStyle = 'rgba(' + (p.col || '226,226,220') + ',' + Math.min(1, k * 1.6) + ')';
        c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        c.restore();
      }
      for (i = 0; i < bolts.length; i++) {
        var bo = bolts[i], bA = 1 - bo.t / bo.life;
        if (bo.t < 0) continue;
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = 'rgba(' + bo.col + ',' + bA + ')';
        c.lineWidth = 1 + bA * 2.6;
        c.beginPath();
        for (var q = 0; q < bo.pts.length; q++) { if (q) c.lineTo(bo.pts[q].x, bo.pts[q].y); else c.moveTo(bo.pts[q].x, bo.pts[q].y); }
        c.stroke();
        c.restore();
      }
      c.textAlign = 'center';
      for (i = 0; i < texts.length; i++) {
        p = texts[i]; k = 1 - p.t / p.life;
        var a = Math.min(1, k * 2.1);
        c.font = '600 ' + p.size + 'px "Songti SC","STSong","SimSun",serif';
        c.fillStyle = 'rgba(0,0,0,' + a * 0.45 + ')';
        c.fillText(p.s, p.x + 1.5, p.y + 1.5);
        c.fillStyle = 'rgba(' + p.col + ',' + a + ')';
        c.fillText(p.s, p.x, p.y);
      }
      if (flashA > 0) {
        if (flashEdge) {
          // 中心留亮、四周泛光:保住打击反馈,不糊住中央视野
          var fg = c.createRadialGradient(DM.W / 2, DM.H / 2, DM.H * 0.16, DM.W / 2, DM.H / 2, DM.H * 0.92);
          fg.addColorStop(0, 'rgba(' + flashCol + ',' + (flashA * 0.2) + ')');
          fg.addColorStop(0.5, 'rgba(' + flashCol + ',' + (flashA * 0.55) + ')');
          fg.addColorStop(1, 'rgba(' + flashCol + ',' + flashA + ')');
          c.fillStyle = fg;
        } else {
          c.fillStyle = 'rgba(' + flashCol + ',' + flashA + ')';
        }
        c.fillRect(0, 0, DM.W, DM.H);
      }
      c.restore();
    },
    count: function () { return parts.length + shards.length + rings.length + texts.length; }
  };
})(DM);
