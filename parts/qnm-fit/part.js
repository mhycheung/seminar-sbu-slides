// QNM-fit part: SXS:BBH:0305 h22 (slide 1); free-QNM fits over start times t0, with one mode
// (slide 2) and two modes (slide 3).
// Data: QNMFIT_DATA from assets/qnm-fit-data.js (tasks/t05-qnm-fit/make_qnm_fit_data.py).
// Times in M_f, t = 0 at the peak of |h22|; frequencies as M_f omega.
(function () {
  "use strict";
  var D = window.QNMFIT_DATA;
  var W = D.wave;
  var WAVE = "#333333";                  // waveform: very dark grey, apart from the black frame
  var WAVE_UNUSED = "#c8c8c8";           // waveform before the fit window
  var FIT_COLOR = "#d62728";             // reconstructed waveform (matplotlib C3)
  var MODE_COLORS = ["#1f77b4", "#ff7f0e"];  // fitted frequencies: matplotlib C0, C1
  var STAGE_K = [null, 0, 1, 2, 3, 4];   // t0 / M_f shown at stages 1-5
  var SWEEP_STAGE = STAGE_K.length;      // stage 6 on: sweep from t0 = 4 to 50 M_f
  var SWEEP_RATE = 46 / 6000;            // M_f per ms: t0 = 4 -> 50 in 6 s

  function kIndex(k) { return Math.round(k * 10); }  // D.k = 0, 0.1, ..., 50

  // Canvas whose backing store matches its on-screen size in device pixels; drawing is in
  // slide pixels (its CSS size).
  function setup(canvas) {
    var cssW = parseFloat(canvas.style.width), cssH = parseFloat(canvas.style.height);
    var s = canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1) / cssW;
    s = Math.max(s, 0.25);
    var bw = Math.round(cssW * s), bh = Math.round(cssH * s);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    var ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bw, bh);
    ctx.setTransform(bw / cssW, 0, 0, bh / cssH, 0, 0);
    return { ctx: ctx, w: cssW, h: cssH };
  }

  // Axes box with ticks; returns the data -> slide-pixel maps.
  function frame(c, xr, yr, xticks, yticks, fmtx, fmty) {
    var L = 110, R = c.w - 40, T = 25, B = c.h - 60, ctx = c.ctx;
    var X = function (x) { return L + (x - xr[0]) / (xr[1] - xr[0]) * (R - L); };
    var Y = function (y) { return B - (y - yr[0]) / (yr[1] - yr[0]) * (B - T); };
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(L, T, R - L, B - T);
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    xticks.forEach(function (x) {
      ctx.beginPath(); ctx.moveTo(X(x), B); ctx.lineTo(X(x), B - 12); ctx.stroke();
      ctx.fillText(fmtx(x), X(x), B + 10);
    });
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    yticks.forEach(function (y) {
      ctx.beginPath(); ctx.moveTo(L, Y(y)); ctx.lineTo(L + 12, Y(y)); ctx.stroke();
      ctx.fillText(fmty(y), L - 10, Y(y));
    });
    return { X: X, Y: Y, L: L, R: R, T: T, B: B };
  }

  function range(a, b, d) { var r = []; for (var x = a; x <= b + 1e-9; x += d) r.push(+x.toFixed(6)); return r; }
  function fixed(n) { return function (x) { return x.toFixed(n); }; }

  function clip(c, f) {
    c.ctx.save();
    c.ctx.beginPath();
    c.ctx.rect(f.L, f.T, f.R - f.L, f.B - f.T);
    c.ctx.clip();
  }

  // Waveform samples with t0 <= t <= t1 (plus one either side), in `color`.
  function drawWave(c, f, t0, t1, color) {
    var ctx = c.ctx, started = false;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (var i = 0; i < W.t.length; i++) {
      if (W.t[i + 1] < t0 || W.t[i - 1] > t1) continue;
      var x = f.X(W.t[i]), y = f.Y(W.re[i]);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function cross(p, x, y) {
    var a = 14;
    [["#fff", 9], ["#000", 4]].forEach(function (st) {
      p.strokeStyle = st[0];
      p.lineWidth = st[1];
      p.beginPath();
      p.moveTo(x - a, y - a); p.lineTo(x + a, y + a);
      p.moveTo(x - a, y + a); p.lineTo(x + a, y - a);
      p.stroke();
    });
  }

  // ---- slide 1: the waveform ----
  var YR = [-0.42, 0.42], YT = [-0.4, -0.2, 0, 0.2, 0.4];
  function drawSlide1(slide) {
    var c = setup(slide.querySelector("canvas"));
    var f = frame(c, [-30, 100], YR, range(-20, 100, 20), YT, fixed(0), fixed(1));
    clip(c, f);
    drawWave(c, f, -30, 100, WAVE);
    c.ctx.restore();
  }
  var s1 = null;
  Deck.widget("qnm-fit-waveform", {
    enter: function (slide) {
      s1 = function () { drawSlide1(slide); };
      window.addEventListener("resize", s1);
      s1();
    },
    leave: function () { window.removeEventListener("resize", s1); }
  });

  // ---- slides 2 and 3: start-time sweeps ----
  var LX = [-20, 80];
  var LYR = [-0.42, 0.6];                // headroom above the waveform for the window arrow

  // Left panel: waveform (light before t0), fit window, arrow, reconstruction of fit `F` at index cur.
  function drawLeft(slide, F, cur) {
    var cl = setup(slide.querySelector(".qnm-fit-left"));
    var fl = frame(cl, LX, LYR, range(-20, 80, 20), YT, fixed(0), fixed(1));
    var ctx = cl.ctx;
    clip(cl, fl);
    if (cur < 0) { drawWave(cl, fl, LX[0], LX[1], WAVE); ctx.restore(); return; }
    var t0 = D.k[cur];
    ctx.fillStyle = "#ededed";
    ctx.fillRect(fl.X(t0), fl.T, fl.R - fl.X(t0), fl.B - fl.T);
    drawWave(cl, fl, LX[0], t0, WAVE_UNUSED);
    drawWave(cl, fl, t0, LX[1], WAVE);
    ctx.strokeStyle = FIT_COLOR;
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    for (var t = t0; t <= LX[1]; t += 0.25) {
      // jaxqualin model h = sum A exp(-i[(wr + i wi) t + phi]); Re h = sum A e^{wi t} cos(wr t + phi)
      var h = 0;
      for (var j = 0; j < F.A[cur].length; j++)
        h += F.A[cur][j] * Math.exp(F.wi[cur][j] * t) * Math.cos(F.wr[cur][j] * t + F.phi[cur][j]);
      if (t === t0) ctx.moveTo(fl.X(t), fl.Y(h)); else ctx.lineTo(fl.X(t), fl.Y(h));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // "fitting window" arrow, starting at t0 and pointing right
    var x0 = fl.X(t0), x1 = x0 + 170, y = fl.Y(0.52);
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1 - 4, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x1 - 18, y - 9); ctx.lineTo(x1 - 18, y + 9); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x0, y - 14); ctx.lineTo(x0, y + 14); ctx.stroke();
    ctx.font = "30px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("fitting window", x0 + 4, y - 12);
    ctx.restore();
  }

  // One sweep slide. opt: id, fit (one entry per t0, lists over modes), plane {x, y, xt, yt},
  // markers [{w, label, from}] (from: first stage at which the marker shows), pauses (t0 / M_f
  // at which the sweep stops until the next key press).
  function sweep(opt) {
    var F = opt.fit, raf = null, state = null, onResize = null;

    function draw(slide, stage, cur, trail, moving) {
      drawLeft(slide, F, cur);
      var cv = slide.querySelector(".qnm-fit-right");
      var cr = setup(cv);
      var fr = frame(cr, opt.plane.x, opt.plane.y, opt.plane.xt, opt.plane.yt, fixed(2), fixed(2));
      var p = cr.ctx;
      clip(cr, fr);
      for (var j = 0; j < F.wr[0].length; j++) {
        p.fillStyle = MODE_COLORS[j];
        p.globalAlpha = 0.35;
        trail.forEach(function (i) {
          p.beginPath(); p.arc(fr.X(F.wr[i][j]), fr.Y(-F.wi[i][j]), 6, 0, 2 * Math.PI); p.fill();
        });
        p.globalAlpha = 1;
        if (cur >= 0) {
          p.beginPath(); p.arc(fr.X(F.wr[cur][j]), fr.Y(-F.wi[cur][j]), 15, 0, 2 * Math.PI); p.fill();
        }
      }
      opt.markers.forEach(function (m) {
        var el = slide.querySelector(".qnm-fit-q" + m.label);
        var on = stage >= m.from;
        el.style.visibility = on ? "visible" : "hidden";
        if (!on) return;
        var qx = fr.X(m.w[0]), qy = fr.Y(-m.w[1]);
        cross(p, qx, qy);
        el.style.left = (parseFloat(cv.style.left) + qx + 14) + "px";
        el.style.top = (parseFloat(cv.style.top) + qy - 70) + "px";
      });
      p.restore();
      var t0el = slide.querySelector(".qnm-fit-t0");
      if (cur < 0) t0el.innerHTML = "";
      else {
        // whole numbers while the sweep runs; one decimal when it rests on a non-integer t0
        var k = D.k[cur], txt = moving || Math.abs(k - Math.round(k)) < 1e-6 ? String(Math.round(k)) : k.toFixed(1);
        katex.render("t_0 = " + txt + "\\, M_f", t0el);
      }
    }

    // The sweep after the fixed stages runs in segments between opt.pauses, one step each, at
    // SWEEP_RATE M_f per ms. Stage SWEEP_STAGE + s plays segment s.
    var ends = [STAGE_K[SWEEP_STAGE - 1]].concat(opt.pauses || [], [50]);

    // Trail and current index at a stage; k is t0 / M_f during (and after) the sweep.
    function show(slide, stage, k, moving) {
      state = { stage: stage, k: k };
      var trail = [], s;
      for (s = 1; s < Math.min(stage, SWEEP_STAGE); s++) trail.push(kIndex(STAGE_K[s]));
      if (stage === 0) return draw(slide, stage, -1, trail);
      if (stage < SWEEP_STAGE) return draw(slide, stage, kIndex(STAGE_K[stage]), trail);
      var k0 = ends[0], cur = kIndex(k);
      trail.push(kIndex(k0));
      for (var i = kIndex(k0) + 1; i < cur; i++) trail.push(i);
      draw(slide, stage, cur, trail, moving);
    }

    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }

    Deck.widget(opt.id, {
      steps: SWEEP_STAGE - 1 + ends.length - 1,
      enter: function (slide) {
        onResize = function () { if (state) show(slide, state.stage, state.k); };
        window.addEventListener("resize", onResize);
      },
      leave: function () { stop(); window.removeEventListener("resize", onResize); },
      step: function (slide, stage, dir) {
        stop();
        if (stage < SWEEP_STAGE) { show(slide, stage, 0); return; }
        var a = ends[stage - SWEEP_STAGE], b = ends[stage - SWEEP_STAGE + 1];
        if (dir < 0) { show(slide, stage, b); return; }
        var start = null, ms = (b - a) / SWEEP_RATE;
        (function tick(now) {
          if (start === null) start = now;
          var u = Math.max(0, Math.min(1, (now - start) / ms));  // rAF time may precede start
          show(slide, stage, a + (b - a) * u, u < 1);
          raf = u < 1 ? requestAnimationFrame(tick) : null;
        })(performance.now());
      }
    });
  }

  // Wrap the one-mode fit's per-t0 numbers as lists of one mode.
  function oneMode(F) {
    var out = {};
    ["A", "phi", "wr", "wi"].forEach(function (key) { out[key] = F[key].map(function (v) { return [v]; }); });
    return out;
  }

  sweep({
    id: "qnm-fit-sweep", fit: oneMode(D.fit),
    plane: { x: [0.45, 0.55], y: [0.05, 0.09], xt: range(0.46, 0.54, 0.02), yt: range(0.05, 0.09, 0.01) },
    markers: [{ w: D.w220, label: "220", from: 0 }]
  });

  // t0 at which mode 1 of the two-mode fit is closest to the Kerr (2,2,1) frequency.
  function closestTo221() {
    var best = Infinity, kb = 0;
    for (var i = 0; i < D.k.length; i++) {
      var d = Math.hypot(D.fit2.wr[i][1] - D.w221[0], D.fit2.wi[i][1] - D.w221[1]);
      if (d < best) { best = d; kb = D.k[i]; }
    }
    return kb;
  }

  // Two modes; the sweep pauses where mode 1 is closest to (2,2,1).
  sweep({
    id: "qnm-fit-sweep2", fit: D.fit2, pauses: [closestTo221()],
    plane: { x: [0.38, 0.64], y: [0.04, 0.36], xt: range(0.4, 0.6, 0.05), yt: range(0.05, 0.35, 0.05) },
    markers: [{ w: D.w220, label: "220", from: 0 }, { w: D.w221, label: "221", from: 0 }]
  });
  // ---- slides 4 and 5: many-mode fits, complex plane only ----
  // Stage 0: fits at t0 = 0. Stage 1: sweep t0 = 0 -> 50 M_f by itself. Stage 2: the target
  // frequency (retrograde (2,2,0), or quadratic (2,2,0)x(2,2,0)) is marked and labelled.
  // The track that ends near the target (M.hi) is drawn in C3 and at full opacity; the other
  // tracks in the other matplotlib cycle colours, fainter.
  var CYCLE = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f"];
  var HI_COLOR = CYCLE[3];
  var FAINT = 0.45;                      // opacity of the unmarked tracks relative to the marked one

  function many(opt) {
    var M = window.QNMFIT_MANY[opt.key], K = window.QNMFIT_MANY.k;
    var n = M.nFree, raf = null, state = null, onResize = null;
    var others = CYCLE.filter(function (c) { return c !== HI_COLOR; });
    var colors = [], o = 0;
    for (var j = 0; j < n; j++) colors.push(j === M.hi ? HI_COLOR : others[o++]);

    function draw(slide, stage, cur, moving) {
      var cv = slide.querySelector(".qnm-fit-plane");
      var c = setup(cv);
      var f = frame(c, opt.plane.x, opt.plane.y, opt.plane.xt, opt.plane.yt, fixed(1), fixed(1));
      var p = c.ctx;
      clip(c, f);
      // faint tracks first, the marked track on top
      var order = [];
      for (var j = 0; j < n; j++) if (j !== M.hi) order.push(j);
      order.push(M.hi);
      order.forEach(function (j) {
        var hi = j === M.hi;
        p.fillStyle = colors[j];
        p.globalAlpha = (hi ? 1 : FAINT) * 0.5;
        for (var i = 0; i < cur; i++) {
          p.beginPath(); p.arc(f.X(M.wr[i][j]), f.Y(-M.wi[i][j]), hi ? 6 : 4, 0, 2 * Math.PI); p.fill();
        }
        p.globalAlpha = hi ? 1 : FAINT + 0.15;
        p.beginPath(); p.arc(f.X(M.wr[cur][j]), f.Y(-M.wi[cur][j]), hi ? 15 : 11, 0, 2 * Math.PI); p.fill();
      });
      p.globalAlpha = 1;
      var el = slide.querySelector(".qnm-fit-target");
      el.style.visibility = stage >= 2 ? "visible" : "hidden";
      if (stage >= 2) {
        var qx = f.X(M.target[0]), qy = f.Y(-M.target[1]);
        cross(p, qx, qy);
        el.style.left = (parseFloat(cv.style.left) + qx + opt.labelDx) + "px";
        el.style.top = (parseFloat(cv.style.top) + qy + opt.labelDy) + "px";
      }
      p.restore();
      var k = K[cur];
      katex.render("t_0 = " + (moving ? Math.round(k) : k) + "\\, M_f", slide.querySelector(".qnm-fit-t0"));
    }

    function show(slide, stage, k, moving) {
      state = { stage: stage, k: k };
      draw(slide, stage, kIndex(k), moving);
    }

    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }

    Deck.widget(opt.id, {
      steps: 2,
      enter: function (slide) {
        onResize = function () { if (state) show(slide, state.stage, state.k); };
        window.addEventListener("resize", onResize);
      },
      leave: function () { stop(); window.removeEventListener("resize", onResize); },
      step: function (slide, stage, dir) {
        stop();
        if (stage === 0) { show(slide, 0, 0); return; }
        if (stage === 2 || dir < 0) { show(slide, stage, 50); return; }
        var start = null, ms = 50 / SWEEP_RATE;
        (function tick(now) {
          if (start === null) start = now;
          var u = Math.max(0, Math.min(1, (now - start) / ms));  // rAF time may precede start
          show(slide, 1, 50 * u, u < 1);
          raf = u < 1 ? requestAnimationFrame(tick) : null;
        })(performance.now());
      }
    });
  }

  // Plane ranges hold every fitted frequency except the unused mode at omega ~ 0 (or growing,
  // -M_f omega_i < 0, at the earliest t0), which falls below the lower edge.
  many({ id: "qnm-fit-many22", key: "lm22", labelDx: 60, labelDy: 5,
    plane: { x: [-0.45, 0.95], y: [0.02, 0.46], xt: range(-0.4, 0.8, 0.2), yt: range(0.1, 0.4, 0.1) } });
  many({ id: "qnm-fit-many44", key: "lm44", labelDx: 20, labelDy: -85,
    plane: { x: [0.45, 1.6], y: [0.02, 0.46], xt: range(0.6, 1.6, 0.2), yt: range(0.1, 0.4, 0.1) } });
})();
