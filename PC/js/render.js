window.DM = window.DM || {};

(function (DM) {
  'use strict';

  var bgTile = null;

  // 简易 value-noise（生成宣纸/云纹底）
  function vnoise(size, n) {
    n = n || 8;
    var g = [], i;
    for (i = 0; i < (n + 1) * (n + 1); i++) g.push(Math.random());
    function at(x, y) {
      var fi = (x / size) * n, fj = (y / size) * n;
      var i0 = Math.floor(fi) % n, j0 = Math.floor(fj) % n;
      var tx = fi - Math.floor(fi), ty = fj - Math.floor(fj);
      var sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      function gi(a, b) { return g[((b % n) * (n + 1)) + (a % n)] || 0; }
      var a = gi(i0, j0), b = gi(i0 + 1, j0), c = gi(i0, j0 + 1), d = gi(i0 + 1, j0 + 1);
      return DM.lerp(DM.lerp(a, b, sx), DM.lerp(c, d, sx), sy);
    }
    return at;
  }

  function buildTiles() {
    var S = 256;
    bgTile = document.createElement('canvas');
    bgTile.width = bgTile.height = S;
    var bc = bgTile.getContext('2d');
    var img = bc.createImageData(S, S), e = img.data;
    var coarse = vnoise(S, 4), fine = vnoise(S, 20);
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var k = (y * S + x) * 4;
        var v = coarse(x, y) * 16 + fine(x, y) * 5;
        e[k] = 11 + v * 0.72; e[k + 1] = 13 + v * 0.8; e[k + 2] = 22 + v; e[k + 3] = 255;
      }
    }
    bc.putImageData(img, 0, 0);
  }

  // 墨点预渲染精灵：晕 + 核 + 墨眼，比逐点 shadowBlur 快得多
  var sprites = {};
  function dotSprite(colStr) {
    var S = 48, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    var x = cv.getContext('2d'), h = S / 2, cr = DM.PEG_R * 1.15;
    var g0 = x.createRadialGradient(h, h, cr * 0.5, h, h, h);
    g0.addColorStop(0, 'rgba(' + colStr + ',0.3)');
    g0.addColorStop(0.45, 'rgba(' + colStr + ',0.09)');
    g0.addColorStop(1, 'rgba(' + colStr + ',0)');
    x.fillStyle = g0; x.fillRect(0, 0, S, S);
    x.fillStyle = 'rgba(' + colStr + ',0.96)';
    x.beginPath(); x.arc(h, h, cr, 0, 6.2832); x.fill();
    x.fillStyle = 'rgba(10,12,18,0.3)';
    x.beginPath(); x.arc(h + cr * 0.3, h + cr * 0.34, cr * 0.42, 0, 6.2832); x.fill();
    return cv;
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  DM.render = function (c, g) {
    var i, p, W = DM.W, H = DM.H;
    if (!bgTile) buildTiles();

    c.save();
    var so = DM.fx.shakeOffset();
    c.translate(so.x, so.y);

    // 底：拓片墨底
    c.fillStyle = '#0a0b10';
    c.fillRect(-40, -40, W + 80, H + 80);
    c.globalAlpha = 0.55;
    c.fillStyle = g.pat1;
    c.fillRect(0, 0, W, H);
    c.globalAlpha = 1;

    // 缓慢流动的暗纹
    var tt = g.t;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (i = 0; i < 3; i++) {
      var yy = (H * 0.3 + i * 190 + Math.sin(tt * 0.12 + i) * 40);
      var gr = c.createLinearGradient(0, yy - 70, 0, yy + 70);
      gr.addColorStop(0, 'rgba(60,70,96,0)');
      gr.addColorStop(0.5, 'rgba(58,68,94,' + (0.05 + i * 0.012) + ')');
      gr.addColorStop(1, 'rgba(60,70,96,0)');
      c.fillStyle = gr;
      c.fillRect(0, yy - 70, W, 140);
    }
    c.restore();

    DM.fx.drawStain(c);

    drawFrame(c, g);
    drawHazards(c, g);
    drawPegs(c, g);
    if (g.world.boss) drawBoss(c, g);
    drawBucket(c, g);
    if (g.state === 'aim') drawAim(c, g);
    drawBalls(c, g);
    DM.fx.draw(c);

    // 暗角
    var vg = c.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.92);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.62)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);

    if (g.timeScale < 0.9) {
      c.strokeStyle = 'rgba(206,64,48,' + (0.1 + (1 - g.timeScale) * 0.14) + ')';
      c.lineWidth = 3;
      c.strokeRect(6, 6, W - 12, H - 12);
    }
    c.restore();
  };

  function drawFrame(c, g) {
    var i;
    c.save();
    // 两侧墨墙
    for (i = 0; i < 2; i++) {
      var x = i ? DM.W - DM.WALL : 0;
      var gr = c.createLinearGradient(x, 0, x + DM.WALL, 0);
      if (i) { gr.addColorStop(0, 'rgba(38,44,62,0)'); gr.addColorStop(1, 'rgba(46,52,72,0.95)'); }
      else { gr.addColorStop(0, 'rgba(46,52,72,0.95)'); gr.addColorStop(1, 'rgba(38,44,62,0)'); }
      c.fillStyle = gr;
      c.fillRect(x, 0, DM.WALL, DM.H);
    }
    c.fillStyle = 'rgba(226,226,220,0.1)';
    c.fillRect(DM.WALL, DM.CEIL, DM.W - DM.WALL * 2, 1.5);
    // 底沿
    c.fillStyle = 'rgba(226,226,220,0.09)';
    c.fillRect(DM.WALL, DM.FLOOR_Y + 16, DM.W - DM.WALL * 2, 1.5);
    c.restore();
  }

  function drawHazards(c, g) {
    var haz = g.world.hazards;
    for (var i = 0; i < haz.length; i++) {
      var h = haz[i];
      if (h.kind === 'vortex') {
        c.save();
        c.translate(h.x, h.y);
        c.rotate(g.t * h.spd * 0.6);
        for (var k = 0; k < 4; k++) {
          c.strokeStyle = 'rgba(96,120,168,' + (0.24 - k * 0.045) + ')';
          c.lineWidth = 2;
          c.beginPath();
          c.arc(0, 0, h.r * (0.32 + k * 0.22), k * 1.1, k * 1.1 + 3.4);
          c.stroke();
        }
        c.restore();
      } else if (h.kind === 'spinner') {
        c.save();
        c.translate(h.x, h.y);
        c.rotate(h.ang);
        c.lineCap = 'round';
        c.strokeStyle = 'rgba(120,132,158,0.25)';
        c.lineWidth = 16;
        c.beginPath(); c.moveTo(-h.len, 0); c.lineTo(h.len, 0); c.stroke();
        c.strokeStyle = '#9aa3bb';
        c.lineWidth = 6;
        c.beginPath(); c.moveTo(-h.len, 0); c.lineTo(h.len, 0); c.stroke();
        c.fillStyle = '#cfcbc0';
        c.beginPath(); c.arc(0, 0, 7, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(206,64,48,0.9)';
        c.beginPath(); c.arc(-h.len, 0, 5, 0, 6.2832); c.fill();
        c.beginPath(); c.arc(h.len, 0, 5, 0, 6.2832); c.fill();
        c.restore();
      }
    }
  }

  function drawPegs(c, g) {
    var pegs = g.world.pegs;
    for (var i = 0; i < pegs.length; i++) {
      var p = pegs[i];
      if (p.dead) continue;
      var sh = p.shake || 0;
      var x = p.x + (sh ? (Math.random() - 0.5) * sh * 3 : 0);
      var y = p.y + (sh ? (Math.random() - 0.5) * sh * 3 : 0);
      var r = (p.r || DM.PEG_R) * (1 + sh * 0.35) * (p.pop || 1);
      var glow = p.glow || 0;

      if (p.type === 'seal') {
        drawSeal(c, x, y, r, p, glow);
        continue;
      }
      c.save();
      if (p.type === 'hard') {
        c.fillStyle = 'rgba(70,96,116,' + (0.85 + glow * 0.15) + ')';
        c.strokeStyle = 'rgba(150,200,214,' + (0.6 + glow * 0.4) + ')';
        c.lineWidth = 1.6;
        c.beginPath();
        for (var k = 0; k < 6; k++) {
          var a = (k / 6) * 6.2832 + (p.spin || 0);
          var px = x + Math.cos(a) * r * 1.18, py = y + Math.sin(a) * r * 1.18;
          k ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath(); c.fill(); c.stroke();
        if (p.hp > 1) {
          c.fillStyle = 'rgba(226,236,240,0.55)';
          c.fillRect(x - 7, y + r + 4, 14 * (p.hp / (p.maxHp || 2)), 2);
        }
      } else if (p.type === 'gold') {
        c.shadowColor = 'rgba(232,190,110,0.9)';
        c.shadowBlur = 12 + glow * 18;
        c.fillStyle = '#e8be6e';
        star(c, x, y, r * 1.3, 4, g.t * 0.7 + i);
        c.fill();
      } else if (p.type === 'maw') {
        c.fillStyle = 'rgba(30,20,44,0.96)';
        c.beginPath(); c.arc(x, y, r * 1.25, 0, 6.2832); c.fill();
        c.strokeStyle = 'rgba(150,110,190,' + (0.5 + glow * 0.5) + ')';
        c.lineWidth = 2;
        c.beginPath(); c.arc(x, y, r * 1.25, 0, 6.2832); c.stroke();
        c.strokeStyle = 'rgba(120,80,160,0.5)';
        c.lineWidth = 1.2;
        for (var m = 0; m < 3; m++) {
          c.beginPath();
          c.arc(x, y, r * (0.4 + m * 0.3), g.t * (1.2 + m * 0.4), g.t * (1.2 + m * 0.4) + 2.4);
          c.stroke();
        }
      } else {
        var inkC = g.st && g.st.char ? g.st.char.ink : '236,236,228';
        var spr = sprites[inkC] || (sprites[inkC] = dotSprite(inkC));
        var sz = r * (48 / (DM.PEG_R * 1.15));
        c.drawImage(spr, x - sz / 2, y - sz / 2, sz, sz);
        if (glow > 0.04) {
          c.strokeStyle = 'rgba(255,255,250,' + (glow * 0.8) + ')';
          c.lineWidth = 1.4;
          c.beginPath(); c.arc(x, y, r * 1.45 + glow * 6, 0, 6.2832); c.stroke();
        }
      }
      c.restore();
      if (sh) p.shake = Math.max(0, sh - 0.09);
      if (glow) p.glow = Math.max(0, glow - 0.03);
    }
  }

  function drawSeal(c, x, y, r, p, glow) {
    var s = r * 2.5;
    c.save();
    c.translate(x, y);
    c.rotate(Math.sin((p.phase || 0) + (p.wob || 0)) * 0.06);
    c.shadowColor = 'rgba(206,64,48,0.85)';
    c.shadowBlur = 14 + glow * 26;
    c.fillStyle = p.seal === 'move' ? '#b04a3a' : '#c8392c';
    roundRect(c, -s / 2, -s / 2, s, s, 3);
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(255,225,215,0.85)';
    c.lineWidth = 1.4;
    roundRect(c, -s / 2 + 2.5, -s / 2 + 2.5, s - 5, s - 5, 2);
    c.stroke();
    var glyph = { burst: '爆', rain: '雨', slow: '凝', score: '积', move: '移', chain: '雷' }[p.seal] || '印';
    c.fillStyle = 'rgba(255,236,228,0.95)';
    c.font = '700 ' + (s * 0.66) + 'px "Songti SC","STSong","SimSun",serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(glyph, 0, s * 0.04);
    c.restore();
    c.textBaseline = 'alphabetic';
  }

  function drawBoss(c, g) {
    var b = g.world.boss;
    if (!b) return;
    c.save();
    c.translate(b.x, b.y);
    var pulse = 1 + Math.sin(g.t * 2.2) * 0.04;
    var R = b.r * pulse;
    var gr = c.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.5);
    gr.addColorStop(0, 'rgba(4,4,8,1)');
    gr.addColorStop(0.7, 'rgba(20,10,28,0.95)');
    gr.addColorStop(1, 'rgba(30,14,40,0)');
    c.fillStyle = gr;
    c.beginPath(); c.arc(0, 0, R * 1.5, 0, 6.2832); c.fill();

    // 触须
    c.strokeStyle = 'rgba(60,40,74,0.75)';
    c.lineWidth = 4;
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * 6.2832 + g.t * 0.4;
      var wob = Math.sin(g.t * 3 + i) * 10;
      c.beginPath();
      c.moveTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8);
      c.quadraticCurveTo(Math.cos(a) * (R + 18 + wob), Math.sin(a) * (R + 18), Math.cos(a + 0.3) * (R + 34), Math.sin(a + 0.3) * (R + 34));
      c.stroke();
    }
    c.fillStyle = '#12060f';
    c.beginPath(); c.arc(0, 0, R, 0, 6.2832); c.fill();
    c.strokeStyle = 'rgba(206,64,48,' + (0.5 + b.hitFlash * 0.5) + ')';
    c.lineWidth = 2 + b.hitFlash * 5;
    c.beginPath(); c.arc(0, 0, R, 0, 6.2832); c.stroke();

    // 眼
    c.fillStyle = 'rgba(232,190,110,' + (0.7 + b.hitFlash * 0.3) + ')';
    c.beginPath(); c.ellipse(-R * 0.3, -R * 0.1, 6, 10, 0.3, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(R * 0.3, -R * 0.1, 6, 10, -0.3, 0, 6.2832); c.fill();

    // 血条
    var w = R * 2.2;
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(-w / 2, R + 16, w, 6);
    c.fillStyle = '#c8392c';
    c.fillRect(-w / 2, R + 16, w * Math.max(0, b.hp / b.maxHp), 6);
    c.restore();
    c.fillStyle = 'rgba(206,64,48,0.9)';
    c.font = '600 15px "Songti SC","STSong",serif';
    c.textAlign = 'center';
    c.fillText(b.name, b.x, b.y + b.r + 40);
  }

  function drawBucket(c, g) {
    var b = g.world.bucket;
    var y = DM.FLOOR_Y - 4, h = 28;
    c.save();
    c.translate(b.x, y);
    var gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(70,78,100,0.95)');
    gr.addColorStop(1, 'rgba(28,32,44,0.95)');
    c.fillStyle = gr;
    c.beginPath();
    c.moveTo(-b.w / 2, 0);
    c.lineTo(-b.w / 2 + 10, h);
    c.lineTo(b.w / 2 - 10, h);
    c.lineTo(b.w / 2, 0);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(226,226,220,' + (0.4 + b.glow * 0.6) + ')';
    c.lineWidth = 2 + b.glow * 4;
    c.beginPath(); c.moveTo(-b.w / 2, 0); c.lineTo(b.w / 2, 0); c.stroke();
    if (b.glow > 0.01) {
      c.shadowColor = 'rgba(236,236,228,0.9)';
      c.shadowBlur = 26 * b.glow;
      c.strokeStyle = 'rgba(236,236,228,' + b.glow + ')';
      c.beginPath(); c.moveTo(-b.w / 2, 0); c.lineTo(b.w / 2, 0); c.stroke();
    }
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(226,226,220,0.5)';
    c.font = '600 13px "Songti SC","STSong",serif';
    c.textAlign = 'center';
    c.fillText('墨 壶', 0, h - 8);
    c.restore();
  }

  function drawAim(c, g) {
    if (!g.aimPath.length) return;
    var pts = g.aimPath;
    c.save();
    for (var i = 0; i < pts.length; i++) {
      var k = 1 - i / pts.length;
      var a = Math.pow(k, 1.5) * 0.75;
      c.fillStyle = 'rgba(226,226,220,' + a + ')';
      var r = 2.1 * k + 0.7;
      c.beginPath(); c.arc(pts[i].x, pts[i].y, r, 0, 6.2832); c.fill();
    }
    c.restore();

    // 发射口
    var m = DM.MUZZLE;
    c.save();
    c.translate(m.x, m.y);
    c.rotate(g.aim.ang + Math.PI / 2);
    c.fillStyle = 'rgba(46,52,72,0.95)';
    roundRect(c, -13, -8, 26, 30, 4); c.fill();
    c.strokeStyle = 'rgba(226,226,220,' + (0.45 + g.aim.charge * 0.55) + ')';
    c.lineWidth = 2;
    roundRect(c, -13, -8, 26, 30, 4); c.stroke();
    c.restore();

    // 蓄力环
    if (g.aim.charging) {
      var pw = g.aim.power;
      c.save();
      c.strokeStyle = 'rgba(206,64,48,0.9)';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(m.x, m.y, 26, -1.5708, -1.5708 + pw * 6.2832);
      c.stroke();
      c.strokeStyle = 'rgba(226,226,220,0.25)';
      c.lineWidth = 1;
      c.beginPath(); c.arc(m.x, m.y, 26, 0, 6.2832); c.stroke();
      c.restore();
    }
  }

  function drawBalls(c, g) {
    for (var i = 0; i < g.balls.length; i++) {
      var b = g.balls[i];
      // 尾迹
      var tr = b.trail;
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (var k = 0; k < tr.length; k++) {
        var t = k / tr.length;
        c.fillStyle = 'rgba(' + (b.col || '236,236,228') + ',' + (t * t * 0.5) + ')';
        c.beginPath(); c.arc(tr[k].x, tr[k].y, b.r * t * 0.95, 0, 6.2832); c.fill();
      }
      c.restore();
      if (st_lv(g, '噬')) {
        var mr = 34 + g.st.lv('噬') * 12;
        var gr = c.createRadialGradient(b.x, b.y, 2, b.x, b.y, mr);
        gr.addColorStop(0, 'rgba(0,0,0,0.95)');
        gr.addColorStop(0.55, 'rgba(24,10,34,0.7)');
        gr.addColorStop(1, 'rgba(40,16,56,0)');
        c.fillStyle = gr;
        c.beginPath(); c.arc(b.x, b.y, mr, 0, 6.2832); c.fill();
      }
      c.save();
      var halo = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 3.4);
      halo.addColorStop(0, 'rgba(250,250,245,0.5)');
      halo.addColorStop(0.34, 'rgba(' + (b.col || '240,240,234') + ',0.2)');
      halo.addColorStop(1, 'rgba(240,240,234,0)');
      c.fillStyle = halo;
      c.beginPath(); c.arc(b.x, b.y, b.r * 3.4, 0, 6.2832); c.fill();
      c.shadowColor = 'rgba(252,252,248,0.95)';
      c.shadowBlur = 18 + (b.hot || 0) * 18;
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, 6.2832); c.fill();
      c.restore();
    }
  }

  function st_lv(g, id) { return g.st.lv(id); }

  function star(c, x, y, r, points, rot) {
    c.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var rr = i % 2 ? r * 0.42 : r;
      var a = (i / (points * 2)) * 6.2832 + rot;
      var px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }

  DM.tilePattern = function (c) {
    if (!bgTile) buildTiles();
    return c.createPattern(bgTile, 'repeat');
  };
})(DM);
