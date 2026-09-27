// Black-hole merger from the prod_n24 NR run, drawn as a metaball field (schematic).
// Stage 0: the binary two orbits before merger. Stage 1: inspiral up to the common horizon,
// then pause.
// Stage 2: ringdown, played at half the stage-1 speed.
(function () {
  "use strict";

  var D = RINGDOWN_DATA;
  var T_START = 677.5;      // M; two orbits of the punctures before the common horizon
  var L = 7.0;              // half-width of the view, in M
  var SPEED_INSPIRAL = 60;  // M per second
  var SPEED_RINGDOWN = 30;  // M per second
  var CAP = 3.0;            // cap of each metaball term; removes the centre singularity

  var canvas = null, ctx = null, raf = null, curT = T_START;

  // Linear interpolation of every column at time t.
  function sample(t) {
    var u = Math.max(0, Math.min(D.tEnd, t)) / D.dt;
    var i = Math.min(Math.floor(u), D.x0.length - 2), f = u - i, s = {};
    ["x0", "y0", "x1", "y1", "R1", "R2", "acx", "acy", "A", "ph"].forEach(function (k) {
      s[k] = D[k][i] * (1 - f) + D[k][i + 1] * f;
    });
    return s;
  }

  // Field terms at time t; the region F >= 1 is drawn. Mirrors make_merger_gif_smooth.py.
  function model(t) {
    var s = sample(t);
    var w = Math.max(0, Math.min(1, (t - D.tFuse) / (D.tCommon + 10 - D.tFuse)));
    w = w * w * (3 - 2 * w);
    var m = {
      w: w, bh: [[s.x0, s.y0, s.R1], [s.x1, s.y1, s.R2]], rem: null
    };
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
  function boxes(m, sc, W) {
    var list = [];
    function add(x, y, r) {
      var c = W / 2, pad = 3;
      list.push([Math.floor(c + (x - r) * sc) - pad, Math.floor(c - (y + r) * sc) - pad,
                 Math.ceil(c + (x + r) * sc) + pad, Math.ceil(c - (y - r) * sc) + pad]);
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
      return [Math.max(0, b[0]), Math.max(0, b[1]), Math.min(W, b[2]), Math.min(W, b[3])];
    });
  }

  // Black where F >= 1, transparent elsewhere; the edge is anti-aliased from the field
  // gradient, so it stays sharp at any canvas resolution.
  function draw(t) {
    curT = t;
    var W = canvas.width, sc = W / (2 * L), m = model(t);
    ctx.clearRect(0, 0, W, W);
    boxes(m, sc, W).forEach(function (b) {
      var bw = b[2] - b[0], bh = b[3] - b[1];
      if (bw <= 0 || bh <= 0) return;
      var gw = bw + 2, F = new Float32Array(gw * (bh + 2));
      for (var j = 0; j < bh + 2; j++) {
        var Y = -(b[1] + j - 1 + 0.5 - W / 2) / sc;
        for (var i = 0; i < gw; i++) {
          F[j * gw + i] = field(m, (b[0] + i - 1 + 0.5 - W / 2) / sc, Y);
        }
      }
      var img = ctx.createImageData(bw, bh), p = img.data;
      for (j = 0; j < bh; j++) {
        for (i = 0; i < bw; i++) {
          var q = (j + 1) * gw + i + 1, f = F[q] - 1;
          var a;
          if (f > 2) a = 1;
          else if (f < -0.9) a = 0;
          else {
            var gx = 0.5 * (F[q + 1] - F[q - 1]), gy = 0.5 * (F[q + gw] - F[q - gw]);
            var g = Math.sqrt(gx * gx + gy * gy) + 1e-9;
            a = Math.max(0, Math.min(1, 0.5 + f / g));
          }
          p[4 * (j * bw + i) + 3] = Math.round(255 * a);  // RGB stay 0: black
        }
      }
      ctx.putImageData(img, b[0], b[1]);
    });
  }

  // Backing store matches the on-screen size in device pixels, so nothing is resampled.
  function resize() {
    var n = Math.max(200, Math.round(canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1)));
    if (canvas.width !== n) { canvas.width = n; canvas.height = n; }
    draw(curT);
  }

  function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }

  function play(t0, t1, speed) {
    var start = null;
    (function frame(now) {
      if (start === null) start = now;
      var t = Math.min(t1, t0 + speed * (now - start) / 1000);
      draw(t);
      raf = t < t1 ? requestAnimationFrame(frame) : null;
    })(performance.now());
  }

  Deck.widget("ringdown-merger", {
    steps: 2,
    enter: function (slide) {
      canvas = slide.querySelector("canvas");
      ctx = canvas.getContext("2d");
      window.addEventListener("resize", resize);
      resize();
    },
    leave: function () {
      stop();
      window.removeEventListener("resize", resize);
    },
    step: function (slide, k, dir) {
      stop();
      if (k === 0) draw(T_START);
      else if (k === 1) { if (dir > 0) play(T_START, D.tCommon, SPEED_INSPIRAL); else draw(D.tCommon); }
      else { if (dir > 0) play(D.tCommon, D.tEnd, SPEED_RINGDOWN); else draw(D.tEnd); }
    }
  });
})();
