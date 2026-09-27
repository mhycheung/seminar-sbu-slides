// QNM-fit part: SXS:BBH:0305 h22 (slide 1); one-free-QNM fits over start times t0 (slide 2).
// Data: QNMFIT_DATA from assets/qnm-fit-data.js (tasks/t05-qnm-fit/make_qnm_fit_data.py).
// Times in M_f, t = 0 at the peak of |h22|; frequencies as M_f omega.
(function () {
  "use strict";
  var D = window.QNMFIT_DATA;
  var W = D.wave, F = D.fit;
  var FIT_COLOR = "#d62728";
  var SWEEP_MS = 6000;             // stage 6: t0 = 4 -> 50 M_f
  var STAGE_K = [null, 0, 1, 2, 3, 4];  // t0 / M_f shown at stages 1-5
  var LAST = STAGE_K.length;             // the sweep stage
  var PLANE = { x0: 0.45, x1: 0.55, y0: 0.05, y1: 0.09 };

  function kIndex(k) { return Math.round(k * 10); }  // F.k = 0, 0.1, ..., 50

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
    var L = 110, R = c.w - 20, T = 25, B = c.h - 60, ctx = c.ctx;
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

  function drawWave(c, f, t0, t1) {
    var ctx = c.ctx;
    var i0 = Math.max(0, Math.floor((t0 - W.t0) / W.dt)), i1 = Math.min(W.re.length - 1, Math.ceil((t1 - W.t0) / W.dt));
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (var i = i0; i <= i1; i++) {
      var x = f.X(W.t0 + i * W.dt), y = f.Y(W.re[i]);
      if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // ---- slide 1: the waveform ----
  var YR = [-0.42, 0.42], YT = [-0.4, -0.2, 0, 0.2, 0.4];
  function drawSlide1(slide) {
    var c = setup(slide.querySelector("canvas"));
    var f = frame(c, [-1000, 100], YR, range(-1000, 0, 200), YT, fixed(0), fixed(1));
    clip(c, f);
    drawWave(c, f, -1000, 100);
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

  // ---- slide 2: the start-time sweep ----
  var LX = [-20, 80];
  var raf = null, state = null, onResize = null;

  // Draw the fit at sample index `cur` (or none if cur < 0), with earlier samples `trail`.
  function drawSweep(slide, cur, trail) {
    var cl = setup(slide.querySelector("#qnm-fit-left-canvas"));
    var fl = frame(cl, LX, YR, range(-20, 80, 20), YT, fixed(0), fixed(1));
    var cr = setup(slide.querySelector("#qnm-fit-right-canvas"));
    var fr = frame(cr, [PLANE.x0, PLANE.x1], [PLANE.y0, PLANE.y1],
      range(0.46, 0.54, 0.02), range(0.05, 0.09, 0.01), fixed(2), fixed(2));
    var ctx = cl.ctx;
    clip(cl, fl);
    if (cur >= 0) {
      var t0 = F.k[cur];
      ctx.fillStyle = "#e6e6e6";
      ctx.fillRect(fl.X(t0), fl.T, fl.R - fl.X(t0), fl.B - fl.T);
    }
    drawWave(cl, fl, LX[0], LX[1]);
    if (cur >= 0) {
      var A = F.A[cur], ph = F.phi[cur], wr = F.wr[cur], wi = F.wi[cur];
      ctx.strokeStyle = FIT_COLOR;
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      for (var t = t0; t <= LX[1]; t += 0.25) {
        // jaxqualin model h = A exp(-i[(wr + i wi) t + phi]); Re h = A e^{wi t} cos(wr t + phi)
        var y = fl.Y(A * Math.exp(wi * t) * Math.cos(wr * t + ph));
        if (t === t0) ctx.moveTo(fl.X(t), y); else ctx.lineTo(fl.X(t), y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    // complex plane: trail, current point, Kerr (2,2,0) cross
    var p = cr.ctx;
    clip(cr, fr);
    var qx = fr.X(D.w220[0]), qy = fr.Y(-D.w220[1]), a = 14;
    p.fillStyle = FIT_COLOR;
    p.globalAlpha = 0.35;
    trail.forEach(function (i) {
      p.beginPath(); p.arc(fr.X(F.wr[i]), fr.Y(-F.wi[i]), 6, 0, 2 * Math.PI); p.fill();
    });
    p.globalAlpha = 1;
    if (cur >= 0) {
      p.beginPath(); p.arc(fr.X(F.wr[cur]), fr.Y(-F.wi[cur]), 15, 0, 2 * Math.PI); p.fill();
    }
    // cross last, with a white edge, so the points never hide it
    [["#fff", 9], ["#000", 4]].forEach(function (st) {
      p.strokeStyle = st[0];
      p.lineWidth = st[1];
      p.beginPath();
      p.moveTo(qx - a, qy - a); p.lineTo(qx + a, qy + a);
      p.moveTo(qx - a, qy + a); p.lineTo(qx + a, qy - a);
      p.stroke();
    });
    p.restore();

    var lab = slide.querySelector("#qnm-fit-220");
    lab.style.left = (1150 + qx + 14) + "px";
    lab.style.top = (140 + qy - 70) + "px";
    var t0el = slide.querySelector("#qnm-fit-t0");
    if (cur < 0) t0el.innerHTML = "";
    else katex.render("t_0 = " + Math.round(F.k[cur]) + "\\, M_f", t0el);
  }

  // Trail and current index of stages 1-5, or of the sweep at t0 = k (last stage).
  function stageIdx(stage, k) {
    var trail = [];
    for (var s = 1; s < Math.min(stage, LAST); s++) trail.push(kIndex(STAGE_K[s]));
    if (stage < LAST) return { cur: stage === 0 ? -1 : kIndex(STAGE_K[stage]), trail: trail };
    var k0 = STAGE_K[LAST - 1];
    trail.push(kIndex(k0));
    var cur = kIndex(k);
    for (var i = kIndex(k0) + 1; i < cur; i++) trail.push(i);
    return { cur: cur, trail: trail };
  }

  function show(slide, stage, k) {
    state = { stage: stage, k: k };
    var s = stageIdx(stage, k);
    drawSweep(slide, s.cur, s.trail);
  }

  function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }

  Deck.widget("qnm-fit-sweep", {
    steps: LAST,
    enter: function (slide) {
      onResize = function () { if (state) show(slide, state.stage, state.k); };
      window.addEventListener("resize", onResize);
    },
    leave: function () { stop(); window.removeEventListener("resize", onResize); },
    step: function (slide, stage, dir) {
      stop();
      if (stage < LAST || dir < 0) { show(slide, stage, 50); return; }
      var start = null;
      (function tick(now) {
        if (start === null) start = now;
        var u = Math.min(1, (now - start) / SWEEP_MS);
        show(slide, LAST, STAGE_K[LAST - 1] + (50 - STAGE_K[LAST - 1]) * u);
        raf = u < 1 ? requestAnimationFrame(tick) : null;
      })(performance.now());
    }
  });
})();
