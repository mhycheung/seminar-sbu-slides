// Black-hole merger from the prod_n24 NR run, drawn as a metaball field (schematic), and
// what the ringdown is made of. Three slides:
//
// ringdown-merger: left, the merger; right, a ring of test masses driven by the NR strain
//   h_22 at the same time, face-on (circular polarisation), in the style of the gw-ring part.
//   Stage 0: the binary before merger. Stage 1: inspiral up to the common horizon, then
//   pause. Stage 2: ringdown at half the stage-1 speed.
// ringdown-quad: the quadrupole picture. Left, the same inspiral, frozen at merger. Right,
//   a symmetric l = m = 2 blob; zoom; horizon; ringdown; light ring; EHT image; complex
//   plane with the 220 and 221 frequencies.
// ringdown-sum: the full ringdown = 22 + 33 + 44 + ..., with the complex plane.
//
// The quadrupole pictures are schematic: blob r(phi) = R [1 + eps A cos(m (phi - angle))].
(function () {
  "use strict";

  var D = RINGDOWN_DATA;
  var T_START = 584;        // M; start of the inspiral, about 2.8 orbits before the common horizon
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
  var HOR = 0.6;            // horizon radius / blob mean radius (schematic)
  var ZOOM = 2.2;           // zoom of the quadrupole view
  var GREY = "#a6a6a6";     // blob colour once the horizon is drawn over it
  var MF = 0.95;            // remnant mass in units of the initial total mass (schematic)
  // QNM frequencies M_f omega for a_f = 0.69 (qnm package 0.4.4; see the task log).
  var QNM = {
    "220": [0.5282, -0.0812], "221": [0.5165, -0.2454],
    "330": [0.8372, -0.0833], "331": [0.8308, -0.2508],
    "440": [1.1339, -0.0847], "441": [1.1293, -0.2546]
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

  // Pixel boxes that contain the region F >= 1: one per body, merged when they overlap.
  function boxes(m, sc, W, H2, ox, oy) {
    var list = [];
    function add(x, y, r) {
      var pad = 3;
      list.push([Math.floor(W / 2 + (x - ox - r) * sc) - pad, Math.floor(H2 / 2 - (y - oy + r) * sc) - pad,
                 Math.ceil(W / 2 + (x - ox + r) * sc) + pad, Math.ceil(H2 / 2 - (y - oy - r) * sc) + pad]);
    }
    m.bh.forEach(function (b) { add(b[0], b[1], 1.8 * b[2]); });
    if (m.rem) add(m.rem[0], m.rem[1], 1.8 * m.rem[2] * (1 + m.rem[3]));
    var merged = true;
    while (merged) {
      merged = false;
      for (var i = 0; i < list.length && !merged; i++) {
        for (var j = i + 1; j < list.length && !merged; j++) {
          var a = list[i], b = list[j];
          if (a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]) {
            list[i] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
            list.splice(j, 1);
            merged = true;
          }
        }
      }
    }
    return list.map(function (b) {
      return [Math.max(0, b[0]), Math.max(0, b[1]), Math.min(W, b[2]), Math.min(H2, b[3])];
    });
  }

  // A merger view on canvas c: half-width `half` (M) about the point (ox, oy) (M).
  // Black where F >= 1, transparent elsewhere; the edge is anti-aliased from the field
  // gradient, so it stays sharp at any resolution. Redraws only when t or the size changes.
  function MergerView(c, half, ox, oy) {
    var ctx = c.getContext("2d"), last = null;
    return {
      draw: function (t) {
        fit(c);
        var W = c.width, H2 = c.height, key = t + ":" + W;
        if (key === last) return;
        last = key;
        var sc = W / (2 * half), m = model(t);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H2);
        boxes(m, sc, W, H2, ox, oy).forEach(function (b) {
          var bw = b[2] - b[0], bh = b[3] - b[1];
          if (bw <= 0 || bh <= 0) return;
          var gw = bw + 2, F = new Float32Array(gw * (bh + 2)), i, j;
          for (j = 0; j < bh + 2; j++) {
            var Y = oy - (b[1] + j - 1 + 0.5 - H2 / 2) / sc;
            for (i = 0; i < gw; i++) F[j * gw + i] = field(m, ox + (b[0] + i - 1 + 0.5 - W / 2) / sc, Y);
          }
          var img = ctx.createImageData(bw, bh), p = img.data;
          for (j = 0; j < bh; j++) {
            for (i = 0; i < bw; i++) {
              var q = (j + 1) * gw + i + 1, f = F[q] - 1, a;
              if (f > 2) a = 1;
              else if (f < -0.9) a = 0;
              else {
                var gx = 0.5 * (F[q + 1] - F[q - 1]), gy = 0.5 * (F[q + gw] - F[q - gw]);
                a = Math.max(0, Math.min(1, 0.5 + f / (Math.sqrt(gx * gx + gy * gy) + 1e-9)));
              }
              p[4 * (j * bw + i) + 3] = Math.round(255 * a);  // RGB stay 0: black
            }
          }
          ctx.putImageData(img, b[0], b[1]);
        });
      }
    };
  }

  // ---------------- quadrupole blob, horizon, light ring ----------------
  // Blob about (cx, cy) (CSS px, y down) of mean radius R: r(phi) = R [1 + e cos(m (phi - ang))],
  // phi counter-clockwise on screen.
  function blob(ctx, cx, cy, R, m, e, ang, colour) {
    ctx.beginPath();
    for (var i = 0; i <= 360; i++) {
      var p = 2 * Math.PI * i / 360, r = R * (1 + e * Math.cos(m * (p - ang)));
      if (i === 0) ctx.moveTo(cx + r * Math.cos(p), cy - r * Math.sin(p));
      else ctx.lineTo(cx + r * Math.cos(p), cy - r * Math.sin(p));
    }
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
  }

  // Blob (black, turning grey as the horizon appears), the horizon (black disc) with
  // opacity hor, and the light ring (dashed circle at the blob's mean radius) with opacity lr.
  function hole(ctx, cx, cy, R, m, e, ang, hor, lr) {
    var g = Math.round(parseInt(GREY.slice(1, 3), 16) * hor);
    blob(ctx, cx, cy, R, m, e, ang, "rgb(" + g + "," + g + "," + g + ")");
    var a0 = ctx.globalAlpha;
    if (hor > 0) {
      ctx.globalAlpha = a0 * hor;
      ctx.beginPath(); ctx.arc(cx, cy, HOR * R, 0, 2 * Math.PI);
      ctx.fillStyle = "#000"; ctx.fill();
    }
    if (lr > 0) {
      ctx.globalAlpha = a0 * lr;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      ctx.setLineDash([16, 12]); ctx.lineWidth = 4; ctx.strokeStyle = "#000"; ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = a0;
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
  // Axes in the box element (CSS px), x = omega_R in [0, xmax], y = -omega_I in [0, ymax].
  function Plane(box, xmax, ymax, modes) {
    var c = document.createElement("canvas");
    box.appendChild(c);
    var W = box.offsetWidth, Hh = box.offsetHeight, ml = 80, mb = 70, mt = 40, mr = 90;
    function X(x) { return ml + (W - ml - mr) * x / xmax; }
    function Y(y) { return Hh - mb - (Hh - mb - mt) * y / ymax; }
    function label(tex, x, y) {
      var d = document.createElement("div");
      d.className = "ringdown-plane-label";
      d.style.left = x + "px"; d.style.top = y + "px";
      katex.render(tex, d);
      box.appendChild(d);
      return d;
    }
    label("\\omega_R", W - mr + 45, Y(0));
    label("-\\omega_I", X(0), mt - 10);
    var tags = {};
    modes.forEach(function (k) {
      var w = QNM[k];
      tags[k] = label(k, X(w[0]) + 52, Y(-w[1]) - 4);
      tags[k].style.transition = "opacity 0.5s";
    });
    return {
      shown: {},
      draw: function () {
        var k = fit(c), ctx = c.getContext("2d"), shown = this.shown;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.clearRect(0, 0, W, Hh);
        ctx.strokeStyle = "#000"; ctx.fillStyle = "#000"; ctx.lineWidth = 3;
        arrow(ctx, X(0), Y(0), W - mr + 10, Y(0));
        arrow(ctx, X(0), Y(0), X(0), mt + 20);
        modes.forEach(function (m) {
          tags[m].style.opacity = shown[m] ? 1 : 0;
          if (!shown[m]) return;
          var w = QNM[m];
          ctx.beginPath(); ctx.arc(X(w[0]), Y(-w[1]), 12, 0, 2 * Math.PI); ctx.fill();
        });
      }
    };
  }
  function arrow(ctx, x0, y0, x1, y1) {
    var a = Math.atan2(y1 - y0, x1 - x0), s = 18, c = Math.cos(a), n = Math.sin(a);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - 0.8 * s * c, y1 - 0.8 * s * n); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - s * c + 0.45 * s * n, y1 - s * n - 0.45 * s * c);
    ctx.lineTo(x1 - s * c - 0.45 * s * n, y1 - s * n + 0.45 * s * c);
    ctx.closePath(); ctx.fill();
  }

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
        view = MergerView(slide.querySelector("#ringdown-canvas"), L, 0, 0);
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
  // Stages: 0 binary; 1 inspiral to merger (left, frozen after); 2 symmetric 22 blob and
  // "lm = 22" on the right; 3 zoom; 4 horizon; 5 ringdown (once); 6 back to merger;
  // 7 light ring; 8 ringdown, looping from here on; 9 EHT image in place of the left view;
  // 10 complex plane with 220; 11 221 added.
  (function () {
    var view, rc, lm, eht, planeBox, plane = null, run, leftCanvas;
    var left = still(T_START), right = still(D.tCommon);
    var par = { blob: P(0), zoom: P(1), hor: P(0), lr: P(0) };

    function drawRight(now) {
      var k = fit(rc), ctx = rc.getContext("2d");
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.clearRect(0, 0, 900, 900);
      var b = val(par.blob, now);
      if (b <= 0) return;
      var q = quadNR(tAt(right, now)), R = D.Rfinal * (900 / (2 * L)) * val(par.zoom, now);
      ctx.globalAlpha = b;
      hole(ctx, 450, 450, R, 2, q.e, q.ang, val(par.hor, now), val(par.lr, now));
      ctx.globalAlpha = 1;
    }

    Deck.widget("ringdown-quad", {
      steps: 11,
      enter: function (slide) {
        leftCanvas = slide.querySelector("#ringdown-quad-left");
        view = MergerView(leftCanvas, L, 0, 0);
        rc = slide.querySelector("#ringdown-quad-right");
        lm = slide.querySelector("#ringdown-quad-lm");
        eht = slide.querySelector("#ringdown-eht");
        planeBox = slide.querySelector("#ringdown-quad-plane");
        if (!plane) plane = Plane(planeBox, 0.7, 0.3, ["220", "221"]);
        run = Runner(function (now) {
          view.draw(tAt(left, now));
          drawRight(now);
          plane.draw();
        });
        run.start();
      },
      leave: function () { run.stop(); },
      step: function (slide, k, dir) {
        var now = performance.now(), fwd = dir > 0, inst = !fwd;
        // left: inspiral, then frozen at merger; replaced by the EHT image and the plane
        if (k === 0) left = still(T_START);
        else if (k === 1 && fwd) left = clip(T_START, D.tCommon, SPEED_INSPIRAL, false, now);
        else left = still(D.tCommon);
        fade(leftCanvas, k < 9, inst);
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
        fade(planeBox, k >= 10, inst);
        plane.shown = { "220": k >= 10, "221": k >= 11 };
      }
    });
  })();

  // ======================= slide 3: the sum of modes =======================
  // Stage 0: the NR merger-to-ringdown view, looping. Stage 1: "= 22 + 33 + 44 + ...",
  // each l = m blob turning and decaying at its own QNM frequency, in step with the loop.
  // Stage 2: the complex plane with 220, 221, 330, 331, 440, 441.
  (function () {
    var view, modes, terms, planeBox, plane = null, run, loop;
    var MODE_EPS = { 2: EPS, 3: 0.22, 4: 0.16 };

    Deck.widget("ringdown-sum", {
      steps: 2,
      enter: function (slide) {
        var s = sample(D.tCommon + 50);
        view = MergerView(slide.querySelector("#ringdown-sum-full"), 3.4, s.acx, s.acy);
        modes = [2, 3, 4].map(function (m) { return [m, slide.querySelector("#ringdown-sum-" + m + m)]; });
        terms = slide.querySelector("#ringdown-sum-terms");
        planeBox = slide.querySelector("#ringdown-sum-plane");
        if (!plane) plane = Plane(planeBox, 1.25, 0.3, ["220", "221", "330", "331", "440", "441"]);
        loop = clip(D.tCommon, T_RD_END, SPEED_RINGDOWN, true, performance.now());
        var ang0 = quadNR(D.tCommon).ang;
        run = Runner(function (now) {
          var t = tAt(loop, now);
          view.draw(t);
          modes.forEach(function (mc) {
            var m = mc[0], c = mc[1], k = fit(c), ctx = c.getContext("2d");
            var q = quadQNM(m, t, ang0);
            ctx.setTransform(k, 0, 0, k, 0, 0);
            ctx.clearRect(0, 0, 300, 300);
            hole(ctx, 150, 150, 95, m, MODE_EPS[m] * q.e, q.ang, 1, 1);
          });
          plane.draw();
        });
        run.start();
      },
      leave: function () { run.stop(); },
      step: function (slide, k, dir) {
        var inst = dir < 0, on = k >= 2;
        fade(terms, k >= 1, inst);
        fade(planeBox, on, inst);
        plane.shown = { "220": on, "221": on, "330": on, "331": on, "440": on, "441": on };
      }
    });
  })();
})();
