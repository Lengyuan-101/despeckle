window.DM = window.DM || {};

(function (DM) {
  'use strict';

  function closestOnSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var L2 = dx * dx + dy * dy;
    if (L2 <= 0.0001) return { x: ax, y: ay, t: 0 };
    var t = DM.clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1);
    return { x: ax + dx * t, y: ay + dy * t, t: t };
  }

  // b: 球, world: {pegs,hazards,bucket,boss}, st: 局内状态, ev: 事件回调
  function step(b, world, st, ev, dt) {
    var pegs = world.pegs, haz = world.hazards, i, p;

    // ── 受力 ──
    b.vy += DM.GRAVITY * st.gravityMul * dt;
    // 安全阀：滞留过久的球逐渐被深渊拽下，避免一局拖成泥潭
    if (b.age > 8) b.vy += (b.age - 8) * 640 * dt;

    // 引魂井 / 吞星：拽动附近墨点
    var wellR = st.lv('井') ? 74 + st.lv('井') * 22 : 0;
    var mawR = st.lv('噬') ? 44 + st.lv('噬') * 14 : 0;
    if (wellR || mawR) {
      for (i = 0; i < pegs.length; i++) {
        p = pegs[i];
        if (p.dead) continue;
        var d = DM.dist(b.x, b.y, p.x, p.y);
        if (d < 1 || d > wellR + mawR) continue;
        if (p.type === 'stone') continue;
        if (d < wellR) {
          var pull = (1 - d / wellR) * (52 + st.lv('井') * 34) * dt;
          p.x += (b.x - p.x) / d * pull;
          p.y += (b.y - p.y) / d * pull;
          p.x = DM.clamp(p.x, DM.WALL + 12, DM.W - DM.WALL - 12);
          p.y = DM.clamp(p.y, 78, DM.FLOOR_Y - 22);
        }
        if (mawR && d < mawR && p.type !== 'hard' && p.type !== 'seal') {
          p.hp -= dt * 8;
          if (p.hp <= 0) { ev.hit(p, b, true); }
        }
      }
    }

    // 归一：力竭时自主寻点
    if (st.lv('归')) {
      var sp = Math.hypot(b.vx, b.vy);
      if (sp < 360 && b.age > 2.2) {
        var best = null, bd = 1e9;
        for (i = 0; i < pegs.length; i++) {
          p = pegs[i];
          if (p.dead) continue;
          var dd = DM.dist2(b.x, b.y, p.x, p.y);
          if (dd < bd) { bd = dd; best = p; }
        }
        if (best && bd < 340 * 340) {
          var ang = Math.atan2(best.y - b.y, best.x - b.x);
          var cur = Math.atan2(b.vy, b.vx);
          var diff = ((ang - cur + 3.14159) % 6.28318 + 6.28318) % 6.28318 - 3.14159;
          var turn = DM.clamp(diff, -1, 1) * (3.6 * st.lv('归')) * dt;
          var cs = Math.cos(turn), sn = Math.sin(turn);
          var nvx = b.vx * cs - b.vy * sn, nvy = b.vx * sn + b.vy * cs;
          b.vx = nvx; b.vy = nvy;
        }
      }
    }

    // 漩涡
    for (i = 0; i < haz.length; i++) {
      var hz = haz[i];
      if (hz.kind !== 'vortex') continue;
      var dx = b.x - hz.x, dy = b.y - hz.y;
      var hd = Math.hypot(dx, dy);
      if (hd < hz.r && hd > 4) {
        var f = (1 - hd / hz.r) * 1500 * dt;
        var sgn = hz.spd > 0 ? 1 : -1;
        b.vx += (-dy / hd * sgn) * f + (-dx / hd) * f * 0.28;
        b.vy += (dx / hd * sgn) * f + (-dy / hd) * f * 0.28;
        b.swirled = 0.35;
      }
    }

    // ── 积分 ──
    var sp2 = b.vx * b.vx + b.vy * b.vy;
    if (sp2 > DM.MAX_SPEED * DM.MAX_SPEED) {
      var s = DM.MAX_SPEED / Math.sqrt(sp2); b.vx *= s; b.vy *= s;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.age += dt;

    // ── 边界 ──
    var L = DM.WALL + b.r, Rt = DM.W - DM.WALL - b.r, T = DM.CEIL + b.r;
    if (b.x < L) { b.x = L; b.vx = -b.vx * DM.WALL_E; ev.wall(b, -1); }
    else if (b.x > Rt) { b.x = Rt; b.vx = -b.vx * DM.WALL_E; ev.wall(b, 1); }
    if (b.y < T) { b.y = T; b.vy = -b.vy * DM.WALL_E; ev.wall(b, 0); }

    // ── 墨棘（旋转杆） ──
    for (i = 0; i < haz.length; i++) {
      var sp3 = haz[i];
      if (sp3.kind !== 'spinner') continue;
      var ax = sp3.x - Math.cos(sp3.ang) * sp3.len, ay = sp3.y - Math.sin(sp3.ang) * sp3.len;
      var bx = sp3.x + Math.cos(sp3.ang) * sp3.len, by = sp3.y + Math.sin(sp3.ang) * sp3.len;
      var cp = closestOnSeg(b.x, b.y, ax, ay, bx, by);
      var ddx = b.x - cp.x, ddy = b.y - cp.y, dd = Math.hypot(ddx, ddy);
      var rad = b.r + 7;
      if (dd < rad && dd > 0.001) {
        var nx = ddx / dd, ny = ddy / dd;
        b.x = cp.x + nx * rad; b.y = cp.y + ny * rad;
        var vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= 1.72 * vn * nx; b.vy -= 1.72 * vn * ny; }
        // 杆的转动推动
        var arm = DM.dist(cp.x, cp.y, sp3.x, sp3.y) * sp3.spd;
        b.vx += -ny * arm * 34 * dt * 60;
        b.vy += nx * arm * 34 * dt * 60;
        ev.clank(b);
      }
    }

    // ── 墨魇（Boss） ──
    var bs = world.boss;
    if (bs && !bs.dead) {
      var bdx = b.x - bs.x, bdy = b.y - bs.y, bd2 = Math.hypot(bdx, bdy);
      if (bd2 < bs.r + b.r) {
        var bnx = bdx / bd2, bny = bdy / bd2;
        b.x = bs.x + bnx * (bs.r + b.r); b.y = bs.y + bny * (bs.r + b.r);
        var bvn = b.vx * bnx + b.vy * bny;
        if (bvn < 0) { b.vx -= 1.8 * bvn * bnx; b.vy -= 1.8 * bvn * bny; }
        if (b.iframe <= 0) { ev.bossHit(bs, b); b.iframe = 0.14; }
      }
    }

    // ── 墨点 ──
    var pierce = st.lv('穿');
    var nearest = null, nd = 1e9;
    for (i = 0; i < pegs.length; i++) {
      p = pegs[i];
      if (p.dead) continue;
      var pdx = b.x - p.x, pdy = b.y - p.y;
      var pd2 = pdx * pdx + pdy * pdy;
      var rr = (b.r + (p.r || DM.PEG_R));
      if (pd2 < rr * rr && pd2 < nd) { nd = pd2; nearest = p; }
    }
    if (nearest) {
      p = nearest;
      var pr = p.r || DM.PEG_R;
      var qdx = b.x - p.x, qdy = b.y - p.y, qd = Math.max(0.001, Math.hypot(qdx, qdy));
      var pnx = qdx / qd, pny = qdy / qd;
      b.x = p.x + pnx * (b.r + pr + 0.5);
      b.y = p.y + pny * (b.r + pr + 0.5);

      var solid = p.type === 'hard' || p.type === 'stone' || p.type === 'maw';
      var goesThrough = b.pierce > 0 && p.type !== 'seal' && (pierce >= 2 || !solid);
      if (goesThrough) b.pierce--;
      if (!goesThrough) {
        var e = DM.PEG_HIT_E + (st.lv('沉') ? st.lv('沉') * 0.05 : 0);
        if (p.type === 'maw') e = 0.24;
        var vnn = b.vx * pnx + b.vy * pny;
        if (vnn < 0) {
          b.vx -= (1 + e) * vnn * pnx;
          b.vy -= (1 + e) * vnn * pny;
        }
        b.vx *= 0.996; b.vy *= 0.996;
        b.vx += (Math.random() - 0.5) * 34;
        if (p.type === 'maw') { b.slowed = 0.5; }
      }
      p.shake = 1;
      if (goesThrough) { b.vx *= 0.974; b.vy *= 0.996; }
      p.hp -= goesThrough ? (solid ? 1.6 : 1.5) : 1;
      ev.hit(p, b, false);

      // 分墨
      var maxSplit = st.lv('分') * 1;
      if (maxSplit && b.depth < maxSplit + 1 && !b.noSplit) {
        var count = st.lv('分');
        for (var s2 = 0; s2 < count; s2++) {
          if (!ev.canSplit()) break;
          var spread = (s2 === 0 ? -1 : s2 === 1 ? 1 : (s2 % 2 ? -1 : 1)) * (0.42 + s2 * 0.16);
          var cs2 = Math.cos(spread), sn2 = Math.sin(spread);
          ev.split(b, b.vx * cs2 - b.vy * sn2, b.vx * sn2 + b.vy * cs2);
        }
        b.depth = maxSplit + 1;
      }
    }

    // ── 底部 ──
    if (b.y > DM.FLOOR_Y - 4) {
      var bk = world.bucket;
      if (b.vy > 0 && Math.abs(b.x - bk.x) < bk.w / 2 + b.r * 0.4) {
        ev.bucket(b);
        return true;
      }
    }
    if (b.y > DM.H + 60) { ev.lost(b); return true; }
    return false;
  }

  DM.Physics = { step: step };
})(DM);
