// Black-hole merger from the prod_n24 NR run, drawn as a metaball field (schematic), and
// what the ringdown is made of. Three slides:
//
// ringdown-merger: left, the merger; right, a ring of test masses driven by the NR strain
//   h_22 at the same time, face-on (circular polarisation), in the style of the gw-ring part.
//   Stage 0: the binary before merger. Stage 1: inspiral up to the common horizon, then
//   pause. Stage 2: ringdown at half the stage-1 speed.
// ringdown-quad: the quadrupole picture. Left, a shorter inspiral, frozen at merger. Right,
//   at the same scale and height, "~ a symmetric l = m = 2 blob"; the left view fades while
//   the blob zooms; horizon; ringdown; light ring; EHT image; a decaying 220 waveform; below
//   it, the complex plane with the 220 and 221 frequencies.
// ringdown-sum: the full ringdown = 22 + 33 + 44 + ..., frozen at merger until a step
//   starts the ringdown; then the complex plane.
//
// All shapes are drawn soft: a black core out to CORE r, fading outside as
// exp(-((rho/r - CORE)/SOFT)^1.5): 0.78 at rho = r, 0.53 at 1.5 r, 0.33 at 2 r, 0.10 at 3 r.
// Each view's tail is tapered to zero at a radius Rt about its centre, so no canvas or
// slide edge cuts it. The remnant horizon is a dark ring of the animation's final radius
// R_final, the light ring a yellow dashed circle at LR R_final, labelled on ringdown-quad.
// The quadrupole pictures are schematic: blob r(phi) = R [1 + eps A cos(m (phi - angle))].
(function () {
  "use strict";

  var D = RINGDOWN_DATA;
  var T_START = 584;        // M; start of the inspiral on ringdown-merger (about 2.8 orbits before merger)
  var T_START_Q = 677.5;    // M; start of the inspiral on ringdown-quad (two orbits before merger)
  var T_RD_END = 830;       // M; end of the looped merger-to-ringdown animation
  var L = 7.0;              // half-width of the merger view, in M
  var SPEED_INSPIRAL = 60;  // M per second
  var SPEED_RINGDOWN = 30;  // M per second
  var HOLD = 600;           // ms held on the last frame before a loop restarts
  var CAP = 3.0;            // cap of each metaball term; removes the centre singularity
  var R0 = 300;             // ring radius, px of the 900 px ring canvas
  var N = 24;               // number of test masses
  var DOT = 11;             // test-mass radius, px
  var H = 0.26;             // strain shown at the peak of |h_22|
  var EPS = 0.35;           // quadrupole blob deformation at merger (as the merger view)
  var CORE = 0.4;           // radius of the solid core, in units of the local radius r
  var SOFT = 1.5;           // width of the soft fall-off, in units of r
  var DS = 3;               // soft layers: one sample per DS x DS backing pixels
  var LR_COLOR = "#e0a000"; // light ring
  var LR = 1.5;             // light-ring radius / horizon radius (schematic)
  var ZOOM = 1.6;           // zoom of the quadrupole view
  // Remnant of the run: M_f = 0.9555 M, a_f = 0.6870 (tasks/t04-ringdown/qnm_values.py).
  // QNM frequencies M_f omega at a_f = 0.6870 (qnm package 0.4.4).
  var MF = 0.9555;
  var QNM = {
    "220": [0.5270, -0.0813], "221": [0.5151, -0.2457],
    "330": [0.8353, -0.0834], "331": [0.8289, -0.2511],
    "440": [1.1314, -0.0848], "441": [1.1267, -0.2550]
  };

  // ---------------- data ----------------
  var COLS = ["x0", "y0", "x1", "y1", "R1", "R2", "acx", "acy", "A", "ph", "hA", "h2psi"];
  function sample(t) {
    var u = Math.max(0, Math.min(D.tEnd, t)) / D.dt;
    var i = Math.min(Math.floor(u), D.x0.length - 2), f = u - i, s = {};
    COLS.forEach(function (k) { s[k] = D[k][i] * (1 - f) + D[k][i + 1] * f; });
    return s;
  }

  // ---------------- canvases ----------------
  // Backing store = on-screen size in device pixels, so nothing is resampled. Returns the
  // factor from CSS px to backing px.
  function fit(c) {
    var r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var w = Math.max(50, Math.round(r.width * dpr)), h = Math.max(50, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return w / c.offsetWidth;
  }

  // ---------------- clips: time in M as a function of wall time ----------------
  // Plays from -> to at `speed` M/s; with loop, restarts after HOLD ms on the last frame.
  function clip(from, to, speed, loop, now) { return { from: from, to: to, speed: speed, loop: loop, t0: now }; }
  function still(t) { return { from: t, to: t, speed: 1, loop: false, t0: 0 }; }
  function tAt(c, now) {
    var e = now - c.t0, dur = (c.to - c.from) / c.speed * 1000;
    if (c.loop) e = e % (dur + HOLD);
    return Math.min(c.to, c.from + c.speed * Math.max(0, e) / 1000);
  }

  // Eased value: goes from `from` to `to` over [t0, t0 + dur].
  function P(v) { return { from: v, to: v, t0: 0, dur: 1 }; }
  function val(p, now) {
    var f = Math.max(0, Math.min(1, (now - p.t0) / p.dur));
    f = f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f);
    return p.from + (p.to - p.from) * f;
  }
  function set(p, target, now, instant, dur) {
    if (instant) { p.from = p.to = target; return; }
    if (p.to === target) return;
    p.from = val(p, now); p.to = target; p.t0 = now; p.dur = dur;
  }

  function fade(el, on, instant) {
    el.style.transition = instant ? "none" : "opacity 0.5s";
    el.style.opacity = on ? 1 : 0;
  }

  // ---------------- merger view (metaball field) ----------------
  function model(t) {
    var s = sample(t);
    var w = Math.max(0, Math.min(1, (t - D.tFuse) / (D.tCommon + 10 - D.tFuse)));
    w = w * w * (3 - 2 * w);
    var m = { w: w, bh: [[s.x0, s.y0, s.R1], [s.x1, s.y1, s.R2]], rem: null };
    if (w > 0) {
      var pcx = (D.m1 * s.x0 + D.m2 * s.x1) / (D.m1 + D.m2);
      var pcy = (D.m1 * s.y0 + D.m2 * s.y1) / (D.m1 + D.m2);
      m.rem = [(1 - w) * pcx + w * s.acx, (1 - w) * pcy + w * s.acy, D.Rfinal, D.eps * s.A, s.ph];
    }
    return m;
  }

  function field(m, X, Y) {
    var Fb = 0;
    for (var k = 0; k < 2; k++) {
      var b = m.bh[k], dx = X - b[0], dy = Y - b[1];
      Fb += Math.min(b[2] * b[2] / (dx * dx + dy * dy + 1e-12), CAP);
    }
    if (!m.rem) return Fb;
    var r = m.rem, ex = X - r[0], ey = Y - r[1];
    var rr = r[2] * (1 + r[3] * Math.cos(2 * Math.atan2(ey, ex) + r[4]));
    return (1 - m.w) * Fb + m.w * Math.min(rr * rr / (ex * ex + ey * ey + 1e-12), CAP);
  }

  // Soft opacity from q = rho / r: 1 in the core, then exp(-u^1.5), u = (q - CORE) / SOFT.
  var SOFT_UMAX = 3.3;      // u where the opacity is below 0.3%; cut off there
  function softA(q) {
    if (q <= CORE) return 1;
    var u = (q - CORE) / SOFT;
    return u > SOFT_UMAX ? 0 : Math.exp(-Math.pow(u, 1.5));
  }

  // Soft layer: opacity alphaAt(x, y) (CSS px, y down) of black, evaluated at 1/DS of the
  // backing resolution and scaled up with smoothing (the picture has no hard edges).
  // Optional box [x0, y0, x1, y1] (CSS px): alphaAt is 0 outside it and is not called there.
  function renderSoft(c, alphaAt, box) {
    var k = fit(c), W = c.width, H2 = c.height, w = Math.ceil(W / DS), h = Math.ceil(H2 / DS);
    var i0 = 0, j0 = 0, i1 = w, j1 = h;
    if (box) {
      i0 = Math.max(0, Math.floor(box[0] * k / DS)); j0 = Math.max(0, Math.floor(box[1] * k / DS));
      i1 = Math.min(w, Math.ceil(box[2] * k / DS)); j1 = Math.min(h, Math.ceil(box[3] * k / DS));
    }
    var ctx = c.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H2);
    var bw = i1 - i0, bh = j1 - j0;
    if (bw > 0 && bh > 0) {
      // Offscreen layer covering only the box, one pixel per DS x DS backing pixels.
      var o = c.ringdownSoft;
      if (!o || o.width !== bw || o.height !== bh) {
        o = c.ringdownSoft = document.createElement("canvas");
        o.width = bw; o.height = bh;
      }
      var octx = o.getContext("2d"), img = octx.createImageData(bw, bh), p = img.data;
      for (var j = j0; j < j1; j++) {
        var y = (j + 0.5) * DS / k;
        for (var i = i0; i < i1; i++) {
          var a = alphaAt((i + 0.5) * DS / k, y);
          if (a > 0) p[4 * ((j - j0) * bw + i - i0) + 3] = Math.round(255 * a);
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(o, DS * i0, DS * j0, DS * bw, DS * bh);
    }
    ctx.setTransform(k, 0, 0, k, 0, 0);
    return ctx;
  }

  // Opacity factor that takes a tail to zero between 0.75 Rt and Rt from a view's centre.
  function taper(rho, Rt) {
    var u = (rho - 0.75 * Rt) / (0.25 * Rt);
    return u <= 0 ? 1 : u >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * u));
  }

  // Merger view on canvas c: the field about the point (ox, oy) (M) at the canvas centre,
  // sc CSS px per M, drawn with opacity softA(F^(-1/2)), tapered at Rt (CSS px) from the
  // centre. Redraws only when t or the size changes.
  function SoftMergerView(c, sc, ox, oy, Rt) {
    var last = null;
    return {
      draw: function (t) {
        fit(c);
        var key = t + ":" + c.width;
        if (key === last) return;
        last = key;
        var m = model(t), cw = c.offsetWidth, ch = c.offsetHeight;
        renderSoft(c, function (x, y) {
          var dx = x - cw / 2, dy = y - ch / 2, w = taper(Math.sqrt(dx * dx + dy * dy), Rt);
          if (w <= 0) return 0;
          var F = field(m, ox + dx / sc, oy - dy / sc);
          return F < 0.03 ? 0 : w * softA(1 / Math.sqrt(F));
        }, [cw / 2 - Rt, ch / 2 - Rt, cw / 2 + Rt, ch / 2 + Rt]);
      }
    };
  }

  // ---------------- quadrupole blob, horizon, light ring ----------------
  // Soft blob on canvas c about (cx, cy) (CSS px, y down), core radius
  // r(phi) = R [1 + e cos(m (phi - ang))], phi counter-clockwise on screen, opacity scaled by
  // `op`; then the horizon (a dark ring of radius R with a thin white halo, so it shows on
  // black and on white) with opacity hor, and the light ring (yellow dashed circle at LR R)
  // with opacity lr, labelled "light ring" along its top if `label`. The blob's tail is
  // tapered at Rt (CSS px) from (cx, cy).
  function hole(c, cx, cy, R, m, e, ang, op, hor, lr, Rt, label) {
    var rmax = Math.min(Rt, R * (1 + Math.abs(e)) * (CORE + SOFT_UMAX * SOFT));
    var ctx = renderSoft(c, function (x, y) {
      var dx = x - cx, dy = cy - y, rho = Math.sqrt(dx * dx + dy * dy);
      if (rho > rmax) return 0;
      var r = R * (1 + e * Math.cos(m * (Math.atan2(dy, dx) - ang)));
      return op * taper(rho, Rt) * softA(rho / r);
    }, [cx - rmax, cy - rmax, cx + rmax, cy + rmax]);
    if (hor > 0) {
      ctx.globalAlpha = hor;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      ctx.lineWidth = 9; ctx.strokeStyle = "#fff"; ctx.stroke();
      ctx.lineWidth = 5; ctx.strokeStyle = "#000"; ctx.stroke();
    }
    if (lr > 0) {
      ctx.globalAlpha = lr;
      ctx.beginPath(); ctx.arc(cx, cy, LR * R, 0, 2 * Math.PI);
      ctx.setLineDash([16, 12]); ctx.lineWidth = 6; ctx.strokeStyle = LR_COLOR; ctx.stroke();
      ctx.setLineDash([]);
      if (label) arcText(ctx, "light ring", cx, cy, LR * R + 14);
    }
    ctx.globalAlpha = 1;
  }

  // Text centred on the top of the circle of radius rad about (cx, cy), each letter upright
  // to the circle, baseline on the circle, in the light-ring colour.
  function arcText(ctx, text, cx, cy, rad) {
    ctx.font = "40px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    var widths = text.split("").map(function (ch) { return ctx.measureText(ch).width; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) / rad;
    var a = -Math.PI / 2 - total / 2;
    text.split("").forEach(function (ch, i) {
      var da = widths[i] / rad, th = a + da / 2;
      ctx.save();
      ctx.translate(cx + rad * Math.cos(th), cy + rad * Math.sin(th));
      ctx.rotate(th + Math.PI / 2);
      ctx.fillStyle = LR_COLOR; ctx.fillText(ch, 0, 0);
      ctx.restore();
      a += da;
    });
  }

  // l = m = 2 blob of the NR remnant at time t: amplitude and phase of psi4_22, as in the
  // merger view (long axis at angle -ph/2, counter-clockwise).
  function quadNR(t) {
    var s = sample(t);
    return { e: EPS * Math.min(1, s.A), ang: -s.ph / 2 };
  }

  // l = m blob from its fundamental QNM, for t >= tCommon: turns at omega_R / m, decays at omega_I.
  function quadQNM(m, t, ang0) {
    var w = QNM[m + "" + m + "0"], u = Math.max(0, t - D.tCommon) / MF;
    return { e: Math.exp(w[1] * u), ang: ang0 + w[0] * u / m };
  }

  // ---------------- complex plane ----------------
  // In the style of the qnm-fit part: axes box with numbered ticks, x = M_f omega_r,
  // y = -M_f omega_i, Kerr frequencies as crosses labelled omega_lmn. Fills the box element.
  function Plane(box, xr, yr, xticks, yticks, modes) {
    var c = document.createElement("canvas");
    box.appendChild(c);
    var W = box.offsetWidth, Hh = box.offsetHeight, L0 = 110, R1 = W - 20, T0 = 25, B0 = Hh - 60;
    function X(x) { return L0 + (x - xr[0]) / (xr[1] - xr[0]) * (R1 - L0); }
    function Y(y) { return B0 - (y - yr[0]) / (yr[1] - yr[0]) * (B0 - T0); }
    function label(tex, x, y, cls) {
      var d = document.createElement("div");
      d.className = cls;
      d.style.left = x + "px"; d.style.top = y + "px";
      katex.render(tex, d);
      box.appendChild(d);
      return d;
    }
    label("M_f\\, \\omega_r", (L0 + R1) / 2, Hh + 45, "ringdown-plane-label");
    label("-M_f\\, \\omega_i", -45, (T0 + B0) / 2, "ringdown-plane-label ringdown-plane-ylabel");
    var tags = {};
    modes.forEach(function (k) {
      var w = QNM[k];
      tags[k] = label("\\omega_{" + k + "}", X(w[0]) + 14, Y(-w[1]) - 58, "ringdown-plane-q");
      tags[k].style.transition = "opacity 0.5s";
    });
    return {
      shown: {},
      draw: function () {
        var k = fit(c), ctx = c.getContext("2d"), shown = this.shown;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.clearRect(0, 0, W, Hh);
        ctx.strokeStyle = "#000"; ctx.fillStyle = "#000"; ctx.lineWidth = 2;
        ctx.strokeRect(L0, T0, R1 - L0, B0 - T0);
        ctx.font = "30px Arial";
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        xticks.forEach(function (x) {
          ctx.beginPath(); ctx.moveTo(X(x), B0); ctx.lineTo(X(x), B0 - 12); ctx.stroke();
          ctx.fillText(x.toFixed(1), X(x), B0 + 10);
        });
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        yticks.forEach(function (y) {
          ctx.beginPath(); ctx.moveTo(L0, Y(y)); ctx.lineTo(L0 + 12, Y(y)); ctx.stroke();
          ctx.fillText(y.toFixed(2), L0 - 10, Y(y));
        });
        modes.forEach(function (m) {
          tags[m].style.opacity = shown[m] ? 1 : 0;
          if (shown[m]) cross(ctx, X(QNM[m][0]), Y(-QNM[m][1]));
        });
      }
    };
  }
  function cross(p, x, y) {
    var a = 14;
    [["#fff", 9], ["#000", 4]].forEach(function (st) {
      p.strokeStyle = st[0]; p.lineWidth = st[1];
      p.beginPath();
      p.moveTo(x - a, y - a); p.lineTo(x + a, y + a);
      p.moveTo(x - a, y + a); p.lineTo(x + a, y - a);
      p.stroke();
    });
  }
  // Waveform panel, in the same style: Re of A e^{-i omega t} for one QNM (A = 1, t from 0,
  // in units of M_f), labelled h = A e^{-i omega t}. Drawn once; fills the box element.
  function Wave(box, mode, tmax, xticks) {
    var c = document.createElement("canvas");
    box.appendChild(c);
    var W = box.offsetWidth, Hh = box.offsetHeight, L0 = 110, R1 = W - 20, T0 = 10, B0 = Hh - 60;
    var w = QNM[mode], yr = [-1.15, 1.15];
    function X(t) { return L0 + t / tmax * (R1 - L0); }
    function Y(y) { return B0 - (y - yr[0]) / (yr[1] - yr[0]) * (B0 - T0); }
    function label(tex, x, y, cls) {
      var d = document.createElement("div");
      d.className = cls;
      d.style.left = x + "px"; d.style.top = y + "px";
      katex.render(tex, d);
      box.appendChild(d);
    }
    label("t / M_f", (L0 + R1) / 2, Hh + 45, "ringdown-plane-label");
    label("h", 45, (T0 + B0) / 2, "ringdown-plane-label");
    label("h = A\\, e^{-i\\omega t}", R1 - 40, T0 + 55, "ringdown-plane-label ringdown-wave-eq");
    return {
      draw: function () {
        var k = fit(c), ctx = c.getContext("2d");
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.clearRect(0, 0, W, Hh);
        ctx.strokeStyle = "#000"; ctx.fillStyle = "#000"; ctx.lineWidth = 2;
        ctx.strokeRect(L0, T0, R1 - L0, B0 - T0);
        ctx.font = "30px Arial";
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        xticks.forEach(function (x) {
          ctx.beginPath(); ctx.moveTo(X(x), B0); ctx.lineTo(X(x), B0 - 12); ctx.stroke();
          ctx.fillText(String(x), X(x), B0 + 10);
        });
        ctx.save();
        ctx.beginPath(); ctx.rect(L0, T0, R1 - L0, B0 - T0); ctx.clip();
        ctx.lineWidth = 4; ctx.beginPath();
        for (var i = 0; i <= 600; i++) {
          var t = tmax * i / 600, y = Math.exp(w[1] * t) * Math.cos(w[0] * t);
          if (i === 0) ctx.moveTo(X(t), Y(y)); else ctx.lineTo(X(t), Y(y));
        }
        ctx.stroke();
        ctx.restore();
      }
    };
  }
  function range(a, b, d) { var r = []; for (var x = a; x <= b + 1e-9; x += d) r.push(+x.toFixed(6)); return r; }

  // One requestAnimationFrame loop per slide, running while the slide is shown.
  function Runner(frame) {
    var raf = null;
    function tick(now) { frame(now); raf = requestAnimationFrame(tick); }
    return {
      start: function () { if (!raf) raf = requestAnimationFrame(tick); },
      stop: function () { if (raf) cancelAnimationFrame(raf); raf = null; }
    };
  }

  // ======================= slide 1: merger and ring =======================
  (function () {
    var view, rcanvas, run, left = still(T_START);

    // Mass at angle th moves by dx_i = (1/2) h_ij x_j, h_+ = h cos 2psi, h_x = h sin 2psi.
    function drawRing(t) {
      var k = fit(rcanvas), ctx = rcanvas.getContext("2d"), s = sample(t);
      var h = H * s.hA, hp = h * Math.cos(s.h2psi), hx = h * Math.sin(s.h2psi);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.clearRect(0, 0, 900, 900);
      ctx.fillStyle = "#000";
      for (var i = 0; i < N; i++) {
        var th = 2 * Math.PI * i / N, x = R0 * Math.cos(th), y = R0 * Math.sin(th);
        ctx.beginPath();
        ctx.arc(450 + x + 0.5 * (hp * x + hx * y), 450 - (y + 0.5 * (hx * x - hp * y)), DOT, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    Deck.widget("ringdown-merger", {
      steps: 2,
      enter: function (slide) {
        view = SoftMergerView(slide.querySelector("#ringdown-canvas"), 900 / (2 * L), 0, 0, 470);
        rcanvas = slide.querySelector("#ringdown-ring");
        run = Runner(function (now) {
          var t = tAt(left, now);
          view.draw(t);
          drawRing(t);
        });
        run.start();
      },
      leave: function () { run.stop(); },
      step: function (slide, k, dir) {
        var now = performance.now();
        if (k === 0) left = still(T_START);
        else if (k === 1) left = dir > 0 ? clip(T_START, D.tCommon, SPEED_INSPIRAL, false, now) : still(D.tCommon);
        else left = dir > 0 ? clip(D.tCommon, D.tEnd, SPEED_RINGDOWN, false, now) : still(D.tEnd);
      }
    });
  })();

  // ======================= slide 2: the quadrupole picture =======================
  // Stages: 0 binary; 1 inspiral to merger (left, frozen after); 2 "~", symmetric 22 blob and
  // "lm = 22" on the right; 3 left view and "~" fade, zoom; 4 horizon; 5 ringdown (once); 6 back to merger;
  // 7 light ring; 8 ringdown, looping from here on; 9 EHT image in place of the left view;
  // 10 EHT gone, waveform of the 220 QNM on the left; 11 complex plane with 220 below it;
  // 12 221 added.
  (function () {
    var view, rc, lm, approx, eht, planeBox, plane = null, waveBox, wave = null, run, leftCanvas;
    var left = still(T_START_Q), right = still(D.tCommon);
    var par = { blob: P(0), zoom: P(1), hor: P(0), lr: P(0) };

    function drawRight(now) {
      // Same scale as the left view (900 px for 2L); centre at slide (1440, 540), the same
      // height as the left one. The canvas covers the slide, so the fade is never cut.
      var q = quadNR(tAt(right, now)), R = D.Rfinal * (900 / (2 * L)) * val(par.zoom, now);
      hole(rc, 1440, 540, R, 2, q.e, q.ang, val(par.blob, now), val(par.hor, now), val(par.lr, now), 470, true);
    }

    Deck.widget("ringdown-quad", {
      steps: 12,
      enter: function (slide) {
        leftCanvas = slide.querySelector("#ringdown-quad-left");
        view = SoftMergerView(leftCanvas, 900 / (2 * L), 0, 0, 470);
        rc = slide.querySelector("#ringdown-quad-right");
        lm = slide.querySelector("#ringdown-quad-lm");
        approx = slide.querySelector("#ringdown-quad-approx");
        eht = slide.querySelector("#ringdown-eht");
        planeBox = slide.querySelector("#ringdown-quad-plane");
        waveBox = slide.querySelector("#ringdown-quad-wave");
        if (!plane) plane = Plane(planeBox, [0.38, 0.8], [0.04, 0.36], range(0.4, 0.8, 0.1), range(0.05, 0.35, 0.05), ["220", "221"]);
        if (!wave) wave = Wave(waveBox, "220", 40, range(0, 40, 10));
        run = Runner(function (now) {
          view.draw(tAt(left, now));
          drawRight(now);
          wave.draw();
          plane.draw();
        });
        run.start();
      },
      leave: function () { run.stop(); },
      step: function (slide, k, dir) {
        var now = performance.now(), fwd = dir > 0, inst = !fwd;
        // left: inspiral, then frozen at merger; fades at the zoom step; the EHT image and
        // the plane later take its place
        if (k === 0) left = still(T_START_Q);
        else if (k === 1 && fwd) left = clip(T_START_Q, D.tCommon, SPEED_INSPIRAL, false, now);
        else left = still(D.tCommon);
        fade(leftCanvas, k < 3, inst);
        fade(approx, k === 2, inst);
        // right: the quadrupole blob
        set(par.blob, k >= 2 ? 1 : 0, now, inst || k < 2, 500);
        set(par.zoom, k >= 3 ? ZOOM : 1, now, inst || k !== 3, 900);
        set(par.hor, k >= 4 ? 1 : 0, now, inst || k !== 4, 600);
        set(par.lr, k >= 7 ? 1 : 0, now, inst || k !== 7, 600);
        if (k === 5) right = fwd ? clip(D.tCommon, T_RD_END, SPEED_RINGDOWN, false, now) : still(T_RD_END);
        else if (k >= 8) right = clip(D.tCommon, T_RD_END, SPEED_RINGDOWN, true, now);
        else right = still(D.tCommon);
        fade(lm, k >= 2, inst);
        fade(eht, k === 9, inst);
        fade(waveBox, k >= 10, inst);
        fade(planeBox, k >= 11, inst);
        plane.shown = { "220": k >= 11, "221": k >= 12 };
      }
    });
  })();

  // ======================= slide 3: the sum of modes =======================
  // Stage 0: the NR remnant, frozen at merger. Stage 1: "= 22 + 33 + 44 + ...", blobs only,
  // still frozen. Stage 2: horizons and light rings on the blobs. Stage 3: the
  // merger-to-ringdown loop starts, each l = m blob turning and decaying at its own QNM
  // frequency, in step with it. Stage 4: the complex plane with 220, 221, 330, 331, 440, 441.
  (function () {
    var view, modes, terms, planeBox, plane = null, run, loop, ov = P(0);
    var MODE_EPS = { 2: EPS, 3: 0.3, 4: 0.25 };

    Deck.widget("ringdown-sum", {
      steps: 4,
      enter: function (slide) {
        var s = sample(D.tCommon + 50);
        view = SoftMergerView(slide.querySelector("#ringdown-sum-full"), 400 / 11, s.acx, s.acy, 255);
        modes = [2, 3, 4].map(function (m) { return [m, slide.querySelector("#ringdown-sum-" + m + m)]; });
        terms = slide.querySelector("#ringdown-sum-terms");
        planeBox = slide.querySelector("#ringdown-sum-plane");
        if (!plane) plane = Plane(planeBox, [0.38, 1.22], [0.04, 0.36], range(0.4, 1.2, 0.2), range(0.05, 0.35, 0.05),
                                  ["220", "221", "330", "331", "440", "441"]);
        loop = still(D.tCommon);
        var ang0 = quadNR(D.tCommon).ang;
        run = Runner(function (now) {
          var t = tAt(loop, now);
          view.draw(t);
          modes.forEach(function (mc) {
            var m = mc[0], q = quadQNM(m, t, ang0);
            var o = val(ov, now);
            hole(mc[1], 300, 300, 52, m, MODE_EPS[m] * q.e, q.ang, 1, o, o, 185, false);
          });
          plane.draw();
        });
        run.start();
      },
      leave: function () { run.stop(); },
      step: function (slide, k, dir) {
        var inst = dir < 0, on = k >= 4;
        set(ov, k >= 2 ? 1 : 0, performance.now(), inst || k !== 2, 500);
        if (k < 3) loop = still(D.tCommon);
        else if (!loop.loop) loop = clip(D.tCommon, T_RD_END, SPEED_RINGDOWN, true, performance.now());
        fade(terms, k >= 1, inst);
        fade(planeBox, on, inst);
        plane.shown = { "220": on, "221": on, "330": on, "331": on, "440": on, "441": on };
      }
    });
  })();
})();
