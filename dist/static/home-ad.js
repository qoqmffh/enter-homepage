/* ENTER 홈 — 인트로 "시안3": 선화 스크롤 필름(9장면 + 엔딩), 캔버스 2D.
   기준: 기획서/클로드코드_인트로시안3적용_백업_지시서_1120.md +
         기획서/마케팅/인트로시안/시안3/intro3.html("기준 구현" — 위치·크기·타이밍·곡선 값은
         대표가 하나하나 확인한 것이므로 K 키프레임 표·render() 안의 수치는 임의로 바꾸지 않는다).
   이전(2026-11-20 이전) 버전은 three.js 파티클 지도였다 — 그 코드/에셋은
   자료/_backup/intro_v1_particles_1120/에 백업, intro-v1-particles 태그로 되돌릴 수 있다.

   reduced-motion 처리: 정적 스택형 대체 레이아웃을 새로 만들지 않고, 기존과 같이
   why.html로 즉시 리다이렉트한다(템플릿 아래 인라인 스크립트에서 이미 처리) — 광고가 전하는
   숫자·이야기는 why.html에도 이미 그대로 있어서, 애니메이션 없이도 같은 내용을 보여줄 수 있다. */

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

  function cancelHardTimeout() {
    if (window.__adHardTimeout) { clearTimeout(window.__adHardTimeout); window.__adHardTimeout = null; }
  }

  function bailOut() {
    cancelHardTimeout();
    location.replace('why.html');
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
  var latestProgress = 0;
  var lastApplied = -1;
  var isMobileVL = window.matchMedia('(max-width: 767px)').matches;
  var virtualLength = (isMobileVL ? 4 : 5) * window.innerHeight;

  // 스크롤 안내(2026-11-12)
  var hintHidden = false;
  var hintBounceCount = 0;
  var hintBounceTimer = null;
  var lastHintInputTime = 0;
  var HINT_IDLE_MS = 3000;
  var HINT_MAX_BOUNCES = 3;

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  // ================= 캔버스 2D: 시안3 render() 포팅 =================
  var cv = canvas, X = cv.getContext('2d');
  var W, H, D, mob;
  function size() {
    D = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight; mob = W < 700;
    cv.width = W * D; cv.height = H * D;
    X.setTransform(D, 0, 0, D, 0, 0);
  }

  var seg = function (p, a, b) { return Math.min(1, Math.max(0, (p - a) / (b - a))); };
  var io = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var eo = function (t) { return 1 - Math.pow(1 - t, 4); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  var FONT = '"Pretendard Variable",Pretendard,"Pretendard Fallback",-apple-system,BlinkMacSystemFont,system-ui,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';

  /* ---- 에셋: static/intro/*.webp, createImageBitmap으로 미리 디코드해둔다 ---- */
  var IMG = {};
  var names = ['city_far', 'office_enter', 'store', 'office_desk', 'phone', 'calendar'];
  function loadImage(n) {
    return fetch('static/intro/' + n + '.webp')
      .then(function (r) { return r.blob(); })
      .then(function (b) { return createImageBitmap(b); })
      .then(function (bmp) { IMG[n] = bmp; });
  }

  var GRID = [], hub = null;

  /* ---- 레이어 키프레임: [p, x, y, w, alpha, blur] — intro3.html의 K 표와 동일, 값 변경 없음 ----
     무대 = 데스크톱 오른쪽 60%, 모바일 아래쪽 55%. u = 무대 폭/1000 */
  var K = {
    office_enter: [[.19, 0, 40, 300, 0], [.23, 0, 40, 560, 1], [.29, 0, 40, 600, 1], [.34, -900, 40, 520, 0]],
    city_far: [[.19, 0, 215, 1500, 0], [.23, 0, 215, 1500, .3], [.29, 0, 215, 1500, .3], [.34, -120, 175, 1500, .22], [.38, -160, 175, 1500, .22], [.41, -200, 175, 1600, 0]],
    store: [[.29, 300, 170, 560, 0], [.34, 90, 150, 700, 1], [.38, 90, 150, 720, 1], [.42, 90, 260, 1400, 0]],
    phone: [[.40, 120, 240, 160, 0], [.44, 80, 0, 760, 1], [.50, 80, 0, 760, 1], [.54, -300, 0, 600, 1], [.60, -300, 0, 600, 1], [.63, -300, 0, 560, 0]],
    office_desk: [[.50, 500, 60, 560, 0], [.55, 250, 60, 640, 1], [.60, 250, 60, 640, 1], [.63, 280, 60, 620, 0]],
    calendar: [[.80, 0, 20, 560, 0], [.84, 0, 20, 640, 1], [.89, 0, 20, 660, 1], [.91, 0, 20, 620, 0]]
  };
  function kf(arr, p) {
    if (p <= arr[0][0]) return { x: arr[0][1], y: arr[0][2], w: arr[0][3], a: 0, b: arr[0][5] || 0 };
    var l = arr[arr.length - 1];
    if (p >= l[0]) return { x: l[1], y: l[2], w: l[3], a: 0, b: l[5] || 0 };
    for (var i = 0; i < arr.length - 1; i++) {
      var A = arr[i], B = arr[i + 1];
      if (p >= A[0] && p <= B[0]) {
        var t = io(seg(p, A[0], B[0]));
        return { x: lerp(A[1], B[1], t), y: lerp(A[2], B[2], t), w: lerp(A[3], B[3], t), a: lerp(A[4], B[4], t), b: lerp(A[5] || 0, B[5] || 0, t) };
      }
    }
  }
  var SX, SY, U;
  function stage2() {
    if (mob) { SX = W * .5; SY = H * .70; U = W / 1000 * 1.05; }
    else { SX = W * .63; SY = H * .54; U = Math.min(W * .56, H * 1.05) / 1000; }
  }
  function drawImg(n, p) {
    var st = kf(K[n], p); if (!st || st.a <= .002) return null;
    var im = IMG[n]; if (!im) return null;
    var w = st.w * U, h = w * im.height / im.width;
    var x = SX + st.x * U - w / 2, y = SY + st.y * U - h / 2;
    X.globalAlpha = st.a; if (st.b > .1) X.filter = 'blur(' + st.b + 'px)';
    X.drawImage(im, x, y, w, h); X.filter = 'none'; X.globalAlpha = 1;
    return { x: x, y: y, w: w, h: h, a: st.a };
  }

  /* ---- 글자 리빌: intro3.html의 reveal()과 동일 ---- */
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

  function render(p) {
    stage2(); X.clearRect(0, 0, W, H);

    /* ===== S1~S2: 점묘 한국 지도 ===== */
    var mapA = eo(seg(p, .0, .04)) * (1 - io(seg(p, .19, .22)));
    if (mapA > 0 && GRID.length && hub) {
      var zoom = lerp(1, 1.6, io(seg(p, .18, .22)));
      var R = (mob ? 430 : 470) * U, hx = hub[0], hy = hub[1];
      var ox = SX - hx * R * (zoom - 1), oy = SY + hy * R * (zoom - 1);
      var lit = seg(p, .02, .09), yrs = seg(p, .11, .19);
      var GS = .024, sp = GS * R * zoom;
      var rG = Math.max(.8, sp * .20), rO = Math.max(1.3, sp * .31);
      for (var i = 0; i < GRID.length; i++) {
        var g = GRID[i]; var x = ox + g[0] * R * zoom, y = oy - g[1] * R * zoom;
        if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
        var sweep = (1 - (g[1] + 1) / 2);
        var p1 = g[2] < .35 ? eo(seg(lit * 1.12, sweep, sweep + .10)) : 0;
        var t2 = g[3] / 1.15, p2 = g[2] < .72 ? eo(seg(yrs, t2, t2 + .10)) : 0;
        var pop = Math.max(p1, p2);
        X.globalAlpha = .30 * mapA * (1 - pop); X.fillStyle = '#8A8A8F'; X.beginPath(); X.arc(x, y, rG, 0, 7); X.fill();
        if (pop > 0) { X.globalAlpha = mapA * Math.min(1, pop * 1.4); X.fillStyle = '#E36B2C'; X.beginPath(); X.arc(x, y, rO * (.35 + .65 * pop), 0, 7); X.fill(); }
      }
      X.globalAlpha = mapA; var hxp = ox + hx * R * zoom, hyp = oy - hy * R * zoom;
      X.strokeStyle = '#E36B2C'; X.lineWidth = 1.2; X.beginPath(); X.arc(hxp, hyp, 9, 0, 7); X.stroke();
      var pinLabel = COPY.mapPin || 'ENTER';
      X.font = '800 12px ' + FONT; var tw = X.measureText(pinLabel).width;
      X.fillStyle = '#1F1A17'; X.beginPath(); X.roundRect(hxp + 14, hyp - 10, tw + 14, 20, 10); X.fill();
      X.fillStyle = '#FBF8F4'; X.textAlign = 'left'; X.fillText(pinLabel, hxp + 21, hyp + 4);
      X.fillStyle = '#FBF8F4'; X.beginPath(); X.arc(hxp, hyp, 9, 0, 7); X.fill();
      X.strokeStyle = '#1F1A17'; X.lineWidth = 1.6; X.beginPath(); X.arc(hxp, hyp, 9, 0, 7); X.stroke();
      X.fillStyle = '#E36B2C'; X.beginPath(); X.arc(hxp, hyp, 4, 0, 7); X.fill();
      X.globalAlpha = 1;
    }

    /* ===== 선화 레이어(뒤 -> 앞) ===== */
    drawImg('city_far', p);
    drawImg('office_enter', p);
    drawImg('store', p);
    var desk = drawImg('office_desk', p);
    if (desk) {
      var dk = COPY.desk || {};
      X.globalAlpha = desk.a; X.fillStyle = '#1F1A17'; X.font = '700 ' + Math.max(12, 13 * U * 1.6) + 'px ' + FONT; X.textAlign = 'center';
      X.fillText(dk.received || '접수 담당', desk.x + desk.w * .27, desk.y - 14);
      X.fillText(dk.reply || '회신 담당', desk.x + desk.w * .73, desk.y - 14);
      X.fillStyle = '#E36B2C'; X.font = '600 ' + Math.max(11, 11 * U * 1.6) + 'px ' + FONT;
      X.fillText(dk.note || '평균 10분 내외 전달', desk.x + desk.w * .5, desk.y + desk.h + 28);
      X.globalAlpha = 1;
    }
    var ph = drawImg('phone', p);
    if (ph) {
      var sx = ph.x + ph.w * .275, sy = ph.y + ph.h * .07, sw = ph.w * .39;
      var fs = Math.round(Math.max(11, sw * .068)), lh = Math.round(fs * 1.45), pad = Math.round(fs * .8);
      var font = '500 ' + fs + 'px ' + FONT;
      X.globalAlpha = ph.a; X.font = '600 ' + fs + 'px ' + FONT; X.fillStyle = '#1F1A17'; X.textAlign = 'center';
      X.fillText(COPY.phoneTitle || 'ENTER 업무방', sx + sw / 2, sy + fs * 1.3);
      X.fillStyle = '#E8DFD6'; X.fillRect(sx, sy + fs * 2.2, sw, 1); X.textAlign = 'left'; X.font = font;
      var msgs = COPY.phoneMsgs || [];
      var maxW = sw * .78 - pad * 2; var yy = sy + fs * 3.2;
      var wrap = function (t) {
        var out = [], line = '';
        var words = t.split(' ');
        for (var w2 = 0; w2 < words.length; w2++) {
          var tst = line ? line + ' ' + words[w2] : words[w2];
          if (X.measureText(tst).width > maxW && line) { out.push(line); line = words[w2]; } else line = tst;
        }
        out.push(line); return out;
      };
      for (var mi = 0; mi < msgs.length; mi++) {
        var m = msgs[mi];
        var a = eo(seg(p, .44 + mi * .014, .452 + mi * .014)) * ph.a; if (a <= 0) continue;
        var lsArr = wrap(m[1]);
        var bw = 0; for (var li = 0; li < lsArr.length; li++) bw = Math.max(bw, X.measureText(lsArr[li]).width);
        var tw2 = bw + pad * 2, bh = lsArr.length * lh + pad * 1.1;
        var bx = m[0] === 'me' ? sx + sw - tw2 - sw * .05 : sx + sw * .05, by = yy + (1 - a) * 8;
        X.globalAlpha = a; X.fillStyle = m[0] === 'me' ? '#E36B2C' : '#F1EAE3';
        X.beginPath(); X.roundRect(bx, by, tw2, bh, Math.min(16, bh / 2)); X.fill();
        X.fillStyle = m[0] === 'me' ? '#FFFFFF' : '#1F1A17';
        for (var k2 = 0; k2 < lsArr.length; k2++) X.fillText(lsArr[k2], bx + pad, by + pad * .55 + lh * (k2 + .78));
        yy += bh + fs * .7;
      }
      X.globalAlpha = 1;
    }

    /* ===== S7: 코드로 그린 시계 ===== */
    var ca = eo(seg(p, .60, .635)) * (1 - io(seg(p, .70, .72)));
    if (ca > 0) {
      var ck = COPY.clock || {};
      var Rc = mob ? W * .29 : 250 * U, cx = SX + (mob ? 0 : 70 * U), cy = SY + (mob ? 10 : 0);
      var tt = io(seg(p, .635, .685));
      var hrs = 9 + 9 * tt;
      X.save(); X.globalAlpha = ca; X.translate(cx, cy);
      X.strokeStyle = '#6E6E73'; X.lineWidth = 1.6; X.beginPath(); X.arc(0, 0, Rc, 0, 7); X.stroke();
      X.lineWidth = 1; X.beginPath(); X.arc(0, 0, Rc * .93, 0, 7); X.stroke();
      for (var ti = 0; ti < 60; ti++) {
        var ta = ti / 60 * Math.PI * 2, big = ti % 5 === 0; var r1 = Rc * .93, r0 = Rc * (big ? .83 : .89);
        X.lineWidth = big ? 1.6 : 1; X.strokeStyle = big ? '#6E6E73' : 'rgba(110,110,115,.55)';
        X.beginPath(); X.moveTo(Math.sin(ta) * r0, -Math.cos(ta) * r0); X.lineTo(Math.sin(ta) * r1, -Math.cos(ta) * r1); X.stroke();
      }
      var a9 = (9 / 12) * Math.PI * 2 - Math.PI / 2, aNow = ((hrs % 12) / 12) * Math.PI * 2 - Math.PI / 2 + (hrs >= 12 ? Math.PI * 2 : 0);
      X.strokeStyle = '#E36B2C'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.arc(0, 0, Rc * 1.06, a9, aNow); X.stroke(); X.lineCap = 'butt';
      var ah = ((hrs % 12) / 12) * Math.PI * 2, am = ((hrs % 1)) * Math.PI * 2;
      X.strokeStyle = '#1F1A17'; X.lineWidth = 2.4; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.sin(ah) * Rc * .5, -Math.cos(ah) * Rc * .5); X.stroke();
      X.lineWidth = 1.4; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.sin(am) * Rc * .76, -Math.cos(am) * Rc * .76); X.stroke();
      X.fillStyle = '#FBF8F4'; X.strokeStyle = '#1F1A17'; X.lineWidth = 1.4; X.beginPath(); X.arc(0, 0, 4, 0, 7); X.fill(); X.stroke();
      var lab = function (t, a2, col, w2) {
        X.fillStyle = col; X.font = w2 + ' ' + Math.round(Math.max(11, Rc * .085)) + 'px ' + FONT; X.textAlign = 'center';
        X.fillText(t, Math.sin(a2) * Rc * 1.22, -Math.cos(a2) * Rc * 1.22 + 4);
      };
      X.fillStyle = '#6E6259'; X.font = '600 ' + Math.round(Math.max(11, Rc * .085)) + 'px ' + FONT;
      if (mob) { X.textAlign = 'left'; X.fillText(ck.start_mobile || '09:00 시작', -Rc * .78, 4); }
      else { X.textAlign = 'right'; X.fillText(ck.start_desktop || '09:00 업무 시작', -Rc * 1.16, 4); }
      var done = eo(seg(p, .683, .695));
      if (done > 0) {
        X.globalAlpha = ca * done; lab(ck.end || '18:00 사은품 입금', (6 / 12) * Math.PI * 2, '#E36B2C', '700');
        X.fillStyle = '#E36B2C'; X.beginPath(); X.arc(Math.sin(Math.PI) * Rc * 1.06, -Math.cos(Math.PI) * Rc * 1.06, 5, 0, 7); X.fill();
      }
      X.restore(); X.globalAlpha = 1;
    }
    if (!mob) {
      var gH = X.createLinearGradient(0, 0, W * .44, 0);
      gH.addColorStop(0, 'rgba(251,248,244,1)'); gH.addColorStop(.72, 'rgba(251,248,244,.96)'); gH.addColorStop(1, 'rgba(251,248,244,0)');
      X.fillStyle = gH; X.fillRect(0, 0, W * .44, H);
    } else {
      var gV = X.createLinearGradient(0, 0, 0, H * .52);
      gV.addColorStop(0, 'rgba(251,248,244,1)'); gV.addColorStop(.8, 'rgba(251,248,244,.96)'); gV.addColorStop(1, 'rgba(251,248,244,0)');
      X.fillStyle = gV; X.fillRect(0, 0, W, H * .52);
    }
    /* ===== S8: 정산 90회 눈금 ===== */
    var tk = seg(p, .72, .79), tko = 1 - io(seg(p, .795, .81));
    if (tk > 0 && tko > 0) {
      var stl = COPY.settlement || {};
      var bw2 = (mob ? 860 : 760) * U, x0 = SX - bw2 / 2, y2 = SY + 40 * U;
      X.strokeStyle = 'rgba(110,110,115,.35)'; X.lineWidth = 1; X.beginPath(); X.moveTo(x0, y2 + .5); X.lineTo(x0 + bw2 * eo(seg(p, .715, .74)), y2 + .5); X.stroke();
      for (var ii = 0; ii < 90; ii++) {
        var on = eo(seg(tk, ii / 90 * .8, ii / 90 * .8 + .2)); if (on <= 0) continue;
        var xx = x0 + bw2 * ii / 89, bigT = ii % 10 === 9;
        X.strokeStyle = bigT ? 'rgba(227,107,44,' + tko + ')' : 'rgba(110,110,115,' + (.8 * tko) + ')';
        X.lineWidth = bigT ? 1.6 : 1; X.beginPath(); X.moveTo(xx + .5, y2); X.lineTo(xx + .5, y2 - (bigT ? 54 : 28) * U * on); X.stroke();
      }
      X.globalAlpha = tko * eo(seg(p, .76, .79)); X.fillStyle = '#6E6259'; X.font = '600 ' + Math.max(11, 12 * U * 1.6) + 'px ' + FONT; X.textAlign = 'left';
      X.fillText(stl.range_start || '2025.01', x0, y2 + 28); X.textAlign = 'right'; X.fillText(stl.range_end || '2026.10 · 90회', x0 + bw2, y2 + 28);
      X.globalAlpha = 1;
    }
    /* ===== S9: 달력 + 정산 흐름 칩 ===== */
    var cal = drawImg('calendar', p);
    if (cal) {
      var chips = COPY.chips || [];
      var cw = 150 * U * 1.4, gap = 36 * U, tot = cw * 3 + gap * 2; var cx2 = SX - tot / 2; var cy2 = cal.y + cal.h + 30;
      X.font = '700 ' + Math.max(12, 13 * U * 1.6) + 'px ' + FONT; X.textAlign = 'center';
      for (var ci = 0; ci < chips.length; ci++) {
        var a2 = eo(seg(p, .845 + ci * .012, .86 + ci * .012)) * cal.a;
        if (a2 <= 0) { cx2 += cw + gap; continue; }
        X.globalAlpha = a2; X.fillStyle = ci === 2 ? '#E36B2C' : '#F1EAE3'; X.beginPath(); X.roundRect(cx2, cy2, cw, 40, 20); X.fill();
        X.fillStyle = ci === 2 ? '#fff' : '#1F1A17'; X.fillText(chips[ci], cx2 + cw / 2, cy2 + 25);
        if (ci < 2) { X.strokeStyle = '#C9BEB4'; X.lineWidth = 1; X.beginPath(); X.moveTo(cx2 + cw + 6, cy2 + 20); X.lineTo(cx2 + cw + gap - 6, cy2 + 20); X.stroke(); }
        cx2 += cw + gap;
      }
      X.globalAlpha = 1;
    }
    /* ===== 엔딩: 한 가닥 주황선 ===== */
    var e = eo(seg(p, .91, .95));
    if (e > 0) { var yE = H * .72; X.strokeStyle = '#E36B2C'; X.lineWidth = 1.4; X.beginPath(); X.moveTo(0, yE); X.lineTo(W * e, yE); X.stroke(); }

    /* ===== 문구 ===== */
    for (var si = 0; si < 9; si++) {
      var a3 = si * .1;
      reveal(scEls[si], a3 + .008, a3 + .030, a3 + .088, a3 + .098, p);
    }
    var cnt = function (i, to, a4, b4) {
      var el = stage.querySelector('[data-ad-n="' + i + '"]');
      if (el) el.textContent = Math.round(to * eo(seg(p, a4, b4))).toLocaleString('en-US');
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
    reveal(endEl, .912, .93, 2, 3, p);
    if (endBtns) endBtns.style.opacity = eo(seg(p, .94, .97));
    if (hudEl) {
      var sc = Math.min(9, Math.floor(p * 10) + 1);
      hudEl.innerHTML = p < .91 ? ('<b>' + String(sc).padStart(2, '0') + '</b> / 09') : '';
    }

    if (!hintHidden && p >= 0.02) hideScrollHint();
    if (endBtns) endBtns.style.pointerEvents = p >= .95 ? 'auto' : 'none';
  }

  // ================= 스크롤 안내 보이기/숨기기/튕기기 =================
  function resetHintIdle() { lastHintInputTime = performance.now(); }
  function bounceHint() {
    hintBounceCount++;
    scrollHint.classList.remove('hp-ad-scroll-hint--bounce');
    void scrollHint.offsetWidth;
    scrollHint.classList.add('hp-ad-scroll-hint--bounce');
  }
  function checkHintIdle() {
    if (hintHidden || hintBounceCount >= HINT_MAX_BOUNCES) { clearInterval(hintBounceTimer); hintBounceTimer = null; return; }
    if (performance.now() - lastHintInputTime >= HINT_IDLE_MS) {
      bounceHint();
      lastHintInputTime = performance.now();
      if (hintBounceCount >= HINT_MAX_BOUNCES) { clearInterval(hintBounceTimer); hintBounceTimer = null; }
    }
  }
  function showScrollHint() {
    if (!scrollHint) return;
    scrollHint.classList.add('hp-ad-scroll-hint--in');
    resetHintIdle();
    hintBounceTimer = setInterval(checkHintIdle, 500);
  }
  function hideScrollHint() {
    if (hintHidden || !scrollHint) return;
    hintHidden = true;
    scrollHint.classList.remove('hp-ad-scroll-hint--in');
    if (hintBounceTimer) { clearInterval(hintBounceTimer); hintBounceTimer = null; }
  }

  // ================= 재생 루프: 진행도가 실제로 바뀔 때만 그리고, 멈추면 rAF도 멈춘다 =================
  var MIN_AD_SECONDS = 30; // 광고(장면1~엔딩) 최소 재생 시간
  var smoothProgress = 0, lastTickTime = performance.now(), raf = null;
  function tick() {
    var now = performance.now(), dt = Math.min(0.05, (now - lastTickTime) / 1000); lastTickTime = now;
    var diff = latestProgress - smoothProgress;
    var moving = Math.abs(diff) > 0.00002;
    if (moving) {
      var step = diff * (1 - Math.pow(1 - 0.085, dt * 60));
      var maxStep = dt / MIN_AD_SECONDS;
      if (step > maxStep) step = maxStep; else if (step < -maxStep) step = -maxStep;
      smoothProgress += step;
    } else {
      smoothProgress = latestProgress;
    }
    var progressChanged = smoothProgress !== lastApplied;
    if (progressChanged) { render(smoothProgress); lastApplied = smoothProgress; }
    if (moving || progressChanged) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null; // 더 바뀔 게 없으면 루프를 완전히 멈춘다 — 다음 입력이 올 때 startLoop()가 다시 돈다
    }
  }
  function startLoop() {
    if (raf) return;
    lastTickTime = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { size(); render(smoothProgress); }, 100);
  }
  window.addEventListener('resize', onResize);

  // ================= 입력: 스크롤(wheel/touch/키보드)을 가상 진행도로 =================
  var touchY = 0;
  function onWheel(e) {
    e.preventDefault();
    resetHintIdle();
    if (!introDone || transitioning) return;
    latestProgress = clamp01(latestProgress + e.deltaY / virtualLength);
    startLoop();
  }
  function onTouchStart(e) { touchY = e.touches[0].clientY; resetHintIdle(); }
  function onTouchMove(e) {
    e.preventDefault();
    resetHintIdle();
    if (!introDone || transitioning) return;
    var y = e.touches[0].clientY;
    var dy = touchY - y;
    touchY = y;
    latestProgress = clamp01(latestProgress + dy / virtualLength);
    startLoop();
  }
  function onKey(e) {
    resetHintIdle();
    if (!introDone || transitioning) return;
    var step = 0.06;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      latestProgress = clamp01(latestProgress + step); e.preventDefault(); startLoop();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      latestProgress = clamp01(latestProgress - step); e.preventDefault(); startLoop();
    }
  }
  function attachInput() {
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
  }
  function detachInput() {
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('keydown', onKey);
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
      showScrollHint();
    }, 700 + 1100 + 700 + 1000);
  }

  function stopCanvas() {
    stopLoop();
    clearTimeout(resizeTimer);
    if (hintBounceTimer) { clearInterval(hintBounceTimer); hintBounceTimer = null; }
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
      location.href = 'why.html#from-ad';
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

  // ================= 시작: 에셋(webp 6장 + 격자 json) + 폰트 로딩 후 첫 렌더 =================
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
      render(0);
      startLoop();
      playIntro();
    })
    .catch(function () {
      bailOut();
    });
})();
