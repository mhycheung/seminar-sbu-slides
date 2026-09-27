// Gravitational-wave lensing. Two slides.
//
// gw-lensing-main (13 steps). A 3D scene seen nearly from the side (perspective camera,
// optical axis left to right), then the lens plane face-on and the contour method.
//   0  large diffuse halo, a light source on the left, Earth on the right, two bent rays
//   1  the source becomes a merging BBH (NR data of the ringdown part); gravitational
//      waves travel along the same two paths; the lower one arrives later (schematic lag)
//   2  the halo shrinks; one path; the wave changes from unlensed to diffracted at the halo
//      (h_L = IFFT[F(w) h(f)], F from GLoW for a cored isothermal sphere)
//   3  lens plane with many rays source -> plane -> Earth
//   4  rays coloured by the time delay T(x) of their plane point
//   5  source, Earth, rays gone; the camera turns to face the plane, which moves left; contours of T
//   6  empty plot frame on the right: time, ~Area
//   7-9  one band between successive contours per step, filled red; its area on the plot
//   10 the band moves out to the saddle image; 11 to the maximum image; 12 to the end
//   13 |F(w)| panel below the time-domain plot
// gw-lensing-vary: I(tau) and |F(w)| redrawn while the source position y loops.
//
// Lens: cored isothermal sphere, psi(x) = psi0 (r + rc ln(2 rc/(r + rc))), r = sqrt(x^2 + rc^2),
// T(x) = |x - y|^2/2 - psi(x) (GLoW 0.1). Numbers and checks: tasks/t08-gw-lensing/S1/.
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
  var SRC = [-1, 2 * D.y * XS, 0];         // straight line to Earth crosses the plane at y
  var EARTH = [1, 0, 0];
  var LENS = [0, 0, 0];
  var IMG_UP = [0, 0.37, 0], IMG_DN = [0, -0.31, 0];  // ray-optics images of the large halo
  var HALO_R = 0.36;        // halo size (world units) in stages 0-1
  var HALO_SMALL = 0.14;    // relative halo size from stage 2
  var PLANE_CX = 500, PLANE_HALF_PX = 420;  // face-on lens plane on the slide
  var ZOOM2D = PLANE_HALF_PX / (PX * PLANE_H);
  var TRAVEL = 3.0;         // s, travel time source -> Earth
  var DELAY = 1.1;          // s, extra travel time of the lower path (schematic)
  var AMP = 0.045;          // world units of transverse displacement at the unlensed peak
  var GAIN_L = 1.6;         // displayed peak of the diffracted wave / unlensed peak (schematic;
                            // the computed ratio is D.wave.hL max, about 6)
  var LOOP_T0 = 610, LOOP_T1 = 850, NR_SPEED = 55, LOOP_HOLD = 0.8;  // BBH loop, M and s
  var SC_BBH = 11;          // px per M for the BBH at the source
  var BAND_RED = [205, 55, 40];
  var TAU_S = D.images[1].t, TAU_M = D.images[2].t, TAU_END = D.tauMax, DT = D.dtau;
  var N = D.grid, TEX = 2 * N;            // lens-plane grid and texture size
  var I_BOX0 = [1090, 170, 1800, 860], I_BOX1 = [1090, 80, 1800, 450], F_BOX = [1090, 590, 1800, 960];
  var I_Y = [0, 9], F_Y = [0, 7];
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
  function P(v) { return { from: v, to: v, t0: 0, dur: 1, lin: false }; }
  function val(p, now) {
    var f = clamp((now - p.t0) / p.dur, 0, 1);
    if (!p.lin) f = f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f);
    return p.from + (p.to - p.from) * f;
  }
  function set(p, target, now, instant, dur, lin) {
    if (instant) { p.from = p.to = target; p.t0 = 0; return; }
    if (p.to === target) return;
    p.from = val(p, now); p.to = target; p.t0 = now; p.dur = dur || 800; p.lin = !!lin;
  }

  function Runner(frame) {
    var raf = null;
    function tick(now) { frame(now); raf = requestAnimationFrame(tick); }
    return {
      start: function () { if (!raf) raf = requestAnimationFrame(tick); },
      stop: function () { if (raf) cancelAnimationFrame(raf); raf = null; }
    };
  }

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

  // Grid: column i <-> x2 from +h to -h, row j <-> x1 from +h to -h (as the texture).
  var TG = new Float32Array(N * N);
  (function () {
    var h = D.viewHalf;
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++)
      TG[j * N + i] = T(h - (j + 0.5) * 2 * h / N, h - (i + 0.5) * 2 * h / N);
  })();

  // Contour segments (texture px) of T at the band edges k DT, marching squares.
  var SEGS = (function () {
    var out = [], sc = TEX / N;
    for (var k = 1; k * DT <= TAU_END + 1e-9; k++) {
      var L = k * DT;
      for (var j = 0; j < N - 1; j++) for (var i = 0; i < N - 1; i++) {
        var a = TG[j * N + i] - L, b = TG[j * N + i + 1] - L, c = TG[(j + 1) * N + i + 1] - L, d = TG[(j + 1) * N + i] - L;
        var p = [];
        if ((a < 0) !== (b < 0)) p.push([i + a / (a - b), j]);
        if ((b < 0) !== (c < 0)) p.push([i + 1, j + b / (b - c)]);
        if ((d < 0) !== (c < 0)) p.push([i + d / (d - c), j + 1]);
        if ((a < 0) !== (d < 0)) p.push([i, j + a / (a - d)]);
        for (var q = 0; q + 1 < p.length; q += 2)
          out.push([(p[q][0] + 0.5) * sc, (p[q][1] + 0.5) * sc, (p[q + 1][0] + 0.5) * sc, (p[q + 1][1] + 0.5) * sc]);
      }
    }
    return out;
  })();

  // Lens-plane texture: translucent plane, swept region (light red), current band (red),
  // contour lines. Cached by its inputs.
  var texBand = document.createElement("canvas"); texBand.width = N; texBand.height = N;
  var tex = document.createElement("canvas"); tex.width = TEX; tex.height = TEX;
  var texKey = null, contourLayer = null;
  function contours() {
    if (contourLayer) return contourLayer;
    contourLayer = document.createElement("canvas"); contourLayer.width = TEX; contourLayer.height = TEX;
    var ctx = contourLayer.getContext("2d");
    ctx.strokeStyle = "rgba(40,40,40,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var s = 0; s < SEGS.length; s++) { var g = SEGS[s]; ctx.moveTo(g[0], g[1]); ctx.lineTo(g[2], g[3]); }
    ctx.stroke();
    return contourLayer;
  }
  function drawTexture(tauHi, bandOp, contourOp) {
    var key = tauHi.toFixed(5) + ":" + bandOp.toFixed(3) + ":" + contourOp.toFixed(3);
    if (key === texKey) return tex;
    texKey = key;
    var ctx = tex.getContext("2d");
    ctx.clearRect(0, 0, TEX, TEX);
    ctx.fillStyle = "rgba(110,110,150,0.10)";
    ctx.fillRect(0, 0, TEX, TEX);
    if (bandOp > 0 && tauHi > 0) {
      var bctx = texBand.getContext("2d"), img = bctx.createImageData(N, N), p = img.data;
      var lo = tauHi - DT;
      for (var n = 0; n < N * N; n++) {
        var t = TG[n];
        if (t >= tauHi) continue;
        p[4 * n] = BAND_RED[0]; p[4 * n + 1] = BAND_RED[1]; p[4 * n + 2] = BAND_RED[2];
        p[4 * n + 3] = Math.round(255 * bandOp * (t >= lo ? 0.9 : 0.22));
      }
      bctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(texBand, 0, 0, TEX, TEX);
    }
    if (contourOp > 0) {
      ctx.globalAlpha = contourOp;
      ctx.drawImage(contours(), 0, 0);
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
    return { C: C, f: f, r: r, up: up, k: PX * CAMD * lerp(1, ZOOM2D, u), ox: lerp(960, PLANE_CX, u), oy: 540 };
  }
  function proj(cam, p) {
    var d = sub(p, cam.C), z = dot(d, cam.f);
    return [cam.ox + cam.k * dot(d, cam.r) / z, cam.oy - cam.k * dot(d, cam.up) / z, cam.k / z / PX];
  }
  function planePoint(x1, x2) { return [0, x1 * XS, x2 * XS]; }

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
  var bbhLayer = document.createElement("canvas");
  function drawBBH(c, t) {
    var k = fit(c), W = c.width, DS = 3, w = Math.ceil(W / DS), s = nrSample(t), half = c.offsetWidth / 2;
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

  // Source clock: seconds since the BBH appeared -> NR time (loops with a hold).
  var PERIOD = (LOOP_T1 - LOOP_T0) / NR_SPEED + LOOP_HOLD;
  function nrTime(sec) { var e = sec % PERIOD; return Math.min(LOOP_T1, LOOP_T0 + NR_SPEED * e); }
  var HL_MAX = Math.max.apply(null, WV.hL.map(Math.abs));
  // Strain and envelope emitted `sec` seconds after the clock start; lensed if L.
  function emit(sec, L) {
    if (sec < 0) return [0, 0];
    var t = nrTime(sec), g = smooth((t - LOOP_T0) / 30), sc = L ? GAIN_L / HL_MAX : 1;
    return [g * sc * interp(WV.t, L ? WV.hL : WV.h, t), g * sc * interp(WV.t, L ? WV.envL : WV.env, t)];
  }

  // ---------------- drawing the 3D scene ----------------
  function pathLen(pts) { var L = 0; for (var i = 1; i < pts.length; i++) { var d = sub(pts[i], pts[i - 1]); L += Math.sqrt(dot(d, d)); } return L; }
  function polyline(ctx, cam, pts) {
    ctx.beginPath();
    pts.forEach(function (p, i) { var q = proj(cam, p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    ctx.stroke();
  }
  // Wave along a polyline: displaced in the x-y plane, normal to the path, by AMP h at the
  // emission time sec - s / v; opacity follows the envelope. lensAt: arc length of the lens
  // for a switch from unlensed to diffracted (or null).
  function blendN(n, a, b, u) {
    var d = sub(b, a), l = Math.sqrt(dot(d, d)), m = [-d[1] / l, d[0] / l, 0];
    return norm([lerp(n[0], m[0], u), lerp(n[1], m[1], u), 0]);
  }
  function drawWave(ctx, cam, pts, sec, travel, lensAt, op) {
    var Ltot = pathLen(pts), v = Ltot / travel, ds = 0.006, seg = 0, s0 = 0;
    var prev = null;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    for (var s = 0; s <= Ltot + 1e-9; s += ds) {
      while (seg < pts.length - 2) {
        var dd = sub(pts[seg + 1], pts[seg]), l = Math.sqrt(dot(dd, dd));
        if (s - s0 <= l) break;
        s0 += l; seg++;
      }
      var a = pts[seg], b = pts[seg + 1], d = sub(b, a), ll = Math.sqrt(dot(d, d)), u = (s - s0) / ll;
      var n = [-d[1] / ll, d[0] / ll, 0], CW = 0.08;
      if (seg + 2 < pts.length && s0 + ll - s < CW) n = blendN(n, pts[seg + 1], pts[seg + 2], 0.5 * (1 - (s0 + ll - s) / CW));
      else if (seg > 0 && s - s0 < CW) n = blendN(n, pts[seg - 1], pts[seg], 0.5 * (1 - (s - s0) / CW));
      var te = sec - s / v, hv, ev;
      if (lensAt === null) { var e0 = emit(te, false); hv = e0[0]; ev = e0[1]; }
      else {
        var wL = smooth((s - lensAt + 0.06) / 0.12), e1 = emit(te, false), e2 = emit(te, true);
        hv = (1 - wL) * e1[0] + wL * e2[0]; ev = (1 - wL) * e1[1] + wL * e2[1];
      }
      var P3 = [a[0] + d[0] * u + n[0] * AMP * hv, a[1] + d[1] * u + n[1] * AMP * hv, 0];
      var q = proj(cam, P3);
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
  function drawHalo(ctx, cam, scale, op) {
    if (op <= 0) return;
    var q = proj(cam, LENS), R = HALO_R * scale * PX * q[2];
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.rotate(-0.25);
    ctx.scale(1, 0.72);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.6 * R);
    for (var i = 0; i <= 10; i++) {
      var r = i / 10 * 1.6, a = 0.55 * Math.exp(-r * r / 0.5) * op;
      g.addColorStop(i / 10, "rgba(95,78,140," + a.toFixed(4) + ")");
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
  function drawEarth(ctx, cam, op) {
    if (op <= 0) return;
    var q = proj(cam, EARTH), r = 55 * q[2];
    var g = ctx.createRadialGradient(q[0] - 0.35 * r, q[1] - 0.35 * r, 0.1 * r, q[0], q[1], r);
    g.addColorStop(0, "rgba(170,210,255," + op + ")");
    g.addColorStop(0.45, "rgba(50,115,210," + op + ")");
    g.addColorStop(1, "rgba(12,45,110," + op + ")");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 2 * Math.PI); ctx.fill();
  }
  function drawPlane(ctx, cam, texc, op) {
    if (op <= 0) return;
    var h = PLANE_H, tl = proj(cam, [0, h, h]), tr = proj(cam, [0, h, -h]), bl = proj(cam, [0, -h, h]);
    ctx.save();
    ctx.globalAlpha = op;
    ctx.transform((tr[0] - tl[0]) / TEX, (tr[1] - tl[1]) / TEX, (bl[0] - tl[0]) / TEX, (bl[1] - tl[1]) / TEX, tl[0], tl[1]);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(texc, 0, 0);
    ctx.restore();
  }

  // Ray points on the lens plane: rings, denser near the centre.
  var RAYS = (function () {
    var pts = [[0, 0]], rings = [[0.25, 8], [0.55, 12], [0.9, 16], [1.3, 20], [1.75, 24], [2.2, 28], [2.45, 30]];
    rings.forEach(function (rn) {
      for (var i = 0; i < rn[1]; i++) {
        var a = 2 * Math.PI * (i + 0.5 * (rn[0] > 1 ? 1 : 0)) / rn[1];
        pts.push([rn[0] * Math.cos(a), rn[0] * Math.sin(a)]);
      }
    });
    return pts.map(function (p) { return { x1: p[0], x2: p[1], c: viridis(T(p[0], p[1]) / TAU_END) }; });
  })();

  // ---------------- plots ----------------
  function plotAxes(ctx, box, xr, yr, xt, yt, logx, xfmt, op) {
    if (op <= 0) return null;
    function X(x) { return box[0] + ((logx ? Math.log10(x) : x) - (logx ? Math.log10(xr[0]) : xr[0])) / ((logx ? Math.log10(xr[1]) : xr[1]) - (logx ? Math.log10(xr[0]) : xr[0])) * (box[2] - box[0]); }
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
      ctx.fillText(xfmt(x), px, box[3] + 10);
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
  function fmtTau(x) { return x === 0 ? "0" : x.toFixed(1); }
  function fmtW(x) { return x >= 1 ? String(x) : String(x); }
  var TAU_TICKS = [0, 0.2, 0.4, 0.6, 0.8], W_TICKS = [0.01, 0.1, 1, 10, 100];

  // =================== slide 1 ===================
  (function () {
    var scene, bbh, run, labels, citeWave, citePlot, clock = null;
    var p = {};
    ["light", "bbh", "emRays", "halo", "wave2", "wave1", "plane", "rays", "rayColor", "scene", "cam",
     "contour", "frame", "tau", "band", "layout", "fprog"].forEach(function (k) { p[k] = P(0); });
    p.halo = P(1); p.light = P(1); p.emRays = P(1); p.scene = P(1);

    function frame(now) {
      var k = fit(scene), ctx = scene.getContext("2d");
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.clearRect(0, 0, 1920, 1080);
      var v = {};
      for (var key in p) v[key] = val(p[key], now);
      var cam = camera(v.cam), sec = clock === null ? -1 : (now - clock) / 1000;

      drawHalo(ctx, cam, v.halo, lerp(1, 0.5, v.cam));
      drawPlane(ctx, cam, drawTexture(v.tau, v.band, v.contour), v.plane);

      // ray-optics paths
      if (v.emRays > 0) {
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(235,140,20," + v.emRays + ")";
        polyline(ctx, cam, [SRC, IMG_UP, EARTH]);
        polyline(ctx, cam, [SRC, IMG_DN, EARTH]);
      }
      // many rays through the lens plane
      if (v.rays > 0) {
        ctx.lineWidth = 1.6;
        RAYS.forEach(function (r) {
          var c = [lerp(150, r.c[0], v.rayColor), lerp(150, r.c[1], v.rayColor), lerp(150, r.c[2], v.rayColor)];
          ctx.strokeStyle = rgba(c, 0.6 * v.rays);
          polyline(ctx, cam, [SRC, planePoint(r.x1, r.x2), EARTH]);
        });
      }
      // gravitational waves
      if (v.wave2 > 0 && sec >= 0) {
        drawWave(ctx, cam, [SRC, IMG_UP, EARTH], sec, TRAVEL, null, v.wave2);
        drawWave(ctx, cam, [SRC, IMG_DN, EARTH], sec, TRAVEL + DELAY, null, v.wave2);
      }
      if (v.wave1 > 0 && sec >= 0) {
        var mid = planePoint(D.y, 0);
        drawWave(ctx, cam, [SRC, mid, EARTH], sec, TRAVEL, pathLen([SRC, mid]), v.wave1);
      }
      drawLight(ctx, cam, v.light * v.scene);
      drawEarth(ctx, cam, v.scene);

      // BBH at the source
      bbh.style.opacity = v.bbh * v.scene;
      if (v.bbh * v.scene > 0.001) drawBBH(bbh, sec >= 0 ? nrTime(sec) : LOOP_T0);

      // plots
      var ib = [0, 1, 2, 3].map(function (i) { return lerp(I_BOX0[i], I_BOX1[i], v.layout); });
      var mI = plotAxes(ctx, ib, [0, TAU_END], I_Y, TAU_TICKS, [0, 2, 4, 6, 8], false, fmtTau, v.frame);
      if (mI && v.band > 0) {
        var shownTo = v.tau - DT / 2;
        if (p.tau.to > 3 * DT + 1e-9 || v.tau > 3 * DT + 1e-6) curve(ctx, mI, ib, D.tau, D.I, shownTo, "#000", 3, v.band);
        ctx.save(); ctx.globalAlpha = v.band;
        for (var i = 0; i < D.bandMid.length; i++) {
          if (D.bandMid[i] > shownTo + 1e-6) break;
          ctx.fillStyle = "rgb(205,55,40)"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(mI.X(D.bandMid[i]), mI.Y(D.bandI[i]), 8, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      }
      var mF = plotAxes(ctx, F_BOX, [0.01, 100], F_Y, W_TICKS, [0, 2, 4, 6], true, fmtW, v.layout);
      if (mF) curve(ctx, mF, F_BOX, D.w, D.absF, 0.01 * Math.pow(1e4, v.fprog), "#000", 3, 1);

      // labels
      place(labels.it_x, (ib[0] + ib[2]) / 2, ib[3] + 75, v.frame);
      place(labels.it_y, ib[0] - 80, (ib[1] + ib[3]) / 2, v.frame);
      place(labels.f_x, (F_BOX[0] + F_BOX[2]) / 2, F_BOX[3] + 75, v.layout);
      place(labels.f_y, F_BOX[0] - 80, (F_BOX[1] + F_BOX[3]) / 2, v.layout);
      citeWave.style.opacity = v.wave1;
      citePlot.style.opacity = v.frame;
    }

    Deck.widget("gw-lensing-main", {
      steps: 13,
      enter: function (slide) {
        scene = slide.querySelector("#gw-lensing-scene");
        bbh = slide.querySelector("#gw-lensing-bbh");
        citeWave = slide.querySelector("#gw-lensing-cite-wave");
        citePlot = slide.querySelector("#gw-lensing-cite-plot");
        var q = proj(camera(0), SRC);
        bbh.style.left = (q[0] - 130) + "px"; bbh.style.top = (q[1] - 130) + "px";
        var l = proj(camera(0), LENS);
        citeWave.style.left = l[0] + "px"; citeWave.style.top = (l[1] + 150) + "px";
        citePlot.style.left = PLANE_CX + "px"; citePlot.style.top = "985px";
        if (!labels) {
          var box = slide.querySelector("#gw-lensing-labels");
          labels = {
            it_x: makeLabel(box, "Time"), it_y: makeLabel(box, "~Area", true),
            f_x: makeLabel(box, "$w"), f_y: makeLabel(box, "$\\lvert F(w)\\rvert", true)
          };
        }
        run = Runner(frame);
        run.start();
      },
      leave: function () { run.stop(); },
      step: function (slide, k, dir) {
        var now = performance.now(), inst = dir < 0;
        if (k >= 1 && (clock === null || inst)) clock = inst ? now - 20000 : now;
        if (k === 0) clock = null;
        set(p.light, k === 0 ? 1 : 0, now, inst, 900);
        set(p.bbh, k >= 1 && k <= 4 ? 1 : 0, now, inst, 900);
        set(p.emRays, k === 0 ? 1 : k === 1 ? 0.22 : 0, now, inst, 900);
        set(p.halo, k <= 1 ? 1 : HALO_SMALL, now, inst, 2000);
        set(p.wave2, k === 1 ? 1 : 0, now, inst, 900);
        set(p.wave1, k === 2 ? 1 : 0, now, inst, 1200);
        set(p.plane, k >= 3 ? 1 : 0, now, inst, 900);
        set(p.rays, k === 3 || k === 4 ? 1 : 0, now, inst, 900);
        set(p.rayColor, k >= 4 ? 1 : 0, now, inst, 1200);
        set(p.scene, k <= 4 ? 1 : 0, now, inst, 900);
        set(p.cam, k >= 5 ? 1 : 0, now, inst, 2200);
        set(p.contour, k >= 5 ? 1 : 0, now, inst, 1200);
        set(p.frame, k >= 6 ? 1 : 0, now, inst, 700);
        set(p.band, k >= 7 ? 1 : 0, now, inst, 300);
        var tau = k < 7 ? 0 : k <= 9 ? (k - 6) * DT : k === 10 ? TAU_S : k === 11 ? TAU_M : TAU_END;
        if (k <= 9) set(p.tau, tau, now, true);
        else set(p.tau, tau, now, inst, k === 10 ? 2000 : k === 11 ? 2500 : 6000, true);
        set(p.layout, k >= 13 ? 1 : 0, now, inst, 1200);
        set(p.fprog, k >= 13 ? 1 : 0, now, inst, 2000, true);
        if (k >= 13 && !inst) { p.fprog.t0 = now + 1000; }
      }
    });
  })();

  // =================== slide 2: source position loops ===================
  (function () {
    var cv, run, labels, t0 = 0;
    var BOX_I = [170, 170, 900, 860], BOX_F = [1090, 170, 1820, 860];
    var Y_LO = 0.08, Y_HI = D.sweepY[D.sweepY.length - 1], LOOP = 14;   // s per back-and-forth
    function row(arrs, y) {
      var ys = D.sweepY, i = 0;
      while (i < ys.length - 2 && ys[i + 1] < y) i++;
      var f = clamp((y - ys[i]) / (ys[i + 1] - ys[i]), 0, 1);
      return arrs[i].map(function (a, j) { return a * (1 - f) + arrs[i + 1][j] * f; });
    }
    function frame(now) {
      var k = fit(cv), ctx = cv.getContext("2d");
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.clearRect(0, 0, 1920, 1080);
      var ph = ((now - t0) / 1000) / LOOP, y = Y_LO + (Y_HI - Y_LO) * (0.5 - 0.5 * Math.cos(2 * Math.PI * ph));
      var mI = plotAxes(ctx, BOX_I, [0, TAU_END], I_Y, TAU_TICKS, [0, 2, 4, 6, 8], false, fmtTau, 1);
      curve(ctx, mI, BOX_I, D.tau, row(D.sweepI, y), 1e9, "#000", 3, 1);
      var mF = plotAxes(ctx, BOX_F, [0.01, 100], F_Y, W_TICKS, [0, 2, 4, 6], true, fmtW, 1);
      curve(ctx, mF, BOX_F, D.w, row(D.sweepF, y), 1e9, "#000", 3, 1);
    }
    Deck.widget("gw-lensing-vary", {
      steps: 0,
      enter: function (slide) {
        cv = slide.querySelector("#gw-lensing-vary-canvas");
        if (!labels) {
          var box = slide.querySelector("#gw-lensing-vary-labels");
          labels = [makeLabel(box, "Time"), makeLabel(box, "~Area", true),
                    makeLabel(box, "$w"), makeLabel(box, "$\\lvert F(w)\\rvert", true)];
          place(labels[0], (BOX_I[0] + BOX_I[2]) / 2, BOX_I[3] + 75, 1);
          place(labels[1], BOX_I[0] - 80, (BOX_I[1] + BOX_I[3]) / 2, 1);
          place(labels[2], (BOX_F[0] + BOX_F[2]) / 2, BOX_F[3] + 75, 1);
          place(labels[3], BOX_F[0] - 80, (BOX_F[1] + BOX_F[3]) / 2, 1);
        }
        t0 = performance.now();
        run = Runner(frame);
        run.start();
      },
      leave: function () { run.stop(); },
      step: function () {}
    });
  })();
})();
