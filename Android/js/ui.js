window.DM = window.DM || {};

(function (DM) {
  'use strict';

  var el = {}, G = null, cache = {}, cur = 'title';
  var toastMap = {};

  function dropToast(rec) {
    if (!rec || rec.dead) return;
    rec.dead = true;
    clearTimeout(rec.timer);
    var node = rec.el;
    node.classList.add('out');
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 460);
    if (rec.key) delete toastMap[rec.key];
  }

  function q(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function vrow(id, label, val) {
    var pct = Math.round(val * 100);
    return '<div class="vrow"><span class="vl">' + label + '</span>' +
      '<input type="range" class="vol" data-vol="' + id + '" min="0" max="100" step="1" value="' + pct + '" aria-label="' + label + '">' +
      '<b class="vv" id="vv_' + id + '">' + pct + '</b></div>';
  }

  DM.ui = {
    init: function (game) {
      G = game;
      el.hud = {
        depth: q('hDepth'), score: q('hScore'), ink: q('hInk'), balls: q('hBalls'), ballNum: q('hBallNum'),
        qPct: q('qPct'), qFill: q('qFill'), qBar: document.querySelector('.qbar'),
        cMult: q('cMult'), cHits: q('cHits'), cFill: q('cFill'), combo: q('comboBox'),
        builds: q('builds'), toast: q('toast')
      };
      el.panel = q('panel');
      el.box = q('panelBox');
      q('btnHelp').onclick = function () { DM.ui.show('help'); DM.audio.ui(true); };
      q('btnPause').onclick = function () { G.togglePause(); };
      q('btnSound').onclick = function () {
        DM.audio.unlock();
        if (G.state === 'aim' || G.state === 'fly') G.togglePause();
        DM.ui.backTo = (G.state === 'pause') ? 'pause' : 'title';
        DM.ui.show('music');
      };
      el.box.addEventListener('input', function (e) {
        var t = e.target;
        if (!t.getAttribute) return;
        var which = t.getAttribute('data-vol');
        if (!which) return;
        DM.audio.unlock();
        DM.audio.setVol(which, (+t.value || 0) / 100);
        var lab = document.getElementById('vv_' + which);
        if (lab) lab.textContent = t.value;
      });
      el.box.addEventListener('click', function (e) {
        var t = e.target.closest('[data-act]');
        if (!t || t.disabled) return;
        var a = t.getAttribute('data-act'), v = t.getAttribute('data-v');
        DM.audio.unlock();
        DM.audio.ui(true);
        if (a === 'start') G.startRun();
        else if (a === 'continue') { if (!G.resumeRun()) { G.clearSlot(); DM.ui.show('title'); } }
        else if (a === 'saveQuit') G.toTitle();
        else if (a === 'help') { DM.ui.backTo = cur; DM.ui.show('help'); }
        else if (a === 'chars') { DM.ui.backTo = cur; DM.ui.show('chars'); }
        else if (a === 'shop') { DM.ui.backTo = cur; DM.ui.show('shop'); }
        else if (a === 'music') { DM.ui.backTo = cur; DM.ui.show('music'); }
        else if (a === 'setMusic') { DM.audio.setMusic(v); DM.ui.show('music'); }
        else if (a === 'mute') { DM.audio.toggle(); DM.ui.show('music'); }
        else if (a === 'audition') { DM.audio.preview(); }
        else if (a === 'title') G.toTitle();
        else if (a === 'choose') G.choose(v);
        else if (a === 'reroll') G.reroll();
        else if (a === 'cont') G.afterClear();
        else if (a === 'again') G.startRun();
        else if (a === 'pickChar') G.selectChar(v);
        else if (a === 'buy') G.buyPerk(v);
        else if (a === 'resume') G.togglePause();
        else if (a === 'quit') {
          var r = G.settle();
          G.clearSlot();
          G.toTitle();
          if (r) DM.ui.toast('弃 墨 而 去 · 得 墨 髓 ' + r.earned, 'rgba(232,190,110,.95)', false, 'quit');
        }
        else if (a === 'back') DM.ui.show(DM.ui.backTo || 'title');
      });
    },

    hide: function () { el.panel.classList.add('hidden'); },

    syncVol: function () {
      var b = document.getElementById('btnSound');
      if (b) b.classList.toggle('off', !DM.audio.on);
    },

    show: function (name, data) {
      if (data === undefined && cache[name]) data = cache[name];
      data = data || {};
      cache[name] = data;
      cur = name;
      this.clearToasts();
      var s = DM.save.data, h = '';
      if (name === 'title') {
        var ch = DM.getChar(s.lastChar || DM.CHARS[0].id);
        var slot = G.slotInfo();
        h = '<div class="ptitle">弹<span class="red">墨</span></div>' +
          '<div class="psub">一 滴 墨 的 深 渊 回 响</div>' +
          '<div class="stat">' +
          '<div><span>最 深</span><b>' + s.bestDepth + '</b></div>' +
          '<div><span>最 高 墨 迹</span><b class="gold">' + fmt(s.bestScore) + '</b></div>' +
          '<div><span>墨 髓</span><b>' + s.marrow + '</b></div>' +
          '</div>' +
          (slot ? '<div class="slotline">悬 渊 之 处 · 第 <b>' + slot.depth + '</b> 层 · ' + esc(slot.charName) + ' · ' + fmt(slot.score) + ' 墨 迹 · ' + slot.ups + ' 诀 · 砚 余 ' + slot.lives + '</div>' : '') +
          '<div class="row">' +
          (slot ? '<button class="btn pri" data-act="continue">继 渊</button><button class="btn" data-act="start">重 入 渊</button>'
                : '<button class="btn pri" data-act="start">入 渊</button>') +
          '<button class="btn" data-act="chars">择 墨</button>' +
          '<button class="btn" data-act="shop">藏 墨</button>' +
          '<button class="btn" data-act="music">音 律</button>' +
          '<button class="btn" data-act="help">玩 法</button></div>' +
          '<div class="marq" style="margin-top:18px">当前之墨 · ' + esc(ch.name) + ' · 点击「择墨」另选</div>';
      } else if (name === 'help') {
        h = '<div class="ph">玩 法</div><div class="marq">弹 墨 · 深 渊 回 响</div><div class="help">' +
          '<h4>目 的</h4>每一层都要碎够定额的墨（左下角「碎墨」）。但深渊不肯空着：<b>你碎得越多，墨渗回来越快</b>——越深的层，越只能靠更凶的墨诀压过它。<br>' +
          '珠尽而未达标，砚台裂一角并补 2 珠再战；三砚尽碎，则墨散于渊。' +
          '<h4>操 作</h4><span class="kbd">移动</span>定向　<span class="kbd">按住</span>蓄力　<span class="kbd">松开</span>出珠<br>' +
          '<span class="kbd">←→</span>微调角度　<span class="kbd">空格</span>以默认力道发射　<span class="kbd">M</span>静音<br>' +
          '暂停 (<span class="kbd">P</span>) 会自动把这一局悬在渊中,下次开页可在渊口「继渊」续行。' +
          '「存墨而退」保留进度;「弃墨而去」就此收束,已过层数<b>照常折算墨髓与最高纪录</b>,与弹尽而亡无异。<br>' +
          '<span class="kbd">M</span>一键静音;总音量、音效、音乐三轨与音景,都在「音律」里自调。<br>' +
          '<span class="kbd">1 2 3</span>择诀　<span class="kbd">R</span>洗墨重择' +
          '<h4>爽 点</h4>' +
          '・<b>连击</b>：一发之内撞得越多，倍率越高，音阶一路攀升。<br>' +
          '・<b>落壶</b>：珠坠入底部「墨壶」，白得一珠且连击不断——这是最划算的收束。<br>' +
          '・<b>绝墨</b>：一发清空全场，厚赏。<br>' +
          '・<b>朱印</b>：红印各有奇效（爆、雨、凝、积、移、雷），一发之内只能应验有限的几枚。' +
          '<h4>构筑</h4>每过一层，三选一的「墨诀」决定你这局成为什么：贯穿、分裂、引力、雷络、黑渊……<b>同一层可以有不同的打法和不同的结局</b>。' +
          '<h4>长 远</h4>每局结算获得「墨髓」，可在藏墨阁换取永久之力、解锁新的墨。' +
          '</div><div class="row" style="margin-top:20px"><button class="btn" data-act="back">回</button></div>';
      } else if (name === 'chars') {
        var rows = DM.CHARS.map(function (c) {
          var un = c.free || G.charUnlocked(c);
          var on = s.lastChar === c.id;
          return '<div class="item' + (un ? '' : ' locked') + (on ? ' on' : '') + '" ' + (un ? 'data-act="pickChar" data-v="' + c.id + '"' : '') + '>' +
            '<div class="g" style="color:rgb(' + c.ink + ')">墨</div><div class="t"><b>' + esc(c.name) + '</b><p>' + esc(c.desc) + '</p></div>' +
            '<div class="c">' + (un ? (on ? '当前' : '择此') : (c.unlock === 'clear' ? '需通关 ' : '需深入 ') + c.cost + ' 层') + '</div></div>';
        }).join('');
        h = '<div class="ph">择 墨</div><div class="marq">每 一 滴 墨 ，都 有 不 同 的 脾 性</div><div class="list">' + rows + '</div>' +
          '<div class="row" style="margin-top:18px"><button class="btn" data-act="back">回</button></div>';
      } else if (name === 'shop') {
        var it = DM.PERKS.map(function (p) {
          var lv = s.perks[p.id] || 0, maxed = lv >= p.max;
          var cost = p.cost * (lv + 1);
          var can = !maxed && s.marrow >= cost;
          return '<div class="item' + (can ? '' : ' locked') + '" ' + (can ? 'data-act="buy" data-v="' + p.id + '"' : '') + '>' +
            '<div class="g">' + lv + '</div><div class="t"><b>' + esc(p.name) + '</b><p>' + esc(p.d) + '　·　' + lv + '/' + p.max + '</p></div>' +
            '<div class="c">' + (maxed ? '已极' : cost + ' 髓') + '</div></div>';
        }).join('');
        h = '<div class="ph">藏 墨 阁</div><div class="marq">墨 髓 · ' + s.marrow + ' 　可 换 永 久 之 力</div><div class="list">' + it + '</div>' +
          '<div class="row" style="margin-top:18px"><button class="btn" data-act="back">回</button></div>';
      } else if (name === 'choice') {
        var cards = data.cards.map(function (u, i) {
          var lv = G.st.lv(u.id), next = lv + 1;
          var maxed = lv >= u.max;
          return '<div class="card r' + u.r + (maxed ? ' max' : '') + '" style="animation-delay:' + (i * 70) + 'ms" ' +
            (maxed ? '' : 'data-act="choose" data-v="' + u.id + '"') + ' tabindex="' + (i + 1) + '">' +
            '<div class="tag">' + DM.RARITY[u.r] + '</div>' +
            '<div class="glyph">' + u.id + '</div>' +
            '<div class="cn">' + esc(u.name) + '</div>' +
            '<div class="lv">' + (lv ? '现 ' + lv + ' 阶 → ' + next + ' 阶' : '初 得') + '</div>' +
            '<div class="ds">' + esc(u.d) + '</div></div>';
        }).join('');
        var own = G.st.order.length ? G.st.order.map(function (id) {
          var u2 = DM.upById[id];
          return '<b class="r' + u2.r + '" title="' + esc(u2.name + ' · ' + u2.d) + '">' + u2.id + '<u>' + G.st.lv(id) + '</u></b>';
        }).join('') : '<span class="none">尚 无 一 诀</span>';
        h = '<div class="ph">择 一 墨 诀</div><div class="marq">第 ' + data.depth + ' 层 · 渊 深 如 此 · 洗 墨 尚 余 ' + data.rerolls + '</div>' +
          '<div class="curbuild">' + own + '</div>' +
          '<div class="cards">' + cards + '</div>' +
          '<div class="row" style="margin-top:20px">' +
          '<button class="btn mini" data-act="reroll" ' + (data.rerolls > 0 ? '' : 'disabled') + '>洗 墨 (R)</button>' +
          '<button class="btn mini" data-act="help">玩 法</button></div>';
      } else if (name === 'clear') {
        h = '<div class="big-word" style="color:' + (data.perfect ? 'var(--gold)' : 'var(--paper)') + '">' + data.gradeW + '</div>' +
          '<div class="marq">第 ' + data.depth + ' 层 已 破</div>' +
          '<div class="stat">' +
          '<div><span>碎 墨</span><b>' + data.dead + '</b></div>' +
          '<div><span>余 珠</span><b>' + data.left + '</b></div>' +
          '<div><span>层 赏</span><b class="gold">+' + fmt(data.bonus) + '</b></div>' +
          '<div><span>墨 迹</span><b>' + fmt(data.score) + '</b></div>' +
          '</div>' +
          (data.note ? '<div class="pnote">' + esc(data.note) + '</div>' : '') +
          '<div class="row"><button class="btn pri" data-act="cont">继 续 下 潜</button></div>';
      } else if (name === 'over') {
        h = '<div class="big-word" style="color:var(--red)">墨 散</div>' +
          '<div class="marq">砚 尽 于 第 ' + data.depth + ' 层</div>' +
          '<div class="stat">' +
          '<div><span>墨 迹</span><b class="gold">' + fmt(data.score) + '</b></div>' +
          '<div><span>深 度</span><b>' + data.depth + '</b></div>' +
          '<div><span>碎 墨</span><b>' + data.hits + '</b></div>' +
          '<div><span>绝 墨</span><b>' + data.perfects + '</b></div>' +
          '<div><span>墨 髓</span><b>+' + data.marrow + '</b></div>' +
          '</div>' +
          (data.record ? '<div class="pnote" style="color:var(--gold)">此 乃 前 所 未 至 之 深</div>' : '') +
          '<div class="row"><button class="btn pri" data-act="again">再 入 渊</button>' +
          '<button class="btn" data-act="shop">藏 墨</button><button class="btn" data-act="back">渊 口</button></div>';
      } else if (name === 'music') {
        var v = DM.audio.volumes();
        var sets = DM.audio.musicSets().map(function (m) {
          var on = DM.audio.getMusic() === m.id;
          return '<div class="item' + (on ? ' on' : '') + '" data-act="setMusic" data-v="' + m.id + '">' +
            '<div class="g">' + m.name.charAt(0) + '</div>' +
            '<div class="t"><b>' + m.name + '</b><p>' + esc(m.desc) + '</p></div>' +
            '<div class="c">' + (on ? '当前' : '择此') + '</div></div>';
        }).join('');
        h = '<div class="ph">音 律</div><div class="marq">调 此 三 弦 · 择 一 片 音 景</div>' +
          '<div class="vrows">' + vrow('master', '总 音 量', v.master) + vrow('sfx', '效 音', v.sfx) + vrow('music', '音 乐', v.music) + '</div>' +
          '<div class="row" style="margin-bottom:18px">' +
          '<button class="btn mini" data-act="mute">' + (v.muted ? '放 声' : '静 音') + '</button>' +
          '<button class="btn mini" data-act="audition">试 听 音 景</button></div>' +
          '<div class="list">' + sets + '</div>' +
          '<div class="row" style="margin-top:18px"><button class="btn" data-act="back">回</button></div>';
      } else if (name === 'pause') {
        h = '<div class="ph">暂 栖</div><div class="marq">深 ' + data.depth + ' 层 · ' + fmt(data.score) + ' 墨迹</div>' +
          '<div class="slotline">' + (data.saved ? '「存墨而退」悬局可续 ·「弃墨而去」就此结算墨髓' : '本 机 无 法 暂 存 · 弃 墨 亦 照 常 结 算') + '</div>' +
          '<div class="row" style="flex-direction:column;align-items:center">' +
          '<button class="btn pri" data-act="resume">继 续</button>' +
          '<button class="btn" data-act="saveQuit">存 墨 而 退</button>' +
          '<button class="btn" data-act="help">玩 法</button>' +
          '<button class="btn" data-act="quit">弃 墨 而 去 · 结 算</button></div>';
      }
      el.box.innerHTML = h;
      el.panel.classList.remove('hidden');
    },

    // 同一来源的提示原地复用并累加 ×N,不再刷屏
    toast: function (text, col, big, key, counter) {
      var host = el.hud && el.hud.toast;
      if (!host) return;
      var rec = key ? toastMap[key] : null;
      if (rec && !rec.dead) {
        rec.txt.textContent = text;
        if (counter) { rec.n++; rec.num.textContent = '×' + rec.n; }
        rec.el.classList.remove('bump'); void rec.el.offsetWidth; rec.el.classList.add('bump');
        clearTimeout(rec.timer);
        rec.timer = setTimeout(function () { dropToast(rec); }, big ? 2000 : 1500);
        return;
      }
      var d = document.createElement('div');
      var b = document.createElement('b'); b.textContent = text;
      var i = document.createElement('i');
      d.appendChild(b); d.appendChild(i);
      if (col) d.style.color = col;
      if (big) d.classList.add('big');
      host.appendChild(d);
      while (host.children.length > 4) {
        var old = host.firstElementChild;
        for (var k in toastMap) { if (toastMap[k].el === old) dropToast(toastMap[k]); }
        if (old.parentNode) old.parentNode.removeChild(old);
      }
      rec = { el: d, txt: b, num: i, n: 1, key: key || null, dead: false, timer: null };
      rec.timer = setTimeout(function () { dropToast(rec); }, big ? 2000 : 1500);
      if (key) toastMap[key] = rec;
    },

    clearToasts: function () {
      for (var k in toastMap) dropToast(toastMap[k]);
      toastMap = {};
    },

    setHud: function () {
      var st = G.st, L = G.layer, e = el.hud;
      if (!st) return;
      e.depth.textContent = st.depth;
      var sc = fmt(st.score);
      if (e.score.textContent !== sc) {
        e.score.textContent = sc;
        e.score.classList.remove('pulse'); void e.score.offsetWidth; e.score.classList.add('pulse');
      }
      var ink = '';
      for (var i = 0; i < st.maxLives; i++) ink += '<i class="' + (i < st.lives ? '' : 'off') + '"></i>';
      if (e.ink.innerHTML !== ink) e.ink.innerHTML = ink;

      var shown = Math.min(st.balls, 10), left = Math.min(st.ballsLeft, 10), bl = '';
      for (var b = 0; b < shown; b++) bl += '<i class="' + (b < left ? '' : 'spent') + '"></i>';
      if (bl !== e.balls.dataset.k) { e.balls.dataset.k = bl; e.balls.innerHTML = bl; }
      if (e.ballNum.textContent !== String(st.ballsLeft)) e.ballNum.textContent = st.ballsLeft;

      var pct = Math.min(1, L.dead / Math.max(1, L.need));
      e.qPct.textContent = L.dead + ' / ' + L.need;
      e.qFill.style.width = (pct * 100) + '%';
      e.qBar.classList.toggle('ok', pct >= 1);

      var m = G.combo, sh = G.shot;
      e.combo.classList.toggle('on', m.hits > 1);
      e.cMult.textContent = '×' + m.mult.toFixed(1);
      e.cHits.textContent = m.hits > 1 && sh ? ('碎 ' + sh.kills + (sh.kills > sh.killCap ? ' 超额' : '')) : '';
      e.cFill.style.width = Math.min(100, (m.step / m.cap) * 100) + '%';

      var bs = '';
      for (var k = 0; k < st.order.length; k++) {
        var u = DM.upById[st.order[k]];
        bs += '<b class="r' + u.r + '" title="' + esc(u.name + ' · ' + u.d) + '">' + u.id + '<u>' + st.lv(u.id) + '</u></b>';
      }
      if (bs !== e.builds.dataset.k) { e.builds.dataset.k = bs; e.builds.innerHTML = bs; }
    }
  };
})(DM);
