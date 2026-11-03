/* eslint-disable */
// @ts-nocheck
/**
 * Màn mở thẻ (Vinh danh, BRD 13.1): đường hầm → lửa → giới thiệu vị trí / số áo / đội → lóe sáng →
 * sân vận động 3D (three.js) → thẻ xoay bay ra, pháo hoa, kim tuyến. Chuyển từ prototype "Thẻ Đom Đóm FC 2"
 * gần như nguyên văn (JS thuần), tham số hoá tên đội / cầu thủ. three.js truyền vào sau khi tải động.
 */
export function createIntro(opts) {
  var root = opts.root, reduce = !!opts.reduce, THREE = null;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var TEAM = String(opts.team || '').trim() || 'Đội bóng';
  var TEAM_UP = TEAM.toUpperCase();
  var TEAM_SHORT = TEAM_UP.replace(/\b(FC|CLB|UNITED)\b/g, '').trim() || TEAM_UP;
  var TEAM_INIT = TEAM_UP.split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 5);
  var player = opts.player, timers = [];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }

  /* ---- Đường hầm + lửa (canvas trong lớp phủ) ---- */
  var WALK = 1500;
  var TINT = { dd: '212,255,58', gold: '255,200,90', silver: '190,215,255' };
  var FIRE_Y = [[255, 255, 230], [255, 196, 48], [225, 70, 12]];
  var FIRE = { dd: FIRE_Y, gold: FIRE_Y, silver: FIRE_Y };
  var tun = null;

  function fit() {
    if (!tun) return;
    var r = tun.cv.getBoundingClientRect();
    tun.w = r.width; tun.h = r.height;
    tun.cv.width = r.width * dpr; tun.cv.height = r.height * dpr;
    tun.c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (tun.s3) resizeS3(tun.s3, tun.w, tun.h);
  }

  function startTunnel(cv, tier) {
    var rings = [];
    for (var i = 0; i < 18; i++) rings.push(0.05 + i / 18);
    tun = { cv: cv, c: cv.getContext('2d'), rings: rings, fire: [], fireUntil: 0, fireRate: 0, start: performance.now(), last: performance.now(), tier: tier, run: true, slow: reduce, mode: 'tunnel', fw: [], parts: [], conf: [], fwOn: false, fwAt: 0, nextLaunch: 0, stadAt: 0, th0: 0, bowl: null };
    fit();
    requestAnimationFrame(tick);
  }
  function mix(a, b, t) { return Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t); }
  function lamp(c, x, y, r, a) {
    c.fillStyle = 'rgba(255,255,240,' + (a * .25) + ')'; c.beginPath(); c.arc(x, y, r * 2.4, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(255,255,240,' + a + ')'; c.beginPath(); c.arc(x, y, r * .7, 0, 6.2832); c.fill();
  }
  function emit(side, n) {
    var T = tun, x = side < 0 ? T.w * .06 : T.w * .94, k = Math.max(.6, T.h / 800);
    for (var i = 0; i < n; i++) {
      T.fire.push({ x: x + (Math.random() - .5) * 24, y: T.h + 12, vx: -side * (.4 + Math.random() * 1.6) + (Math.random() - .5) * .8, vy: -(14 + Math.random() * 8) * k, r: 8 + Math.random() * 12, life: 0, max: 36 + Math.random() * 22 });
    }
  }
  function fire(ms, rate) { if (!tun || reduce) return; tun.fireUntil = performance.now() + ms; tun.fireRate = rate; }

  function tick(now) {
    if (!tun || !tun.run) return;
    var T = tun, c = T.c, w = T.w, h = T.h, dt = Math.min(.05, (now - T.last) / 1000); T.last = now;
    var el = now - T.start, walking = !T.slow && el < WALK;
    var light = walking ? el / WALK : 1, speed = walking ? .9 : .12, tint = TINT[T.tier];
    var m = Math.min(w, h), cx = w / 2, cy = h * .44 + (walking ? Math.sin(el / 1000 * 9) * 3 : 0);

    c.globalCompositeOperation = 'source-over';
    if (T.mode === 'stadium') { if (T.s3) { c.clearRect(0, 0, w, h); renderS3(T.s3, T, now); if (!reduce) drawFireworks(c, now); } else drawBowl(c, w, h, now); } else {
    c.fillStyle = '#020604'; c.fillRect(0, 0, w, h);
    var g = c.createRadialGradient(cx, cy, 0, cx, cy, m * (.06 + light * .22) * 3);
    g.addColorStop(0, 'rgba(255,255,255,' + (.5 + light * .5) + ')');
    g.addColorStop(.18, 'rgba(' + tint + ',' + (.35 + light * .4) + ')');
    g.addColorStop(1, 'rgba(' + tint + ',0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);

    c.strokeStyle = 'rgba(' + tint + ',.12)'; c.lineWidth = 1;
    for (var k = -4; k <= 4; k++) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + k * w * .35, h); c.stroke(); }

    for (var i = 0; i < T.rings.length; i++) { T.rings[i] -= speed * dt; if (T.rings[i] < .04) T.rings[i] += 1; }
    var order = T.rings.slice().sort(function (a, b) { return b - a; });
    c.globalCompositeOperation = 'lighter';
    for (var j = 0; j < order.length; j++) {
      var z = order[j], s = 1 / z, bw = m * .06 * s, bh = bw * 1.1;
      if (bw > w * 3) continue;
      var near = 1 - z, a = Math.min(1, near * near * 1.4) * .9, top = cy - bh * .15, bot = cy + bh;
      c.lineWidth = Math.min(26, 1 + s * .9);
      c.strokeStyle = 'rgba(' + tint + ',' + (a * .55) + ')';
      c.beginPath(); c.moveTo(cx - bw, bot); c.lineTo(cx - bw, top); c.arc(cx, top, bw, Math.PI, 0); c.lineTo(cx + bw, bot); c.stroke();
      var lr = Math.min(40, 2 + s * 1.4);
      lamp(c, cx, top - bw, lr, a); lamp(c, cx - bw * .7071, top - bw * .7071, lr * .8, a); lamp(c, cx + bw * .7071, top - bw * .7071, lr * .8, a);
    }
    }
    if (now < T.fireUntil) { emit(-1, T.fireRate); emit(1, T.fireRate); }
    var pal = FIRE[T.tier];
    for (var q = T.fire.length - 1; q >= 0; q--) {
      var f = T.fire[q];
      f.x += f.vx; f.y += f.vy; f.vy *= .962; f.vx *= .985; f.r *= 1.018; f.life++;
      var t = f.life / f.max;
      if (t >= 1) { T.fire.splice(q, 1); continue; }
      var col = t < .3 ? mix(pal[0], pal[1], t / .3) : mix(pal[1], pal[2], (t - .3) / .7);
      c.fillStyle = 'rgba(' + col + ',' + ((1 - t) * .42) + ')';
      c.beginPath(); c.arc(f.x, f.y, f.r, 0, 6.2832); c.fill();
    }
    drawConfetti(c, h);
    if (!reduce) requestAnimationFrame(tick);
  }

  /* ---- Sân vận động 3D: máy quay bay vòng chậm quanh sân ---- */
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function glow(c, x, y, r, rgb, a) {
    if (r <= 0) return;
    var g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  }
  function buildBowl(tier) {
    var tint = TINT[tier], N = 48, ROWS = 3, quads = [], lights = [], i, j;
    var IN = [40, 30, 1.5], OUT = [62, 48, 22];
    function bowl(phi, t) {
      var a = IN[0] + (OUT[0] - IN[0]) * t, b = IN[1] + (OUT[1] - IN[1]) * t;
      return [a * Math.cos(phi), b * Math.sin(phi), IN[2] + (OUT[2] - IN[2]) * t];
    }
    var crowd = ['200,212,220', '125,138,148', tint, tint, '232,226,208', '70,84,95', '242,242,242', '190,70,60'];
    for (i = 0; i < N; i++) {
      var p0 = i / N * 6.2832, p1 = (i + 1) / N * 6.2832, aisle = i % 6 === 0;
      for (var r = 0; r < ROWS; r++) {
        var t0 = r / ROWS, t1 = (r + 1) / ROWS, sh = 34 + r * 9 + (aisle ? 7 : 0);
        var qd = { pts: [bowl(p0, t0), bowl(p1, t0), bowl(p1, t1), bowl(p0, t1)], fill: 'rgb(' + sh + ',' + (sh + 7) + ',' + (sh + 13) + ')', dots: [] };
        if (!aisle) for (j = 0; j < 26; j++) {
          var u = Math.random(), v = Math.random();
          qd.dots.push({ p: bowl(p0 + (p1 - p0) * u, t0 + (t1 - t0) * v), col: pick(crowd), a: .6 + Math.random() * .4 });
        }
        quads.push(qd);
      }
      var o0 = bowl(p0, 1), o1 = bowl(p1, 1), k = 1.05;
      quads.push({ pts: [o0, o1, [o1[0] * k, o1[1] * k, o1[2] + 4], [o0[0] * k, o0[1] * k, o0[2] + 4]], fill: '#05080a', dots: [] });
      if (i % 2 === 0) lights.push([o0[0] * 1.02, o0[1] * 1.02, o0[2] + 2]);
    }
    /* Bảng LED quanh sân */
    function side(ax, ay, bx, by, n) {
      for (var s = 0; s < n; s++) {
        var u0 = s / n, u1 = (s + 1) / n;
        var x0 = ax + (bx - ax) * u0, y0 = ay + (by - ay) * u0, x1 = ax + (bx - ax) * u1, y1 = ay + (by - ay) * u1;
        quads.push({ pts: [[x0, y0, 0], [x1, y1, 0], [x1, y1, 1.3], [x0, y0, 1.3]], fill: s % 2 ? 'rgba(' + tint + ',.95)' : 'rgba(' + tint + ',.75)', dots: [] });
      }
    }
    side(-34, -24, 34, -24, 10); side(34, -24, 34, 24, 6); side(34, 24, -34, 24, 10); side(-34, 24, -34, -24, 6);
    /* Mặt đất ngoài sân + sọc cỏ */
    var ground = [];
    for (i = 0; i < 8; i++) for (j = 0; j < 8; j++) {
      var gx0 = -64 + i * 16, gy0 = -50 + j * 12.5;
      ground.push([[gx0, gy0, 0], [gx0 + 16, gy0, 0], [gx0 + 16, gy0 + 12.5, 0], [gx0, gy0 + 12.5, 0]]);
    }
    var stripes = [];
    for (i = 0; i < 12; i++) { var sx0 = -30 + i * 5; stripes.push({ pts: [[sx0, -20, 0], [sx0 + 5, -20, 0], [sx0 + 5, 20, 0], [sx0, 20, 0]], fill: i % 2 ? '#2f7f35' : '#3a9140' }); }
    /* Vạch vôi, khung thành */
    var lines = [[[-30, -20, 0], [30, -20, 0], [30, 20, 0], [-30, 20, 0], [-30, -20, 0]], [[0, -20, 0], [0, 20, 0]],
      [[-30, -9, 0], [-23, -9, 0], [-23, 9, 0], [-30, 9, 0]], [[30, -9, 0], [23, -9, 0], [23, 9, 0], [30, 9, 0]],
      [[-30, -3, 0], [-30, -3, 2], [-30, 3, 2], [-30, 3, 0]], [[30, -3, 0], [30, -3, 2], [30, 3, 2], [30, 3, 0]]];
    var circ = []; for (i = 0; i <= 32; i++) circ.push([5 * Math.cos(i / 32 * 6.2832), 5 * Math.sin(i / 32 * 6.2832), 0]);
    lines.push(circ);
    var towers = [];
    for (i = 0; i < 4; i++) { var ph = Math.PI / 4 + i * Math.PI / 2, b0 = bowl(ph, 1); towers.push({ base: [b0[0] * 1.06, b0[1] * 1.06, b0[2]], top: [b0[0] * 1.06, b0[1] * 1.06, 36] }); }
    return { quads: quads, ground: ground, stripes: stripes, lines: lines, lights: lights, towers: towers };
  }

  function camera(T, now) {
    var se = (now - T.stadAt) / 1000, th = T.th0 + se * .09;
    var pull = reduce ? 1 : 1 - .4 * Math.exp(-se / 1.3);
    var C = [44 * pull * Math.cos(th), 33 * pull * Math.sin(th), 13 * pull + 2 + Math.sin(se * .5) * .8];
    var tg = [0, 0, 4], f = [tg[0] - C[0], tg[1] - C[1], tg[2] - C[2]], fl = Math.hypot(f[0], f[1], f[2]);
    f = [f[0] / fl, f[1] / fl, f[2] / fl];
    var r = [f[1], -f[0], 0], rl = Math.hypot(r[0], r[1]); r = [r[0] / rl, r[1] / rl, 0];
    var u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return { C: C, f: f, r: r, u: u, focal: Math.max(T.w, T.h) * .52, cx: T.w / 2, cy: T.h * .5 };
  }
  function proj(K, P) {
    var d0 = P[0] - K.C[0], d1 = P[1] - K.C[1], d2 = P[2] - K.C[2];
    var z = d0 * K.f[0] + d1 * K.f[1] + d2 * K.f[2];
    if (z < .6) return null;
    return [K.cx + (d0 * K.r[0] + d1 * K.r[1] + d2 * K.r[2]) / z * K.focal, K.cy - (d0 * K.u[0] + d1 * K.u[1] + d2 * K.u[2]) / z * K.focal, z];
  }
  function fillPoly(c, K, pts, fill) {
    var s = [];
    for (var i = 0; i < pts.length; i++) { var p = proj(K, pts[i]); if (!p) return null; s.push(p); }
    c.fillStyle = fill; c.beginPath(); c.moveTo(s[0][0], s[0][1]);
    for (i = 1; i < s.length; i++) c.lineTo(s[i][0], s[i][1]);
    c.closePath(); c.fill();
    return s;
  }

  function drawBowl(c, w, h, now) {
    var T = tun, B = T.bowl, K = camera(T, now), i, j, p;
    var sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#02050a'); sky.addColorStop(.45, '#0c1822'); sky.addColorStop(.5, '#0b1a10'); sky.addColorStop(1, '#081209');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);

    for (i = 0; i < B.ground.length; i++) fillPoly(c, K, B.ground[i], '#163a1c');
    for (i = 0; i < B.stripes.length; i++) fillPoly(c, K, B.stripes[i].pts, B.stripes[i].fill);
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; c.lineJoin = 'round';
    for (i = 0; i < B.lines.length; i++) {
      var L = B.lines[i], ok = true, pts = [];
      for (j = 0; j < L.length; j++) { p = proj(K, L[j]); if (!p) { ok = false; break; } pts.push(p); }
      if (!ok) continue;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (j = 1; j < pts.length; j++) c.lineTo(pts[j][0], pts[j][1]); c.stroke();
    }

    /* Khán đài + bảng LED: vẽ từ xa tới gần */
    var list = [];
    for (i = 0; i < B.quads.length; i++) {
      var q4 = B.quads[i], zs = 0, bad = false;
      for (j = 0; j < 4; j++) { p = proj(K, q4.pts[j]); if (!p) { bad = true; break; } zs += p[2]; }
      if (!bad) list.push([zs / 4, q4]);
    }
    list.sort(function (a, b) { return b[0] - a[0]; });
    for (i = 0; i < list.length; i++) {
      var qd = list[i][1];
      fillPoly(c, K, qd.pts, qd.fill);
      for (j = 0; j < qd.dots.length; j++) {
        var d = qd.dots[j]; p = proj(K, d.p); if (!p) continue;
        var sz = Math.min(3.6, Math.max(1.7, 90 / p[2]));
        c.fillStyle = 'rgba(' + d.col + ',' + d.a + ')'; c.fillRect(p[0], p[1], sz, sz);
      }
    }

    /* Cột đèn pha, đèn viền mái, quầng sáng */
    c.globalCompositeOperation = 'lighter';
    var cp = proj(K, [0, 0, 0]); if (cp) glow(c, cp[0], cp[1], Math.max(w, h) * .45, '210,240,220', .1);
    for (i = 0; i < B.lights.length; i++) { p = proj(K, B.lights[i]); if (p) glow(c, p[0], p[1], Math.min(16, 300 / p[2]), '255,250,235', .7); }
    for (i = 0; i < B.towers.length; i++) {
      var tb = proj(K, B.towers[i].base), tt = proj(K, B.towers[i].top);
      if (!tb || !tt) continue;
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = '#0a0f12'; c.lineWidth = Math.max(2, 40 / tt[2]);
      c.beginPath(); c.moveTo(tb[0], tb[1]); c.lineTo(tt[0], tt[1]); c.stroke();
      c.globalCompositeOperation = 'lighter';
      glow(c, tt[0], tt[1], Math.min(w, 9000 / tt[2]), '200,225,255', .22);
      glow(c, tt[0], tt[1], Math.min(80, 1600 / tt[2]), '255,255,255', .95);
    }
    if (!reduce) for (var f = 0; f < 6; f++) if (Math.random() < (T.fwOn ? .3 : .12)) glow(c, Math.random() * w, h * (.1 + Math.random() * .3), 3 + Math.random() * 6, '255,255,255', .9);
    c.globalCompositeOperation = 'source-over';

    var vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);

    if (!reduce) drawFireworks(c, now);
  }

  /* ---- Pháo hoa, kim tuyến ---- */
  var FW_COLORS = ['255,214,90', '212,255,58', '255,255,255', '255,110,90', '120,190,255', '255,160,230'];
  var FW_TYPES = ['peony', 'ring', 'willow', 'double', 'peony', 'glitter'];
  function launch() {
    var T = tun; if (!T) return;
    T.fw.push({ x: T.w * (.1 + Math.random() * .8), y: T.h * .34, vx: (Math.random() - .5) * 1.2, vy: -(9 + Math.random() * 4) * Math.max(.7, T.h / 800), ty: T.h * (.04 + Math.random() * .17), type: pick(FW_TYPES), col: pick(FW_COLORS), col2: pick(FW_COLORS) });
  }
  function part(x, y, a, sp, col, o) {
    o = o || {};
    tun.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: o.max || 55 + Math.random() * 30, col: col, r: o.r || 1.6, g: o.g == null ? .045 : o.g, drag: o.drag || .975, flick: !!o.flick });
  }
  function explode(r) {
    var k = Math.max(.7, Math.min(tun.w, tun.h) / 700), i, n;
    tun.parts.push({ x: r.x, y: r.y, vx: 0, vy: 0, life: 0, max: 12, col: r.col, flash: 70 * k, g: 0, drag: 1 });
    if (r.type === 'ring') { n = 56; for (i = 0; i < n; i++) part(r.x, r.y, i / n * 6.2832, 4 * k, r.col); }
    else if (r.type === 'willow') { for (i = 0; i < 90; i++) part(r.x, r.y, Math.random() * 6.2832, Math.random() * 3.4 * k, '255,200,90', { max: 110 + Math.random() * 30, g: .035, drag: .985, r: 1.3 }); }
    else if (r.type === 'double') {
      for (i = 0; i < 50; i++) part(r.x, r.y, Math.random() * 6.2832, (1 + Math.random()) * k, r.col);
      for (i = 0; i < 60; i++) part(r.x, r.y, i / 60 * 6.2832, 4.6 * k, r.col2);
    }
    else if (r.type === 'glitter') { for (i = 0; i < 80; i++) part(r.x, r.y, Math.random() * 6.2832, (1 + Math.random() * 3.2) * k, '255,240,200', { flick: true, max: 80 + Math.random() * 30 }); }
    else { for (i = 0; i < 80; i++) part(r.x, r.y, Math.random() * 6.2832, (1.5 + Math.random() * 3) * k, r.col); }
  }
  function drawFireworks(c, now) {
    var T = tun, i;
    if (T.fwOn && now > T.nextLaunch) {
      launch();
      T.nextLaunch = now + (now - T.fwAt < 4000 ? 160 + Math.random() * 300 : 650 + Math.random() * 900);
    }
    c.globalCompositeOperation = 'lighter';
    for (i = T.fw.length - 1; i >= 0; i--) {
      var r = T.fw[i];
      r.x += r.vx; r.y += r.vy; r.vy += .12;
      part(r.x, r.y, Math.PI / 2 + (Math.random() - .5), Math.random() * .8, '255,220,150', { max: 18, r: 1.2, g: .02, drag: .95 });
      glow(c, r.x, r.y, 6, '255,240,200', .9);
      if (r.vy > -1.5 || r.y <= r.ty) { explode(r); T.fw.splice(i, 1); }
    }
    for (i = T.parts.length - 1; i >= 0; i--) {
      var p = T.parts[i];
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.life++;
      var t = p.life / p.max;
      if (t >= 1) { T.parts.splice(i, 1); continue; }
      if (p.flash) { glow(c, p.x, p.y, p.flash, p.col, .55 * (1 - t)); continue; }
      var a = 1 - t; if (p.flick && Math.random() < .5) a *= .15;
      c.fillStyle = 'rgba(' + p.col + ',' + (a * .3) + ')'; c.beginPath(); c.arc(p.x, p.y, p.r * 3, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(' + p.col + ',' + a + ')'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.2832); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }
  function confettiBurst() {
    var T = tun, cols = ['#D4FF3A', '#FFD25A', '#FFFFFF', '#FF6E5A', '#78BEFF'];
    for (var i = 0; i < 160; i++) T.conf.push({ x: Math.random() * T.w, y: -20 - Math.random() * T.h * .6, vx: (Math.random() - .5) * 1.2, vy: 1.4 + Math.random() * 1.8, a: Math.random() * 6.28, va: (Math.random() - .5) * .25, ph: Math.random() * 6.28, w: 6 + Math.random() * 5, h: 3 + Math.random() * 3, col: pick(cols) });
  }
  function drawConfetti(c, h) {
    var T = tun;
    c.globalCompositeOperation = 'source-over';
    for (var k = T.conf.length - 1; k >= 0; k--) {
      var cf = T.conf[k];
      cf.x += cf.vx + Math.sin(cf.ph) * .6; cf.y += cf.vy; cf.a += cf.va; cf.ph += .05;
      if (cf.y > h + 20) { T.conf.splice(k, 1); continue; }
      c.save(); c.translate(cf.x, cf.y); c.rotate(cf.a); c.scale(1, Math.cos(cf.ph * 2));
      c.fillStyle = cf.col; c.fillRect(-cf.w / 2, -cf.h / 2, cf.w, cf.h); c.restore();
    }
  }

  /* ==== Sân vận động 3D (three.js): khán đài, khán giả chuyển động, gôn có lưới, bảng LED, cabin HLV, 22 cầu thủ ==== */
  function texCanvas(w, h, draw) {
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(cv); t.anisotropy = 8; return t;
  }
  var FONT = "'Barlow Condensed', 'Arial Narrow', sans-serif";

  function pitchTexture() {
    var S = 20;
    return texCanvas(2100, 1360, function (g, W, H) {
      for (var i = 0; i < 18; i++) { g.fillStyle = i % 2 ? '#2d7c33' : '#38913e'; g.fillRect(Math.floor(i * W / 18), 0, Math.ceil(W / 18) + 1, H); }
      for (var n = 0; n < 14000; n++) { g.fillStyle = 'rgba(0,0,0,' + (Math.random() * .07) + ')'; g.fillRect(Math.random() * W, Math.random() * H, 2, 3); }
      for (n = 0; n < 6000; n++) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * .04) + ')'; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
      function X(x) { return (x + 52.5) * S; } function Y(z) { return (z + 34) * S; }
      g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 3; g.fillStyle = 'rgba(255,255,255,.95)';
      function line(x0, z0, x1, z1) { g.beginPath(); g.moveTo(X(x0), Y(z0)); g.lineTo(X(x1), Y(z1)); g.stroke(); }
      function arc(x, z, r, a0, a1) { g.beginPath(); g.arc(X(x), Y(z), r * S, a0, a1); g.stroke(); }
      function spot(x, z) { g.beginPath(); g.arc(X(x), Y(z), 4, 0, 6.2832); g.fill(); }
      g.strokeRect(2, 2, W - 4, H - 4);
      line(0, -34, 0, 34); arc(0, 0, 9.15, 0, 6.2832); spot(0, 0);
      [-1, 1].forEach(function (sd) {
        var gl = sd * 52.5;
        line(gl, -20.16, gl - sd * 16.5, -20.16); line(gl - sd * 16.5, -20.16, gl - sd * 16.5, 20.16); line(gl - sd * 16.5, 20.16, gl, 20.16);
        line(gl, -9.16, gl - sd * 5.5, -9.16); line(gl - sd * 5.5, -9.16, gl - sd * 5.5, 9.16); line(gl - sd * 5.5, 9.16, gl, 9.16);
        var px = gl - sd * 11; spot(px, 0);
        if (sd < 0) arc(px, 0, 9.15, -0.927, 0.927); else arc(px, 0, 9.15, Math.PI - 0.927, Math.PI + 0.927);
        arc(gl, -34, 1, sd < 0 ? 0 : Math.PI / 2, sd < 0 ? Math.PI / 2 : Math.PI);
        arc(gl, 34, 1, sd < 0 ? -Math.PI / 2 : Math.PI, sd < 0 ? 0 : 1.5 * Math.PI);
      });
    });
  }

  function ledTexture(tint) {
    var t = texCanvas(1024, 64, function (g, W, H) {
      var segs = [[TEAM_UP, '#06100A', 'rgb(' + tint + ')'], ['SÂN 7 · MÙA GIẢI ' + new Date().getFullYear(), 'rgb(' + tint + ')', '#0b1d12'], [TEAM_UP, '#ffffff', '#123a22'], ['VINH DANH', '#06100A', '#ffd25a']];
      var sw = W / segs.length;
      segs.forEach(function (s, i) {
        g.fillStyle = s[2]; g.fillRect(i * sw, 0, sw, H);
        g.fillStyle = s[1]; g.font = '800 40px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(s[0], i * sw + sw / 2, H / 2 + 2);
      });
    });
    t.wrapS = THREE.RepeatWrapping; return t;
  }

  function screenTexture(p, t, tint) {
    return texCanvas(1024, 440, function (g, W, H) {
      var bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#071a10'); bg.addColorStop(1, '#0d2c1a');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgb(' + tint + ')'; g.lineWidth = 10; g.strokeRect(10, 10, W - 20, H - 20);
      g.textAlign = 'center'; g.fillStyle = 'rgb(' + tint + ')';
      g.font = '700 46px ' + FONT; g.fillText(TEAM_UP + ' · THẺ MỚI', W / 2, 92);
      g.fillStyle = '#ffffff'; g.font = '800 150px ' + FONT; g.fillText(p.name.toUpperCase(), W / 2, 250, W - 60);
      g.fillStyle = 'rgb(' + tint + ')'; g.font = '800 70px ' + FONT; g.fillText(p.ovr + '  ·  ' + p.pos + (p.num != null ? '  ·  SỐ ' + p.num : ''), W / 2, 360);
    });
  }

  function buildS3(host, tier, player) {
    if (!THREE) return null;
    var tint = TINT[tier], mobile = Math.min(window.innerWidth, window.innerHeight) < 600;
    var cv = document.createElement('canvas'); cv.className = 'hc-stadium3d'; cv.setAttribute('aria-hidden', 'true');
    host.insertBefore(cv, host.firstChild);
    var R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04070c);
    scene.fog = new THREE.Fog(0x04070c, 220, 600);
    var cam = new THREE.PerspectiveCamera(42, 1, .5, 900);
    scene.add(new THREE.HemisphereLight(0xb8cff0, 0x0d2412, .75));
    var sun = new THREE.DirectionalLight(0xffffff, .85); sun.position.set(40, 120, 60); scene.add(sun);
    var U = { time: { value: 0 }, hype: { value: .35 }, wave: { value: 0 } };
    var MATS = {};
    function lam(c, o) { var k = c + JSON.stringify(o || {}); if (!MATS[k]) MATS[k] = new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {})); return MATS[k]; }
    var tintCol = new THREE.Color('rgb(' + tint + ')');

    /* Bầu trời sao */
    var sg = new THREE.BufferGeometry(), sp = [];
    for (var i = 0; i < 900; i++) { var th = Math.random() * 6.2832, ph = Math.random() * 1.2; sp.push(420 * Math.cos(th) * Math.cos(ph), 420 * Math.sin(ph) + 30, 420 * Math.sin(th) * Math.cos(ph)); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: .6, fog: false })));

    /* Mặt cỏ + vạch vôi */
    var outer = new THREE.Mesh(new THREE.PlaneGeometry(150, 112), lam(0x1f5a25)); outer.rotation.x = -Math.PI / 2; outer.position.y = -.02; scene.add(outer);
    var ptex = pitchTexture(); ptex.anisotropy = R.capabilities.getMaxAnisotropy();
    var pitch = new THREE.Mesh(new THREE.PlaneGeometry(105, 68), new THREE.MeshLambertMaterial({ map: ptex })); pitch.rotation.x = -Math.PI / 2; scene.add(pitch);

    /* Khung thành có lưới */
    function goal(side) {
      var g = new THREE.Group(), white = lam(0xffffff, { emissive: 0x555555 });
      var post = new THREE.CylinderGeometry(.07, .07, 2.44, 10);
      [-3.66, 3.66].forEach(function (z) { var m = new THREE.Mesh(post, white); m.position.set(0, 1.22, z); g.add(m); });
      var bar = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 7.46, 10), white); bar.rotation.x = Math.PI / 2; bar.position.set(0, 2.44, 0); g.add(bar);
      var thin = lam(0xcfd6dc), bp = new THREE.CylinderGeometry(.03, .03, 2, 6);
      [-3.66, 3.66].forEach(function (z) { var m = new THREE.Mesh(bp, thin); m.position.set(-2, 1, z); g.add(m); });
      var v = [], s = .2, z, y, x;
      function yTop(lx) { return 2.44 + (2 - 2.44) * (-lx / 2); }
      for (z = -3.66; z <= 3.661; z += s) { v.push(-2, 0, z, -2, 2, z); v.push(0, 2.44, z, -2, 2, z); }
      for (y = 0; y <= 2.001; y += s) v.push(-2, y, -3.66, -2, y, 3.66);
      for (x = 0; x >= -2.001; x -= s) {
        v.push(x, yTop(x), -3.66, x, yTop(x), 3.66);
        [-3.66, 3.66].forEach(function (zz) { v.push(x, 0, zz, x, yTop(x), zz); });
      }
      for (y = 0; y <= 2.001; y += s) [-3.66, 3.66].forEach(function (zz) { v.push(0, y, zz, -2, y, zz); });
      var ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.add(new THREE.LineSegments(ng, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5 })));
      g.position.x = side * 52.5; g.rotation.y = side > 0 ? Math.PI : 0;
      scene.add(g);
    }
    goal(-1); goal(1);

    /* Bảng LED có tên đội, chữ chạy */
    var ledBase = ledTexture(tint), boards = [];
    function board(x, z, len, rotY) {
      var tex = ledBase.clone(); tex.needsUpdate = true; tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = len / 22;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(len, .95), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(x, .55, z); m.rotation.y = rotY; scene.add(m);
      var back = new THREE.Mesh(new THREE.BoxGeometry(len, 1.05, .25), lam(0x0b0f12)); back.position.set(x, .55, z); back.rotation.y = rotY;
      back.translateZ(-.14); scene.add(back);
      boards.push(tex);
    }
    board(0, 40, 112, Math.PI); board(0, -40, 112, 0); board(-59, 0, 74, Math.PI / 2); board(59, 0, 74, -Math.PI / 2);

    /* Người (cầu thủ, trọng tài, ban huấn luyện) */
    var GEO = {
      torso: new THREE.BoxGeometry(.48, .66, .28), shorts: new THREE.BoxGeometry(.46, .26, .3),
      leg: new THREE.BoxGeometry(.16, .82, .17).translate(0, -.41, 0), arm: new THREE.BoxGeometry(.12, .62, .12).translate(0, -.31, 0),
      head: new THREE.SphereGeometry(.13, 10, 8), hair: new THREE.SphereGeometry(.135, 10, 6, 0, 6.2832, 0, 1.4)
    };
    function person(shirt, shorts, socks, skin) {
      var g = new THREE.Group();
      var t = new THREE.Mesh(GEO.torso, lam(shirt)); t.position.y = 1.24; g.add(t);
      var s = new THREE.Mesh(GEO.shorts, lam(shorts)); s.position.y = .86; g.add(s);
      function limb(geo, col, x, y) { var p = new THREE.Group(); p.position.set(x, y, 0); p.add(new THREE.Mesh(geo, lam(col))); g.add(p); return p; }
      var lL = limb(GEO.leg, socks, -.12, .84), lR = limb(GEO.leg, socks, .12, .84);
      var aL = limb(GEO.arm, shirt, -.31, 1.54), aR = limb(GEO.arm, shirt, .31, 1.54);
      var h = new THREE.Mesh(GEO.head, lam(skin)); h.position.y = 1.74; g.add(h);
      var hr = new THREE.Mesh(GEO.hair, lam(0x1a1410)); hr.position.y = 1.76; g.add(hr);
      scene.add(g);
      return { g: g, lL: lL, lR: lR, aL: aL, aR: aR };
    }
    var SKIN = [0xc68a5e, 0xe0ac85, 0x8d5a3b, 0xd29a70, 0xb07650];
    var HOME = { shirt: 0xc8f03a, shorts: 0x10331e, socks: 0xc8f03a }, AWAY = { shirt: 0xf1f3f5, shorts: 0x1c2f5c, socks: 0xf1f3f5 };
    var F = [[-49, 0], [-36, -22], [-38, -8], [-38, 8], [-36, 22], [-22, -24], [-24, -8], [-24, 8], [-22, 24], [-9, -8], [-8, 8]];
    var players = [];
    [-1, 1].forEach(function (sd) {
      F.forEach(function (f, i) {
        var kit = sd < 0 ? HOME : AWAY, gk = i === 0;
        var pp = person(gk ? (sd < 0 ? 0xff8a1f : 0x8d3fd6) : kit.shirt, gk ? 0x111111 : kit.shorts, gk ? 0x111111 : kit.socks, pick(SKIN));
        players.push({ o: pp, hx: 0, hz: 0, r: gk ? .6 : .8 + Math.random() * 2.2, sp: gk ? .25 : .25 + Math.random() * .35, ph: Math.random() * 6.28 });
      });
    });
    players.forEach(function (p, i) { var f = F[i % 11], sd = i < 11 ? -1 : 1; p.hx = sd < 0 ? f[0] : -f[0]; p.hz = sd < 0 ? f[1] : -f[1]; });
    var ref = person(0x151515, 0x151515, 0x151515, pick(SKIN));
    players.push({ o: ref, hx: 4, hz: 10, r: 4, sp: .3, ph: 0 });
    var ball = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 10), lam(0xffffff, { emissive: 0x333333 })); ball.position.set(0, .12, 0); scene.add(ball);

    /* Cabin ban huấn luyện + băng ghế dự bị */
    var staff = [];
    function dugout(x, kit) {
      var g = new THREE.Group(); g.position.set(x, 0, -37.2); scene.add(g);
      var base = new THREE.Mesh(new THREE.BoxGeometry(9, .25, 2.4), lam(0x30363c)); base.position.y = .12; g.add(base);
      var wall = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, .12), lam(0x1d2328)); wall.position.set(0, 1.2, -1.1); g.add(wall);
      var dome = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 9, 20, 1, true, 0, Math.PI).rotateZ(Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: 0xa8d8ff, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false }));
      dome.position.set(0, 1.05, -.1); g.add(dome);
      var rim = new THREE.Mesh(new THREE.BoxGeometry(9.1, .08, .08), lam(0xd0d6dc)); rim.position.set(0, 1.05, 1.15); g.add(rim);
      var bench = new THREE.Mesh(new THREE.BoxGeometry(8.4, .45, .5), lam(kit === HOME ? 0x2e7d3a : 0x2a4a8a)); bench.position.set(0, .45, -.75); g.add(bench);
      for (var k = 0; k < 6; k++) {
        var st = person(kit === HOME ? 0x123a22 : 0x1c2f5c, 0x111518, 0x111518, pick(SKIN));
        g.remove(st.g); g.add(st.g);
        st.g.position.set(-3.4 + k * 1.35, -.28, -.65); st.lL.rotation.x = -Math.PI / 2; st.lR.rotation.x = -Math.PI / 2;
        st.aL.rotation.x = -.5; st.aR.rotation.x = -.5;
        staff.push(st);
      }
      var coach = person(0x0f1418, 0x0f1418, 0x0f1418, pick(SKIN));
      g.remove(coach.g); g.add(coach.g); coach.g.position.set(1.5, .25, 2.4);
      coach.aL.rotation.x = -1.2; coach.aR.rotation.x = -1.2; coach.aL.rotation.z = .6; coach.aR.rotation.z = -.6;
      staff.push(coach);
      var area = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .12 }));
      area.rotation.x = -Math.PI / 2; area.position.set(0, .01, 2.4); g.add(area);
    }
    dugout(-10, HOME); dugout(10, AWAY);

    /* Khán đài nhiều tầng + mái che + khán giả */
    var crowd = [], gap = mobile ? 1.05 : .78;
    var CROWD_COLS = [0x22262b, 0x2d3238, 0x3a3f46, 0xc8f03a, 0xc8f03a, 0xb5e033, 0x1d5c33, 0x123a22, 0xf0f0f0, 0xe8e2d0, 0x9a2b2b, 0x2d4f8a];
    var standMat = lam(0x2a2f35), roofMat = lam(0x0b0e11), facadeTex = ledBase.clone(); facadeTex.needsUpdate = true; facadeTex.wrapS = THREE.RepeatWrapping;
    function stand(cx, cz, rotY, len, tiers, opts) {
      opts = opts || {};
      var g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = rotY; scene.add(g); g.updateMatrixWorld();
      var back = 0, top = 0;
      tiers.forEach(function (T, ti) {
        var shape = new THREE.Shape(); shape.moveTo(T.z0, 0); shape.lineTo(T.z0, T.y0);
        for (var k = 0; k < T.rows; k++) { shape.lineTo(T.z0 + k * .85, T.y0 + k * .42); shape.lineTo(T.z0 + (k + 1) * .85, T.y0 + k * .42); }
        var bz = T.z0 + T.rows * .85, by = T.y0 + T.rows * .42;
        shape.lineTo(bz, by + 1.2); shape.lineTo(bz + .4, by + 1.2); shape.lineTo(bz + .4, 0); shape.lineTo(T.z0, 0);
        var geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }); geo.rotateY(-Math.PI / 2); geo.translate(len / 2, 0, 0);
        g.add(new THREE.Mesh(geo, standMat));
        back = Math.max(back, bz + .4); top = Math.max(top, by + 1.2);
        if (ti > 0) {
          var ft = facadeTex.clone(); ft.needsUpdate = true; ft.wrapS = THREE.RepeatWrapping; ft.repeat.x = len / 30; boards.push(ft);
          var fac = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.2), new THREE.MeshBasicMaterial({ map: ft }));
          fac.position.set(0, T.y0 - 1.6, T.z0 - .05); fac.rotation.y = Math.PI; g.add(fac);
        }
        for (k = 0; k < T.rows; k++) for (var x = -len / 2 + .6; x < len / 2 - .6; x += gap) {
          if (Math.random() < .07) continue;
          var lp = new THREE.Vector3(x + (Math.random() - .5) * .15, T.y0 + k * .42, T.z0 + k * .85 + .45);
          var wp = lp.applyMatrix4(g.matrixWorld);
          var col = CROWD_COLS[(Math.random() * CROWD_COLS.length) | 0];
          if (opts.tifo) col = opts.tifo((x + len / 2) / len, k / T.rows, ti) ? 0xc8f03a : 0x0f2a18;
          crowd.push({ p: wp, rot: rotY, col: col });
        }
      });
      var roof = new THREE.Mesh(new THREE.BoxGeometry(len + 2, .7, back * .7), roofMat); roof.position.set(0, top + 8, back - back * .35); g.add(roof);
      var strip = new THREE.Mesh(new THREE.BoxGeometry(len, .25, .5), new THREE.MeshBasicMaterial({ color: 0xfffbea })); strip.position.set(0, top + 7.55, back - back * .7 + .3); g.add(strip);
      for (var c = -len / 2 + 6; c <= len / 2 - 6; c += 24) { var col2 = new THREE.Mesh(new THREE.BoxGeometry(.6, 8, .6), roofMat); col2.position.set(c, top + 4, back - .5); g.add(col2); }
      var bw = new THREE.Mesh(new THREE.BoxGeometry(len, top + 8, .5), lam(0x15191d)); bw.position.set(0, (top + 8) / 2, back); g.add(bw);
      return g;
    }
    var LOW = { z0: 0, y0: 1.4, rows: 20 }, UP = { z0: 21, y0: 15, rows: 15 };
    stand(0, 44, 0, 128, [LOW, UP]); stand(0, -44, Math.PI, 128, [LOW, UP]);
    /* Tifo chữ ĐĐ trên khán đài phía đông */
    var tc = document.createElement('canvas'); tc.width = 120; tc.height = 22; var tg = tc.getContext('2d');
    tg.fillStyle = '#000'; tg.fillRect(0, 0, 120, 22); tg.fillStyle = '#fff'; tg.font = '800 21px ' + FONT; tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.fillText(TEAM_SHORT, 60, 12, 116);
    var td = tg.getImageData(0, 0, 120, 22).data;
    function tifo(u, v, ti) { if (ti > 0) return Math.random() < .5; var px = Math.min(119, Math.floor((1 - u) * 120)), py = Math.min(21, Math.floor((1 - v) * 22)); return td[(py * 120 + px) * 4] > 100; }
    stand(64, 0, Math.PI / 2, 92, [{ z0: 0, y0: 1.4, rows: 22 }, { z0: 23, y0: 16, rows: 14 }], { tifo: tifo });
    stand(-64, 0, -Math.PI / 2, 92, [LOW, UP]);
    [[1, 1], [1, -1], [-1, 1]].forEach(function (s) {
      var a = Math.atan2(s[0], s[1]); stand(s[0] * 60, s[1] * 46, a, 30, [{ z0: 0, y0: 1.4, rows: 22 }]);
    });

    /* Khán giả: instanced + shader nhún nhảy, làn sóng Mexico, đèn flash điện thoại */
    var pg = new THREE.BoxGeometry(.5, .8, .34); pg.translate(0, .4, 0);
    var cmat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    cmat.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = U.time; sh.uniforms.uHype = U.hype; sh.uniforms.uWave = U.wave;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPhase;\nattribute float aEnergy;\nuniform float uTime;\nuniform float uHype;\nuniform float uWave;\nvarying float vFlash;')
        .replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          'vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);',
          'float ang = atan(ip.z, ip.x);',
          'float d = mod(ang - uTime * 0.75 + 3.14159, 6.28318) - 3.14159;',
          'float wave = exp(-d * d * 28.0) * uWave;',
          'float spd = 2.2 + aEnergy * 4.5;',
          'float jump = abs(sin(uTime * spd + aPhase * 6.2832)) * (0.03 + 0.34 * aEnergy * uHype);',
          'transformed.y *= 1.0 + wave * 0.4;',
          'transformed.y += jump + wave * 0.5;',
          'transformed.x += sin(uTime * 1.4 + aPhase * 12.0) * (0.03 + 0.05 * uHype);',
          'float hs = fract(sin(aPhase * 91.7 + floor(uTime * 7.0) * 13.1) * 43758.5453);',
          'vFlash = step(0.9972, hs) * (0.5 + uHype);'
        ].join('\n'));
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFlash;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb += vec3(vFlash * 1.8);');
    };
    var im = new THREE.InstancedMesh(pg, cmat, crowd.length), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1), C = new THREE.Color();
    var aPh = new Float32Array(crowd.length), aEn = new Float32Array(crowd.length);
    crowd.forEach(function (cw, i) {
      Q.setFromAxisAngle(Y, cw.rot + (Math.random() - .5) * .3);
      var sc = .9 + Math.random() * .2; M4.compose(cw.p, Q, new THREE.Vector3(sc, .85 + Math.random() * .3, sc)); im.setMatrixAt(i, M4);
      C.setHex(cw.col); C.offsetHSL(0, 0, (Math.random() - .5) * .08); im.setColorAt(i, C);
      aPh[i] = Math.random(); aEn[i] = Math.pow(Math.random(), 1.6);
    });
    pg.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPh, 1));
    pg.setAttribute('aEnergy', new THREE.InstancedBufferAttribute(aEn, 1));
    scene.add(im);

    /* Cờ cổ động vẫy trên khán đài */
    var flags = [];
    var flagTex = texCanvas(128, 80, function (g, W, H) {
      g.fillStyle = '#0f2a18'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgb(' + tint + ')'; g.fillRect(0, H / 3, W, H / 3);
      g.fillStyle = '#fff'; g.font = '800 22px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(TEAM_INIT, W / 2, H / 2 + 1, W - 8);
    });
    for (i = 0; i < 14; i++) {
      var side = i % 2 ? 1 : -1, fx = -55 + (i >> 1) * 18, fg = new THREE.PlaneGeometry(4, 2.4, 14, 6);
      var fl = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ map: flagTex, side: THREE.DoubleSide }));
      fl.position.set(fx, 9 + Math.random() * 3, side * (44 + 8 + Math.random() * 6)); scene.add(fl);
      flags.push({ m: fl, base: Float32Array.from(fg.attributes.position.array), ph: Math.random() * 6 });
    }

    /* Màn hình lớn ở góc sân */
    var scr = new THREE.Group(); scr.position.set(-66, 0, -50); scr.rotation.y = Math.atan2(66, 50); scene.add(scr);
    var pole = new THREE.Mesh(new THREE.BoxGeometry(1, 20, 1), roofMat); pole.position.y = 10; scr.add(pole);
    var frame = new THREE.Mesh(new THREE.BoxGeometry(25.5, 11.5, .8), lam(0x0a0d10)); frame.position.set(0, 26, -.45); scr.add(frame);
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(24, 10.3), new THREE.MeshBasicMaterial({ map: screenTexture(player, tier, tint) })); screen.position.set(0, 26, 0); scr.add(screen);

    /* Cột đèn pha + quầng sáng + chùm sáng */
    var glowTex = texCanvas(128, 128, function (g, W) { var gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(220,235,255,.5)'); gr.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, W); });
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (s) {
      var x = s[0] * 82, z = s[1] * 62, tw = new THREE.Mesh(new THREE.CylinderGeometry(.5, .9, 50, 10), lam(0x181c20)); tw.position.set(x, 25, z); scene.add(tw);
      var head = new THREE.Group(); head.position.set(x, 51, z); head.lookAt(0, 0, 0); scene.add(head);
      var panel = new THREE.Mesh(new THREE.BoxGeometry(10, 6, .6), lam(0x101418)); head.add(panel);
      for (var a = 0; a < 3; a++) for (var b = 0; b < 5; b++) { var l = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff })); l.position.set(-4 + b * 2, -1.9 + a * 1.9, .32); head.add(l); }
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xdfe9ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      spr.scale.set(38, 38, 1); spr.position.set(x, 51, z); scene.add(spr);
      var dist = Math.hypot(x, 51, z), cg = new THREE.ConeGeometry(22, dist, 28, 1, true); cg.rotateX(-Math.PI / 2); cg.translate(0, 0, dist / 2);
      var beam = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: .022, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.set(x, 51, z); beam.lookAt(0, 0, 0); scene.add(beam);
    });

    /* Bỏ cầu thủ và trọng tài trên sân, chỉ giữ quả bóng ở chấm giữa sân */
    players.forEach(function (p) { scene.remove(p.o.g); });
    players = [];
    return { R: R, cv: cv, scene: scene, cam: cam, U: U, boards: boards, players: players, flags: flags, ball: ball, staff: staff };
  }

  function resizeS3(S, w, h) {
    if (!S) return;
    S.R.setSize(w, h, false);
    S.cam.aspect = w / h; S.cam.fov = w < h ? 70 : 48; S.cam.updateProjectionMatrix();
  }

  function renderS3(S, T, now) {
    var t = (now - T.stadAt) / 1000, gt = now / 1000;
    S.U.time.value = gt;
    var since = T.fwOn ? (now - T.fwAt) / 1000 : -1;
    S.U.hype.value = since < 0 ? .35 : .45 + .9 * Math.exp(-since / 5);
    S.U.wave.value = since < 2.5 ? 0 : Math.min(1, (since - 2.5) / 1.5);
    /* Máy quay: từ gần lùi ra rồi bay vòng chậm quanh sân */
    var e = reduce ? 1 : 1 - Math.exp(-t / 1.4), th = T.th0 + t * .045;
    var hh = 12 + 66 * e;
    S.cam.position.set((40 + 55 * e) * Math.cos(th), hh, (28 + 46 * e) * Math.sin(th));
    S.cam.lookAt(0, 5 - 5 * e, 0);
    /* Bảng LED chạy chữ */
    for (var i = 0; i < S.boards.length; i++) S.boards[i].offset.x = (gt * .025) % 1;
    /* Cầu thủ chạy khởi động quanh vị trí */
    S.players.forEach(function (p) {
      var a = gt * p.sp + p.ph, x = p.hx + Math.cos(a) * p.r, z = p.hz + Math.sin(a) * p.r * .6;
      var vx = -Math.sin(a) * p.r, vz = Math.cos(a) * p.r * .6;
      p.o.g.position.set(x, 0, z); p.o.g.rotation.y = Math.atan2(vx, vz);
      var sw = Math.sin(gt * 9 + p.ph) * (.35 + p.sp);
      p.o.lL.rotation.x = sw; p.o.lR.rotation.x = -sw; p.o.aL.rotation.x = -sw * .8; p.o.aR.rotation.x = sw * .8;
      p.o.g.position.y = Math.abs(Math.sin(gt * 9 + p.ph)) * .05;
    });
    S.ball.position.x = Math.sin(gt * .7) * .4;
    /* Cờ vẫy */
    S.flags.forEach(function (f) {
      var pos = f.m.geometry.attributes.position, b = f.base;
      for (var k = 0; k < pos.count; k++) { var x0 = b[k * 3] + 2; pos.array[k * 3 + 2] = Math.sin(x0 * 1.6 - gt * 5 + f.ph) * .35 * (x0 / 4); }
      pos.needsUpdate = true;
    });
    S.R.render(S.scene, S.cam);
  }


  /* ---- Trình tự intro ---- */
  function q(sel) { return root.matches(sel) ? root : root.querySelector(sel); }
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function quake() { var s = q('.hc-scene'); if (!s) return; s.classList.remove('quake'); void s.offsetWidth; s.classList.add('quake'); }
  function slam(label, bigHTML, cls, dur) {
    q('.hc-slam').innerHTML = '<div class="hc-slam-in ' + cls + '" style="animation-duration:' + dur + 'ms"><div class="hc-slam-label">' + esc(label) + '</div><div class="hc-slam-big">' + bigHTML + '</div><div class="hc-slam-flare"></div></div>';
  }
  function lightBurst() {
    if (!tun) return;
    tun.fwOn = true; tun.fwAt = performance.now(); tun.nextLaunch = 0;
    if (reduce) { tick(performance.now()); return; }
    for (var i = 0; i < 5; i++) launch();
    confettiBurst(); fire(1200, 7); quake();
    at(1500, function () { fire(450, 6); });
    at(2500, function () { fire(450, 6); });
  }
  function toStadium() {
    if (!tun.bowl) tun.bowl = buildBowl(tun.tier);
    tun.mode = 'stadium'; tun.stadAt = performance.now(); tun.th0 = Math.random() * 6.2832; tun.fire = [];
    if (reduce) tick(performance.now());
  }
  function blind() { var white = q('.hc-white'); white.classList.remove('go', 'blind'); void white.offsetWidth; white.classList.add('blind'); }
  function land() {
    var stage = q('.hc-stage');
    stage.classList.remove('pre', 'fly'); stage.classList.add('landed');
    if (opts.onLand) opts.onLand();
    lightBurst();
  }
  var isDone = false;
  function done() { isDone = true; q('.hc-scene').classList.add('done'); if (opts.onDone) opts.onDone(); }
  function finish() {
    clearTimers();
    q('.hc-slam').innerHTML = '';
    if (tun && tun.mode !== 'stadium') { toStadium(); tun.stadAt -= 4000; }
    q('.hc-stage').classList.remove('pre', 'fly', 'landed');
    lightBurst();
    done();
  }
  var badge = '<svg class="hc-badge" viewBox="0 0 34 34" aria-hidden="true"><path d="M17 2 L30 7 V17 C30 25 24 30 17 32 C10 30 4 25 4 17 V7 Z" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="17" cy="19" rx="3.2" ry="6" fill="currentColor"/><circle cx="17" cy="11" r="2.4" fill="currentColor"/><path d="M14 15 C9 12 8 16 10 18 M20 15 C25 12 26 16 24 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  function play() {
    var stage = q('.hc-stage'), white = q('.hc-white');
    clearTimers(); isDone = false;
    q('.hc-scene').classList.remove('done');
    stage.classList.remove('fly', 'landed'); stage.classList.add('pre');
    q('.hc-slam').innerHTML = '';
    if (opts.onStart) opts.onStart();
    Object.assign(tun, { mode: 'tunnel', fw: [], parts: [], conf: [], fwOn: false, fire: [], fireUntil: 0 });
    if (reduce) { finish(); return; }
    tun.start = performance.now(); tun.slow = false;
    white.classList.remove('go', 'blind');
    at(WALK, function () { void white.offsetWidth; white.classList.add('go'); fire(1100, 7); quake(); });
    at(2000, function () { slam('Vị trí', esc(player.pos), '', 950); fire(280, 4); });
    at(2950, function () { slam('Số áo', player.num != null ? esc(player.num) : esc(player.ovr), '', 950); fire(280, 4); });
    at(3900, function () { slam('Đội', badge + '<span>' + esc(TEAM) + '</span>', 'team', 1150); fire(280, 4); });
    /* Lóe sáng chói → ra giữa sân → thẻ xoay bay ra → pháo hoa, máy quay bay vòng quanh sân */
    at(5100, function () { q('.hc-slam').innerHTML = ''; blind(); quake(); });
    at(5380, toStadium);
    at(5600, function () { stage.classList.remove('pre'); stage.classList.add('fly'); });
    at(6750, land);
    at(7100, done);
  }

  startTunnel(q('.hc-tunnel'), opts.tier);
  window.addEventListener('resize', fit);
  play();

  return {
    play: play,
    finish: finish,
    isDone: function () { return isDone; },
    /** three.js tải xong → dựng sân 3D (nếu lỗi WebGL thì giữ sân 2D vẽ bằng canvas) */
    attachThree: function (T) {
      if (!tun || tun.s3) return;
      THREE = T;
      try { tun.s3 = buildS3(q('.hc-scene'), opts.tier, player); if (tun.s3) resizeS3(tun.s3, tun.w, tun.h); } catch (err) { tun.s3 = null; }
    },
    destroy: function () {
      clearTimers();
      window.removeEventListener('resize', fit);
      if (tun && tun.s3) { try { tun.s3.R.dispose(); tun.s3.R.forceContextLoss(); } catch (err) {} }
      if (tun) { tun.run = false; tun = null; }
    },
  };
}
