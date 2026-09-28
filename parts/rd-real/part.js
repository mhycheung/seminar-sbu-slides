// Ringdown-in-real-data part: animated Silencio f-gamma posteriors over start time t0.
// Data: RDREAL_DATA from assets/rd-real-data.js (tasks/t07-rd-real-data/S2/make_rd_real_data.py).
// Each mode's 90% region at each t0 is a KDE grid on a local box, normalised so that the region
// is where value / scale >= 1. Between integer t0 the grids are blended linearly.
// f in Hz, gamma = 1/tau in 1/s (detector frame); t0 in units of the remnant mass M_f.
(function () {
  "use strict";
  var D = window.RDREAL_DATA;
  var NG = D.ng, SCALE = D.scale;
  var MODE_COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728"];  // matplotlib C0-C3
  var KERR_COLOR = "#555555";
  var FILL_ALPHA = 0.06;
  var KERR_FILL_ALPHA = 0.15;
  var CELL = 3;                          // slide px per display-grid cell
  var CANVAS = { left: 330, top: 130, width: 1260, height: 810 };
  var MARGIN = { L: 120, R: 30, T: 20, B: 62 };
  var SWEEP_MS = 6000;                   // stage 3: t0 = 2 -> last in 6 s
  var HOLD_END_MS = 1000, HOLD_START_MS = 400;
  var TICK_FONT = "28px Arial";

  function decode(e) {
    if (!e) return null;
    var s = atob(e.q), a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return { box: e.box, a: a };
  }

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
    return ctx;
  }

  function niceTicks(lo, hi, n) {
    var raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    var step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p, out = [];
    for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }

  function makeAnim(sl) {
    var key = sl.getAttribute("data-rd-real"), S = D.slides[key];
    var last = S.t0.length - 1;
    var frames = S.frames.map(function (fr) { return fr.map(decode); });
    var PL = MARGIN.L, PR = CANVAS.width - MARGIN.R, PT = MARGIN.T, PB = CANVAS.height - MARGIN.B;
    var nx = Math.round((PR - PL) / CELL), ny = Math.round((PB - PT) / CELL);
    var fr = S.frange, gr = S.grange;
    function X(f) { return PL + (f - fr[0]) / (fr[1] - fr[0]) * (PR - PL); }
    function Y(g) { return PB - (g - gr[0]) / (gr[1] - gr[0]) * (PB - PT); }
    // display-grid vertex (i, j) -> data; vertices span the plot area inclusive
    function fAt(i) { return fr[0] + i / nx * (fr[1] - fr[0]); }
    function gAt(j) { return gr[1] - j / ny * (gr[1] - gr[0]); }   // j = 0 at the top

    // ---- DOM ----
    var canvas = document.createElement("canvas");
    canvas.className = "rd-real-canvas";
    ["left", "top", "width", "height"].forEach(function (k) { canvas.style[k] = CANVAS[k] + "px"; });
    sl.appendChild(canvas);
    function label(tex, x, y, cls) {
      var d = document.createElement("div");
      d.className = cls;
      d.style.left = x + "px";
      d.style.top = y + "px";
      katex.render(tex, d, { throwOnError: false });
      sl.appendChild(d);
      return d;
    }
    label("f \\sim \\omega_r\\ [\\mathrm{Hz}]", CANVAS.left + (PL + PR) / 2, CANVAS.top + CANVAS.height + 12, "rd-real-label");
    label("\\gamma \\sim -\\omega_i\\ [\\mathrm{s}^{-1}]", CANVAS.left + 22, CANVAS.top + (PT + PB) / 2, "rd-real-label rd-real-ylabel");
    S.kerr.forEach(function (k) {
      var lab = k.label.replace("x", "\\times"), fx, gy;
      if (k.point) { fx = k.point[0]; gy = k.point[1]; }
      else { fx = k.maxl[0]; gy = k.box[3]; }
      if (fx < fr[0] || fx > fr[1] || gy < gr[0] || gy > gr[1]) return;
      var d = label("\\omega_{" + lab + "}", 0, 0, "rd-real-kerr");
      if (k.point) { d.style.left = (CANVAS.left + X(fx) + 12) + "px"; d.style.top = (CANVAS.top + Y(gy) - 44) + "px"; }
      else {
        d.style.left = (CANVAS.left + X(fx)) + "px"; d.style.top = (CANVAS.top + Y(gy) - 40) + "px";
        d.style.transform = "translateX(-50%)";
      }
    });
    var nm = document.createElement("div");   // number of free modes in the fit
    nm.className = "rd-real-nmodes";
    nm.textContent = S.n + " modes";
    nm.style.left = (CANVAS.left + PR - 20) + "px";
    nm.style.top = (CANVAS.top + PT + 16) + "px";
    sl.appendChild(nm);
    var ctl = document.createElement("div");
    ctl.className = "rd-real-controls";
    ctl.innerHTML = '<svg class="rd-real-play" viewBox="0 0 48 48"></svg>' +
      '<div class="rd-real-bar"><div class="rd-real-track"></div><div class="rd-real-fill"></div>' +
      '<div class="rd-real-knob"></div></div><div class="rd-real-t0"></div>';
    sl.appendChild(ctl);
    var playEl = ctl.querySelector(".rd-real-play"), bar = ctl.querySelector(".rd-real-bar");
    var fillEl = ctl.querySelector(".rd-real-fill"), knob = ctl.querySelector(".rd-real-knob");
    var t0El = ctl.querySelector(".rd-real-t0");

    // ---- fields ----
    // Add w * (value / SCALE) of grid e to buf over the display vertices inside e's box.
    function accumulate(buf, e, w) {
      if (!e || w === 0) return;
      var b = e.box, a = e.a;
      var i0 = Math.max(0, Math.ceil((b[0] - fr[0]) / (fr[1] - fr[0]) * nx));
      var i1 = Math.min(nx, Math.floor((b[1] - fr[0]) / (fr[1] - fr[0]) * nx));
      var j0 = Math.max(0, Math.ceil((gr[1] - b[3]) / (gr[1] - gr[0]) * ny));
      var j1 = Math.min(ny, Math.floor((gr[1] - b[2]) / (gr[1] - gr[0]) * ny));
      var sx = (NG - 1) / (b[1] - b[0]), sy = (NG - 1) / (b[3] - b[2]), k = w / SCALE;
      for (var j = j0; j <= j1; j++) {
        var v = (gAt(j) - b[2]) * sy, r = Math.min(NG - 2, Math.floor(v)), dv = v - r;
        for (var i = i0; i <= i1; i++) {
          var u = (fAt(i) - b[0]) * sx, c = Math.min(NG - 2, Math.floor(u)), du = u - c;
          var p = r * NG + c;
          var val = (a[p] * (1 - du) + a[p + 1] * du) * (1 - dv) + (a[p + NG] * (1 - du) + a[p + NG + 1] * du) * dv;
          buf[j * (nx + 1) + i] += k * val;
        }
      }
    }

    // Marching squares for the level 1 of buf; segments added to the current path.
    function outline(ctx, buf) {
      var W = nx + 1;
      function px(i) { return PL + i * CELL * (PR - PL) / (nx * CELL); }
      function py(j) { return PT + j * (PB - PT) / ny; }
      ctx.beginPath();
      for (var j = 0; j < ny; j++) {
        for (var i = 0; i < nx; i++) {
          var a = buf[j * W + i], b = buf[j * W + i + 1], c = buf[(j + 1) * W + i + 1], d = buf[(j + 1) * W + i];
          var idx = (a >= 1 ? 8 : 0) | (b >= 1 ? 4 : 0) | (c >= 1 ? 2 : 0) | (d >= 1 ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          // edge points: top (a-b), right (b-c), bottom (d-c), left (a-d)
          var T = [px(i + (1 - a) / (b - a)), py(j)], R = [px(i + 1), py(j + (1 - b) / (c - b))];
          var B = [px(i + (1 - d) / (c - d)), py(j + 1)], L = [px(i), py(j + (1 - a) / (d - a))];
          var segs;
          switch (idx) {
            case 1: case 14: segs = [[L, B]]; break;
            case 2: case 13: segs = [[B, R]]; break;
            case 3: case 12: segs = [[L, R]]; break;
            case 4: case 11: segs = [[T, R]]; break;
            case 5: segs = [[L, T], [B, R]]; break;
            case 6: case 9: segs = [[T, B]]; break;
            case 7: case 8: segs = [[L, T]]; break;
            case 10: segs = [[T, R], [L, B]]; break;
          }
          for (var s = 0; s < segs.length; s++) {
            ctx.moveTo(segs[s][0][0], segs[s][0][1]);
            ctx.lineTo(segs[s][1][0], segs[s][1][1]);
          }
        }
      }
      ctx.stroke();
    }

    var off = document.createElement("canvas");
    off.width = nx + 1; off.height = ny + 1;
    var octx = off.getContext("2d"), img = octx.createImageData(nx + 1, ny + 1);
    function fill(ctx, buf, color, alpha) {
      var r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), bl = parseInt(color.slice(5, 7), 16);
      var px = img.data, A = Math.round(255 * alpha);
      for (var p = 0; p < buf.length; p++) {
        var q = 4 * p, inside = buf[p] >= 1;
        px[q] = r; px[q + 1] = g; px[q + 2] = bl; px[q + 3] = inside ? A : 0;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, PL - CELL / 2, PT - CELL / 2, PR - PL + CELL, PB - PT + CELL);
    }

    var kerrBufs = S.kerr.filter(function (k) { return k.box; }).map(function (k) {
      var buf = new Float32Array((nx + 1) * (ny + 1));
      accumulate(buf, decode(k), 1);
      return buf;
    });

    function axes(ctx) {
      ctx.strokeStyle = "#000"; ctx.fillStyle = "#000"; ctx.lineWidth = 2; ctx.font = TICK_FONT;
      ctx.strokeRect(PL, PT, PR - PL, PB - PT);
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      niceTicks(fr[0], fr[1], 6).forEach(function (v) {
        ctx.beginPath(); ctx.moveTo(X(v), PB); ctx.lineTo(X(v), PB - 12); ctx.stroke();
        ctx.fillText(String(v), X(v), PB + 8);
      });
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      niceTicks(gr[0], gr[1], 6).forEach(function (v) {
        ctx.beginPath(); ctx.moveTo(PL, Y(v)); ctx.lineTo(PL + 12, Y(v)); ctx.stroke();
        ctx.fillText(String(v), PL - 10, Y(v));
      });
    }

    var buf = new Float32Array((nx + 1) * (ny + 1));
    function draw(t) {
      var ctx = setup(canvas);
      var i = Math.min(last, Math.floor(t)), u = t - i;
      if (i === last) u = 0;
      ctx.save();
      ctx.beginPath(); ctx.rect(PL, PT, PR - PL, PB - PT); ctx.clip();
      kerrBufs.forEach(function (kb) {
        fill(ctx, kb, KERR_COLOR, KERR_FILL_ALPHA);
        ctx.lineWidth = 2.5; ctx.strokeStyle = KERR_COLOR;
        outline(ctx, kb);
      });
      S.kerr.forEach(function (k) {             // crosses under the posteriors: a small region stays visible
        if (!k.point) return;
        var x = X(k.point[0]), y = Y(k.point[1]);
        ctx.strokeStyle = "#000"; ctx.lineWidth = 2.5; ctx.beginPath();
        ctx.moveTo(x - 10, y - 10); ctx.lineTo(x + 10, y + 10);
        ctx.moveTo(x - 10, y + 10); ctx.lineTo(x + 10, y - 10); ctx.stroke();
      });
      for (var m = 0; m < S.n; m++) {
        buf.fill(0);
        accumulate(buf, frames[i][m], 1 - u);
        if (u > 0) accumulate(buf, frames[i + 1][m], u);
        fill(ctx, buf, MODE_COLORS[m], FILL_ALPHA);
        ctx.lineWidth = 3; ctx.strokeStyle = MODE_COLORS[m];
        outline(ctx, buf);
      }
      ctx.restore();
      axes(ctx);
      var frac = t / last;
      fillEl.style.width = (100 * frac) + "%";
      knob.style.left = (100 * frac) + "%";
      var txt = "t_0 = " + t.toFixed(1) + "\\,M_f";
      if (t0El.getAttribute("data-t") !== txt) { t0El.setAttribute("data-t", txt); katex.render(txt, t0El); }
    }

    // ---- playback ----
    var st = { t: 0, playing: false, raf: null, hold: 0, prev: null };
    function icon() {
      playEl.innerHTML = st.playing
        ? '<rect x="10" y="8" width="10" height="32" fill="#222"/><rect x="28" y="8" width="10" height="32" fill="#222"/>'
        : '<path d="M12 6 L40 24 L12 42 Z" fill="#222"/>';
    }
    var rate = (last - 2) / SWEEP_MS;
    function tick(now) {
      var dt = st.prev === null ? 0 : Math.min(100, now - st.prev);
      st.prev = now;
      if (st.hold > 0) {
        st.hold -= dt;
        if (st.hold <= 0 && st.t >= last) { st.t = 0; st.hold = HOLD_START_MS; }
      } else {
        st.t = Math.min(last, st.t + rate * dt);
        if (st.t >= last) st.hold = HOLD_END_MS;
      }
      draw(st.t);
      st.raf = requestAnimationFrame(tick);
    }
    function play() {
      if (st.raf) cancelAnimationFrame(st.raf);
      st.playing = true; st.prev = null;
      if (st.t >= last) { st.t = 0; st.hold = HOLD_START_MS; }
      icon();
      st.raf = requestAnimationFrame(tick);
    }
    function pause() {
      if (st.raf) cancelAnimationFrame(st.raf);
      st.raf = null; st.playing = false; st.hold = 0;
      icon();
    }
    playEl.addEventListener("click", function () { if (st.playing) pause(); else play(); });
    var dragging = false;
    function seek(ev) {
      var r = bar.getBoundingClientRect();
      st.t = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * last;
      draw(st.t);
    }
    bar.addEventListener("pointerdown", function (ev) { dragging = true; pause(); seek(ev); ev.preventDefault(); });
    window.addEventListener("pointermove", function (ev) { if (dragging) seek(ev); });
    window.addEventListener("pointerup", function () { dragging = false; });

    var onResize = function () { draw(st.t); };
    Deck.widget(sl.id, {
      steps: 3,
      enter: function () { window.addEventListener("resize", onResize); },
      leave: function () { pause(); window.removeEventListener("resize", onResize); },
      step: function (slide, stage) {
        pause();
        st.t = Math.min(stage, 2);
        draw(st.t);
        if (stage === 3) play();
      }
    });
    icon();
  }

  document.querySelectorAll(".rd-real-anim").forEach(makeAnim);
})();
