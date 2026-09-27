// Ring of test masses deformed by the gravitational wave of a binary black hole.
// Stage 0: circular ring. Stage 1: two black holes appear left and right.
// Stage 2: ring stretched towards the holes, squeezed top and bottom.
// Stage 3: the holes orbit; the ring follows as for a circularly polarised wave.
(function () {
  "use strict";

  var CX = 960, CY = 540;   // slide centre, px
  var R0 = 300;             // ring radius, px
  var N = 24;               // number of test masses
  var DOT = 11;             // test-mass radius, px
  var D = 450;              // black-hole distance from the centre, px (orbit stays on the slide, outside the ring)
  var BH = 45;              // black-hole radius, px
  var EPS = 0.26;           // strain amplitude h shown on the ring
  var PERIOD = 4000;        // orbital period, ms
  var FADE = 700;           // black-hole fade-in, ms
  var GROW = 1200;          // strain growth at stage 2, ms

  // Test mass at angle th, displaced by dx_i = (1/2) h_ij x_j with
  // h_+ = h cos 2phi, h_x = h sin 2phi: an ellipse stretched along the axis at angle phi.
  function draw(ctx, bhAlpha, h, phi) {
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, 1920, 1080);
    var c2 = Math.cos(2 * phi), s2 = Math.sin(2 * phi);
    ctx.fillStyle = "#000";
    for (var k = 0; k < N; k++) {
      var th = 2 * Math.PI * k / N;
      var x = R0 * Math.cos(th), y = R0 * Math.sin(th);
      var px = x + 0.5 * h * (c2 * x + s2 * y);
      var py = y + 0.5 * h * (s2 * x - c2 * y);
      ctx.beginPath();
      ctx.arc(CX + px, CY - py, DOT, 0, 2 * Math.PI);
      ctx.fill();
    }
    if (bhAlpha > 0) {
      ctx.globalAlpha = bhAlpha;
      for (var j = 0; j < 2; j++) {
        var sgn = j === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.arc(CX + sgn * D * Math.cos(phi), CY - sgn * D * Math.sin(phi), BH, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function ease(f) { return f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f); }

  var raf = null;
  function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }

  // Runs frame(t) with t = ms since start until frame returns false.
  function animate(frame) {
    var t0 = performance.now();
    (function tick(now) {
      raf = frame(now - t0) ? requestAnimationFrame(tick) : null;
    })(t0);
  }

  Deck.widget("gw-ring-binary", {
    steps: 3,
    leave: stop,
    step: function (slide, k, dir) {
      stop();
      var ctx = slide.querySelector("canvas").getContext("2d");
      if (k === 0) {
        draw(ctx, 0, 0, 0);
      } else if (k === 1) {
        if (dir < 0) { draw(ctx, 1, 0, 0); return; }
        animate(function (t) {
          var f = Math.min(1, t / FADE);
          draw(ctx, f, 0, 0);
          return f < 1;
        });
      } else if (k === 2) {
        if (dir < 0) { draw(ctx, 1, EPS, 0); return; }
        animate(function (t) {
          var f = Math.min(1, t / GROW);
          draw(ctx, 1, EPS * ease(f), 0);
          return f < 1;
        });
      } else {
        // Counter-clockwise orbit from phi = 0, where stage 2 left the ring; runs until leave.
        animate(function (t) {
          draw(ctx, 1, EPS, 2 * Math.PI * t / PERIOD);
          return true;
        });
      }
    }
  });
})();
