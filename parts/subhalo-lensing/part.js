// Gravitational-wave lensing by a subhalo, one slide (subhalo-lensing-main, 1 step). The 3D
// scene of the gw-lensing part (perspective camera, optical axis left to right):
//   0  a large dark diffuse halo with a compact satellite subhalo off its centre; a light
//      source on the left, Earth on the right, two smooth ray-optics paths; the upper path
//      passes through the subhalo
//   1  the source becomes a merging BBH (NR data of the ringdown part); gravitational waves
//      travel along the two paths; the lower one arrives later (schematic lag); on the upper
//      path the wave changes from unlensed to diffracted at the subhalo
//
// The diffracted wave is not computed for this scene: it is the gw-lensing part's
// h_L = IFFT[F(w) h(f)], F from GLoW for a cored isothermal sphere (psi0 = 1, rc = 0.15,
// y = 0.1; tasks/t08-gw-lensing/S1/), copied by tasks/t10-subhalo-lensing/S1/make_data.py.
(function () {
  "use strict";

  var D = SUBHALO_LENSING_DATA, NR = D.nr, WV = D.wave;

  // ---------------- constants ----------------
  var PX = 700;             // px per world unit at the lens
  var CAMD = 6;             // camera distance from the lens, world units
  var YAW = 0.38;           // rad; camera azimuth (0 = exactly side-on)
  var PITCH = 0.17;         // rad; camera elevation
  var SRC = [-1, 0, 0], EARTH = [1, 0, 0], LENS = [0, 0, 0];
  var SUB = [0, 0.30, 0];   // subhalo centre: the upper path's crossing of the lens plane
  var IMG_DN = [0, -0.27, 0];
  var GAP_SRC = 0.09, GAP_EARTH = 0.13;    // world units kept free at the ends of the paths
  var HALO_R = 0.55;        // main halo size, world units
  var SUB_R = 0.075;        // subhalo size, world units
  var TRAVEL = 4.0;         // s, travel time source -> Earth
  var DELAY = 1.4;          // s, extra travel time of the lower path (schematic)
  var AMP = 0.035;          // world units of transverse displacement at the unlensed peak
  var GAIN_L = 1.6;         // displayed peak of the diffracted wave / unlensed peak (schematic,
                            // as in the gw-lensing part)
  var LOOP_T0 = 650, LOOP_T1 = 850, NR_SPEED = 90;  // BBH loop (M) and speed (M/s)
  var SC_BBH = 11;          // px per M for the BBH at the source
  var EARTH_R = 60;         // px, Earth radius at the lens distance

  // ---------------- small helpers ----------------
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function smooth(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)); return [a[0] / l, a[1] / l, a[2] / l]; }
  function interp(xs, ys, x) {
    var n = xs.length;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
    var f = (x - xs[lo]) / (xs[hi] - xs[lo]);
    return ys[lo] * (1 - f) + ys[hi] * f;
  }

  function fit(c) {
    var r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var w = Math.max(50, Math.round(r.width * dpr)), h = Math.max(50, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return w / c.offsetWidth;
  }

  // Eased parameter: from -> to over [t0, t0 + dur] (ms), in-out quadratic.
  function P(v) { return { from: v, to: v, t0: 0, dur: 1 }; }
  function val(p, now) {
    var f = clamp((now - p.t0) / p.dur, 0, 1);
    f = f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f);
    return p.from + (p.to - p.from) * f;
  }
  function set(p, target, now, instant, dur) {
    if (instant) { p.from = p.to = target; p.t0 = 0; return; }
    if (p.to === target) return;
    p.from = val(p, now); p.to = target; p.t0 = now; p.dur = dur || 800;
  }

  function Runner(frame) {
    var raf = null;
    function tick(now) { frame(now); raf = requestAnimationFrame(tick); }
    return {
      start: function () { if (!raf) raf = requestAnimationFrame(tick); },
      stop: function () { if (raf) cancelAnimationFrame(raf); raf = null; }
    };
  }

  // ---------------- camera ----------------
  var CAM = (function () {
    var C = [CAMD * Math.sin(YAW) * Math.cos(PITCH), CAMD * Math.sin(PITCH), CAMD * Math.cos(YAW) * Math.cos(PITCH)];
    var f = norm([-C[0], -C[1], -C[2]]), r = norm(cross(f, [0, 1, 0])), up = cross(r, f);
    return { C: C, f: f, r: r, up: up, k: PX * CAMD, ox: 960, oy: 540 };
  })();
  function proj(p) {
    var d = sub(p, CAM.C), z = dot(d, CAM.f);
    return [CAM.ox + CAM.k * dot(d, CAM.r) / z, CAM.oy - CAM.k * dot(d, CAM.up) / z, CAM.k / z / PX];
  }

  // ---------------- source: BBH from the NR data (as the ringdown part) ----------------
  function nrSample(t) {
    var u = clamp((t - NR.t0) / NR.dt, 0, NR.x0.length - 1.001), i = Math.floor(u), f = u - i, s = {};
    ["x0", "y0", "x1", "y1", "R1", "R2", "acx", "acy", "A", "ph"].forEach(function (k) { s[k] = NR[k][i] * (1 - f) + NR[k][i + 1] * f; });
    return s;
  }
  function field(t, X, Y, s) {
    var w = smooth((t - NR.tFuse) / (NR.tCommon + 10 - NR.tFuse)), Fb = 0;
    var bh = [[s.x0, s.y0, s.R1], [s.x1, s.y1, s.R2]];
    for (var k = 0; k < 2; k++) {
      var dx = X - bh[k][0], dy = Y - bh[k][1];
      Fb += Math.min(bh[k][2] * bh[k][2] / (dx * dx + dy * dy + 1e-12), 3);
    }
    if (w <= 0) return Fb;
    var cx = (1 - w) * (NR.m1 * s.x0 + NR.m2 * s.x1) / (NR.m1 + NR.m2) + w * s.acx;
    var cy = (1 - w) * (NR.m1 * s.y0 + NR.m2 * s.y1) / (NR.m1 + NR.m2) + w * s.acy;
    var ex = X - cx, ey = Y - cy;
    var rr = NR.Rfinal * (1 + NR.eps * s.A * Math.cos(2 * Math.atan2(ey, ex) + s.ph));
    return (1 - w) * Fb + w * Math.min(rr * rr / (ex * ex + ey * ey + 1e-12), 3);
  }
  function softA(q) { if (q <= 0.4) return 1; var u = (q - 0.4) / 1.5; return u > 3.3 ? 0 : Math.exp(-Math.pow(u, 1.5)); }
  var bbhLayer = document.createElement("canvas"), bbhLast = null;
  function drawBBH(c, t) {
    var k = fit(c), W = c.width, DS = 3, w = Math.ceil(W / DS), half = c.offsetWidth / 2;
    if (bbhLast === t + ":" + W) return;
    bbhLast = t + ":" + W;
    var s = nrSample(t);
    if (bbhLayer.width !== w) { bbhLayer.width = w; bbhLayer.height = w; }
    var octx = bbhLayer.getContext("2d"), img = octx.createImageData(w, w), p = img.data;
    for (var j = 0; j < w; j++) for (var i = 0; i < w; i++) {
      var x = (i + 0.5) * DS / k - half, y = half - (j + 0.5) * DS / k, rho = Math.sqrt(x * x + y * y);
      var tp = rho < 0.7 * half ? 1 : rho > half ? 0 : 0.5 * (1 + Math.cos(Math.PI * (rho - 0.7 * half) / (0.3 * half)));
      if (tp <= 0) continue;
      var F = field(t, x / SC_BBH, y / SC_BBH, s);
      if (F >= 0.03) p[4 * (j * w + i) + 3] = Math.round(255 * tp * softA(1 / Math.sqrt(F)));
    }
    octx.putImageData(img, 0, 0);
    var ctx = c.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bbhLayer, 0, 0, DS * w, DS * w);
  }

  // Source clock: seconds since emission started -> NR time (loops with a hold). A loop
  // restarts only after the previous pulse has reached the Earth on the lower path.
  var EMIT = (LOOP_T1 - LOOP_T0) / NR_SPEED, PERIOD = EMIT + TRAVEL + DELAY + 0.3;
  function nrTime(sec) { var e = sec % PERIOD; return Math.min(LOOP_T1, LOOP_T0 + NR_SPEED * e); }
  var HL_MAX = Math.max.apply(null, WV.hL.map(Math.abs));
  // Strain and envelope emitted `sec` seconds after the clock start; diffracted if L.
  function emit(sec, L) {
    if (sec < 0) return [0, 0];
    var t = nrTime(sec), g = smooth((t - LOOP_T0) / 30), sc = L ? GAIN_L / HL_MAX : 1;
    return [g * sc * interp(WV.t, L ? WV.hL : WV.h, t), g * sc * interp(WV.t, L ? WV.envL : WV.env, t)];
  }

  // ---------------- paths ----------------
  // A path is a dense polyline with cumulative arc length: a quadratic Bezier curve from S
  // to E through the point I at its middle.
  function Path(pts) {
    var cum = [0];
    for (var i = 1; i < pts.length; i++) { var d = sub(pts[i], pts[i - 1]); cum.push(cum[i - 1] + Math.sqrt(dot(d, d))); }
    return { pts: pts, cum: cum, L: cum[cum.length - 1] };
  }
  function bezier(S, I, E) {
    var C = [2 * I[0] - (S[0] + E[0]) / 2, 2 * I[1] - (S[1] + E[1]) / 2, 2 * I[2] - (S[2] + E[2]) / 2], pts = [];
    for (var n = 0; n <= 400; n++) {
      var u = n / 400, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
      pts.push([a * S[0] + b * C[0] + c * E[0], a * S[1] + b * C[1] + c * E[1], a * S[2] + b * C[2] + c * E[2]]);
    }
    return Path(pts);
  }
  function at(path, s) {
    var cum = path.cum, lo = 0, hi = cum.length - 1;
    s = clamp(s, 0, path.L);
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    var a = path.pts[lo], b = path.pts[hi], d = sub(b, a), l = cum[hi] - cum[lo], f = (s - cum[lo]) / l;
    return { p: [a[0] + d[0] * f, a[1] + d[1] * f, a[2] + d[2] * f], t: [d[0] / l, d[1] / l, d[2] / l] };
  }
  var PATH_UP = bezier(SRC, SUB, EARTH), PATH_DN = bezier(SRC, IMG_DN, EARTH);
  var SUB_S = PATH_UP.L / 2;   // the symmetric Bezier passes SUB at half its length

  function strokePath(ctx, path) {
    ctx.beginPath();
    for (var s = GAP_SRC, first = true; s <= path.L - GAP_EARTH + 1e-9; s += 0.01, first = false) {
      var q = proj(at(path, s).p);
      if (first) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
  }
  // Wave along a path: displaced in the x-y plane, normal to the path, by AMP h at the
  // emission time sec - s / v; opacity follows the envelope. lensS: arc length where the
  // wave switches from unlensed to diffracted (null: never).
  function drawWave(ctx, path, sec, travel, lensS, op) {
    var v = path.L / travel, prev = null;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    for (var s = GAP_SRC; s <= path.L - GAP_EARTH + 1e-9; s += 0.0035) {
      var a = at(path, s), nl = Math.sqrt(a.t[0] * a.t[0] + a.t[1] * a.t[1]), n = [-a.t[1] / nl, a.t[0] / nl, 0];
      var te = sec - s / v, hv, ev;
      if (lensS === null) { var e0 = emit(te, false); hv = e0[0]; ev = e0[1]; }
      else {
        var wL = smooth((s - lensS + 0.05) / 0.1), e1 = emit(te, false), e2 = emit(te, true);
        hv = (1 - wL) * e1[0] + wL * e2[0]; ev = (1 - wL) * e1[1] + wL * e2[1];
      }
      var q = proj([a.p[0] + n[0] * AMP * hv, a.p[1] + n[1] * AMP * hv, a.p[2]]);
      if (prev) {
        var al = op * clamp(ev / 0.12, 0, 1);
        if (al > 0.01) {
          ctx.strokeStyle = "rgba(20,20,20," + al + ")";
          ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        }
      }
      prev = q;
    }
  }

  // ---------------- scene objects ----------------
  // Main halo: large diffuse ellipse, as in the gw-lensing part.
  function drawHalo(ctx) {
    var q = proj(LENS), R = HALO_R * PX * q[2];
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.rotate(-0.25);
    ctx.scale(1, 0.8);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.6 * R);
    for (var i = 0; i <= 12; i++) {
      var r = i / 12 * 1.6, a = 0.75 * Math.exp(-r * r / 0.7);
      g.addColorStop(i / 12, "rgba(55,38,95," + a.toFixed(4) + ")");
    }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 1.6 * R, 0, 2 * Math.PI); ctx.fill();
    ctx.restore();
  }
  // Subhalo: compact, denser and darker than the main halo around it, with a lighter rim
  // so that it stands out against the halo.
  function drawSubhalo(ctx) {
    var q = proj(SUB), R = SUB_R * PX * q[2];
    ctx.save();
    ctx.translate(q[0], q[1]);
    var rim = ctx.createRadialGradient(0, 0, 0.9 * R, 0, 0, 1.9 * R);
    rim.addColorStop(0, "rgba(190,170,240,0.55)");
    rim.addColorStop(1, "rgba(190,170,240,0)");
    ctx.fillStyle = rim;
    ctx.beginPath(); ctx.arc(0, 0, 1.9 * R, 0, 2 * Math.PI); ctx.fill();
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.3 * R);
    for (var i = 0; i <= 10; i++) {
      var r = i / 10 * 1.3, a = Math.exp(-r * r / 0.45);
      g.addColorStop(i / 10, "rgba(25,12,55," + a.toFixed(4) + ")");
    }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 1.3 * R, 0, 2 * Math.PI); ctx.fill();
    ctx.restore();
  }
  function drawLight(ctx, op) {
    if (op <= 0) return;
    var q = proj(SRC), r = 80 * q[2];
    var g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
    g.addColorStop(0, "rgba(255,150,20," + op + ")");
    g.addColorStop(0.12, "rgba(255,165,40," + op + ")");
    g.addColorStop(0.35, "rgba(255,190,80," + 0.45 * op + ")");
    g.addColorStop(1, "rgba(255,210,120,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 2 * Math.PI); ctx.fill();
  }
  var earthImg = new Image();
  earthImg.src = "parts/subhalo-lensing/assets/earth_apollo17_400.png";
  function drawEarth(ctx) {
    if (!earthImg.complete || !earthImg.naturalWidth) return;
    var q = proj(EARTH), r = EARTH_R * q[2];
    ctx.drawImage(earthImg, q[0] - r, q[1] - r, 2 * r, 2 * r);
  }

  // =================== the slide ===================
  var scene, bbh, run, clock = null;
  var p = { light: P(1), bbh: P(0), rays: P(1), waves: P(0) };

  function frame(now) {
    var k = fit(scene), ctx = scene.getContext("2d");
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, 1920, 1080);
    var v = {};
    for (var key in p) v[key] = val(p[key], now);
    var sec = clock === null ? -1 : (now - clock) / 1000;

    drawHalo(ctx);
    drawSubhalo(ctx);
    if (v.rays > 0) {
      ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.strokeStyle = "rgba(235,140,20," + v.rays + ")";
      strokePath(ctx, PATH_UP);
      strokePath(ctx, PATH_DN);
    }
    if (v.waves > 0 && sec >= 0) {
      drawWave(ctx, PATH_UP, sec, TRAVEL, SUB_S, v.waves);
      drawWave(ctx, PATH_DN, sec, TRAVEL + DELAY, null, v.waves);
    }
    drawLight(ctx, v.light);
    drawEarth(ctx);

    bbh.style.opacity = v.bbh;
    if (v.bbh > 0.001) drawBBH(bbh, clock === null ? LOOP_T0 : nrTime(sec));
  }

  Deck.widget("subhalo-lensing-main", {
    steps: 1,
    enter: function (slide) {
      scene = slide.querySelector("#subhalo-lensing-scene");
      bbh = slide.querySelector("#subhalo-lensing-bbh");
      var q = proj(SRC);
      bbh.style.left = (q[0] - 130) + "px"; bbh.style.top = (q[1] - 130) + "px";
      run = Runner(frame);
      run.start();
    },
    leave: function () { run.stop(); },
    step: function (slide, k, dir) {
      var now = performance.now(), inst = dir < 0;
      clock = k === 0 ? null : inst ? now - 20000 : now;
      set(p.light, k === 0 ? 1 : 0, now, inst, 900);
      set(p.bbh, k >= 1 ? 1 : 0, now, inst, 900);
      set(p.rays, k === 0 ? 1 : 0.22, now, inst, 900);
      set(p.waves, k >= 1 ? 1 : 0, now, inst, 800);
    }
  });
})();

