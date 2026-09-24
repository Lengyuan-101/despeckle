window.DM = window.DM || {};

(function (DM) {
  'use strict';

  function fit() {
    var stage = document.getElementById('stage');
    var pad = window.innerWidth < 700 ? 0 : 14;
    var s = Math.min((window.innerWidth - pad) / DM.W, (window.innerHeight - pad) / DM.H);
    s = DM.clamp(s || 0, 0.22, 1.35);
    stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
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
