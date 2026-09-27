// QNM-amplitude part, slide 1: 3D scatter of A_220 for the aligned-spin prec_amp fits over
// (q, chi_eff, chi_-), rotating on its own and by mouse drag. Slides 2-4 are images.
// Data: QNMAMP_DATA from assets/qnm-amp-data.js (tasks/t06-qnm-amp/make_qnm_amp_plots.py).
(function () {
  "use strict";
  var D = window.QNMAMP_DATA;
  var Q_RANGE = [1, 20], CHI_RANGE = [-1, 1];
  var Q_TICKS = [1, 5, 10, 15, 20], CHI_TICKS = [-1, -0.5, 0, 0.5, 1];
  var CB_TICKS = [0, 0.25, 0.5, 0.75, 1, 1.25];
  var SCALE = 285;                     // slide px per unit of the [-1, 1] cube
  var AUTO_RATE = 2 * Math.PI / 40000; // rad per ms: one turn in 40 s
  var PITCH0 = 0.38, YAW0 = -0.75;
  var RADIUS = 9;
  var EDGE = "#999999";

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

  function norm(v, r) { return 2 * (v - r[0]) / (r[1] - r[0]) - 1; }
  function color(a) {
    var i = Math.max(0, Math.min(255, Math.round(a / D.vmax * 255)));
    return D.lut[i];
  }

  // Cube coordinates: x = q, y = chi_-, z = chi_eff (vertical).
  var pts = D.q.map(function (q, i) {
    return { x: norm(q, Q_RANGE), y: norm(D.chim[i], CHI_RANGE), z: norm(D.chip[i], CHI_RANGE),
             c: color(D.A[i]), a: D.A[i] };
  });

  var yaw = YAW0, pitch = PITCH0, raf = null, last = null, drag = null, slideEl = null;

  // Rotate about the vertical axis by yaw, then tilt by pitch; returns slide px and depth.
  function proj(x, y, z, cx, cy) {
    var cyw = Math.cos(yaw), syw = Math.sin(yaw);
    var x1 = cyw * x - syw * y, y1 = syw * x + cyw * y;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var up = cp * z + sp * y1, depth = cp * y1 - sp * z;  // depth > 0: away from viewer
    return { X: cx + SCALE * x1, Y: cy - SCALE * up, d: depth };
  }

  // Of the 4 edges parallel to one axis, the one on the silhouette nearest the viewer's lower side.
  function pickEdge(cands, cx, cy) {
    var best = null;
    cands.forEach(function (e) {
      var a = proj(e[0][0], e[0][1], e[0][2], cx, cy), b = proj(e[1][0], e[1][1], e[1][2], cx, cy);
      var score = (a.Y + b.Y) - 200 * (a.d + b.d);
      if (!best || score > best.s) best = { s: score, e: e, a: a, b: b };
    });
    return best;
  }

  function draw() {
    var c = setup(document.getElementById("qnm-amp-3d-canvas")), ctx = c.ctx;
    var cx = c.w / 2, cy = c.h / 2 - 10;
    var corners = [];
    [-1, 1].forEach(function (x) { [-1, 1].forEach(function (y) { [-1, 1].forEach(function (z) { corners.push([x, y, z]); }); }); });
    // Cube edges; the three back faces drawn solid, the rest dashed on top of the points.
    var edges = [];
    corners.forEach(function (p) { corners.forEach(function (q) {
      var diff = 0; for (var k = 0; k < 3; k++) if (p[k] !== q[k]) diff++;
      if (diff === 1 && p < q) edges.push([p, q]);
    }); });
    ctx.lineWidth = 2;
    ctx.strokeStyle = EDGE;
    edges.forEach(function (e) {
      var a = proj(e[0][0], e[0][1], e[0][2], cx, cy), b = proj(e[1][0], e[1][1], e[1][2], cx, cy);
      ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(b.X, b.Y); ctx.stroke();
    });
    // Points, far to near.
    var P = pts.map(function (p) { var r = proj(p.x, p.y, p.z, cx, cy); r.c = p.c; return r; });
    P.sort(function (a, b) { return b.d - a.d; });
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    P.forEach(function (p) {
      ctx.beginPath(); ctx.arc(p.X, p.Y, RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = p.c; ctx.fill(); ctx.stroke();
    });
    // Ticks and axis labels on one visible edge per axis.
    var axes = [
      { k: 0, r: Q_RANGE, t: Q_TICKS, f: function (v) { return String(v); }, lab: ".qnm-amp-ax-q" },
      { k: 1, r: CHI_RANGE, t: CHI_TICKS, f: function (v) { return String(v); }, lab: ".qnm-amp-ax-chim" },
      { k: 2, r: CHI_RANGE, t: CHI_TICKS, f: function (v) { return String(v); }, lab: ".qnm-amp-ax-chip" }
    ];
    ctx.fillStyle = "#000";
    ctx.font = "28px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var canvasRect = { left: parseFloat(document.getElementById("qnm-amp-3d-canvas").style.left),
                       top: parseFloat(document.getElementById("qnm-amp-3d-canvas").style.top) };
    axes.forEach(function (ax) {
      var cands = [];
      [-1, 1].forEach(function (u) { [-1, 1].forEach(function (v) {
        var a = [0, 0, 0], b = [0, 0, 0], o = [0, 1, 2].filter(function (m) { return m !== ax.k; });
        a[ax.k] = -1; b[ax.k] = 1; a[o[0]] = b[o[0]] = u; a[o[1]] = b[o[1]] = v;
        cands.push([a, b]);
      }); });
      if (ax.k === 2) {
        // vertical axis: the leftmost silhouette edge
        var best = null;
        cands.forEach(function (e) {
          var a = proj(e[0][0], e[0][1], e[0][2], cx, cy);
          if (!best || a.X < best.x) best = { x: a.X, e: e };
        });
        var e2 = best.e;
      } else {
        var e2 = pickEdge(cands, cx, cy).e;
      }
      var mid = [(e2[0][0] + e2[1][0]) / 2, (e2[0][1] + e2[1][1]) / 2, (e2[0][2] + e2[1][2]) / 2];
      var m = proj(mid[0], mid[1], mid[2], cx, cy);
      var dx = m.X - cx, dy = m.Y - cy, L = Math.sqrt(dx * dx + dy * dy) || 1;
      if (ax.k === 2) { dx = -1; dy = 0; L = 1; }
      ax.t.forEach(function (tv) {
        var p = e2[0].slice(); p[ax.k] = norm(tv, ax.r);
        var s = proj(p[0], p[1], p[2], cx, cy);
        ctx.fillText(ax.f(tv), s.X + 40 * dx / L, s.Y + 40 * dy / L);
      });
      var lab = slideEl.querySelector(ax.lab);
      lab.style.left = (canvasRect.left + m.X + 105 * dx / L) + "px";
      lab.style.top = (canvasRect.top + m.Y + 105 * dy / L) + "px";
    });
  }

  function drawColorbar() {
    var c = setup(document.getElementById("qnm-amp-3d-cbar")), ctx = c.ctx;
    var L = 20, W = 50, T = 10, B = c.h - 10;
    for (var i = 0; i < 256; i++) {
      var y0 = B - (i + 1) / 256 * (B - T), y1 = B - i / 256 * (B - T);
      ctx.fillStyle = D.lut[i];
      ctx.fillRect(L, y0, W, y1 - y0 + 0.5);
    }
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.strokeRect(L, T, W, B - T);
    ctx.fillStyle = "#000"; ctx.font = "30px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    CB_TICKS.forEach(function (v) {
      var y = B - v / D.vmax * (B - T);
      ctx.beginPath(); ctx.moveTo(L + W, y); ctx.lineTo(L + W - 10, y); ctx.stroke();
      ctx.fillText(v.toFixed(2), L + W + 12, y);
    });
  }

  function loop(ts) {
    if (last !== null && !drag) yaw += (ts - last) * AUTO_RATE;
    last = ts;
    draw();
    raf = requestAnimationFrame(loop);
  }

  // Slide px per screen px (the engine scales the 1920x1080 canvas to the window).
  function slideScale() {
    var cv = document.getElementById("qnm-amp-3d-canvas");
    return parseFloat(cv.style.width) / cv.getBoundingClientRect().width;
  }
  function onDown(ev) {
    drag = { x: ev.clientX, y: ev.clientY, yaw: yaw, pitch: pitch, s: slideScale() };
    ev.currentTarget.classList.add("qnm-amp-drag");
    ev.preventDefault();
  }
  function onMove(ev) {
    if (!drag) return;
    yaw = drag.yaw + (ev.clientX - drag.x) * drag.s * 0.006;
    pitch = Math.max(-1.3, Math.min(1.3, drag.pitch + (ev.clientY - drag.y) * drag.s * 0.006));
  }
  function onUp() {
    if (!drag) return;
    drag = null;
    document.getElementById("qnm-amp-3d-canvas").classList.remove("qnm-amp-drag");
  }
  function onResize() { drawColorbar(); }

  Deck.widget("qnm-amp-3d", {
    enter: function (slide) {
      slideEl = slide;
      var cv = document.getElementById("qnm-amp-3d-canvas");
      cv.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("resize", onResize);
      drawColorbar();
      last = null;
      raf = requestAnimationFrame(loop);
    },
    leave: function () {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      drag = null;
      var cv = document.getElementById("qnm-amp-3d-canvas");
      cv.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
    }
  });
})();
