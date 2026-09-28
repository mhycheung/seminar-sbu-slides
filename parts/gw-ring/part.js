// Ring of test masses deformed by the gravitational wave of a binary black hole.
// Stage 0: circular ring. Stage 1: two black holes appear left and right.
// Stage 2: ring stretched towards the holes, squeezed top and bottom.
// Stage 3: the holes orbit (speeding up to the final rate); the ring follows as for a
//          circularly polarised wave.
// Stage 4: the view turns to 3D: the orbital plane moves to the left, seen from the side,
//          and its ring fades out.
// Stage 5: a ring in a plane in front of the binary, along the orbital axis, with a delay.
// Stage 6: a second ring, further out, with twice the delay.
// Stage 7: five more rings, appearing one after the other.
// Stage 8: the orbital plane tilts to contain the propagation axis (edge-on binary);
//          new rings appear one after the other, now plus polarised.
// Second slide (gw-ring-ligo), stages 0-3: aerial photo of LIGO Hanford; 4 km marks on
// the arms; the photo fades into a schematic interferometer lying on the photo's arms,
// which then turns into an upright L (left) while a ring of test masses appears (right);
// the wave passes: ring and detector deform together, and the detector response h_+(t)
// is traced at the bottom.
(function () {
  "use strict";

  // World coordinates in slide pixels: X right, Y up in the orbital plane of stages 0-7,
  // Z along the orbital axis (the propagation direction of the waves drawn).
  var R0 = 300;             // ring radius
  var N = 24;               // number of test masses per ring
  var DOT = 11;             // test-mass radius, screen px
  var BH = 45;              // black-hole radius, screen px
  var D2 = 450;             // orbital radius in the 2D view
  var D3 = 220;             // orbital radius in the 3D view (clear of the first ring plane)
  var EPS = 0.26;           // strain amplitude h shown on the rings
  var PERIOD = 4000;        // final orbital period, ms
  var SLOW = 0.35;          // initial orbital rate as a fraction of the final rate
  var RAMP = 1500;          // time to reach the final rate, ms
  var NW = 7;               // number of ring planes in front of the binary
  var DZ = 400;             // spacing of the ring planes along Z
  var DELAY = PERIOD / 14;  // delay per ring plane, ms (7 planes = one wave period)
  var FB = 70;              // margin of the orbital-plane frame beyond the orbital radius
  var FW = 360;             // half-size of a ring-plane frame
  // 3D view: orthographic camera, yaw ALPHA from the Z axis (sin = 0.4: planes seen from
  // the side), pitch BETA, scale S3, image of the origin at (CX3, CY3).
  var ALPHA = Math.asin(0.4), BETA = 12 * Math.PI / 180, S3 = 0.55, CX3 = 330, CY3 = 600;

  // ---- animated parameters: value eases from `from` to `to` over [t0, t0 + dur] ----
  function ease(f) { return f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f); }
  function P(v) { return { from: v, to: v, t0: 0, dur: 1 }; }
  function val(p, now) {
    var f = Math.max(0, Math.min(1, (now - p.t0) / p.dur));
    return p.from + (p.to - p.from) * ease(f);
  }
  function set(p, target, now, instant, delay, dur) {
    if (instant) { p.from = p.to = target; return; }
    if (p.to === target) return;
    p.from = val(p, now); p.to = target; p.t0 = now + delay; p.dur = dur;
  }

  var par = { bh: P(0), h: P(0), ring: P(1), cam: P(0), frame: P(0), tilt: P(0) };
  var circ = [], plus = [];
  for (var j = 0; j < NW; j++) { circ.push(P(0)); plus.push(P(0)); }

  // ---- orbit: phase of the binary at time s (ms) since the orbit started ----
  // Rate w(s) = wf - (wf - wi)(1 - s/RAMP)^2 for s < RAMP, wf after; phase = its integral.
  var WF = 2 * Math.PI / PERIOD, WI = SLOW * WF;
  var orbitStart = null;    // performance.now() at the start of the orbit; null: no orbit
  // phase(s) is shared by both slides; s <= 0 means the orbit has not started.
  function phase(s) {
    if (s <= 0) return 0;
    var u = Math.min(s, RAMP) / RAMP;
    return WF * s - (WF - WI) * (RAMP / 3) * (1 - Math.pow(1 - u, 3));
  }

  // ---- projection ----
  var cam = {};
  function setCamera(c) {
    var a = Math.PI / 2 + (ALPHA - Math.PI / 2) * c, b = BETA * c;
    var B0 = [-Math.cos(a), 0, Math.sin(a)];
    cam.R = [Math.sin(a), 0, Math.cos(a)];
    cam.U = [Math.sin(b) * B0[0], Math.cos(b), Math.sin(b) * B0[2]];
    cam.s = 1 + (S3 - 1) * c;
    cam.cx = 960 + (CX3 - 960) * c;
    cam.cy = 540 + (CY3 - 540) * c;
  }
  function proj(x, y, z) {
    var R = cam.R, U = cam.U;
    return [cam.cx + cam.s * (x * R[0] + y * R[1] + z * R[2]),
            cam.cy - cam.s * (x * U[0] + y * U[1] + z * U[2])];
  }

  // Square frame of half-size a in the plane through o spanned by e1, e2.
  function frame(ctx, o, e1, e2, a, alpha) {
    if (alpha <= 0) return;
    ctx.beginPath();
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q, i) {
      var p = proj(o[0] + a * (q[0] * e1[0] + q[1] * e2[0]),
                   o[1] + a * (q[0] * e1[1] + q[1] * e2[1]),
                   o[2] + a * (q[0] * e1[2] + q[1] * e2[2]));
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0," + 0.04 * alpha + ")";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0," + 0.35 * alpha + ")";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Ring of test masses in the plane Z = z. Each mass moves by dx_i = (1/2) h_ij x_j with
  // h_+ = h cos 2phi and h_x = h sin 2phi (circular) or h_x = 0 (plus).
  function ring(ctx, z, h, phi, circular, alpha, r) {
    if (alpha <= 0) return;
    var hp = h * Math.cos(2 * phi), hx = circular ? h * Math.sin(2 * phi) : 0;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#000";
    for (var k = 0; k < N; k++) {
      var th = 2 * Math.PI * k / N;
      var x = R0 * Math.cos(th), y = R0 * Math.sin(th);
      var p = proj(x + 0.5 * (hp * x + hx * y), y + 0.5 * (hx * x - hp * y), z);
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Faint lines through the centre of the plane through o along e1 and e2.
  function planeAxes(ctx, o, e1, e2, a, alpha) {
    if (alpha <= 0) return;
    ctx.strokeStyle = "rgba(0,0,0," + 0.2 * alpha + ")";
    ctx.lineWidth = 1.5;
    [e1, e2].forEach(function (e) {
      var p = proj(o[0] - a * e[0], o[1] - a * e[1], o[2] - a * e[2]);
      var q = proj(o[0] + a * e[0], o[1] + a * e[1], o[2] + a * e[2]);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    });
  }

  // Small faint x, y, z triad in the lower left, turned with the camera.
  var TRIAD = [170, 930], TL = 110;
  function triad(ctx, alpha) {
    if (alpha <= 0) return;
    var col = "rgba(0,0,0," + 0.4 * alpha + ")";
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
    ctx.font = "italic 30px KaTeX_Math, 'Times New Roman', serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    [["x", [1, 0, 0]], ["y", [0, 1, 0]], ["z", [0, 0, 1]]].forEach(function (ax) {
      var v = ax[1];
      var dx = v[0] * cam.R[0] + v[1] * cam.R[1] + v[2] * cam.R[2];
      var dy = -(v[0] * cam.U[0] + v[1] * cam.U[1] + v[2] * cam.U[2]);
      var n = Math.hypot(dx, dy);
      var x1 = TRIAD[0] + TL * dx, y1 = TRIAD[1] + TL * dy;
      ctx.beginPath(); ctx.moveTo(TRIAD[0], TRIAD[1]); ctx.lineTo(x1, y1); ctx.stroke();
      if (n > 0.05) {
        var ux = dx / n, uy = dy / n;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - 12 * ux - 6 * uy, y1 - 12 * uy + 6 * ux);
        ctx.lineTo(x1 - 12 * ux + 6 * uy, y1 - 12 * uy - 6 * ux);
        ctx.closePath(); ctx.fill();
        ctx.fillText(ax[0], x1 + 24 * ux, y1 + 24 * uy);
      }
    });
  }

  function draw(ctx, now) {
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, 1920, 1080);
    var c = val(par.cam, now);
    setCamera(c);
    var s = orbitStart === null ? 0 : now - orbitStart;
    var h = val(par.h, now), size = 1 - 0.2 * c;
    var t = val(par.tilt, now) * Math.PI / 2;
    var e1 = [1, 0, 0], e2 = [0, Math.cos(t), Math.sin(t)];   // orbital plane

    var D = D2 + (D3 - D2) * c;
    frame(ctx, [0, 0, 0], e1, e2, D + FB, val(par.frame, now));
    planeAxes(ctx, [0, 0, 0], e1, e2, D + FB, val(par.frame, now));
    triad(ctx, val(par.frame, now));
    for (var j = 0; j < NW; j++) {
      var z = (j + 1) * DZ, ret = phase(s - (j + 1) * DELAY);
      var ac = val(circ[j], now), ap = val(plus[j], now);
      frame(ctx, [0, 0, z], [1, 0, 0], [0, 1, 0], FW, Math.max(ac, ap));
      planeAxes(ctx, [0, 0, z], [1, 0, 0], [0, 1, 0], FW, Math.max(ac, ap));
      ring(ctx, z, h, ret, true, ac, DOT * size);
      ring(ctx, z, h, ret, false, ap, DOT * size);
    }
    ring(ctx, 0, h, phase(s), true, val(par.ring, now), DOT * size);

    var a = val(par.bh, now);
    if (a > 0) {
      var phi = phase(s);
      ctx.globalAlpha = a;
      ctx.fillStyle = "#000";
      for (var i = 0; i < 2; i++) {
        var sg = i === 0 ? 1 : -1, cp = sg * D * Math.cos(phi), sp = sg * D * Math.sin(phi);
        var p = proj(cp * e1[0] + sp * e2[0], cp * e1[1] + sp * e2[1], cp * e1[2] + sp * e2[2]);
        ctx.beginPath();
        ctx.arc(p[0], p[1], BH * size, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  var raf = null, ctx = null;
  function loop(now) { draw(ctx, now); raf = requestAnimationFrame(loop); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }

  Deck.widget("gw-ring-binary", {
    steps: 8,
    enter: function (slide) {
      ctx = slide.querySelector("canvas").getContext("2d");
      orbitStart = null;
      stop();
      raf = requestAnimationFrame(loop);
    },
    leave: function () { stop(); orbitStart = null; },
    step: function (slide, k, dir) {
      var now = performance.now(), inst = dir < 0;
      if (k < 3) orbitStart = null;
      // The orbit starts slowly on the way forward into stage 3; otherwise at full rate.
      else if (orbitStart === null) orbitStart = k === 3 && !inst ? now : now - 100 * PERIOD;
      set(par.bh, k >= 1 ? 1 : 0, now, inst, 0, 700);
      set(par.h, k >= 2 ? EPS : 0, now, inst, 0, 1200);
      set(par.ring, k <= 3 ? 1 : 0, now, inst, 0, 600);
      set(par.cam, k >= 4 ? 1 : 0, now, inst, 400, 2000);
      set(par.frame, k >= 4 ? 1 : 0, now, inst, 400, 1500);
      set(par.tilt, k >= 8 ? 1 : 0, now, inst, 500, 1500);
      for (var j = 0; j < NW; j++) {
        var on = (k === 5 && j === 0) || (k === 6 && j <= 1) || k === 7;
        set(circ[j], on ? 1 : 0, now, inst, k === 7 ? Math.max(0, j - 2) * 400 : 0, on ? 600 : 400);
        set(plus[j], k >= 8 ? 1 : 0, now, inst, 2000 + j * 350, 500);
      }
    }
  });

  // ================= second slide: the LIGO detector =================

  // Photo: source crop (0, 380)-(2400, 1600) px drawn at 0.8 scale, mirrored left-right,
  // into slide rows 52-1028. Arm positions below were read by eye on the photo, slide px.
  var photo = document.getElementById("gw-ring-photo");   // an <img> in part.html, so that a saved page keeps it
  var ARM_UP = [[345, 775], [1085, 268]];        // arm towards the upper right, full length
  var ARM_RIGHT = [[400, 832], [1920, 888]];     // arm to the right, leaves the photo
  // Camera on the detector. The detector is a rigid L on the ground: arms along ground x
  // and y, length 1. A view maps ground (u, v) to screen o + M (u, v), with M written as
  // R(th) diag(s1, s2) R(ph) F (F flips v; s2/s1 = cos of the camera tilt). Moving from the
  // photo's view to the top view interpolates th, s1, s2, ph and o: only the camera moves.
  // "photo": arms on the photo's arm tubes, beam splitter where the two tube lines meet;
  // "flat": top view, upright L.
  var VIEW_PHOTO = { o: [268, 827], x: [1400 * Math.cos(Math.atan2(56, 1520)),
                     1400 * Math.sin(Math.atan2(56, 1520))], y: [817, -559] };
  var VIEW_FLAT = { o: [330, 640], x: [440, 0], y: [0, -440] };
  var KM_UP = [[684, 476], [200, 420]];     // label of the y arm: photo view, top view
  var KM_RIGHT = [[1158, 915], [550, 722]]; // label of the x arm: photo view, top view
  var KM_SWING = 0.15;      // shown change of an arm length at h = EPS, km (exaggerated)
  var RC = [1350, 430], RR = 250;                // ring
  // Trace of h_+(t): axes origin (TX0, TY), newest value at TX1.
  var TX0 = 180, TX1 = 1740, TY = 900, TA = 95, TWIN = 6000;
  var AMPRAMP = 1200;       // strain grows from 0 to EPS in this time, ms

  var q = { km: P(0), fade: P(0), morph: P(0), trace: P(0) };
  var ligoStart = null;

  function amp(s) { return s <= 0 ? 0 : EPS * ease(Math.min(1, s / AMPRAMP)); }

  // "4 km" beside an arm on the photo: white, along the arm direction a (radians).
  function photoLabel(ctx, c, a, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 8;
    ctx.translate(c[0], c[1]); ctx.rotate(a);
    ctx.font = "bold 44px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("4 km", 0, 0);
    ctx.restore();
  }

  function drawPhoto(ctx, alpha, kmAlpha) {
    if (alpha <= 0 || !photo.complete || !photo.naturalWidth) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(1920, 0); ctx.scale(-1, 1);
    ctx.drawImage(photo, 0, 380, 2400, 1220, 0, 52, 1920, 976);
    ctx.restore();
    // Credit line required by the LIGO image use policy.
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#555";
    ctx.font = "22px Arial"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("Photo: Courtesy Caltech/MIT/LIGO Laboratory (mirrored)", 1905, 1054);
    ctx.restore();
    if (kmAlpha > 0) {
      photoLabel(ctx, KM_UP[0], Math.atan2(ARM_UP[1][1] - ARM_UP[0][1], ARM_UP[1][0] - ARM_UP[0][0]),
                 kmAlpha * alpha);
      photoLabel(ctx, KM_RIGHT[0], Math.atan2(ARM_RIGHT[1][1] - ARM_RIGHT[0][1],
                 ARM_RIGHT[1][0] - ARM_RIGHT[0][0]), kmAlpha * alpha);
    }
  }

  // M' = M F = R(th) diag(s1, s2) R(ph), closed-form 2x2 decomposition (det M' > 0).
  function decompose(v) {
    var p = v.x[0], qq = -v.y[0], r = v.x[1], t = -v.y[1];
    var E = (p + t) / 2, Fh = (p - t) / 2, G = (r + qq) / 2, H = (r - qq) / 2;
    var Q = Math.hypot(E, H), R = Math.hypot(Fh, G);
    var a1 = R > 1e-9 ? Math.atan2(G, Fh) : 0, a2 = Math.atan2(H, E);
    return { o: v.o, s1: Q + R, s2: Q - R, th: (a2 + a1) / 2, ph: (a2 - a1) / 2 };
  }
  var CAM_A = decompose(VIEW_PHOTO), CAM_B = decompose(VIEW_FLAT);
  // The top view has s1 = s2, so only th + ph is fixed there; split the rotation evenly.
  (function () {
    var d = CAM_B.th + CAM_B.ph - (CAM_A.th + CAM_A.ph);
    d = Math.atan2(Math.sin(d), Math.cos(d));
    CAM_B.th = CAM_A.th + d / 2; CAM_B.ph = CAM_A.ph + d / 2;
  })();
  function camera(m) {
    function L(k) { return CAM_A[k] + (CAM_B[k] - CAM_A[k]) * m; }
    var th = L("th"), ph = L("ph"), s1 = L("s1"), s2 = L("s2");
    var ct = Math.cos(th), st = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph);
    // R(th) diag(s1, s2) R(ph), then flip the second column.
    var m11 = ct * s1 * cp - st * s2 * sp, m12 = -ct * s1 * sp - st * s2 * cp;
    var m21 = st * s1 * cp + ct * s2 * sp, m22 = -st * s1 * sp + ct * s2 * cp;
    return { o: [CAM_A.o[0] + (CAM_B.o[0] - CAM_A.o[0]) * m, CAM_A.o[1] + (CAM_B.o[1] - CAM_A.o[1]) * m],
             x: [m11, m21], y: [-m12, -m22] };
  }

  // Filled rectangle centred at c, size w along direction a and t across it.
  function box(ctx, c, a, w, t) {
    ctx.save();
    ctx.translate(c[0], c[1]); ctx.rotate(a);
    ctx.fillRect(-w / 2, -t / 2, w, t);
    ctx.restore();
  }

  // Interferometer seen by the camera at m (0 photo view, 1 top view). In ground
  // coordinates every point moves by dx_i = (1/2) h_ij x_j about the beam splitter, the
  // same map as for the ring. Laser and photodetector keep fixed screen offsets.
  function drawSchematic(ctx, alpha, m, hp, hx) {
    if (alpha <= 0) return;
    var c = camera(m), o = c.o;
    function at(u, v) { return [o[0] + u * c.x[0] + v * c.y[0], o[1] + u * c.x[1] + v * c.y[1]]; }
    var lx = Math.hypot(c.x[0], c.x[1]), ly = Math.hypot(c.y[0], c.y[1]);
    var ux = [c.x[0] / lx, c.x[1] / lx], uy = [c.y[0] / ly, c.y[1] / ly];
    var ax = Math.atan2(ux[1], ux[0]), ay = Math.atan2(uy[1], uy[0]);
    function off(u, d) { return [o[0] + d * u[0], o[1] + d * u[1]]; }
    var ex = at(1 + 0.5 * hp, 0.5 * hx), ey = at(0.5 * hx, 1 - 0.5 * hp);
    var laser = off(ux, -130), pd = off(uy, -100), pdIn = off(uy, -80), lsOut = off(ux, -65);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#c00"; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(lsOut[0], lsOut[1]); ctx.lineTo(o[0], o[1]);
    ctx.moveTo(o[0], o[1]); ctx.lineTo(ex[0], ex[1]);
    ctx.moveTo(o[0], o[1]); ctx.lineTo(ey[0], ey[1]);
    ctx.moveTo(o[0], o[1]); ctx.lineTo(pdIn[0], pdIn[1]);
    ctx.stroke();
    ctx.fillStyle = "#000";
    box(ctx, laser, ax, 130, 64);                                   // laser
    box(ctx, ex, ay, 90, 16);                                       // end mirrors
    box(ctx, ey, ax, 90, 16);
    ctx.beginPath();                                                // photodetector
    ctx.arc(pd[0], pd[1], 24, ay - Math.PI / 2, ay + Math.PI / 2, true);
    ctx.fill();
    ctx.fillStyle = "#666";                                         // beam splitter
    box(ctx, o, Math.atan2(ux[1] + uy[1], ux[0] + uy[0]), 90, 10);
    ctx.restore();
  }

  // Arm-length labels of the schematic, at fixed places. Before the wave: "4 km"; during
  // it, the (exaggerated) lengths with three decimals.
  function drawKm(ctx, alpha, m, running, hp) {
    if (alpha <= 0) return;
    var dx = KM_SWING * hp / EPS;
    var tx = running ? (4 + dx).toFixed(3) + " km" : "4 km";
    var ty = running ? (4 - dx).toFixed(3) + " km" : "4 km";
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#c00";
    ctx.font = "40px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    // Each label starts at the angle of its photo label and turns level with the camera.
    [[KM_RIGHT, tx, ARM_RIGHT], [KM_UP, ty, ARM_UP]].forEach(function (e) {
      var A = e[0][0], B = e[0][1], arm = e[2];
      var a0 = Math.atan2(arm[1][1] - arm[0][1], arm[1][0] - arm[0][0]);
      ctx.save();
      ctx.translate(A[0] + (B[0] - A[0]) * m, A[1] + (B[1] - A[1]) * m);
      ctx.rotate(a0 * (1 - m));
      ctx.fillText(e[1], 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  function drawRing2(ctx, alpha, hp, hx) {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#000";
    for (var k = 0; k < N; k++) {
      var th = 2 * Math.PI * k / N, x = RR * Math.cos(th), y = RR * Math.sin(th);
      ctx.beginPath();
      ctx.arc(RC[0] + x + 0.5 * (hp * x + hx * y), RC[1] - (y + 0.5 * (hx * x - hp * y)),
              DOT, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function arrowHead(ctx, x, y, a) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 18 * Math.cos(a) + 8 * Math.sin(a), y - 18 * Math.sin(a) - 8 * Math.cos(a));
    ctx.lineTo(x - 18 * Math.cos(a) - 8 * Math.sin(a), y - 18 * Math.sin(a) + 8 * Math.cos(a));
    ctx.closePath(); ctx.fill();
  }

  // Detector output h_+(t) = (dLx - dLy)/(2L): axes with labels, curve, current value.
  function drawTrace(ctx, alpha, s) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#555"; ctx.fillStyle = "#555"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(TX0, TY + TA + 20); ctx.lineTo(TX0, TY - TA - 30);         // h axis
    ctx.moveTo(TX0, TY); ctx.lineTo(TX1 + 60, TY);                        // t axis
    ctx.stroke();
    arrowHead(ctx, TX0, TY - TA - 34, -Math.PI / 2);
    arrowHead(ctx, TX1 + 64, TY, 0);
    ctx.fillStyle = "#000";
    ctx.font = "italic 40px KaTeX_Math, 'Times New Roman', serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "right"; ctx.fillText("h", TX0 - 18, TY - TA - 20);
    ctx.textAlign = "center"; ctx.fillText("t", TX1 + 64, TY + 36);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 4;
    ctx.beginPath();
    for (var x = TX0; x <= TX1; x += 3) {
      var t = s - (TX1 - x) / (TX1 - TX0) * TWIN;
      var y = TY - TA / EPS * amp(t) * Math.cos(2 * phase(t));
      if (x === TX0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#c00";
    ctx.beginPath();
    ctx.arc(TX1, TY - TA / EPS * amp(s) * Math.cos(2 * phase(s)), 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }

  function drawLigo(ctx2, now) {
    ctx2.setTransform(2, 0, 0, 2, 0, 0);
    ctx2.clearRect(0, 0, 1920, 1080);
    var f = val(q.fade, now), m = val(q.morph, now);
    var s = ligoStart === null ? 0 : now - ligoStart;
    var A = amp(s), ph = phase(s), hp = A * Math.cos(2 * ph), hx = A * Math.sin(2 * ph);
    drawPhoto(ctx2, 1 - f, val(q.km, now));
    drawSchematic(ctx2, f, m, hp, hx);
    drawKm(ctx2, f * val(q.km, now), m, ligoStart !== null, hp);
    // The ring fades in over the last 40% of the camera move, after the x arm has passed.
    drawRing2(ctx2, Math.max(0, (m - 0.6) / 0.4), hp, hx);
    drawTrace(ctx2, val(q.trace, now), s);
  }

  var raf2 = null, ctx2 = null;
  function loop2(now) { drawLigo(ctx2, now); raf2 = requestAnimationFrame(loop2); }
  function stop2() { if (raf2) cancelAnimationFrame(raf2); raf2 = null; }
  photo.onload = function () { if (ctx2 && !raf2) drawLigo(ctx2, performance.now()); };

  Deck.widget("gw-ring-ligo", {
    steps: 3,
    enter: function (slide) {
      ctx2 = slide.querySelector("canvas").getContext("2d");
      ligoStart = null;
      stop2();
      raf2 = requestAnimationFrame(loop2);
    },
    leave: function () { stop2(); ligoStart = null; },
    step: function (slide, k, dir) {
      var now = performance.now(), inst = dir < 0;
      if (k < 3) ligoStart = null;
      // The wave starts on the way forward into stage 3; going back, it is already running.
      else if (ligoStart === null) ligoStart = inst ? now - 100 * PERIOD : now;
      set(q.km, k >= 1 ? 1 : 0, now, inst, 0, 600);
      // Stage 2: the photo fades into the slanted schematic, which then turns upright.
      set(q.fade, k >= 2 ? 1 : 0, now, inst, 0, 1500);
      set(q.morph, k >= 2 ? 1 : 0, now, inst, k >= 2 ? 1700 : 0, 1800);
      set(q.trace, k >= 3 ? 1 : 0, now, inst, 0, 500);
    }
  });
})();
