/* ENTER 홈 — 인트로 "시안4": 점 한국 지도 + 3D 카메라(EnduroSat 구조), 캔버스 2D.
   기준: 기획서/마케팅/클로드코드_인트로시안4적용_지시서_1120.md +
         기획서/마케팅/인트로시안/시안4/intro4.html("기준 구현" — 카메라 키프레임(KF)·장면
         타이밍·곡선·크기·문구는 대표가 하나하나 확인한 값이므로 임의로 바꾸지 않는다).
   이전(시안3, 선화 스크롤 필름) 버전은 intro-v2-lineart 태그 +
   자료/_backup/intro_v2_lineart_1120/에 백업되어 있다. 그 이전(파티클)은 intro-v1-particles.

   스크롤 감각(대표 지적 사항) — "굴린 만큼만" 움직인다:
   최소 재생 시간·속도 상한을 전부 없앴다. 휠 이벤트마다 목표 진행도(target)에 바로
   더하고, 화면(P)은 매 프레임 P += (target-P)*0.18로만 따라간다. 입력이 쌓이지 않으므로
   손을 떼면 금방(이론상 ~390ms, 0.18 수렴 특성) 멈춘다 — 기준 구현의 스크롤 공식과 동일.

   reduced-motion 처리: 시안3 적용 때와 같은 방식(why.html로 즉시 리다이렉트) 유지. */

(function () {
  'use strict';

  var html = document.documentElement;
  var stage = document.querySelector('[data-ad-stage]');
  if (!stage) return;

  function safeGet(sel) { return stage.querySelector(sel); }

  var ONE_HOUR = 60 * 60 * 1000;
  var STORE_KEY = 'enter_ad_seen';

  function markSeen() { try { localStorage.setItem(STORE_KEY, String(Date.now())); } catch (e) {} }
  function recentlySeen() {
    try {
      var last = localStorage.getItem(STORE_KEY);
      return !!last && (Date.now() - parseInt(last, 10)) < ONE_HOUR;
    } catch (e) { return false; }
  }

  var params = new URLSearchParams(location.search);
  var forced = params.get('intro') === '1';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  function cancelHardTimeout() {
    if (window.__adHardTimeout) { clearTimeout(window.__adHardTimeout); window.__adHardTimeout = null; }
  }

  function bailOut() {
    cancelHardTimeout();
    location.replace('/why');
  }

  if (reduce || (!forced && recentlySeen())) {
    bailOut();
    return;
  }
  html.classList.add('ad-pending');

  // ================= DOM refs =================
  var introEl = safeGet('[data-ad-intro]');
  var canvas = safeGet('[data-ad-canvas]');
  var txtRoot = safeGet('[data-ad-txt]');
  var scEls = Array.prototype.slice.call(stage.querySelectorAll('[data-ad-sc]'));
  var endEl = safeGet('[data-ad-end]');
  var endBtns = safeGet('[data-ad-end-btns]');
  var hudEl = safeGet('[data-ad-hud]');
  var enterHomeBtn = safeGet('[data-ad-enter-home]');
  var ctaPrimaryBtn = safeGet('[data-ad-cta-primary]');
  var skipBtn = safeGet('[data-ad-skip]');
  var scrollHint = safeGet('[data-ad-scroll-hint]');
  var wipeLayers = Array.prototype.slice.call(stage.querySelectorAll('.hp-ad-wipe-layer'));

  var copyEl = document.getElementById('hp-ad-copy');
  var COPY = {};
  try { COPY = JSON.parse(copyEl.textContent); } catch (e) {}

  // ================= 상태 =================
  var introDone = false;
  var transitioning = false;

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  // ================= 캔버스 2D =================
  var cv = canvas, X = cv.getContext('2d');
  var W, H, D, mob, HDR;
  function size() {
    D = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight; mob = W < 700;
    HDR = 76; // 실제 사이트 헤더 높이(static/site.css .hp-header-inner) — 모바일도 동일
    cv.width = W * D; cv.height = H * D;
    X.setTransform(D, 0, 0, D, 0, 0);
  }

  var seg = function (p, a, b) { return Math.min(1, Math.max(0, (p - a) / (b - a))); };
  var io = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var eo = function (t) { return 1 - Math.pow(1 - t, 4); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var DEG = Math.PI / 180;

  var FONT = function (w, s) { return w + ' ' + s + 'px "Pretendard Variable",Pretendard,"Pretendard Fallback Win","Pretendard Fallback Mac","Pretendard Fallback Android",-apple-system,BlinkMacSystemFont,system-ui,"Apple SD Gothic Neo","Noto Sans KR",sans-serif'; };

  /* ---- 에셋: static/intro/*.webp(속 채움 선화), createImageBitmap으로 미리 디코드 ----
     AS의 h(기준 높이)·gf(바닥 접지 비율)는 기준 구현 값 그대로 — 바꾸지 않는다. */
  var IMG = {};
  var AS = {
    office_enter: { h: 190, gf: .676 },
    store: { h: 160, gf: .725 },
    phone: { h: 170, gf: .996 },
    office_desk: { h: 140, gf: .615 },
    calendar: { h: 150, gf: .975 }
  };
  var names = Object.keys(AS);
  function loadImage(n) {
    return fetch('static/intro/' + n + '.webp')
      .then(function (r) { return r.blob(); })
      .then(function (b) { return createImageBitmap(b); })
      .then(function (bmp) { IMG[n] = bmp; });
  }

  /* ---- 세계: 지도 평면 y=0, 지도 좌표(x,y) -> 세계(X=x*SC, Z=-y*SC) ---- */
  var SC = 1000;
  var GRID = [], hub = null, city = null, LINKS = [];
  function Wp(x, y, h) { h = h || 0; return [x * SC, h, -y * SC]; }

  /* ---- 카메라 키프레임 KF(19개) — 기준 구현 그대로, 임의로 바꾸지 않는다 ----
     [p, 목표x, 목표y(지도), 거리, 내려보는 각(도), 돌아간 각(도), 목표 높이] */
  var KF = [];
  function buildKF() {
    var h = hub, c = city;
    KF = [
      [0.00, .00, .02, 3300, 62, 0, 0],
      [0.09, .00, .02, 3100, 58, -6, 0],
      [0.19, .00, .02, 2900, 55, -10, 0],
      [0.24, h[0], h[1], 900, 38, -18, 60],
      [0.29, h[0], h[1], 820, 34, -24, 60],
      [0.34, c[0], c[1], 760, 30, 12, 50],
      [0.39, c[0], c[1], 700, 28, 18, 50],
      [0.44, c[0], c[1], 360, 14, 22, 70],
      [0.49, c[0], c[1], 330, 12, 24, 70],
      [0.54, h[0], h[1], 640, 26, -30, 50],
      [0.59, h[0], h[1], 600, 24, -34, 50],
      [0.64, .00, .05, 2300, 70, 0, 250],
      [0.69, .00, .05, 2200, 72, 6, 250],
      [0.74, .00, .00, 3200, 50, 20, 0],
      [0.79, .00, .00, 3300, 46, 32, 0],
      [0.84, h[0], h[1], 760, 30, -10, 60],
      [0.89, h[0], h[1], 720, 28, -14, 60],
      [0.96, .00, .00, 4300, 58, 0, 0],
      [1.00, .00, .00, 4400, 60, 4, 0]
    ];
  }

  /* ---- 마우스 기울기: yaw +mx*5°, pitch -my*2.5°. 매 프레임 0.06으로 수렴.
     터치 기기(pointer:coarse)에서는 끈다(목표를 항상 0으로 둬서 자연히 안 움직임). ---- */
  var MX = 0, MY = 0, mx = 0, my = 0;
  function onMouseMove(e) {
    MX = (e.clientX / W - .5) * 2;
    MY = (e.clientY / H - .5) * 2;
    startLoop();
  }
  /* 검증용 훅(기준 구현의 window.__mouse처럼) — 정확한 좌표로 즉시 반영, 시안 비교용. */
  window.__adSetMouse = function (x, y) { MX = x; MY = y; mx = x; my = y; draw(P); };

  function cam(p) {
    var a = KF[0], b = KF[KF.length - 1];
    for (var i = 0; i < KF.length - 1; i++) {
      if (p >= KF[i][0] && p <= KF[i + 1][0]) { a = KF[i]; b = KF[i + 1]; break; }
    }
    var t = io(seg(p, a[0], b[0]));
    var v = a.map(function (x, i) { return lerp(x, b[i], t); });
    return { tx: v[1] * SC, tz: -v[2] * SC, dist: v[3], pitch: (v[4] - my * 2.5) * DEG, yaw: (v[5] + mx * 5) * DEG, ty: v[6] };
  }
  var CX, CY, F, C, FW, RT, UP;
  function setCam(c) {
    var ce = io(seg(P, .91, .96));
    CX = lerp(mob ? W * .5 : W * .64, W * .5, ce);
    CY = lerp(mob ? HDR + (H - HDR) * .66 : HDR + (H - HDR) * .56, HDR + (H - HDR) * (mob ? .66 : .60), ce);
    F = (mob ? W * 1.5 : H * 1.25);
    var T = [c.tx, c.ty, c.tz];
    C = [T[0] + c.dist * Math.sin(c.yaw) * Math.cos(c.pitch), T[1] + c.dist * Math.sin(c.pitch), T[2] + c.dist * Math.cos(c.yaw) * Math.cos(c.pitch)];
    var f = [T[0] - C[0], T[1] - C[1], T[2] - C[2]];
    var fl = Math.hypot(f[0], f[1], f[2]);
    FW = f.map(function (v) { return v / fl; });
    var r = [-FW[2], 0, FW[0]];
    var rl = Math.hypot(r[0], r[1], r[2]);
    RT = r.map(function (v) { return v / rl; });
    UP = [RT[1] * FW[2] - RT[2] * FW[1], RT[2] * FW[0] - RT[0] * FW[2], RT[0] * FW[1] - RT[1] * FW[0]];
  }
  function proj(Pt) {
    var d = [Pt[0] - C[0], Pt[1] - C[1], Pt[2] - C[2]];
    var z = d[0] * FW[0] + d[1] * FW[1] + d[2] * FW[2];
    if (z < 10) return null;
    var x = d[0] * RT[0] + d[1] * RT[1] + d[2] * RT[2], y = d[0] * UP[0] + d[1] * UP[1] + d[2] * UP[2];
    return [CX + F * x / z, CY - F * y / z, F / z, z];
  }

  /* 그림을 지도 위에 세운다(항상 화면을 향함). pop: 0->1 솟아오름 */
  function billboard(n, mapx, mapy, a, pop, dx) {
    pop = pop === undefined ? 1 : pop; dx = dx || 0;
    var Am = AS[n], im = IMG[n];
    var q = proj(Wp(mapx, mapy));
    if (!q || !im || a <= .003) return null;
    var s = q[2], h = Am.h / Am.gf * s * (.6 + .4 * pop), w = h * im.width / im.height;
    var x = q[0] + dx * s, y = q[1];
    X.globalAlpha = a * pop; X.drawImage(im, x - w / 2, y - h * Am.gf, w, h); X.globalAlpha = 1;
    return { x: x - w / 2, y: y - h * Am.gf, w: w, h: h, s: s };
  }

  function arcPts(a, b, lift, n) {
    n = n || 40;
    var A = Wp(a[0], a[1]), B = Wp(b[0], b[1]);
    var L = Math.hypot(B[0] - A[0], B[2] - A[2]);
    var o = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      o.push([lerp(A[0], B[0], t), Math.sin(t * Math.PI) * L * lift, lerp(A[2], B[2], t)]);
    }
    return o;
  }
  function strokePath(pts, u, col, w, a) {
    var pr = [];
    var n = Math.max(1, Math.floor(pts.length * u));
    for (var i = 0; i < n; i++) { var q = proj(pts[i]); if (q) pr.push(q); }
    if (pr.length < 2 || a <= 0) return pr;
    X.globalAlpha = a; X.strokeStyle = col; X.lineWidth = w;
    X.beginPath();
    pr.forEach(function (q, i) { if (i) X.lineTo(q[0], q[1]); else X.moveTo(q[0], q[1]); });
    X.stroke(); X.globalAlpha = 1;
    return pr;
  }

  /* ---- 글자 리빌: 줄마다 차례로(step .0085) ---- */
  function reveal(el, in0, in1, out0, out1, p) {
    if (!el) return;
    var ls = el.querySelectorAll('.hp-ad-m>span');
    el.style.visibility = (p >= in0 - .001 && p <= out1 + .001) ? 'visible' : 'hidden';
    var step = .0085, dur = Math.max(.016, in1 - in0);
    for (var i = 0; i < ls.length; i++) {
      var st = in0 + i * step;
      var a = eo(seg(p, st, st + dur)), b = io(seg(p, out0, out1));
      ls[i].style.transform = 'translate3d(0,' + ((1 - a) * 105 - b * 105) + '%,0)';
      ls[i].style.opacity = String(Math.min(1, a * 1.3) * (1 - b));
    }
  }

  var GS = 0.024;
  function draw(p) {
    P = p; X.clearRect(0, 0, W, H); if (!hub) return;
    var c = cam(p); setCam(c);
    if (coarsePointer || mob) { txtRoot.style.transform = 'none'; }
    else { txtRoot.style.transform = 'translate(' + (-mx * 6) + 'px,calc(-50% + ' + (-my * 4) + 'px))'; }

    var deskA = seg(p, .52, .545) * (1 - seg(p, .61, .625)), calA = seg(p, .82, .84) * (1 - seg(p, .905, .92));
    // 한 번에 주인공 하나: 초점 그림 외에는 숨긴다
    var offA = (1 - seg(p, .32, .345)) + seg(p, .93, .97), stA = seg(p, .30, .32) * (1 - seg(p, .42, .44)), phA = seg(p, .425, .445) * (1 - seg(p, .53, .545));
    var offAA = Math.min(1, offA) * (1 - Math.max(deskA, calA));

    /* ===== 1. 점 지도(항상) ===== */
    var lit = seg(p, .02, .09), yrs = seg(p, .11, .19);
    var pts = [];
    for (var gi = 0; gi < GRID.length; gi++) {
      var g = GRID[gi];
      var q = proj(Wp(g[0], g[1]));
      if (!q || q[0] < -20 || q[0] > W + 20 || q[1] < HDR - 20 || q[1] > H + 20) continue;
      var sweep = (1 - (g[1] + 1) / 2), p1 = g[2] < .35 ? eo(seg(lit * 1.12, sweep, sweep + .10)) : 0, t2 = g[3] / 1.15, p2 = g[2] < .72 ? eo(seg(yrs, t2, t2 + .10)) : 0;
      pts.push([q, Math.max(p1, p2)]);
    }
    var sp = Math.max(1, GS * SC * 0.9);
    var zT = c.dist;
    for (var pi = 0; pi < pts.length; pi++) {
      var qq = pts[pi][0], pop = pts[pi][1];
      var s = qq[2], rG = Math.min(mob ? 1.6 : 2.2, Math.max(.6, sp * .20 * s)), rO = Math.min(mob ? 2.5 : 3.6, Math.max(1, sp * .31 * s));
      var near = Math.min(1, Math.max(0, (qq[3] - zT * .35) / (zT * .35)));
      var nearA = near; if (nearA <= .01) continue;
      X.globalAlpha = .32 * (1 - pop) * nearA; X.fillStyle = '#8A8A8F'; X.beginPath(); X.arc(qq[0], qq[1], rG, 0, 7); X.fill();
      if (pop > 0) { X.globalAlpha = Math.min(1, pop * 1.4) * nearA; X.fillStyle = '#E36B2C'; X.beginPath(); X.arc(qq[0], qq[1], rO * (.35 + .65 * pop), 0, 7); X.fill(); }
    }
    X.globalAlpha = 1;

    /* ===== 2. 정산 90회 — 지도를 두르는 궤도 눈금 ===== */
    var ringOn = seg(p, .71, .785), ringA = p < .7 ? 0 : (p < .93 ? (1 - seg(p, .80, .82)) : seg(p, .93, .97));
    if (ringA > 0) {
      var RR = 1250;
      for (var ri = 0; ri < 90; ri++) {
        var on = p >= .93 ? 1 : eo(seg(ringOn, ri / 90 * .8, ri / 90 * .8 + .2)); if (on <= 0) continue;
        var ra2 = ri / 90 * Math.PI * 2 - Math.PI / 2, big = ri % 10 === 9;
        var L = (big ? 110 : 55) * on;
        var A = [Math.cos(ra2) * RR, 0, Math.sin(ra2) * RR], B = [Math.cos(ra2) * (RR + L), 0, Math.sin(ra2) * (RR + L)];
        var qa = proj(A), qb = proj(B); if (!qa || !qb) continue;
        X.globalAlpha = ringA; X.strokeStyle = big ? '#E36B2C' : 'rgba(110,110,115,.7)'; X.lineWidth = big ? 2 : 1.1;
        X.beginPath(); X.moveTo(qa[0], qa[1]); X.lineTo(qb[0], qb[1]); X.stroke();
      }
      X.globalAlpha = 1;
      var raLab = seg(p, .76, .785) * (1 - seg(p, .79, .80));
      if (raLab > 0) {
        var qLab = proj([0, 0, -RR - 180]);
        if (qLab) {
          X.globalAlpha = raLab; X.font = FONT(700, 13); X.fillStyle = '#6E6259'; X.textAlign = 'center';
          X.fillText(COPY.settlementLabel || '2025.01 → 2026.10 · 정산 90회', qLab[0], qLab[1]);
          X.globalAlpha = 1;
        }
      }
    }
    /* ===== 3. 연결선: ENTER -> 전국 거래처(호) ===== */
    var linkA = eo(seg(p, .22, .27));
    var dimL = (p > .40 && p < .93) ? (1 - .8 * seg(p, .40, .42)) : 1;
    if (linkA > 0) {
      LINKS.forEach(function (L, i) {
        var u = p >= .95 ? 1 : eo(seg(p, .22 + i * .0012, .27 + i * .0012));
        var hi = (L.main && p >= .29 && p < .41);
        strokePath(L.pts, u, hi ? '#E36B2C' : 'rgba(227,107,44,.38)', hi ? 2.2 : 1, linkA * (hi ? 1 : dimL));
      });
    }
    // 4장면: 주요 연결선을 따라 이동하는 한 건(접수)
    if (p > .29 && p < .345) {
      var tDot = io(seg(p, .29, .34));
      var L0 = LINKS[0];
      if (L0) {
        var qDot = proj(L0.pts[Math.floor(tDot * (L0.pts.length - 1))]);
        if (qDot) { X.fillStyle = '#E36B2C'; X.beginPath(); X.arc(qDot[0], qDot[1], 5, 0, 7); X.fill(); }
      }
    }
    /* ===== 4. 지도 위 그림들 ===== */
    var off = billboard('office_enter', hub[0], hub[1], offAA, eo(seg(p, .215, .25)));
    var st = billboard('store', city[0], city[1], stA, eo(seg(p, .30, .335)));
    var ph = billboard('phone', city[0], city[1], phA, eo(seg(p, .425, .455)), 0);
    var dk = billboard('office_desk', hub[0], hub[1], deskA, eo(seg(p, .525, .55)), 0);
    var cl = billboard('calendar', hub[0], hub[1], calA, eo(seg(p, .82, .85)), 0);
    // 라벨(작게, 그림 위)
    var tags = COPY.tags || {};
    var tag = function (t, x, y, a) {
      if (a <= 0) return;
      X.globalAlpha = a; X.font = FONT(800, 12); var tw = X.measureText(t).width;
      X.fillStyle = '#1F1A17'; X.beginPath(); X.roundRect(x - tw / 2 - 8, y - 22, tw + 16, 20, 10); X.fill();
      X.fillStyle = '#FBF8F4'; X.textAlign = 'center'; X.fillText(t, x, y - 8); X.globalAlpha = 1;
    };
    if (off) tag(tags.hq || 'ENTER 본사', off.x + off.w / 2, off.y - 6, offAA * seg(p, .23, .25));
    if (st) tag(tags.city || '거래처 판매점', st.x + st.w / 2, st.y - 6, stA * seg(p, .32, .34));
    // 휴대폰 속 대화
    if (ph && ph.w > 150) {
      var phAlpha = seg(p, .43, .45) * (1 - seg(p, .53, .545));
      var sx = ph.x + ph.w * .275, sy = ph.y + ph.h * .07, sw = ph.w * .39, fs = Math.round(Math.max(11, sw * .068)), lh = Math.round(fs * 1.45), pad = Math.round(fs * .8);
      X.globalAlpha = phAlpha; X.font = FONT(600, fs); X.fillStyle = '#1F1A17'; X.textAlign = 'center';
      X.fillText(COPY.phoneTitle || 'ENTER 업무방', sx + sw / 2, sy + fs * 1.3);
      X.fillStyle = '#E8DFD6'; X.fillRect(sx, sy + fs * 2.2, sw, 1); X.textAlign = 'left'; X.font = FONT(500, fs);
      var msgs = COPY.phoneMsgs || []; var maxW = sw * .78 - pad * 2; var yy = sy + fs * 3.2;
      var wrap = function (t) {
        var o = [], l = '';
        var words = t.split(' ');
        for (var wi = 0; wi < words.length; wi++) {
          var s2 = l ? l + ' ' + words[wi] : words[wi];
          if (X.measureText(s2).width > maxW && l) { o.push(l); l = words[wi]; } else l = s2;
        }
        o.push(l); return o;
      };
      for (var mi = 0; mi < msgs.length; mi++) {
        var m = msgs[mi];
        var b2 = eo(seg(p, .445 + mi * .012, .456 + mi * .012)) * phAlpha; if (b2 <= 0) continue;
        var ls2 = wrap(m[1]);
        var bw = 0; for (var li = 0; li < ls2.length; li++) bw = Math.max(bw, X.measureText(ls2[li]).width);
        var tw2 = bw + pad * 2, bh = ls2.length * lh + pad * 1.1;
        var bx = m[0] === 'me' ? sx + sw - tw2 - sw * .05 : sx + sw * .05, by = yy + (1 - b2) * 8;
        X.globalAlpha = b2; X.fillStyle = m[0] === 'me' ? '#E36B2C' : '#F1EAE3';
        X.beginPath(); X.roundRect(bx, by, tw2, bh, Math.min(16, bh / 2)); X.fill();
        X.fillStyle = m[0] === 'me' ? '#fff' : '#1F1A17';
        for (var k2 = 0; k2 < ls2.length; k2++) X.fillText(ls2[k2], bx + pad, by + pad * .55 + lh * (k2 + .78));
        yy += bh + fs * .7;
      }
      X.globalAlpha = 1;
    }
    if (dk) {
      var dkA = seg(p, .545, .56) * (1 - seg(p, .605, .62));
      var dkCopy = COPY.desk || {};
      X.globalAlpha = dkA; X.font = FONT(700, 13); X.fillStyle = '#1F1A17'; X.textAlign = 'center';
      X.fillText(dkCopy.received || '접수 담당', dk.x + dk.w * .27, dk.y - 10);
      X.fillText(dkCopy.reply || '회신 담당', dk.x + dk.w * .73, dk.y - 10);
      X.fillStyle = '#E36B2C'; X.fillText(dkCopy.note || '평균 10분 내외 전달', dk.x + dk.w * .5, dk.y + dk.h * AS.office_desk.gf + 24);
      X.globalAlpha = 1;
    }
    /* ===== 5. 하루(시계) — 지도 위 공중 ===== */
    var ca = seg(p, .61, .635) * (1 - seg(p, .70, .715));
    if (ca > 0) {
      var qClock = proj([0, 520, -50]);
      if (qClock) {
        var Rc = Math.min(mob ? W * .26 : H * .2, 200);
        var tt = io(seg(p, .635, .685)), hrs = 9 + 9 * tt;
        var ck = COPY.clock || {};
        X.save(); X.globalAlpha = ca; X.translate(qClock[0], qClock[1]);
        X.fillStyle = 'rgba(251,248,244,.92)'; X.beginPath(); X.arc(0, 0, Rc, 0, 7); X.fill();
        X.strokeStyle = '#6E6E73'; X.lineWidth = 1.6; X.stroke();
        for (var ti = 0; ti < 12; ti++) {
          var ta = ti / 12 * Math.PI * 2;
          X.beginPath(); X.moveTo(Math.sin(ta) * Rc * .84, -Math.cos(ta) * Rc * .84); X.lineTo(Math.sin(ta) * Rc * .93, -Math.cos(ta) * Rc * .93); X.stroke();
        }
        var a9 = (9 / 12) * Math.PI * 2 - Math.PI / 2, aN = ((hrs % 12) / 12) * Math.PI * 2 - Math.PI / 2 + (hrs >= 12 ? Math.PI * 2 : 0);
        X.strokeStyle = '#E36B2C'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.arc(0, 0, Rc * 1.07, a9, aN); X.stroke(); X.lineCap = 'butt';
        var ah = ((hrs % 12) / 12) * Math.PI * 2, am = (hrs % 1) * Math.PI * 2;
        X.strokeStyle = '#1F1A17'; X.lineWidth = 2.4; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.sin(ah) * Rc * .5, -Math.cos(ah) * Rc * .5); X.stroke();
        X.lineWidth = 1.4; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.sin(am) * Rc * .76, -Math.cos(am) * Rc * .76); X.stroke();
        X.font = FONT(600, 13); X.fillStyle = '#6E6259'; X.textAlign = 'right';
        X.fillText(ck.start_desktop || '09:00 업무 시작', -Rc * 1.16, 4);
        var dn = eo(seg(p, .683, .695));
        if (dn > 0) {
          X.globalAlpha = ca * dn; X.fillStyle = '#E36B2C'; X.font = FONT(700, 13); X.textAlign = 'center';
          X.fillText(ck.end || '18:00 사은품 입금', 0, Rc * 1.07 + 24);
          X.beginPath(); X.arc(0, Rc * 1.07, 5, 0, 7); X.fill();
        }
        X.restore();
      }
    }
    /* ===== 6. 정산 칩(달력 아래) ===== */
    if (cl) {
      var chipA = seg(p, .84, .855) * (1 - seg(p, .9, .915));
      var chips = COPY.chips || [];
      var cw = mob ? 96 : 132, gap = mob ? 12 : 24, tot = cw * 3 + gap * 2;
      var cx = cl.x + cl.w / 2 - tot / 2, cy = cl.y + cl.h * AS.calendar.gf + 20;
      X.font = FONT(700, 14); X.textAlign = 'center';
      for (var ci = 0; ci < chips.length; ci++) {
        var b3 = eo(seg(p, .85 + ci * .01, .862 + ci * .01)) * chipA;
        if (b3 > 0) {
          X.globalAlpha = b3; X.fillStyle = ci === 2 ? '#E36B2C' : '#EFE8E1'; X.beginPath(); X.roundRect(cx, cy, cw, 36, 18); X.fill();
          X.fillStyle = ci === 2 ? '#fff' : '#1F1A17'; X.fillText(chips[ci], cx + cw / 2, cy + 23);
        }
        cx += cw + gap;
      }
      X.globalAlpha = 1;
    }
    /* ===== ENTER 표시(지도 단계) ===== */
    var hq = proj(Wp(hub[0], hub[1])), ha = 1 - seg(p, .2, .225);
    if (hq && ha > 0) {
      var pinLabel = COPY.mapPin || 'ENTER';
      X.globalAlpha = ha; X.font = FONT(800, 12); var tw3 = X.measureText(pinLabel).width;
      X.fillStyle = '#1F1A17'; X.beginPath(); X.roundRect(hq[0] + 14, hq[1] - 10, tw3 + 14, 20, 10); X.fill();
      X.fillStyle = '#FBF8F4'; X.textAlign = 'left'; X.fillText(pinLabel, hq[0] + 21, hq[1] + 4);
      X.beginPath(); X.arc(hq[0], hq[1], 9, 0, 7); X.fill();
      X.strokeStyle = '#1F1A17'; X.lineWidth = 1.6; X.stroke();
      X.fillStyle = '#E36B2C'; X.beginPath(); X.arc(hq[0], hq[1], 4, 0, 7); X.fill(); X.globalAlpha = 1;
    }
    /* ===== 글자 칸 가독성 ===== */
    if (p < .92) {
      if (!mob) {
        var gH = X.createLinearGradient(0, 0, W * .46, 0);
        gH.addColorStop(0, 'rgba(251,248,244,1)'); gH.addColorStop(.68, 'rgba(251,248,244,.93)'); gH.addColorStop(1, 'rgba(251,248,244,0)');
        X.fillStyle = gH; X.fillRect(0, HDR, W * .46, H - HDR);
      } else {
        var gV = X.createLinearGradient(0, 0, 0, H * .48);
        gV.addColorStop(0, 'rgba(251,248,244,1)'); gV.addColorStop(.8, 'rgba(251,248,244,.95)'); gV.addColorStop(1, 'rgba(251,248,244,0)');
        X.fillStyle = gV; X.fillRect(0, 0, W, H * .48);
      }
    } else {
      var aEnd = io(seg(p, .92, .96)), cxE = W / 2, cyE = HDR + (H - HDR) * .30, rr = Math.min(W * .42, 520);
      X.save(); X.translate(cxE, cyE); X.scale(1, .55);
      var gE = X.createRadialGradient(0, 0, 0, 0, 0, rr);
      gE.addColorStop(0, 'rgba(251,248,244,' + (aEnd * .92) + ')');
      gE.addColorStop(.55, 'rgba(251,248,244,' + (aEnd * .75) + ')');
      gE.addColorStop(1, 'rgba(251,248,244,0)');
      X.fillStyle = gE; X.fillRect(-rr, -rr, rr * 2, rr * 2);
      X.restore();
    }
    /* ===== 문구 ===== */
    for (var si = 0; si < 9; si++) {
      var a5 = si * .1;
      reveal(scEls[si], a5 + .008, a5 + .030, a5 + .086, a5 + .097, p);
    }
    var cnt = function (i, to, a6, b4) {
      var el = stage.querySelector('[data-ad-n="' + i + '"]');
      if (el) el.textContent = Math.round(to * eo(seg(p, a6, b4))).toLocaleString('en-US');
    };
    cnt(0, 3000, .02, .08); cnt(2, 4000, .22, .28); cnt(5, 10, .52, .56);
    var yEl = stage.querySelector('[data-ad-n="1"]');
    if (yEl) {
      yEl.textContent = String(Math.round(lerp(2010, 2026, seg(p, .12, .19))));
      var smallEl = scEls[1] && scEls[1].querySelector('small');
      if (smallEl) smallEl.textContent = p < .19 ? '년' : '년까지';
    }
    var tEl = stage.querySelector('[data-ad-n="6"]');
    if (tEl) {
      var hh2 = 9 + 9 * io(seg(p, .635, .685));
      var hh = Math.floor(hh2 + 1e-6), mm = Math.floor((hh2 - hh) * 60 / 10) * 10;
      tEl.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    }
    reveal(endEl, .935, .955, 2, 3, p);
    if (endBtns) {
      var btnsOp = eo(seg(p, .96, .985));
      endBtns.style.opacity = btnsOp;
      endBtns.style.pointerEvents = p >= .985 ? 'auto' : 'none';
    }
    if (hudEl) {
      var scn = Math.min(9, Math.floor(p * 10) + 1);
      hudEl.innerHTML = p < .9 ? ('<b>' + String(scn).padStart(2, '0') + '</b> / 09') : '';
    }
    // 스크롤 안내: 1장면(p<.1)에서만, intro 끝난 뒤부터
    if (scrollHint) scrollHint.classList.toggle('hp-ad-scroll-hint--in', introDone && p < .1);
  }

  // ================= 재생 루프: "굴린 만큼만" — 입력을 쌓지 않는다 =================
  // target: 휠/터치/키보드가 바로 더하는 목표 진행도. P: 화면에 그리는 값, 매 프레임
  // target을 18%씩 따라간다(최소재생시간·속도상한 없음 — 기준 구현과 같은 공식).
  var target = 0, P = 0, raf = null;
  function tick() {
    var dm = Math.abs(MX - mx) + Math.abs(MY - my);
    mx += (MX - mx) * .06; my += (MY - my) * .06;
    var moving = Math.abs(target - P) > 1e-5 || dm > 1e-4;
    if (moving) {
      draw(P + (target - P) * .14);
      raf = requestAnimationFrame(tick);
    } else {
      P = target; draw(P);
      raf = null; // 진행도·마우스 둘 다 멈추면 rAF도 멈춘다
    }
  }
  function startLoop() {
    if (raf) return;
    raf = requestAnimationFrame(tick);
  }
  function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { size(); draw(P); }, 100);
  }
  window.addEventListener('resize', onResize);

  // ================= 입력: "굴린 만큼만" — 휠/터치 같은 계수(/14000), 쌓이지 않음 =================
  // 대표 요청(2026-11-20): 휠 한 칸에 진행되는 양을 절반으로(/14000 -> /28000) 줄여 천천히,
  // 그리고 장면마다 문구·숫자가 다 찬 지점(멈춤점)에서는 휠을 3~4번(420) 더 굴려야 넘어간다.
  var BASE = 28000, DETENT = 420;
  var STOPS = [0.082, 0.182, 0.282, 0.382, 0.482, 0.582, 0.682, 0.782, 0.882];
  var hold = -1, holdDir = 0, holdAcc = 0;
  function advance(d) {
    if (!d) return;
    var dir = d > 0 ? 1 : -1;
    if (hold >= 0) {
      if (dir !== holdDir) { hold = -1; holdAcc = 0; }
      else {
        holdAcc += Math.abs(d);
        if (holdAcc < DETENT) return;
        var rest = holdAcc - DETENT; hold = -1; holdAcc = 0;
        target = clamp01(target + dir * rest / BASE);
        return;
      }
    }
    var nt = clamp01(target + d / BASE);
    for (var i = 0; i < STOPS.length; i++) {
      var s = STOPS[i];
      if ((dir > 0 && target < s - 1e-6 && nt >= s) || (dir < 0 && target > s + 1e-6 && nt <= s)) {
        target = s; hold = s; holdDir = dir; holdAcc = Math.abs(nt - s) * BASE;
        if (holdAcc >= DETENT) { var r = holdAcc - DETENT; hold = -1; holdAcc = 0; target = clamp01(s + dir * r / BASE); }
        return;
      }
    }
    target = nt;
  }
  var touchY = 0;
  function onWheel(e) {
    e.preventDefault();
    if (!introDone || transitioning) return;
    var d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;
    d = Math.max(-120, Math.min(120, d));
    advance(d);
    startLoop();
  }
  function onTouchStart(e) { touchY = e.touches[0].clientY; }
  function onTouchMove(e) {
    e.preventDefault();
    if (!introDone || transitioning) return;
    var y = e.touches[0].clientY;
    var dy = touchY - y;
    touchY = y;
    advance(dy);
    startLoop();
  }
  function jumpScene(dir) {
    var idx = target * 10;
    var newIdx = dir > 0 ? Math.floor(idx + 1e-6) + 1 : Math.ceil(idx - 1e-6) - 1;
    target = clamp01(Math.round(newIdx) / 10);
    startLoop();
  }
  function onKey(e) {
    if (!introDone || transitioning) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { jumpScene(1); e.preventDefault(); }
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') { jumpScene(-1); e.preventDefault(); }
  }
  function attachInput() {
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    if (!coarsePointer) window.addEventListener('mousemove', onMouseMove);
  }
  function detachInput() {
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('mousemove', onMouseMove);
  }

  // ================= 인트로(자동재생, 효과 없음) =================
  function playIntro() {
    attachInput();
    requestAnimationFrame(function () { introEl.classList.add('hp-ad-intro--in'); });
    setTimeout(function () {
      introEl.classList.remove('hp-ad-intro--in');
      introEl.classList.add('hp-ad-intro--out');
    }, 700 + 1100);
    setTimeout(function () {
      introEl.classList.add('hp-ad-intro--done');
      stage.classList.add('hp-ad-stage--film');
    }, 700 + 1100 + 700);
    setTimeout(function () {
      introDone = true;
    }, 700 + 1100 + 700 + 1000);
  }

  function stopCanvas() {
    stopLoop();
    clearTimeout(resizeTimer);
  }

  function beginTransition() {
    if (transitioning) return;
    transitioning = true;
    detachInput();
    markSeen();

    wipeLayers.forEach(function (layer, i) {
      setTimeout(function () {
        layer.style.transition = 'transform .72s cubic-bezier(.7,0,.3,1)';
        layer.style.transform = 'translateX(0)';
      }, i * 80);
    });

    setTimeout(function () {
      stopCanvas();
      location.href = '/why#from-ad';
    }, 900);
  }

  if (skipBtn) skipBtn.addEventListener('click', beginTransition);
  if (enterHomeBtn) enterHomeBtn.addEventListener('click', beginTransition);
  if (ctaPrimaryBtn) {
    ctaPrimaryBtn.addEventListener('click', function (e) {
      if (ctaPrimaryBtn.getAttribute('href') === '#') e.preventDefault();
      beginTransition();
    });
  }

  // ================= 시작: 에셋(webp 5장 + 지도 json) + 폰트 로딩 후 첫 렌더 =================
  cancelHardTimeout();
  size();

  var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();

  Promise.all([
    Promise.all(names.map(loadImage)),
    fetch('static/intro/korea-grid.json').then(function (r) {
      if (!r.ok) throw new Error('korea-grid fetch failed');
      return r.json();
    }),
    fontsReady
  ])
    .then(function (results) {
      var gridData = results[1];
      hub = gridData.hub;
      GRID = gridData.grid;
      city = gridData.city;
      LINKS = gridData.links.map(function (l) {
        return { pts: arcPts(l.a, l.b, l.lift, l.n), main: l.main };
      });
      buildKF();
      draw(0);
      playIntro();
      /* 검증용 훅(기준 구현 intro4.html의 window.render처럼) — 정확한 진행도로 캡처해
         시안과 비교할 때만 쓴다. 평소 사용자 흐름에는 전혀 관여하지 않는다. */
      window.__adSetProgress = function (p) {
        introEl.classList.remove('hp-ad-intro--in', 'hp-ad-intro--out');
        introEl.classList.add('hp-ad-intro--done');
        stage.classList.add('hp-ad-stage--film');
        introDone = true; target = p; P = p; draw(p);
      };
      /* 검증용 훅: 현재 화면 진행도(P)·목표 진행도(target)를 읽기만 한다(스크롤 감각
         수치 검증용, §3-2). 쓰기는 하지 않으므로 평소 흐름에 관여하지 않는다. */
      window.__adDebugP = function () { return P; };
      window.__adDebugTarget = function () { return target; };
    })
    .catch(function () {
      bailOut();
    });
})();
