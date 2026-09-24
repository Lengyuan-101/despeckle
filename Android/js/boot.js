window.DM = window.DM || {};

(function (DM) {
  'use strict';

  function fit() {
    var stage = document.getElementById('stage');
    var wrap = document.getElementById('wrap');
    var cs = getComputedStyle(wrap);
    // 刘海屏要按安全区后的可用尺寸缩放,否则舞台边缘会被切掉
    var vw = window.innerWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    var vh = window.innerHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    // 只在窗口比舞台还大、留边不会损失缩放时才留边;手机上这 14px 会白吃掉约 4% 的尺寸
    var pad = (vw > DM.W && vh > DM.H) ? 14 : 0;
    var s = Math.min((vw - pad) / DM.W, (vh - pad) / DM.H);
    s = DM.clamp(s || 0, 0.22, 1.35);
    // 安全区不对称时,把舞台中心挪到安全区中心;桌面端 inset 为 0,不产生位移
    var dx = ((parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)) / 2;
    var dy = ((parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0)) / 2;
    stage.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(' + s + ')';
  }

  // 舞台与画布的 CSS 尺寸必须跟着 DM.W/DM.H 走,否则 CSS 写死 900 会把加宽的战场裁掉
  function applyViewport() {
    var r = document.documentElement.style;
    r.setProperty('--dm-w', DM.W + 'px');
    r.setProperty('--dm-h', DM.H + 'px');
  }

  function hiDPI() {
    var cv = document.getElementById('cv');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = DM.W * dpr;
    cv.height = DM.H * dpr;
    cv.style.width = DM.W + 'px';
    cv.style.height = DM.H + 'px';
    DM.Game.dpr = dpr;
  }

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);

  window.addEventListener('load', function () {
    DM.save.load();
    DM.audio.initVolumes(DM.save.data.vol, DM.save.data.music, DM.save.data.muted);
    applyViewport();
    hiDPI();
    fit();
    DM.Game.init(document.getElementById('cv'));
    DM.ui.show('title');
    if (!DM.save.data.seenHelp) {
      DM.save.data.seenHelp = true;
      DM.save.flush();
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && (DM.Game.state === 'aim' || DM.Game.state === 'fly')) DM.Game.togglePause();
    });
  });
})(DM);
