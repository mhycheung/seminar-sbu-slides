// Gravitational-wave lensing, one slide (gw-lensing-main, 14 steps). A 3D scene seen
// nearly from the side (perspective camera, optical axis left to right), then the lens
// plane face-on and the contour method for the time-domain amplification factor.
//   0  large dark diffuse halo, a light source on the left, Earth on the right, two smooth rays
//   1  the source becomes a merging BBH (NR data of the ringdown part); gravitational
//      waves travel along the same two paths; the lower one arrives later (schematic lag)
//   2  waves and paths fade, the BBH stops; then the halo shrinks
//   3  one path; the BBH runs again; the wave changes from unlensed to diffracted at the
//      halo (h_L = IFFT[F(w) h(f)], F from GLoW for a cored isothermal sphere)
//   4  lens plane with many rays source -> plane -> Earth (thin lens: straight segments);
//      the BBH shows its first frame, still (stages 4-5)
//   5  rays coloured by the time delay T(x) of their plane point; colour bar "T"
//   6  source, Earth, rays fade out; then the camera turns to face the plane, which moves left;
//      contours of T in the same colours; the three images marked min, saddle, max (white
//      rings; a red disc while the band stands at the image)
//   7  empty plot frame on the right: T, (1/2pi) dA/dT
//   8-10 one band between successive contours per step, filled red; its area on the plot
//   11 the band moves out to the saddle image; 12 to the maximum image; 13 to the end
//   14 |F(w)| panel below the time-domain plot
//
// Lens: cored isothermal sphere, psi(x) = psi0 (r + rc ln(2 rc/(r + rc))), r = sqrt(x^2 + rc^2),
// T(x) = |x - y|^2/2 - psi(x) (GLoW 0.1), y along x1. Numbers and checks: tasks/t08-gw-lensing/S1/.
// World axes: x along the line of sight, y up; lens-plane x1 -> world -z, x2 -> world y, so
// that the face-on plane shows x1 to the right (the images on the horizontal axis).
(function () {
  "use strict";

  var D = GW_LENSING_DATA, NR = D.nr, WV = D.wave;

  // ---------------- constants ----------------
  var PX = 700;             // px per world unit at the lens in the side view
  var CAMD = 6;             // camera distance from the lens, world units
  var YAW0 = 0.38;          // rad; camera azimuth in the side view (0 = exactly side-on)
  var PITCH0 = 0.17;        // rad; camera elevation in the side view
  var PLANE_H = 0.45;       // half size of the lens plane, world units
  var XS = PLANE_H / D.viewHalf;           // world units per lens-plane unit
  var SRC = [-1, 0, -2 * D.y * XS];        // straight line to Earth crosses the plane at x1 = y
  var EARTH = [1, 0, 0];
  var LENS = [0, 0, 0];
  var IMG_UP = [0, 0.37, 0], IMG_DN = [0, -0.31, 0];  // ray-optics images of the large halo
  var GAP_SRC = 0.09, GAP_EARTH = 0.13;    // world units kept free at the ends of the smooth paths
  var HALO_R = 0.36;        // halo size (world units) in stages 0-1
  var HALO_SMALL = 0.14;    // relative halo size from stage 2
  var PLANE_CX = 500, PLANE_CY = 490, PLANE_HALF_PX = 390;  // face-on lens plane on the slide
  var ZOOM2D = PLANE_HALF_PX / (PX * PLANE_H);
  var TRAVEL = 4.0;         // s, travel time source -> Earth
  var DELAY = 1.4;          // s, extra travel time of the lower path (schematic)
  var AMP = 0.035;          // world units of transverse displacement at the unlensed peak
  var GAIN_L = 1.6;         // displayed peak of the diffracted wave / unlensed peak (schematic;
                            // the computed ratio, max |h_L| / max |h|, is 6.1)
  var LOOP_T0 = 650, LOOP_T1 = 850, NR_SPEED = 90;  // BBH loop (M) and speed (M/s)
  var SC_BBH = 11;          // px per M for the BBH at the source
  var EARTH_R = 60;         // px, Earth radius at the lens distance
  var BAND_RED = [205, 55, 40];
  var TAU_S = D.images[1].t, TAU_M = D.images[2].t, TAU_END = D.tauMax, DT = D.dtau;
  var TEX = D.grid;         // lens-plane texture = grid of the band check (S1)
  var I_BOX0 = [1090, 150, 1800, 840], I_BOX1 = [1090, 60, 1800, 400], F_BOX = [1090, 530, 1800, 870];
  var I_Y = [0, 9], F_Y = [0, 7];
  var CB = { w: 600, h: 26, y: 930 };      // colour bar; its label sits below the tick numbers
  var VIRIDIS = [[68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142], [38, 130, 142],
                 [31, 158, 137], [53, 183, 121], [109, 205, 89], [180, 222, 44]];

  // ---------------- small helpers ----------------
  function lerp(a, b, u) { return a + (b - a) * u; }
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
  function viridis(u) {
    u = clamp(u, 0, 1) * (VIRIDIS.length - 1);
    var i = Math.min(Math.floor(u), VIRIDIS.length - 2), f = u - i, a = VIRIDIS[i], b = VIRIDIS[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  function rgba(c, a) { return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + a + ")"; }

  function fit(c) {
    var r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var w = Math.max(50, Math.round(r.width * dpr)), h = Math.max(50, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return w / c.offsetWidth;
  }

  // Eased parameter: from -> to over [t0, t0 + dur] (ms); linear if lin.
  // Easing: false (in-out quadratic), true (linear), or "out" (quadratic ease-out).
  function P(v) { return { from: v, to: v, t0: 0, dur: 1, lin: false }; }
  function val(p, now) {
    var f = clamp((now - p.t0) / p.dur, 0, 1);
    if (p.lin === "out") f = 1 - (1 - f) * (1 - f);
    else if (!p.lin) f = f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f);
    return p.from + (p.to - p.from) * f;
  }
  // Move p to target over dur ms, starting after delay ms (instant: at once).
  function set(p, target, now, instant, dur, lin, delay) {
    if (instant) { p.from = p.to = target; p.t0 = 0; return; }
    if (p.to === target) return;
    p.from = val(p, now); p.to = target; p.t0 = now + (delay || 0); p.dur = dur || 800; p.lin = lin || false;
  }

  function Runner(frame) {
    var raf = null;
    function tick(now) { frame(now); raf = requestAnimationFrame(tick); }
    return {
      start: function () { if (!raf) raf = requestAnimationFrame(tick); },
      stop: function () { if (raf) cancelAnimationFrame(raf); raf = null; }
    };
  }

  // Label: plain text in Arial, or KaTeX if the text starts with "$".
  function makeLabel(parent, tex, rot) {
    var el = document.createElement("div");
    el.className = "gw-lensing-label" + (rot ? " gw-lensing-label-rot" : "");
    if (tex.charAt(0) !== "$") el.textContent = tex;
    else if (window.katex) katex.render(tex.slice(1), el, { throwOnError: false });
    else el.textContent = tex.slice(1);
    parent.appendChild(el);
    return el;
  }
  function place(el, x, y, op) { el.style.left = x + "px"; el.style.top = y + "px"; el.style.opacity = op; }

  // ---------------- lens model ----------------
  function psi(x) {
    var r = Math.sqrt(x * x + D.rc * D.rc);
    return D.psi0 * (r + D.rc * Math.log(2 * D.rc / (r + D.rc)));
  }
  function T(x1, x2) { return 0.5 * ((x1 - D.y) * (x1 - D.y) + x2 * x2) - psi(Math.sqrt(x1 * x1 + x2 * x2)) - D.tauMin; }

  // Texture grid: column i <-> x1 from -h to +h, row j <-> x2 from +h to -h.
  // TG: T - tau_min at pixel centres; GR: |grad T| in units per texture pixel (for
  // anti-aliased band edges).
  var TG = new Float32Array(TEX * TEX), GR = new Float32Array(TEX * TEX);
  function texX1(i) { return -D.viewHalf + (i + 0.5) * 2 * D.viewHalf / TEX; }
  function texX2(j) { return D.viewHalf - (j + 0.5) * 2 * D.viewHalf / TEX; }
  (function () {
    for (var j = 0; j < TEX; j++) for (var i = 0; i < TEX; i++) TG[j * TEX + i] = T(texX1(i), texX2(j));
    for (j = 0; j < TEX; j++) for (i = 0; i < TEX; i++) {
      var i0 = Math.max(0, i - 1), i1 = Math.min(TEX - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(TEX - 1, j + 1);
      var gx = (TG[j * TEX + i1] - TG[j * TEX + i0]) / (i1 - i0), gy = (TG[j1 * TEX + i] - TG[j0 * TEX + i]) / (j1 - j0);
      GR[j * TEX + i] = Math.max(Math.sqrt(gx * gx + gy * gy), 1e-7);
    }
  })();

  // Contour layer: T at the band edges k DT, marching squares on the texture grid, each
  // level in its colour-map colour. Drawn once.
  var contourLayer = null;
  function contours() {
    if (contourLayer) return contourLayer;
    contourLayer = document.createElement("canvas"); contourLayer.width = TEX; contourLayer.height = TEX;
    var ctx = contourLayer.getContext("2d");
    ctx.lineWidth = 2.6;
    ctx.lineJoin = "round";
    for (var k = 1; k * DT <= TAU_END + 1e-9; k++) {
      var L = k * DT;
      ctx.strokeStyle = rgba(viridis(L / TAU_END), 1);
      ctx.beginPath();
      for (var j = 0; j < TEX - 1; j++) for (var i = 0; i < TEX - 1; i++) {
        var a = TG[j * TEX + i] - L, b = TG[j * TEX + i + 1] - L, c = TG[(j + 1) * TEX + i + 1] - L, d = TG[(j + 1) * TEX + i] - L;
        if ((a < 0) === (b < 0) && (b < 0) === (c < 0) && (c < 0) === (d < 0)) continue;
        var p = [];
        if ((a < 0) !== (b < 0)) p.push([i + a / (a - b), j]);
        if ((b < 0) !== (c < 0)) p.push([i + 1, j + b / (b - c)]);
        if ((d < 0) !== (c < 0)) p.push([i + d / (d - c), j + 1]);
        if ((a < 0) !== (d < 0)) p.push([i, j + a / (a - d)]);
        for (var q = 0; q + 1 < p.length; q += 2) {
          ctx.moveTo(p[q][0] + 0.5, p[q][1] + 0.5); ctx.lineTo(p[q + 1][0] + 0.5, p[q + 1][1] + 0.5);
        }
      }
      ctx.stroke();
    }
    return contourLayer;
  }

  // Lens-plane texture: translucent plane, swept region (light red), current band (red),
  // contour lines, image markers. Band edges are anti-aliased: the covered fraction of a
  // pixel is clamp(1/2 - (T - edge) / |grad T|). Cached by its inputs.
  var bandLayer = document.createElement("canvas"); bandLayer.width = TEX; bandLayer.height = TEX;
  var bandImg = null;
  var tex = document.createElement("canvas"); tex.width = TEX; tex.height = TEX;
  var texKey = null;
  function cover(t, g, edge) { var c = 0.5 - (t - edge) / g; return c <= 0 ? 0 : c >= 1 ? 1 : c; }
  // An image marker is a white ring (the band shows through it), and a filled red disc
  // while the band stands at the image's tau: the min in the first band (stage 8), the
  // saddle and the max at the ends of stages 11 and 12.
  function reached(im, tauHi, bandOp) {
    if (bandOp <= 0) return false;
    return Math.abs(tauHi - (im.type === "min" ? DT : im.t)) < 1e-7;
  }
  function drawTexture(tauHi, bandOp, contourOp, markOp) {
    var red = D.images.map(function (im) { return reached(im, tauHi, bandOp) ? 1 : 0; }).join("");
    var key = tauHi.toFixed(6) + ":" + bandOp.toFixed(3) + ":" + contourOp.toFixed(3) + ":" + markOp.toFixed(3) + ":" + red;
    if (key === texKey) return tex;
    texKey = key;
    var ctx = tex.getContext("2d");
    ctx.clearRect(0, 0, TEX, TEX);
    ctx.fillStyle = "rgba(110,110,150,0.10)";
    ctx.fillRect(0, 0, TEX, TEX);
    if (bandOp > 0 && tauHi > 0) {
      var bctx = bandLayer.getContext("2d");
      if (!bandImg) bandImg = bctx.createImageData(TEX, TEX);
      var p = bandImg.data, lo = tauHi - DT, n4;
      for (var n = 0; n < TEX * TEX; n++) {
        var t = TG[n], g = GR[n];
        n4 = 4 * n;
        if (t >= tauHi + g) { p[n4 + 3] = 0; continue; }
        var cHi = cover(t, g, tauHi), cLo = lo > 0 ? cover(t, g, lo) : 0;
        p[n4] = BAND_RED[0]; p[n4 + 1] = BAND_RED[1]; p[n4 + 2] = BAND_RED[2];
        p[n4 + 3] = Math.round(255 * bandOp * (0.9 * (cHi - cLo) + 0.22 * cLo));
      }
      bctx.putImageData(bandImg, 0, 0);
      ctx.drawImage(bandLayer, 0, 0);
    }
    if (contourOp > 0) {
      ctx.globalAlpha = contourOp;
      ctx.drawImage(contours(), 0, 0);
      ctx.globalAlpha = 1;
    }
    if (markOp > 0) {
      ctx.globalAlpha = markOp;
      ctx.font = "36px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.lineJoin = "round";
      D.images.forEach(function (im, n) {
        var x = (im.x1 + D.viewHalf) / (2 * D.viewHalf) * TEX, y = (D.viewHalf - im.x2) / (2 * D.viewHalf) * TEX;
        ctx.beginPath(); ctx.arc(x, y, 10, 0, 2 * Math.PI);
        if (red.charAt(n) === "1") {
          ctx.fillStyle = rgba(BAND_RED, 1); ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
          ctx.fill(); ctx.stroke();
        } else {
          ctx.strokeStyle = "#000"; ctx.lineWidth = 7; ctx.stroke();
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.5; ctx.stroke();
        }
        // label placement: saddle to the left, max below, min to the right
        var lx = x, ly = y;
        if (im.type === "saddle") { ctx.textAlign = "right"; ctx.textBaseline = "middle"; lx = x - 20; }
        else if (im.type === "max") { ctx.textAlign = "center"; ctx.textBaseline = "top"; ly = y + 18; }
        else { ctx.textAlign = "left"; ctx.textBaseline = "middle"; lx = x + 20; }
        ctx.lineWidth = 7; ctx.strokeStyle = "#fff";
        ctx.strokeText(im.type, lx, ly);
        ctx.fillStyle = "#000";
        ctx.fillText(im.type, lx, ly);
      });
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = "rgba(60,60,90,0.6)";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, TEX - 3, TEX - 3);
    return tex;
  }

  // ---------------- camera ----------------
  function camera(u) {
    var yaw = lerp(YAW0, Math.PI / 2, u), pitch = lerp(PITCH0, 0, u);
    var C = [CAMD * Math.sin(yaw) * Math.cos(pitch), CAMD * Math.sin(pitch), CAMD * Math.cos(yaw) * Math.cos(pitch)];
    var f = norm([-C[0], -C[1], -C[2]]), r = norm(cross(f, [0, 1, 0])), up = cross(r, f);
    return { C: C, f: f, r: r, up: up, k: PX * CAMD * lerp(1, ZOOM2D, u), ox: lerp(960, PLANE_CX, u), oy: lerp(540, PLANE_CY, u) };
  }
  function proj(cam, p) {
    var d = sub(p, cam.C), z = dot(d, cam.f);
    return [cam.ox + cam.k * dot(d, cam.r) / z, cam.oy - cam.k * dot(d, cam.up) / z, cam.k / z / PX];
  }
  function planePoint(x1, x2) { return [0, x2 * XS, -x1 * XS]; }

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
  // restarts only after the previous pulse has reached the Earth on every path: stage 1
  // waits for the lower path (TRAVEL + DELAY), stage 3 for the one path.
  var EMIT = (LOOP_T1 - LOOP_T0) / NR_SPEED;
  var PER_1 = EMIT + TRAVEL + DELAY + 0.3, PER_3 = EMIT + TRAVEL + 0.3;
  var period = PER_1;
  function nrTime(sec) { var e = sec % period; return Math.min(LOOP_T1, LOOP_T0 + NR_SPEED * e); }
  var HL_MAX = Math.max.apply(null, WV.hL.map(Math.abs));
  // Strain and envelope emitted `sec` seconds after the clock start; lensed if L.
  function emit(sec, L) {
    if (sec < 0) return [0, 0];
    var t = nrTime(sec), g = smooth((t - LOOP_T0) / 30), sc = L ? GAIN_L / HL_MAX : 1;
    return [g * sc * interp(WV.t, L ? WV.hL : WV.h, t), g * sc * interp(WV.t, L ? WV.envL : WV.env, t)];
  }

  // ---------------- paths ----------------
  // A path is a dense polyline with cumulative arc length. Smooth paths are quadratic
  // Bezier curves from S to E through the point I at their middle.
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
  // Point and unit tangent at arc length s.
  function at(path, s) {
    var cum = path.cum, lo = 0, hi = cum.length - 1;
    s = clamp(s, 0, path.L);
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    var a = path.pts[lo], b = path.pts[hi], d = sub(b, a), l = cum[hi] - cum[lo], f = (s - cum[lo]) / l;
    return { p: [a[0] + d[0] * f, a[1] + d[1] * f, a[2] + d[2] * f], t: [d[0] / l, d[1] / l, d[2] / l] };
  }
  var PATH_UP = bezier(SRC, IMG_UP, EARTH), PATH_DN = bezier(SRC, IMG_DN, EARTH);
  var PATH_1 = bezier(SRC, planePoint(D.y, 0), EARTH);   // straight
  var LENS_S = PATH_1.L / 2;

  function strokePath(ctx, cam, path) {
    ctx.beginPath();
    for (var s = GAP_SRC, first = true; s <= path.L - GAP_EARTH + 1e-9; s += 0.01, first = false) {
      var q = proj(cam, at(path, s).p);
      if (first) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
  }
  // Wave along a path: displaced in the x-y plane, normal to the path, by AMP h at the
  // emission time sec - s / v; opacity follows the envelope. lensS: arc length of the lens,
  // where the wave switches from unlensed to diffracted (null: never).
  function drawWave(ctx, cam, path, sec, travel, lensS, op) {
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
      var q = proj(cam, [a.p[0] + n[0] * AMP * hv, a.p[1] + n[1] * AMP * hv, a.p[2]]);
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
  function drawHalo(ctx, cam, scale, op) {
    if (op <= 0) return;
    var q = proj(cam, LENS), R = HALO_R * scale * PX * q[2];
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.rotate(-0.25);
    ctx.scale(1, 0.72);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.6 * R);
    for (var i = 0; i <= 12; i++) {
      var r = i / 12 * 1.6, a = 0.92 * Math.exp(-r * r / 0.55) * op;
      g.addColorStop(i / 12, "rgba(55,38,95," + a.toFixed(4) + ")");
    }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 1.6 * R, 0, 2 * Math.PI); ctx.fill();
    ctx.restore();
  }
  function drawLight(ctx, cam, op) {
    if (op <= 0) return;
    var q = proj(cam, SRC), r = 80 * q[2];
    var g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
    g.addColorStop(0, "rgba(255,150,20," + op + ")");
    g.addColorStop(0.12, "rgba(255,165,40," + op + ")");
    g.addColorStop(0.35, "rgba(255,190,80," + 0.45 * op + ")");
    g.addColorStop(1, "rgba(255,210,120,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 2 * Math.PI); ctx.fill();
  }
  var earthImg = new Image();
  earthImg.src = "parts/gw-lensing/assets/earth_apollo17_400.png";
  function drawEarth(ctx, cam, op) {
    if (op <= 0 || !earthImg.complete || !earthImg.naturalWidth) return;
    var q = proj(cam, EARTH), r = EARTH_R * q[2];
    ctx.save();
    ctx.globalAlpha = op;
    ctx.drawImage(earthImg, q[0] - r, q[1] - r, 2 * r, 2 * r);
    ctx.restore();
  }
  function drawPlane(ctx, cam, texc, op) {
    if (op <= 0) return;
    var tl = proj(cam, planePoint(-D.viewHalf, D.viewHalf)), tr = proj(cam, planePoint(D.viewHalf, D.viewHalf)),
        bl = proj(cam, planePoint(-D.viewHalf, -D.viewHalf));
    ctx.save();
    ctx.globalAlpha = op;
    ctx.transform((tr[0] - tl[0]) / TEX, (tr[1] - tl[1]) / TEX, (bl[0] - tl[0]) / TEX, (bl[1] - tl[1]) / TEX, tl[0], tl[1]);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(texc, 0, 0);
    ctx.restore();
  }
  function drawColorbar(ctx, cx, op) {
    if (op <= 0) return;
    var x0 = cx - CB.w / 2, y0 = CB.y;
    ctx.save();
    ctx.globalAlpha = op;
    var g = ctx.createLinearGradient(x0, 0, x0 + CB.w, 0);
    for (var i = 0; i < VIRIDIS.length; i++) g.addColorStop(i / (VIRIDIS.length - 1), rgba(VIRIDIS[i], 1));
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, CB.w, CB.h);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, CB.w, CB.h);
    ctx.fillStyle = "#000"; ctx.font = "28px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    [0, 0.2, 0.4, 0.6, 0.8].forEach(function (t) {
      var x = x0 + t / TAU_END * CB.w;
      ctx.beginPath(); ctx.moveTo(x, y0 + CB.h); ctx.lineTo(x, y0 + CB.h + 8); ctx.stroke();
      ctx.fillText(t === 0 ? "0" : t.toFixed(1), x, y0 + CB.h + 10);
    });
    ctx.restore();
  }

  // Ray points on the lens plane: rings, denser near the centre.
  var RAYS = (function () {
    var pts = [[0, 0]], rings = [[0.25, 4], [0.55, 6], [0.9, 8], [1.3, 10], [1.75, 12], [2.2, 14], [2.45, 15]];
    rings.forEach(function (rn) {
      for (var i = 0; i < rn[1]; i++) {
        var a = 2 * Math.PI * (i + 0.5 * (rn[0] > 1 ? 1 : 0)) / rn[1];
        pts.push([rn[0] * Math.cos(a), rn[0] * Math.sin(a)]);
      }
    });
    return pts.map(function (p) { return { x1: p[0], x2: p[1], c: viridis(T(p[0], p[1]) / TAU_END) }; });
  })();

  // ---------------- plots ----------------
  function plotAxes(ctx, box, xr, yr, xt, yt, logx, op) {
    if (op <= 0) return null;
    var f = logx ? Math.log10 : function (x) { return x; };
    function X(x) { return box[0] + (f(x) - f(xr[0])) / (f(xr[1]) - f(xr[0])) * (box[2] - box[0]); }
    function Y(y) { return box[3] - (y - yr[0]) / (yr[1] - yr[0]) * (box[3] - box[1]); }
    ctx.save();
    ctx.globalAlpha = op;
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2.5;
    ctx.strokeRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
    ctx.fillStyle = "#000"; ctx.font = "28px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    xt.forEach(function (x) {
      var px = X(x);
      ctx.beginPath(); ctx.moveTo(px, box[3]); ctx.lineTo(px, box[3] - 12); ctx.stroke();
      ctx.fillText(logx || x !== 0 ? String(x) : "0", px, box[3] + 10);
    });
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    yt.forEach(function (y) {
      var py = Y(y);
      ctx.beginPath(); ctx.moveTo(box[0], py); ctx.lineTo(box[0] + 12, py); ctx.stroke();
      ctx.fillText(String(y), box[0] - 12, py);
    });
    ctx.restore();
    return { X: X, Y: Y };
  }
  // Curve through (xs, ys) for xs <= xmax, clipped to the box.
  function curve(ctx, m, box, xs, ys, xmax, color, width, op) {
    if (!m || op <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(box[0], box[1], box[2] - box[0], box[3] - box[1]); ctx.clip();
    ctx.globalAlpha = op; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round";
    ctx.beginPath();
    for (var i = 0; i < xs.length && xs[i] <= xmax; i++) {
      if (i) ctx.lineTo(m.X(xs[i]), m.Y(ys[i])); else ctx.moveTo(m.X(xs[i]), m.Y(ys[i]));
    }
    ctx.stroke();
    ctx.restore();
  }
  var TAU_TICKS = [0, 0.2, 0.4, 0.6, 0.8], W_TICKS = [0.01, 0.1, 1, 10, 100, 1000];

  // =================== the slide ===================
  var scene, bbh, run, labels, citePlot, clock = null, freezeT = null;
  var p = {};
  ["light", "bbh", "emRays", "halo", "wave2", "wave1", "plane", "rays", "rayColor", "cbar", "scene", "cam",
   "contour", "marks", "frame", "tau", "band", "layout", "fprog"].forEach(function (k) { p[k] = P(0); });
  p.halo = P(1); p.light = P(1); p.emRays = P(1); p.scene = P(1);

  function srcTime(now) {
    if (freezeT !== null) return freezeT;
    return clock === null ? LOOP_T0 : nrTime((now - clock) / 1000);
  }

  function frame(now) {
    var k = fit(scene), ctx = scene.getContext("2d");
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, 1920, 1080);
    var v = {};
    for (var key in p) v[key] = val(p[key], now);
    var cam = camera(v.cam), sec = clock === null ? -1 : (now - clock) / 1000;

    drawHalo(ctx, cam, v.halo, lerp(1, 0.35, v.cam));
    drawPlane(ctx, cam, drawTexture(v.tau, v.band, v.contour, v.marks), v.plane);

    // smooth ray-optics paths
    if (v.emRays > 0) {
      ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.strokeStyle = "rgba(235,140,20," + v.emRays + ")";
      strokePath(ctx, cam, PATH_UP);
      strokePath(ctx, cam, PATH_DN);
    }
    // many rays through the lens plane (thin lens: straight segments)
    if (v.rays > 0) {
      ctx.lineWidth = 1.6;
      RAYS.forEach(function (r) {
        var c = [lerp(150, r.c[0], v.rayColor), lerp(150, r.c[1], v.rayColor), lerp(150, r.c[2], v.rayColor)];
        ctx.strokeStyle = rgba(c, 0.6 * v.rays);
        ctx.beginPath();
        [SRC, planePoint(r.x1, r.x2), EARTH].forEach(function (pt, i) { var q = proj(cam, pt); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
        ctx.stroke();
      });
    }
    // gravitational waves
    if (v.wave2 > 0 && sec >= 0) {
      drawWave(ctx, cam, PATH_UP, sec, TRAVEL, null, v.wave2);
      drawWave(ctx, cam, PATH_DN, sec, TRAVEL + DELAY, null, v.wave2);
    }
    if (v.wave1 > 0 && sec >= 0) {
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(235,140,20," + 0.22 * v.wave1 + ")";
      strokePath(ctx, cam, PATH_1);
      drawWave(ctx, cam, PATH_1, sec, TRAVEL, LENS_S, v.wave1);
    }
    drawLight(ctx, cam, v.light * v.scene);
    drawEarth(ctx, cam, v.scene);
    drawColorbar(ctx, lerp(960, PLANE_CX, v.cam), v.cbar);

    // BBH at the source
    bbh.style.opacity = v.bbh * v.scene;
    if (v.bbh * v.scene > 0.001) drawBBH(bbh, srcTime(now));

    // plots
    var ib = [0, 1, 2, 3].map(function (i) { return lerp(I_BOX0[i], I_BOX1[i], v.layout); });
    var mI = plotAxes(ctx, ib, [0, TAU_END], I_Y, TAU_TICKS, [0, 2, 4, 6, 8], false, v.frame);
    if (mI && v.band > 0) {
      // the GLoW curve once the band moves continuously (stage 11 on), up to the band's outer edge
      if (p.tau.to > 3 * DT + 1e-9) curve(ctx, mI, ib, D.tau, D.I, v.tau, "#000", 3, v.band);
      ctx.save(); ctx.globalAlpha = v.band;
      ctx.fillStyle = "rgb(205,55,40)"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
      for (var i = 0; i < D.bandMid.length; i++) {
        if (D.bandMid[i] + DT / 2 > v.tau + 1e-6) break;
        ctx.beginPath(); ctx.arc(mI.X(D.bandMid[i]), mI.Y(D.bandI[i]), 8, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    var mF = plotAxes(ctx, F_BOX, [0.01, 1000], F_Y, W_TICKS, [0, 2, 4, 6], true, v.layout);
    if (mF) curve(ctx, mF, F_BOX, D.w, D.absF, 0.01 * Math.pow(1e5, v.fprog), "#000", 2, 1);

    // labels
    place(labels.it_x, (ib[0] + ib[2]) / 2, ib[3] + 70, v.frame);
    place(labels.it_y, ib[0] - 90, (ib[1] + ib[3]) / 2, v.frame);
    place(labels.cb, lerp(960, PLANE_CX, v.cam), CB.y + CB.h + 60, v.cbar);
    place(labels.f_x, (F_BOX[0] + F_BOX[2]) / 2, F_BOX[3] + 70, v.layout);
    place(labels.f_y, F_BOX[0] - 80, (F_BOX[1] + F_BOX[3]) / 2, v.layout);
    citePlot.style.opacity = v.frame;
  }

  Deck.widget("gw-lensing-main", {
    steps: 14,
    enter: function (slide) {
      scene = slide.querySelector("#gw-lensing-scene");
      bbh = slide.querySelector("#gw-lensing-bbh");
      citePlot = slide.querySelector("#gw-lensing-cite-plot");
      var q = proj(camera(0), SRC);
      bbh.style.left = (q[0] - 130) + "px"; bbh.style.top = (q[1] - 130) + "px";
      citePlot.style.left = ((I_BOX0[0] + I_BOX0[2]) / 2) + "px"; citePlot.style.top = "1010px";
      if (!labels) {
        var box = slide.querySelector("#gw-lensing-labels");
        labels = {
          it_x: makeLabel(box, "$T"), it_y: makeLabel(box, "$\\frac{1}{2\\pi}\\frac{\\mathrm{d}A}{\\mathrm{d}T}", true),
          cb: makeLabel(box, "$T"),
          f_x: makeLabel(box, "$w"), f_y: makeLabel(box, "$\\lvert F(w)\\rvert", true)
        };
      }
      run = Runner(frame);
      run.start();
    },
    leave: function () { run.stop(); },
    step: function (slide, k, dir) {
      var now = performance.now(), inst = dir < 0;
      // source clock: waves start from the source on entering stages 1 and 3; the BBH
      // stops in stage 2 and shows its first frame (LOOP_T0), still, in stages 4-5
      if (k === 0) { clock = null; freezeT = null; period = PER_1; }
      else if (k === 2) { freezeT = inst ? LOOP_T0 : srcTime(now); }
      else if (k >= 4) { freezeT = LOOP_T0; }
      else {
        freezeT = null; period = k === 1 ? PER_1 : PER_3;
        clock = inst ? now - 20000 : now;
      }
      set(p.light, k === 0 ? 1 : 0, now, inst, 900);
      set(p.bbh, k >= 1 && k <= 5 ? 1 : 0, now, inst, 900);
      set(p.emRays, k === 0 ? 1 : k === 1 ? 0.22 : 0, now, inst, 900);
      set(p.halo, k <= 1 ? 1 : HALO_SMALL, now, inst, 2000, false, k === 2 ? 900 : 0);
      set(p.wave2, k === 1 ? 1 : 0, now, inst, 800);
      set(p.wave1, k === 3 ? 1 : 0, now, inst, 800);
      set(p.plane, k >= 4 ? 1 : 0, now, inst, 900);
      set(p.rays, k === 4 || k === 5 ? 1 : 0, now, inst, 900);
      set(p.rayColor, k >= 5 ? 1 : 0, now, inst, 1200);
      set(p.cbar, k >= 5 ? 1 : 0, now, inst, 900);
      set(p.scene, k <= 5 ? 1 : 0, now, inst, 900);
      // stage 6: rays, source and Earth fade out first; then the camera turns
      set(p.cam, k >= 6 ? 1 : 0, now, inst, 2200, false, k === 6 ? 900 : 0);
      set(p.contour, k >= 6 ? 1 : 0, now, inst, 1200, false, k === 6 ? 900 : 0);
      set(p.marks, k >= 6 ? 1 : 0, now, inst, 600, false, k === 6 ? 2900 : 0);
      set(p.frame, k >= 7 ? 1 : 0, now, inst, 700);
      set(p.band, k >= 8 ? 1 : 0, now, inst, 300);
      var tau = k < 8 ? 0 : k <= 10 ? (k - 7) * DT : k === 11 ? TAU_S : k === 12 ? TAU_M : TAU_END;
      if (k <= 10) set(p.tau, tau, now, true);
      // stage 12 eases out: the hole T >= tau around the maximum has radius ~ sqrt(tau_M - tau),
      // so with ease-out it shrinks at a steady rate and closes as the band stops
      else set(p.tau, tau, now, inst, k === 11 ? 2000 : k === 12 ? 2500 : 6000, k === 12 ? "out" : true);
      set(p.layout, k >= 14 ? 1 : 0, now, inst, 1200);
      set(p.fprog, k >= 14 ? 1 : 0, now, inst, 2500, true, k === 14 ? 1000 : 0);
    }
  });
})();
