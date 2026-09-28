// GW231123 lensing part: the whitened Livingston data and the maximum-likelihood NRSur7dq4
// waveforms of Cheung+ (2607.21834), Fig. 3, built up stage by stage. Each lensed waveform first
// appears as its components (geometrical-optics images and diffraction residual, as in Fig. 10),
// stacked in the upper half, which then move into the Livingston panel and merge into their sum.
// Data: GW231123_LENSING_DATA from assets/gw231123-lensing-data.js
// (tasks/t09-gw231123-lensing/S2/export_waveforms.py). Time in ms from t_event; strain whitened.
(function () {
  "use strict";
  var D = window.GW231123_LENSING_DATA;

  // Bayes factor -> posterior odds (slide 5): the title gains "=> posterior odds", B becomes O,
  // and the prior odds appear as a factor.
  document.querySelectorAll(".gw231123-lensing-bayes").forEach(function (sl) {
    Deck.widget(sl.id, {
      steps: 2,
      enter: function () {},
      leave: function () {},
      step: function (s, k) { sl.classList.toggle("gw231123-lensing-odds", k >= 1); }
    });
  });
  if (!D) return;
  var MODELS = ["PM", "gSIS", "CIS"];
  var BASE = { unL: "#000000", PM: "#1f77b4", gSIS: "#ff7f0e", CIS: "#2ca02c" };  // Fig. 3
  var DATA_COLOR = "rgba(90,90,90,0.75)";
  var LW = 3.5, DATA_LW = 1.6;
  var XLIM = [-150, 100];
  var YLIM = D.ylim || { L1: [-5.5, 4.5], H1: [-4.5, 5.5] };                        // Fig. 3
  var PANEL = { L: 250, R: 1830 };
  var ROWS = { T: 140, B: 540 };           // upper half, below the title: the stacked components
  var LOW = { T: 560, B: 930 };            // Livingston panel; its axis label clears the progress bar
  var HIGH = { T: 95, B: 465 };            // Hanford panel (stage 8)
  var MERGE_MS = 1600;
  // Title of slide 2 at each stage: the model on screen (none at stage 0 and at the end, stage 8).
  var TITLES = ["", "Unlensed", "Point mass lens (PM)", "Point mass lens (PM)",
    "Generalized singular isothermal sphere (gSIS)", "Generalized singular isothermal sphere (gSIS)",
    "Cored isothermal sphere (CIS)", "Cored isothermal sphere (CIS)", ""];
  var COMP_LABEL = { I: "image I", II: "image II", III: "image III", diff: "diffraction" };
  var TICK_FONT = "30px Arial";

  function colorsFor(m) {
    var c = D.colors && D.colors[m];
    return c || {};
  }

  function setup(canvas) {
    var cssW = 1920, cssH = 1080;
    var s = canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1) / cssW;
    s = Math.max(s, 0.25);
    var bw = Math.round(cssW * s), bh = Math.round(cssH * s);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    var ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bw, bh);
    ctx.setTransform(bw / cssW, 0, 0, bh / cssH, 0, 0);
    return ctx;
  }

  function ease(u) { u = Math.min(Math.max(u, 0), 1); return u * u * (3 - 2 * u); }

  var t = D.t_ms;
  var i0 = 0, i1 = t.length - 1;
  while (i0 < t.length && t[i0] < XLIM[0]) i0++;
  while (i1 > 0 && t[i1] > XLIM[1]) i1--;
  function X(tm) { return PANEL.L + (tm - XLIM[0]) / (XLIM[1] - XLIM[0]) * (PANEL.R - PANEL.L); }

  // panel {T, B, ylim} -> y mapping: returns [zero line, px per unit strain]
  function frame(P, ylim) {
    var k = (P.B - P.T) / (ylim[1] - ylim[0]);
    return { y0: P.B + ylim[0] * k, k: k };
  }
  var FL = frame(LOW, YLIM.L1), FH = frame(HIGH, YLIM.H1);

  function comps(m) {
    var c = D.L1.components[m], keys = ["I", "II", "III", "diff"].filter(function (k) { return c[k]; });
    return keys.map(function (k) { return { key: k, y: c[k], color: (colorsFor(m)[k]) || BASE[m] }; });
  }
  function maxAbs(a) { var m = 0; for (var i = i0; i <= i1; i++) m = Math.max(m, Math.abs(a[i])); return m; }

  // Row layout of a model's components in the upper half: baseline and scale per row. The scale
  // is the Livingston panel's, reduced if needed so that neighbouring rows do not overlap.
  function rowLayout(m) {
    var cs = comps(m), n = cs.length, h = (ROWS.B - ROWS.T) / n;
    var amp = Math.max.apply(null, cs.map(function (c) { return maxAbs(c.y); }));
    var k = Math.min(FL.k, 0.46 * h / amp);
    return cs.map(function (c, j) { return { y0: ROWS.T + (j + 0.5) * h, k: k, c: c }; });
  }
  var LAYOUT = {};
  MODELS.forEach(function (m) { LAYOUT[m] = rowLayout(m); });

  function line(ctx, y, F, color, lw, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = "round";
    ctx.beginPath();
    for (var i = i0; i <= i1; i++) {
      var px = X(t[i]), py = F.y0 - y[i] * F.k;
      if (i === i0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function axes(ctx, P, F, ylim, showXLabels) {
    ctx.save();
    ctx.strokeStyle = "#e3e3e3"; ctx.lineWidth = 1.5;
    var xt = [-150, -100, -50, 0, 50, 100], yt = [];
    for (var v = Math.ceil(ylim[0] / 2) * 2; v <= ylim[1]; v += 2) yt.push(v);
    ctx.beginPath();
    xt.forEach(function (v) { ctx.moveTo(X(v), P.T); ctx.lineTo(X(v), P.B); });
    yt.forEach(function (v) { var y = F.y0 - v * F.k; ctx.moveTo(PANEL.L, y); ctx.lineTo(PANEL.R, y); });
    ctx.stroke();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
    ctx.strokeRect(PANEL.L, P.T, PANEL.R - PANEL.L, P.B - P.T);
    ctx.beginPath();
    xt.forEach(function (v) { ctx.moveTo(X(v), P.B); ctx.lineTo(X(v), P.B - 12); ctx.moveTo(X(v), P.T); ctx.lineTo(X(v), P.T + 12); });
    yt.forEach(function (v) { var y = F.y0 - v * F.k; ctx.moveTo(PANEL.L, y); ctx.lineTo(PANEL.L + 12, y); ctx.moveTo(PANEL.R, y); ctx.lineTo(PANEL.R - 12, y); });
    ctx.stroke();
    ctx.fillStyle = "#000"; ctx.font = TICK_FONT;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    yt.forEach(function (v) { ctx.fillText(v < 0 ? "−" + (-v) : String(v), PANEL.L - 12, F.y0 - v * F.k); });
    if (showXLabels) {
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      xt.forEach(function (v) { ctx.fillText(v < 0 ? "−" + (-v) : String(v), X(v), P.B + 10); });
    }
    ctx.restore();
  }

  function legend(ctx) {
    var x = PANEL.L + 22, y = HIGH.T + 18, w = 450, h = 64;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.strokeStyle = "#bbb"; ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    ctx.font = "30px Arial"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    ["unL", "PM", "gSIS", "CIS"].forEach(function (m, j) {
      var cx = x + 24 + j * 108;
      ctx.fillStyle = "#000";
      ctx.fillText(m, cx + 30, y + 20);
      ctx.strokeStyle = BASE[m]; ctx.lineWidth = LW;
      ctx.beginPath(); ctx.moveTo(cx + 6, y + 46); ctx.lineTo(cx + 54, y + 46); ctx.stroke();
    });
    ctx.restore();
  }

  // Components of model m in the upper half; u in [0, 1] is the merge progress (0: rows,
  // 1: merged into the sum in the Livingston panel).
  function drawComponents(ctx, m, u) {
    var L = LAYOUT[m], a = ease(u / 0.6), fade = ease((u - 0.6) / 0.4);
    // component names left of the rows and "+" signs between them, fading out as the rows move
    if (a < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - a;
      ctx.textBaseline = "middle";
      ctx.font = "34px Arial"; ctx.textAlign = "right";
      L.forEach(function (r) { ctx.fillStyle = r.c.color; ctx.fillText(COMP_LABEL[r.c.key], PANEL.L - 16, r.y0); });
      ctx.fillStyle = "#000"; ctx.font = "48px Arial"; ctx.textAlign = "center";
      for (var j = 0; j + 1 < L.length; j++) ctx.fillText("+", PANEL.L - 110, (L[j].y0 + L[j + 1].y0) / 2);
      ctx.restore();
    }
    L.forEach(function (r) {
      var F = { y0: r.y0 + (FL.y0 - r.y0) * a, k: r.k + (FL.k - r.k) * a };
      line(ctx, r.c.y, F, r.c.color, LW, 1 - fade);
    });
    if (fade > 0) line(ctx, D.L1[m], FL, BASE[m], LW, fade);
  }

  function makeWave(sl) {
    var canvas = document.createElement("canvas");
    canvas.className = "gw231123-lensing-canvas";
    sl.appendChild(canvas);
    function label(tex, x, y, cls) {
      var d = document.createElement("div");
      d.className = "gw231123-lensing-label " + (cls || "");
      d.style.left = x + "px"; d.style.top = y + "px";
      katex.render(tex, d, { throwOnError: false });
      sl.appendChild(d);
      return d;
    }
    label("t - t_{\\rm event}\\ [\\mathrm{ms}]", (PANEL.L + PANEL.R) / 2, LOW.B + 72);
    function textLabel(txt, x, y) {
      var d = document.createElement("div");
      d.className = "gw231123-lensing-label gw231123-lensing-ylabel";
      d.style.left = x + "px"; d.style.top = y + "px";
      d.textContent = txt;
      sl.appendChild(d);
      return d;
    }
    textLabel("Livingston strain (whitened)", 150, (LOW.T + LOW.B) / 2);
    var hLab = textLabel("Hanford strain (whitened)", 150, (HIGH.T + HIGH.B) / 2);

    var stage = 0, raf = 0, t0 = 0, animModel = -1;

    var titleEl = sl.querySelector(".gw231123-lensing-wtitle");
    function draw(u) {
      var ctx = setup(canvas);
      titleEl.textContent = TITLES[stage];
      hLab.style.visibility = stage >= 8 ? "visible" : "hidden";
      axes(ctx, LOW, FL, YLIM.L1, true);
      line(ctx, D.L1.data, FL, DATA_COLOR, DATA_LW);
      if (stage >= 1) line(ctx, D.L1.unL, FL, BASE.unL, LW);
      MODELS.forEach(function (m, j) {
        var sRows = 2 + 2 * j, sMerge = 3 + 2 * j;
        if (stage === sRows) drawComponents(ctx, m, 0);
        else if (stage === sMerge && j === animModel) drawComponents(ctx, m, u);
        else if (stage >= sMerge) line(ctx, D.L1[m], FL, BASE[m], LW);
      });
      if (stage >= 8) {
        axes(ctx, HIGH, FH, YLIM.H1, true);
        line(ctx, D.H1.data, FH, DATA_COLOR, DATA_LW);
        ["unL"].concat(MODELS).forEach(function (m) { line(ctx, D.H1[m], FH, BASE[m], LW); });
        legend(ctx);
      }
    }

    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; animModel = -1; }
    function tick(now) {
      if (!t0) t0 = now;
      var u = (now - t0) / MERGE_MS;
      if (u >= 1) { animModel = -1; raf = 0; draw(1); return; }
      draw(u);
      raf = requestAnimationFrame(tick);
    }

    Deck.widget(sl.id, {
      steps: 8,
      enter: function () { stop(); draw(1); },
      leave: function () { stop(); },
      step: function (s, k, dir) {
        stop();
        stage = k;
        if (dir > 0 && (k === 3 || k === 5 || k === 7)) {
          animModel = (k - 3) / 2; t0 = 0;
          raf = requestAnimationFrame(tick);
        } else {
          draw(1);
        }
      }
    });
  }

  document.querySelectorAll(".gw231123-lensing-wave").forEach(makeWave);
})();
