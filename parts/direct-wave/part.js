// direct-wave-plunge: left, a particle plunging into a Kerr black hole (chi = 0.7), the
// trajectory of Cheung (2608.29466), purple outside the prograde light ring and red inside
// it, as in the paper's figure. When the plunge ends, the paper's unfiltered waveform
// panel fades in on the right. Going back from the next slide shows the final state.
// Outside the light ring the particle moves uniformly in coordinate time; inside, uniformly
// in arc length with an ease-out (coordinate time diverges at the horizon).
(function () {
  "use strict";

  var D = direct_wave_traj;          // x, y in M (tasks/t11-direct-wave/S1/make_dw_data.py)
  var C_FULL = "#540d6e", C_IN = "#ee4266", C_LR = "#FDB515";
  var T_OUT = 3.0, T_IN = 1.8;       // s, the two parts of the plunge
  var HOLD = 0.3;                    // s, from the end of the plunge to the panel fading in
  var L = 3.9;                       // half-width of the view, in M
  var LW = 5.5;                      // trajectory and light-ring width, px of the 860 px canvas
  var DOT = 11;                      // particle radius, px
  var FS = 38;                       // "light ring" label, px
  var N_OUT = D.out.length, N_IN = D.inn.length;

  var raf = null, timer = null, t0 = 0;

  function fit(c) {
    var r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var w = Math.max(50, Math.round(r.width * dpr)), h = Math.max(50, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return w / c.offsetWidth;
  }

  // Curved text centred at angle th (radians, maths convention) on a circle of radius R px,
  // read left to right below the centre (angle increases along the text).
  function arcText(g, text, cx, cy, R, th) {
    var total = g.measureText(text).width, a = th - total / 2 / R;
    for (var i = 0; i < text.length; i++) {
      var w = g.measureText(text[i]).width;
      a += w / 2 / R;
      g.save();
      g.translate(cx + R * Math.cos(a), cy - R * Math.sin(a));
      g.rotate(-a - Math.PI / 2);
      g.fillText(text[i], 0, 0);
      g.restore();
      a += w / 2 / R;
    }
  }

  // Draw the plunge up to progress p in [0, 2]: p in [0, 1] outside, [1, 2] inside.
  function draw(slide, p) {
    var c = slide.querySelector(".direct-wave-canvas"), k = fit(c), g = c.getContext("2d");
    var W = c.width, s = W / (2 * L), cx = W / 2, cy = c.height / 2;
    function X(q) { return cx + s * q[0]; }
    function Y(q) { return cy - s * q[1]; }
    g.clearRect(0, 0, W, c.height);
    g.lineCap = "round"; g.lineJoin = "round";

    // black hole
    g.fillStyle = "#000";
    g.beginPath(); g.arc(cx, cy, s * D.r_plus, 0, 2 * Math.PI); g.fill();

    // trajectory, outside then inside
    function path(pts, n, col) {
      if (n < 2) return;
      g.strokeStyle = col; g.lineWidth = LW * k;
      g.beginPath(); g.moveTo(X(pts[0]), Y(pts[0]));
      for (var i = 1; i < n; i++) g.lineTo(X(pts[i]), Y(pts[i]));
      g.stroke();
    }
    var nOut = Math.max(1, Math.min(N_OUT, Math.round(Math.min(p, 1) * (N_OUT - 1)) + 1));
    var nIn = p > 1 ? Math.max(1, Math.min(N_IN, Math.round((p - 1) * (N_IN - 1)) + 1)) : 0;
    path(D.out, nOut, C_FULL);
    path(D.inn, nIn, C_IN);

    // light ring, dashed, above the trajectory, with its curved label
    g.strokeStyle = C_LR; g.lineWidth = LW * k;
    g.setLineDash([11 * k, 6.5 * k]); g.lineCap = "butt";
    g.beginPath(); g.arc(cx, cy, s * D.r_lr, 0, 2 * Math.PI); g.stroke();
    g.setLineDash([]);
    g.fillStyle = C_LR; g.font = (FS * k) + "px Arial"; g.textAlign = "center"; g.textBaseline = "top";
    arcText(g, "light ring", cx, cy, s * D.r_lr + 10 * k, -Math.PI / 2);

    // the particle
    var q = nIn > 0 ? D.inn[nIn - 1] : D.out[nOut - 1];
    g.fillStyle = nIn > 0 ? C_IN : C_FULL;
    g.beginPath(); g.arc(X(q), Y(q), DOT * k, 0, 2 * Math.PI); g.fill();
  }

  function progress(e) {
    if (e < T_OUT) return e / T_OUT;
    var f = Math.min(1, (e - T_OUT) / T_IN);
    return 1 + (1 - (1 - f) * (1 - f));    // ease-out inside the light ring
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    raf = null; timer = null;
  }

  function panel(slide, on) {
    slide.querySelector(".direct-wave-panel").classList.toggle("direct-wave-show", on);
  }

  function play(slide) {
    stop();
    panel(slide, false);
    t0 = performance.now();
    function frame(now) {
      var e = (now - t0) / 1000;
      draw(slide, progress(e));
      if (e < T_OUT + T_IN) raf = requestAnimationFrame(frame);
      else {
        raf = null;
        timer = setTimeout(function () { panel(slide, true); }, HOLD * 1000);
      }
    }
    raf = requestAnimationFrame(frame);
  }

  Deck.widget("direct-wave-plunge", {
    steps: 0,
    enter: function () {},
    leave: function (slide) { stop(); panel(slide, false); },
    step: function (slide, k, dir) {
      if (dir === -1) { stop(); draw(slide, 2); panel(slide, true); }
      else play(slide);
    }
  });
})();
