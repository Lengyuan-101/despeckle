window.DM = window.DM || {};

(function (DM) {
  'use strict';

  var ctx = null, ready = false;
  var master, comp, sfxIn, musIn, verb, verbGain, noiseBuf;
  var muted = false;
  var vol = { master: 0.8, sfx: 0.95, music: 0.55 };

  var PENT = [0, 2, 4, 7, 9];        // 宫商角徵羽
  var PENT_DARK = [0, 2, 3, 7, 8];   // 带清角变徵,更暗

  /* ───────── 鼓组:16 分 bitmask。鼓只托底,不铺满 ───────── */
  var KITS = {
    still:    { kick: '................', snare: '................', hat: '................', crash: '................' },
    light:    { kick: 'x.......x.......', snare: '............x...', hat: '....x...x.......', crash: '................' },
    heavy:    { kick: 'x..x..x...x.....', snare: '....x.......x...', hat: 'x...x...x...x...', crash: 'x.......x.......' },
    blasting: { kick: 'x..x..x.x..x.x..', snare: '....x.......x.x.', hat: 'x.x.x.x.x.x.x...', crash: 'x.......x.......' }
  };

  /* ───────── 主音 riff:唯一会跑的声部。x=发声,o=紧跟前音延音 ─────────
     静水与行墨用长音连奏,音符一直延续到下一音;深渊保留原来的留白。 */
  var RIFFS = {
    jingshui: [
      { pat: 'x.......x...x...', deg: [0, 1, 2] },
      { pat: 'x.....x.....x...', deg: [3, 4, 3] },
      { pat: 'x...x...x.......', deg: [2, 1, 0] },
      { pat: 'x.......x.......', deg: [1, 0] },
      { pat: 'x.....x...x.....', deg: [2, 3, 2] }
    ],
    xingmo: [
      { pat: 'x.....x...x.....', deg: [2, 1, 2] },
      { pat: 'x.......x...x...', deg: [3, 4, 5] },
      { pat: 'x.....x.....x...', deg: [4, 3, 2] },
      { pat: 'x.......x.......', deg: [1, 2] },
      { pat: 'x...x.......x...', deg: [4, 3, 2] }
    ],
    shenyuan: [
      { pat: 'x.x.x...x.x.....', deg: [0] },
      { pat: 'x..x..x.x.....x.', deg: [0, 3] },
      { pat: 'x.x.x.x.......x.', deg: [0, 3, 0] },
      { pat: 'x.o.....x...x...', deg: [7, 4] },
      { pat: 'x.xx..x.x..x....', deg: [0, 3, 4] }
    ]
  };
  // 乐句:每 4 小节一组,组内末小节落在长音上;两组构成 8 小节循环
  var PHRASES = {
    jingshui: [[0, 1, 2, 3], [0, 1, 4, 3]],
    xingmo: [[0, 1, 2, 3], [0, 1, 4, 3]],
    shenyuan: [[0, 0, 1, 3], [4, 0, 1, 3]]
  };
  // 静水与行墨保持同一调性,让独奏旋律平顺连接;深渊保留四小节和声进行。
  var PROG = {
    jingshui: [0, 0, 0, 0],
    xingmo: [0, 0, 0, 0],
    shenyuan: [0, 3, 7, 8]
  };

  /* ───────── 静水单笛、行墨大提琴,均为无伴奏连奏独奏。
     深渊保留电吉他主线、背景和声、低音与鼓。 ───────── */
  var SETS = {
    jingshui: {
      name: '静 水', desc: '单笛悠扬连奏,长音柔和衔接,句尾与循环处不断音。无伴奏、低音或鼓点。',
      beat: 0.92, root: 293.66, scale: PENT, lead: 'dizi', fills: [],
      kit: 'still', drumAmt: 0, bassAmt: 0, gain: 1.0, drone: 0,
      leadAmt: 0.15, harmAmt: 0, leadOct: 1, harmOct: 0, bassOct: -1,
      legato: 0.18, tempoBoost: 0
    },
    xingmo: {
      name: '行 墨', desc: '大提琴独奏,温暖的中低音缓缓起伏,长弓连奏不断线。无伴奏、低音铺底或鼓点。',
      beat: 0.86, root: 220.0, scale: PENT, lead: 'cello', fills: [],
      kit: 'still', drumAmt: 0, bassAmt: 0, gain: 1.0, drone: 0,
      leadAmt: 0.18, harmAmt: 0, leadOct: -1, harmOct: 0, bassOct: -1,
      legato: 0.22, tempoBoost: 0
    },
    shenyuan: {
      name: '深 渊', desc: '电吉他riff单线推进,木吉他只垫一层和声。鼓与低音托底,越深越重。',
      beat: 0.5, root: 146.83, scale: PENT_DARK, lead: 'eguitar', fills: ['guitar'],
      kit: 'heavy', drumAmt: 0.85, bassAmt: 0.075, gain: 1.25, drone: 0.06,
      leadAmt: 0.2, harmAmt: 0.022, leadOct: 1, harmOct: 0, bassOct: -1
    }
  };
  var cur = 'xingmo', intensity = 0, playing = false;
  var seq = { timer: null, next: 0, step: 0 };
  var droneNodes = null;

  function now() { return ctx.currentTime; }

  function makeNoise() {
    var len = ctx.sampleRate * 1.5;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function makeVerb() {
    var len = (ctx.sampleRate * 1.9) | 0;
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.0) * (1 - t * 0.2);
      }
    }
    var conv = ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  function ensure() {
    if (ready) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }

    master = ctx.createGain();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    master.connect(comp);
    comp.connect(ctx.destination);

    sfxIn = ctx.createGain();
    musIn = ctx.createGain();
    sfxIn.connect(master);
    musIn.connect(master);

    verb = makeVerb();
    verbGain = ctx.createGain();
    verbGain.gain.value = 0.2;
    verb.connect(verbGain);
    verbGain.connect(master);

    noiseBuf = makeNoise();
    applyVol();
    ready = true;
    return true;
  }

  function applyVol() {
    if (!ready) return;
    var t = now();
    master.gain.setTargetAtTime(muted ? 0.0001 : vol.master, t, 0.05);
    sfxIn.gain.setTargetAtTime(vol.sfx, t, 0.05);
    musIn.gain.setTargetAtTime(vol.music, t, 0.08);
  }

  /* ───────── 基础发声单元(音效) ───────── */
  function tone(freq, opt) {
    if (!ready || muted) return;
    opt = opt || {};
    var t = now();
    var dur = opt.dur || 0.18;
    var o = ctx.createOscillator();
    o.type = opt.type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.slide), t + dur);
    var g = ctx.createGain();
    var peak = (opt.gain === undefined ? 0.3 : opt.gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opt.atk || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var node = o;
    if (opt.filter) {
      var f = ctx.createBiquadFilter();
      f.type = opt.filter; f.frequency.value = opt.fc || 1200; f.Q.value = opt.q || 1;
      node.connect(f); node = f;
    }
    node.connect(g);
    g.connect(opt.bus === 'mus' ? musIn : sfxIn);
    if (opt.send) { var s = ctx.createGain(); s.gain.value = opt.send; g.connect(s); s.connect(verb); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, fc, gain, type, q, bus) {
    if (!ready || muted) return;
    var t = now();
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    var f = ctx.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.setValueAtTime(fc, t);
    if (type !== 'lowpass') f.frequency.exponentialRampToValueAtTime(Math.max(80, fc * 0.35), t + dur);
    f.Q.value = q || 1.4;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus === 'mus' ? musIn : sfxIn);
    src.start(t); src.stop(t + dur + 0.02);
  }

  /* ───────── 和声与音高 ───────── */
  function barOf(step) { return (step / 16) | 0; }
  function chordSemi(bar) { var pr = PROG[cur]; return pr[bar % pr.length]; }
  function freqAt(deg, rootSemi, octave) {
    var s = SETS[cur], n = s.scale.length;
    var idx = ((deg % n) + n) % n;
    var oct = Math.floor(deg / n) + (octave || 0);
    return s.root * Math.pow(2, (rootSemi || 0) / 12) * Math.pow(2, oct) * Math.pow(2, s.scale[idx] / 12);
  }

  /* ───────── 乐器合成(物理建模式,零采样) ───────── */
  function distCurve(k) {
    var n = 1024, c = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = (i * 2) / n - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    return c;
  }

  // 通用发声器:多振荡器 → 颤音/轮指 → 前级提升 → 削波 → 滤波扫频 → 包络
  function strum(p) {
    if (!ready) return;
    var t = p.t, dur = p.dur, i;
    var head = ctx.createGain();
    var parts = p.parts || [{ type: 'triangle', mul: 1, lvl: 0.8 }];
    for (i = 0; i < parts.length; i++) {
      var q = parts[i];
      var o = ctx.createOscillator();
      o.type = q.type;
      o.frequency.setValueAtTime(Math.max(20, p.f * q.mul), t);
      if (p.bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, p.f * q.mul * p.bend), t + (p.bendT || 0.12));
      if (q.det) o.detune.value = q.det;
      var gg = ctx.createGain(); gg.gain.value = q.lvl;
      o.connect(gg); gg.connect(head);
      if (p.vib) {
        var lv = ctx.createOscillator(); lv.frequency.value = p.vib.rate;
        var lg = ctx.createGain();
        lg.gain.setValueAtTime(p.vib.delay ? 0.0001 : p.vib.cents, t);
        if (p.vib.delay) lg.gain.linearRampToValueAtTime(p.vib.cents, t + p.vib.delay);
        lv.connect(lg); lg.connect(o.detune);
        lv.start(t); lv.stop(t + dur + 0.05);
      }
      o.start(t); o.stop(t + dur + 0.08);
    }
    var node = head;
    if (p.pre) {
      var pf = ctx.createBiquadFilter(); pf.type = 'highshelf'; pf.frequency.value = p.pre[0]; pf.gain.value = p.pre[1];
      node.connect(pf); node = pf;
    }
    if (p.shape) {
      var ws = ctx.createWaveShaper(); ws.curve = distCurve(p.shape); ws.oversample = '2x';
      var ws2 = ctx.createWaveShaper(); ws2.curve = distCurve(p.shape * 0.5); ws2.oversample = '2x';
      node.connect(ws); ws.connect(ws2);
      var trim = ctx.createGain(); trim.gain.value = 0.4;
      ws2.connect(trim); node = trim;
    }
    if (p.hp) {
      var hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = p.hp; hf.Q.value = 0.7;
      node.connect(hf); node = hf;
    }
    if (p.lp) {
      var lf = ctx.createBiquadFilter(); lf.type = 'lowpass'; lf.Q.value = p.q || 1;
      lf.frequency.setValueAtTime(Math.min(13000, p.lp[0]), t);
      lf.frequency.exponentialRampToValueAtTime(Math.max(120, Math.min(13000, p.lp[1])), t + (p.lpT || dur));
      node.connect(lf); node = lf;
    }
    var amp = ctx.createGain();
    amp.gain.setValueAtTime(1, t);
    if (p.trem) {
      var lo = ctx.createOscillator(); lo.frequency.value = p.trem.rate;
      var la = ctx.createGain(); la.gain.value = p.trem.amt;
      lo.connect(la); la.connect(amp.gain);
      lo.start(t); lo.stop(t + dur + 0.05);
    }
    node.connect(amp);
    var e = ctx.createGain();
    var pk = Math.max(0.0005, p.g);
    e.gain.setValueAtTime(0.0001, t);
    if (p.release) {
      // 连奏长音不按拨弦衰减:保持音量,仅在接上下一音时收尾。
      var attack = Math.min(p.atk, dur * 0.25);
      var release = Math.min(p.release, dur * 0.25);
      e.gain.linearRampToValueAtTime(pk, t + attack);
      e.gain.linearRampToValueAtTime(pk * (p.sustain || 1), t + dur - release);
      e.gain.linearRampToValueAtTime(0.0001, t + dur);
    } else {
      e.gain.exponentialRampToValueAtTime(pk, t + p.atk);
      if (p.sustain) e.gain.exponentialRampToValueAtTime(Math.max(0.0004, pk * p.sustain), t + dur * (p.susT || 0.42));
      e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    amp.connect(e);
    e.connect(musIn);
    if (p.send) { var sg = ctx.createGain(); sg.gain.value = p.send; e.connect(sg); sg.connect(verb); }
  }

  function pickNoise(t, dur, fc, g, rate) {
    if (!ready) return;
    var n = ctx.createBufferSource(); n.buffer = noiseBuf; n.playbackRate.value = rate || 1.4;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = Math.min(13000, fc); f.Q.value = 1.1;
    var e = ctx.createGain();
    e.gain.setValueAtTime(Math.max(0.0002, g), t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(e); e.connect(musIn);
    n.start(t); n.stop(t + dur + 0.02);
  }

  function bowNoise(t, dur, fc, g, atk) {
    if (!ready) return;
    var n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.playbackRate.value = 1;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = Math.min(13000, fc); f.Q.value = 0.8;
    var e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(Math.max(0.0002, g), t + (atk || 0.1));
    e.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(e); e.connect(musIn);
    n.start(t); n.stop(t + dur + 0.02);
  }

  var VOICES = {
    // 琵琶:双弦微detune + 一次泛音;拨片头很轻,轮指只是起伏
    pipa: function (f, t, g, dur) {
      dur = dur || 0.62;
      strum({ f: f, t: t, g: g, dur: dur, atk: 0.005, sustain: 0.3, susT: 0.26,
        parts: [{ type: 'triangle', mul: 1, det: -4, lvl: 0.72 }, { type: 'triangle', mul: 1, det: 5, lvl: 0.58 },
                { type: 'sine', mul: 2.002, lvl: 0.2 }],
        lp: [Math.min(8000, f * 6), Math.max(460, f * 1.9)], lpT: dur * 0.6, q: 0.9,
        trem: { rate: 7.5, amt: 0.06 }, send: 0.3 });
      pickNoise(t, 0.022, Math.min(6000, f * 3.2), g * 0.14, 1.0);
    },
    // 古筝:圆润绵长,起音带揉弦上滑,混响重
    guzheng: function (f, t, g, dur) {
      dur = dur || 1.9;
      strum({ f: f, t: t, g: g, dur: dur, atk: 0.012, sustain: 0.68,
        parts: [{ type: 'triangle', mul: 1, lvl: 0.9 }, { type: 'sine', mul: 2.002, lvl: 0.2 }],
        bend: 1.012, bendT: 0.14,
        lp: [Math.min(7000, f * 5), Math.max(400, f * 1.7)], lpT: dur * 0.75, q: 0.8, send: 0.6 });
    },
    // 竹笛:柔和起音,持续气息,轻颤音;相邻音用短交叠连奏,不堆叠旋律。
    dizi: function (f, t, g, dur) {
      dur = dur || 1.8;
      strum({ f: f, t: t, g: g, dur: dur, atk: 0.18, sustain: 0.94, release: 0.18,
        parts: [{ type: 'sine', mul: 1, lvl: 0.92 }, { type: 'triangle', mul: 2, lvl: 0.05 }],
        vib: { rate: 5.1, cents: 9, delay: 0.45 }, lp: [Math.min(5500, f * 4), Math.min(5500, f * 4)], q: 0.6, send: 0.38 });
      bowNoise(t, dur, Math.min(9000, f * 2.4), g * 0.025, 0.18);
    },
    // 钢琴:基音 + 一根非谐泛音就够,不再叠四路拍频
    piano: function (f, t, g, dur) {
      dur = dur || 2.1;
      strum({ f: f, t: t, g: g, dur: dur, atk: 0.004, sustain: 0.4, susT: 0.3,
        parts: [{ type: 'sine', mul: 1, det: -0.6, lvl: 0.86 }, { type: 'triangle', mul: 1, det: 0.7, lvl: 0.3 },
                { type: 'sine', mul: 2.004, lvl: 0.13 }],
        lp: [Math.min(10000, f * 6 + 800), Math.max(560, f * 2.5)], lpT: dur * 0.7, q: 0.6, send: 0.32 });
    },
    // 小提琴:两弦齐奏 + 迟到窄颤音,弓噪只是质地
    violin: function (f, t, g, dur) {
      dur = dur || 2.4;
      strum({ f: f, t: t, g: g, dur: dur, atk: 0.2, sustain: 0.95,
        parts: [{ type: 'sawtooth', mul: 1, det: -3, lvl: 0.44 }, { type: 'sawtooth', mul: 1, det: 4, lvl: 0.4 }],
        vib: { rate: 5.1, cents: 14, delay: 0.45 }, lp: [Math.min(6500, f * 4), Math.min(7500, f * 2.6)], q: 1.0, send: 0.55 });
      bowNoise(t, dur, Math.min(9000, f * 2.8), g * 0.04, 0.24);
    },
    // 大提琴:单弦低音区,保留弦的泛音但收住高频;长弓保持音量,换音轻柔衔接。
    cello: function (f, t, g, dur) {
      dur = dur || 2.0;
      strum({ f: f, t: t, g: g, dur: dur, atk: 0.22, sustain: 0.94, release: 0.22,
        parts: [{ type: 'sawtooth', mul: 1, lvl: 0.6 }, { type: 'sine', mul: 1, lvl: 0.45 }],
        vib: { rate: 4.6, cents: 7, delay: 0.55 }, hp: 65,
        lp: [Math.min(2200, f * 8), Math.min(2200, f * 8)], q: 0.8, send: 0.28 });
      bowNoise(t, dur, Math.min(1800, f * 4), g * 0.012, 0.22);
    },
    // 木吉他:三角波为主,干净、暗,只做衬托
    guitar: function (f, t, g, dur) {
      dur = dur || 1.5;
      strum({ f: f, t: t, g: g, dur: dur, atk: 0.01, sustain: 0.5,
        parts: [{ type: 'triangle', mul: 1, det: -3, lvl: 0.68 }, { type: 'triangle', mul: 1, det: 4, lvl: 0.6 }],
        lp: [Math.min(6000, f * 4.2), Math.max(480, f * 1.6)], lpT: dur * 0.75, q: 0.7, send: 0.45 });
    },
    // 电吉他:锯齿双弦 → 前段抬高频 → 两级软削波 → 削超低频
    eguitar: function (f, t, g, dur) {
      dur = dur || 0.62;
      strum({ f: f, t: t, g: g, dur: dur, atk: 0.005, sustain: 0.85, susT: 0.5, shape: 20,
        pre: [2400, 7],
        parts: [{ type: 'sawtooth', mul: 1, lvl: 0.72 }, { type: 'sawtooth', mul: 1, det: 9, lvl: 0.5 }],
        hp: 92, lp: [Math.min(6800, f * 5), Math.max(1200, f * 2.4)], lpT: dur * 0.95, q: 2.2, send: 0.16 });
      pickNoise(t, 0.024, 3000, g * 0.12, 1.0);
    }
  };

  /* ───────── 低音与鼓 ───────── */
  function bassNote(f, t, g, dur) {
    if (!ready) return;
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(Math.max(24, f), t);
    var o2 = ctx.createOscillator(); o2.type = 'triangle';
    o2.frequency.setValueAtTime(Math.max(24, f * 2.002), t);
    var g2 = ctx.createGain(); g2.gain.value = 0.2;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340; lp.Q.value = 0.8;
    var e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(Math.max(0.0005, g), t + 0.02);
    e.gain.exponentialRampToValueAtTime(Math.max(0.0004, g * 0.7), t + dur * 0.6);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); o2.connect(g2); g2.connect(lp);
    lp.connect(e); e.connect(musIn);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  function kick(t, amt) {
    if (!ready || !amt) return;
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(124, t);
    o.frequency.exponentialRampToValueAtTime(33, t + 0.2);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.46 * amt, t + 0.007);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(musIn);
    o.start(t); o.stop(t + 0.34);
  }

  function snare(t, amt) {
    if (!ready || !amt) return;
    var n = ctx.createBufferSource(); n.buffer = noiseBuf; n.playbackRate.value = 1.15;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1850; f.Q.value = 0.6;
    var g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, 0.17 * amt), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    n.connect(f); f.connect(g); g.connect(musIn);
    var sd = ctx.createGain(); sd.gain.value = 0.28; g.connect(sd); sd.connect(verb);
    n.start(t); n.stop(t + 0.2);
    var o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(124, t + 0.1);
    var og = ctx.createGain();
    og.gain.setValueAtTime(Math.max(0.0002, 0.11 * amt), t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(og); og.connect(musIn);
    o.start(t); o.stop(t + 0.15);
  }

  function hat(t, amt, open) {
    if (!ready || !amt) return;
    var d = open ? 0.2 : 0.05;
    var n = ctx.createBufferSource(); n.buffer = noiseBuf; n.playbackRate.value = 2.8;
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = open ? 6200 : 7600;
    var g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, (open ? 0.05 : 0.058) * amt), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    n.connect(f); f.connect(g); g.connect(musIn);
    n.start(t); n.stop(t + d + 0.02);
  }

  function crash(t, amt) {
    if (!ready || !amt) return;
    var n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.playbackRate.value = 1.4;
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
    var f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 5200; f2.Q.value = 0.5;
    var g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, 0.085 * amt), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
    n.connect(f); f.connect(f2); f2.connect(g); g.connect(musIn);
    var sd = ctx.createGain(); sd.gain.value = 0.6; g.connect(sd); sd.connect(verb);
    n.start(t); n.stop(t + 1.15);
  }

  /* ───────── 排程:分层。主音唯一在跑,和声整小节一个长音,低音只点根音 ───────── */
  function stepDur() {
    var s = SETS[cur];
    // 独奏曲目保持舒缓速度,避免深度变化打断已经排好的连奏。
    var boost = s.tempoBoost === undefined ? 0.26 : s.tempoBoost;
    return (s.beat / 4) / (1 + intensity * boost);
  }

  function activeKit() {
    var s = SETS[cur];
    if (s.kit === 'heavy' && intensity > 0.5) return 'blasting';
    return s.kit;
  }

  function riffFor(bar) {
    var ph = PHRASES[cur];
    var cycle = ph[((bar / 4) | 0) % ph.length];
    return RIFFS[cur][cycle[bar % 4]];
  }

  function countX(pat, upto) {
    var n = 0;
    for (var i = 0; i < upto; i++) if (pat[i] === 'x') n++;
    return n;
  }

  function leadGap(i) {
    // 跨小节查找下一音,连循环末尾也按真实间隔续住长音。
    for (var gap = 1; gap <= 16; gap++) {
      var next = i + gap, r = riffFor(barOf(next));
      if (r && r.pat[next % 16] === 'x') return gap;
    }
    return 16;
  }

  function playStep(i, t) {
    var s = SETS[cur], bar = barOf(i), pos = i % 16;
    var semi = chordSemi(bar);
    var G = s.gain;
    var kit = KITS[activeKit()];
    var hard = intensity > 0.5 && s.kit === 'heavy';
    var r = riffFor(bar);
    var busy = r && countX(r.pat, 16) >= 4;

    // 鼓:只托拍,音点数固定,永远不比主音密
    if (kit) {
      if (kit.kick[pos] === 'x') kick(t, s.drumAmt * (pos === 0 ? 1 : 0.82));
      if (kit.snare[pos] === 'x') snare(t, s.drumAmt * 0.85);
      if (kit.hat[pos] === 'x') hat(t, s.drumAmt * 0.6, hard && pos === 14);
      if (kit.crash[pos] === 'x' && bar % 4 === 0) crash(t, s.drumAmt * 0.6);
    }

    // 和声:每小节开头进来,一两个长音,低八度、约主音 1/5 音量,撑完一小节就退
    // 主音忙时只铺一个音,主音歇着才铺两个 —— 始终不越过主线
    if (pos === 0 && s.harmAmt) {
      var hv = VOICES[s.fills[bar % s.fills.length]];
      if (hv) {
        hv(freqAt(2, semi, s.harmOct), t + 0.02, s.harmAmt * G, s.beat * 3.4);
        if (!busy) hv(freqAt(4, semi, s.harmOct), t + 0.06, s.harmAmt * 0.7 * G, s.beat * 3.0);
      }
    }

    // 低音:一小节只点根音,过弦时补一个五度
    if (s.bassAmt) {
      if (pos === 0) bassNote(freqAt(0, semi, s.bassOct), t, s.bassAmt * G, s.beat * 1.8);
      else if (pos === 8) bassNote(freqAt(2, semi, s.bassOct), t, s.bassAmt * 0.6 * G, s.beat * 1.1);
    }

    // 主音:全场唯一会跑的声部
    if (r && r.pat[pos] === 'x') {
      var deg = r.deg[countX(r.pat, pos) % r.deg.length];
      var hold = r.pat[(pos + 1) % 16] === 'o';
      var dur = hold ? s.beat * 2.6 : s.beat * (pos % 4 === 0 ? 0.9 : 0.6);
      if (s.legato) dur = leadGap(i) * stepDur() + s.legato;
      var f = freqAt(deg, semi, s.leadOct);
      VOICES[s.lead](f, t, s.leadAmt * G, dur);
      // 只有深渊、只有最强强度、只有强拍才叠一层低八度加厚,不另开旋律线
      if (s.lead === 'eguitar' && hard && pos % 8 === 0) {
        VOICES.eguitar(f * 0.5, t, s.leadAmt * 0.4 * G, dur);
      }
    }
  }

  function tick() {
    if (!ready || !playing || muted) return;
    var t = now();
    // 标签页被节流后追平,避免一次性爆发一堆过期音符
    if (seq.next < t - 0.25) seq.next = t + 0.05;
    var horizon = t + 0.18, guard = 0;
    while (seq.next < horizon && guard++ < 24) {
      playStep(seq.step, seq.next);
      seq.step++;
      seq.next += stepDur();
    }
  }

  function startSeq() {
    if (!ready || seq.timer) return;
    playing = true;
    seq.next = now() + 0.08;
    seq.step = 0;
    seq.timer = setInterval(tick, 30);
  }

  /* ── 低音持续层 ── */
  function updateDroneLayer() {
    if (!ready) return;
    // 独奏曲目彻底停止持续层与调制器,避免切曲后仍有低音残留。
    if (!SETS[cur].drone) {
      if (droneNodes) {
        droneNodes.g.disconnect();
        droneNodes.o.forEach(function (o) { o.stop(); });
        droneNodes = null;
      }
      return;
    }
    var target = muted ? 0.0001 : SETS[cur].drone * (0.5 + intensity * 0.55);
    if (!droneNodes) {
      if (target <= 0.002) return;
      var g = ctx.createGain(); g.gain.value = 0.0001;
      var base = SETS[cur].root * 0.25;
      var o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = base;
      var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = base * 1.5;
      var o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = base * 2.01;
      var g3 = ctx.createGain(); g3.gain.value = 0.22;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      var lg = ctx.createGain(); lg.gain.value = 0.35;
      o1.connect(g); o2.connect(g); o3.connect(g3); g3.connect(g);
      lfo.connect(lg); lg.connect(g.gain);
      g.connect(musIn);
      o1.start(); o2.start(); o3.start(); lfo.start();
      droneNodes = { g: g, o: [o1, o2, o3, lfo] };
    }
    droneNodes.g.gain.setTargetAtTime(target, now(), 1.4);
    droneNodes.o[1].frequency.setTargetAtTime(SETS[cur].root * 0.375 + intensity * 4, now(), 2);
  }

  DM.audio = {
    unlock: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      startSeq();
      updateDroneLayer();
    },
    get on() { return !muted; },
    toggle: function () {
      muted = !muted;
      if (ready) applyVol();
      if (DM.save) { DM.save.data.muted = muted; DM.save.flush(); }
      return !muted;
    },
    volumes: function () { return { master: vol.master, sfx: vol.sfx, music: vol.music, muted: muted }; },
    setVol: function (which, v) {
      if (!(which in vol)) return;
      vol[which] = DM.clamp(v, 0, 1);
      if (which === 'master' && vol.master > 0 && muted) { muted = false; if (DM.save) DM.save.data.muted = false; }
      applyVol();
      if (DM.save) {
        DM.save.data.vol = { master: vol.master, sfx: vol.sfx, music: vol.music };
        DM.save.data.muted = muted;
        DM.save.flush();
      }
      if (DM.ui && DM.ui.syncVol) DM.ui.syncVol();
    },
    initVolumes: function (v, music, isMuted) {
      if (v) {
        vol.master = DM.clamp(v.master === undefined ? 0.8 : v.master, 0, 1);
        vol.sfx = DM.clamp(v.sfx === undefined ? 0.95 : v.sfx, 0, 1);
        vol.music = DM.clamp(v.music === undefined ? 0.55 : v.music, 0, 1);
      }
      muted = !!isMuted;
      if (music && SETS[music]) cur = music;
      applyVol();
    },
    musicSets: function () {
      return Object.keys(SETS).map(function (k) { return { id: k, name: SETS[k].name, desc: SETS[k].desc }; });
    },
    getMusic: function () { return cur; },
    setMusic: function (id) {
      if (!SETS[id]) return;
      cur = id;
      seq.step = 0;
      if (ready) { seq.next = now() + 0.05; updateDroneLayer(); }
      if (DM.save) { DM.save.data.music = id; DM.save.flush(); }
      if (DM.ui && DM.ui.syncVol) DM.ui.syncVol();
    },
    // 越深越紧越燥:强度 0..6
    updateDrone: function (level) {
      intensity = DM.clamp(level / 6, 0, 1);
      if (ready) updateDroneLayer();
    },
    stopDrone: function () { intensity = 0; if (ready) updateDroneLayer(); },

    /* ───────── 音效 ───────── */
    hit: function (step, big) {
      var oct = Math.pow(2, Math.floor(step / 5) % 4);
      var f = SETS.xingmo.root * Math.pow(2, PENT[step % 5] / 12) * oct;
      tone(f, { type: big ? 'square' : 'triangle', dur: big ? 0.26 : 0.15, gain: big ? 0.15 : 0.12, send: 0.5, atk: 0.004 });
      tone(f * 2.01, { type: 'sine', dur: 0.09, gain: 0.045 });
      noise(0.05, Math.min(11000, 2600 + step * 120), 0.045, 'bandpass', 2);
    },
    crack: function (step) {
      var oct = Math.pow(2, Math.floor(step / 5) % 3);
      var f = SETS.xingmo.root * 1.5 * oct;
      tone(f, { type: 'sine', dur: 0.42, gain: 0.17, send: 0.9 });
      tone(f * 1.5, { type: 'triangle', dur: 0.3, gain: 0.06, send: 0.6 });
      noise(0.16, 1800, 0.08);
    },
    clank: function () { noise(0.07, 900 + Math.random() * 500, 0.05, 'bandpass', 3); },
    wall: function () { noise(0.05, 420, 0.04, 'lowpass'); },
    launch: function (power) {
      tone(120 + power * 90, { type: 'sine', dur: 0.16, gain: 0.18, slide: 60 });
      noise(0.11, 700, 0.08, 'lowpass');
    },
    bucket: function () {
      tone(587, { type: 'sine', dur: 0.7, gain: 0.18, send: 1 });
      tone(880, { type: 'triangle', dur: 0.55, gain: 0.09, send: 1 });
      tone(1174, { type: 'sine', dur: 0.9, gain: 0.06, send: 1 });
    },
    clear: function () {
      [0, 2, 4, 7, 9].forEach(function (n, i) {
        setTimeout(function () {
          tone(SETS.xingmo.root * Math.pow(2, n / 12) * (i > 2 ? 2 : 1), { type: 'triangle', dur: 0.7, gain: 0.14, send: 1 });
        }, i * 74);
      });
      noise(0.7, 2400, 0.06);
    },
    hurt: function () {
      tone(150, { type: 'sawtooth', dur: 0.5, gain: 0.15, slide: 44, filter: 'lowpass', fc: 700 });
      noise(0.4, 300, 0.12, 'lowpass');
    },
    ui: function (up) { tone(up ? 660 : 440, { type: 'sine', dur: 0.09, gain: 0.07 }); },
    pick: function (rarity) {
      var base = [392, 523, 659, 784][Math.min(3, rarity)];
      tone(base, { type: 'triangle', dur: 0.5, gain: 0.15, send: 0.8 });
      tone(base * 2, { type: 'sine', dur: 0.7, gain: 0.07, send: 0.8 });
    },
    boss: function () {
      tone(65, { type: 'sawtooth', dur: 1.4, gain: 0.2, filter: 'lowpass', fc: 320 });
      noise(1.0, 180, 0.13, 'lowpass');
    },
    // 连奏曲目试听沿用同一条播放线,不另外叠一条旋律;其他曲目仍试听两小节。
    preview: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (SETS[cur].legato) {
        startSeq();
        updateDroneLayer();
        return;
      }
      var s = SETS[cur], d = s.beat / 4, t0 = now() + 0.06;
      for (var i = 0; i < 32; i++) playStep(i, t0 + i * d);
    }
  };
})(DM);
