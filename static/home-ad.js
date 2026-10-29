/* ENTER 홈 — "광고 한 편 -> 막이 걷히며 하얀 홈" (기획서/클로드코드_홈_광고인트로_지시서.md, v8 기준).
   기준: 기획서/ENTER_광고인트로_러프영상_v8.mp4 + 기획서/참고_광고인트로_러프_v8.html
   러프 코드는 시간(초) 기준 자동재생이지만, 실제 사이트는 "스크롤 진행도"로 재생한다.
   그래서 러프의 모든 초(t) 값을 gAbs(t)로 변환해 0~1 진행도로 바꿔 쓴다 — gAbs는 아래
   SCENES 표(장면별 시작/끝 초 <-> 장면별 시작/끝 진행도%, 지시서 §1 표 기준)로 선형 변환한다.

   팀장이 다시 넣지 말라고 한 것(지시서 §0): 화면 전체 플래시, 워프, 글자 확대 줌,
   입자가 날아와 모여 로고·지도를 만드는 연출, 비 내리는 유성, 위첨자 숫자.
   -> 흩어진 별이 지도로 "모이는" 순간만큼은 위치를 보간하지 않고 스냅(hard cut)한다
      (아래 vertex shader의 step(0.5, revealOn) 참고) — 짧게 사그라들고 다른 자리에 켜지는
      것처럼 보이게 해서, 날아와서 모이는 움직임 자체가 생기지 않게 막았다.
      반대로 장면3의 "펼쳐짐"은 모양을 만드는 게 아니라 흩어지는 움직임이라 허용(v8 승인됨). */
import * as THREE from './vendor/three.module.min.js';

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

  // 하드 안전장치(인라인 head 스크립트가 걸어둔 강제 타임아웃)는 우리가 정상적으로
  // 시작한다는 신호를 보내는 순간 취소한다 — 모듈 로드/파싱 자체가 실패해도
  // 그 타임아웃이 결국 ad-pending을 풀어준다.
  function cancelHardTimeout() {
    if (window.__adHardTimeout) { clearTimeout(window.__adHardTimeout); window.__adHardTimeout = null; }
  }

  function bailOut() {
    cancelHardTimeout();
    html.classList.remove('ad-pending');
  }

  if (reduce || (!forced && recentlySeen())) {
    bailOut();
    return;
  }
  html.classList.add('ad-pending');

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (!hasWebGL()) { bailOut(); return; }

  // ================= DOM refs =================
  var introEl = safeGet('[data-ad-intro]');
  var canvas = safeGet('[data-ad-canvas]');
  var line1 = safeGet('[data-ad-s1-line1]');
  var line2 = safeGet('[data-ad-s1-line2]');
  var s2box = safeGet('[data-ad-s2-box]');
  var s2num = safeGet('[data-ad-s2-num]');
  var s2note = safeGet('[data-ad-s2-note]');
  var s3label = safeGet('[data-ad-s3-label]');
  var s3big = safeGet('[data-ad-s3-big]');
  var s3num = safeGet('[data-ad-s3-num]');
  var s4label = safeGet('[data-ad-s4-label]');
  var s4big = safeGet('[data-ad-s4-big]');
  var s4num = safeGet('[data-ad-s4-num]');
  var s4unit = safeGet('[data-ad-s4-unit]');
  var s4note = safeGet('[data-ad-s4-note]');
  var carrierEls = Array.prototype.slice.call(stage.querySelectorAll('[data-ad-carrier]'));
  var s5slogan = safeGet('[data-ad-s5-slogan]');
  var s6line1 = safeGet('[data-ad-s6-line1]');
  var s6line2 = safeGet('[data-ad-s6-line2]');
  var s6btns = safeGet('[data-ad-end-btns]');
  var enterHomeBtn = safeGet('[data-ad-enter-home]');
  var kakaoBtn = safeGet('[data-cta="kakao"]');
  var dots = Array.prototype.slice.call(stage.querySelectorAll('[data-ad-dot]'));
  var progressFill = safeGet('[data-ad-progress]');
  var skipBtn = safeGet('[data-ad-skip]');
  var wipeLayers = Array.prototype.slice.call(stage.querySelectorAll('.hp-ad-wipe-layer'));

  // ================= 장면 시간표: 러프(초) <-> 진행도(%) 변환 =================
  // t0/t1은 참고_광고인트로_러프_v8.html의 frame() 안 seg()/주석 타임라인에서 그대로 읽은 값.
  // g0/g1은 지시서 §1 표의 진행도 구간(0-14/14-34/34-50/50-68/68-86/86-100)을 0~1로.
  var SCENES = [
    { g0: 0.00, g1: 0.14, t0: 0.0, t1: 6.8 },
    { g0: 0.14, g1: 0.34, t0: 6.8, t1: 11.2 },
    { g0: 0.34, g1: 0.50, t0: 11.2, t1: 15.2 },
    { g0: 0.50, g1: 0.68, t0: 15.2, t1: 19.5 },
    { g0: 0.68, g1: 0.86, t0: 19.5, t1: 26.2 },
    { g0: 0.86, g1: 1.00, t0: 26.2, t1: 30.2 }
  ];
  function gAbs(tSec) {
    for (var i = 0; i < SCENES.length; i++) {
      var s = SCENES[i];
      if (tSec <= s.t1 || i === SCENES.length - 1) {
        var frac = (tSec - s.t0) / (s.t1 - s.t0);
        return s.g0 + frac * (s.g1 - s.g0);
      }
    }
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function fmt(n) { return Math.round(n).toLocaleString('ko-KR'); }

  // ================= 상태 =================
  var isMobile = window.matchMedia('(max-width: 767px)').matches;
  var introDone = false;
  var transitioning = false;
  var latestProgress = 0;
  var lastApplied = -1;
  var virtualLength = (isMobile ? 4 : 5) * window.innerHeight;

  // ================= Three.js 장면 =================
  var renderer, scene, camera, points, uniforms, clock, raf;
  var isVisible = true;

  function buildGeometry(mapPoints) {
    var N_BASE = isMobile ? Math.min(1500, mapPoints.length) : mapPoints.length;
    var N_EXTRA = Math.round(N_BASE / 3);
    var N = N_BASE + N_EXTRA;

    // 모바일: 지도 모양을 지키려고 균등 간격으로 샘플링(끝/앞쪽만 자르지 않음)
    var usedIdx = [];
    if (N_BASE === mapPoints.length) {
      for (var k = 0; k < N_BASE; k++) usedIdx.push(k);
    } else {
      for (var k2 = 0; k2 < N_BASE; k2++) usedIdx.push(Math.floor(k2 * mapPoints.length / N_BASE));
    }

    function rand(seed) { var x = Math.sin(seed) * 10000; return x - Math.floor(x); }

    var position = new Float32Array(N * 3);
    var aMap = new Float32Array(N * 3);
    var aSpread = new Float32Array(N * 3);
    var aRevealStart = new Float32Array(N);
    var aOrderSeed = new Float32Array(N);
    var aBackdropFlag = new Float32Array(N);
    var aTwinkleSeed = new Float32Array(N);
    var aSize = new Float32Array(N);
    var aIsExtra = new Float32Array(N);

    var W = window.innerWidth, H = window.innerHeight;
    var minDim = Math.min(W, H);
    var mapOffX = isMobile ? 0 : -0.10 * W;
    var mapOffY = isMobile ? 0.06 * H : 0.02 * H;
    var mapScale = minDim * (isMobile ? 0.62 : 0.46);

    var extraReveal0 = gAbs(11.4), extraReveal1 = gAbs(11.8);
    var EXTRA_REVEAL_WIDTH = Math.max(0.004, extraReveal1 - extraReveal0);
    var mapReveal0 = gAbs(7.0), mapReveal1 = gAbs(7.35);
    var MAP_REVEAL_WIDTH = Math.max(0.004, mapReveal1 - mapReveal0);

    var maxY = 1, minY = -1; // korea-points.json은 [-1,1] 정규화, y는 위가 +1

    for (var i = 0; i < N; i++) {
      var isExtra = i >= N_BASE ? 1 : 0;
      aIsExtra[i] = isExtra;

      var sx = (rand(i * 2 + 1) - 0.5) * W * 1.15;
      var sy = (rand(i * 2 + 7) - 0.5) * H * 1.15;
      position[i * 3 + 0] = sx;
      position[i * 3 + 1] = sy;
      position[i * 3 + 2] = (rand(i * 2 + 3) - 0.5) * 2;

      var fx = (rand(i * 3 + 11) - 0.5) * W * 1.05;
      var fy = (rand(i * 3 + 17) - 0.5) * H * 1.05;
      aSpread[i * 3 + 0] = fx;
      aSpread[i * 3 + 1] = fy;
      aSpread[i * 3 + 2] = 0;

      var order = rand(i + 41);
      aOrderSeed[i] = order;
      var tw = rand(i + 5);
      aTwinkleSeed[i] = tw;
      aBackdropFlag[i] = tw > 0.85 ? 1 : 0;
      aSize[i] = 0.6 + rand(i + 3) * 1.3;

      if (!isExtra) {
        var p = mapPoints[usedIdx[i]];
        var mx = mapOffX + p[0] * mapScale;
        var my = mapOffY + p[1] * mapScale;
        aMap[i * 3 + 0] = mx;
        aMap[i * 3 + 1] = my;
        aMap[i * 3 + 2] = 0;
        var ny = (maxY - p[1]) / (maxY - minY); // 0=북(위), 1=남(아래) -> 북쪽이 먼저 켜짐
        var jitter = rand(i + 11) * 0.35 * 0.6;
        var startSec = 7.0 + ny * 2.2 + jitter;
        aRevealStart[i] = gAbs(startSec);
      } else {
        aMap[i * 3 + 0] = 0; aMap[i * 3 + 1] = 0; aMap[i * 3 + 2] = 0;
        var off = order; // 러프 코드의 s.off 재사용(장면3 등장 + 장면4 소등 순서 공용)
        var startSecExtra = 11.4 + off * 1.8;
        aRevealStart[i] = gAbs(startSecExtra);
      }
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('aMap', new THREE.BufferAttribute(aMap, 3));
    geo.setAttribute('aSpread', new THREE.BufferAttribute(aSpread, 3));
    geo.setAttribute('aRevealStart', new THREE.BufferAttribute(aRevealStart, 1));
    geo.setAttribute('aOrderSeed', new THREE.BufferAttribute(aOrderSeed, 1));
    geo.setAttribute('aBackdropFlag', new THREE.BufferAttribute(aBackdropFlag, 1));
    geo.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(aTwinkleSeed, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    geo.setAttribute('aIsExtra', new THREE.BufferAttribute(aIsExtra, 1));

    return { geo: geo, mapRevealWidth: MAP_REVEAL_WIDTH, extraRevealWidth: EXTRA_REVEAL_WIDTH };
  }

  var VERT = [
    'attribute vec3 aMap;',
    'attribute vec3 aSpread;',
    'attribute float aRevealStart;',
    'attribute float aOrderSeed;',
    'attribute float aBackdropFlag;',
    'attribute float aTwinkleSeed;',
    'attribute float aSize;',
    'attribute float aIsExtra;',
    'uniform float uProgress;',
    'uniform float uRevealWidth;',
    'uniform float uExtraRevealWidth;',
    'uniform float uSpreadStart;',
    'uniform float uSpreadEnd;',
    'uniform float uKillStart;',
    'uniform float uKillEnd;',
    'uniform float uScatterFadeStart;',
    'uniform float uScatterFadeEnd;',
    'uniform float uBackdropStart;',
    'uniform float uBackdropEnd;',
    'uniform float uTime;',
    'uniform float uPixelRatio;',
    'uniform float uBaseSize;',
    'varying float vAlpha;',
    'varying float vFlash;',
    'varying float vBright;',
    'float seg2(float p, float a, float b){ return clamp((p-a)/max(1e-5,(b-a)), 0.0, 1.0); }',
    'float ease2(float t){ return t<0.5 ? 4.0*t*t*t : 1.0-pow(-2.0*t+2.0,3.0)/2.0; }',
    'void main(){',
    '  vBright = aTwinkleSeed;',
    '  vec3 pos = position;',
    '  pos.x += sin(uTime*0.2 + aOrderSeed*6.2831)*6.0;',
    '  pos.y += cos(uTime*0.17 + aOrderSeed*6.2831)*5.0;',
    '  float revealOn = 0.0;',
    '  float alpha = 0.0;',
    '  float spreadT = ease2(seg2(uProgress, uSpreadStart, uSpreadEnd));',
    '  if (aIsExtra < 0.5) {',
    '    float pulse = 0.85 + 0.15*sin(uTime*1.5 + aTwinkleSeed*6.2831);',
    '    float scatterFade = (1.0 - seg2(uProgress, uScatterFadeStart, uScatterFadeEnd)) * pulse;',
    '    revealOn = seg2(uProgress, aRevealStart, aRevealStart + uRevealWidth);',
    '    vec3 formedPos = mix(aMap, aSpread, spreadT);',
    '    pos = mix(pos, formedPos, step(0.5, revealOn));',
    '    alpha = max(scatterFade * (1.0 - revealOn), revealOn);',
    '  } else {',
    '    revealOn = seg2(uProgress, aRevealStart, aRevealStart + uExtraRevealWidth);',
    '    pos = mix(vec3(0.0), aSpread, spreadT);',
    '    alpha = revealOn;',
    '  }',
    '  float killP = seg2(uProgress, uKillStart, uKillEnd);',
    '  float killed = step(aOrderSeed, killP);',
    '  float flashT = killP - aOrderSeed;',
    '  float pastKillWindow = step(uKillEnd + 0.02, uProgress);',
    '  vFlash = (flashT > -0.04 && flashT < 0.02 && pastKillWindow < 0.5) ? 1.0 : 0.0;',
    '  alpha *= (1.0 - killed);',
    '  if (vFlash > 0.5) alpha = 1.0;',
    '  float backdropMix = seg2(uProgress, uBackdropStart, uBackdropEnd);',
    '  float backdropAlpha = 0.18 * aBackdropFlag;',
    '  alpha = mix(alpha, backdropAlpha, backdropMix);',
    '  vAlpha = alpha;',
    '  vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
    '  gl_PointSize = aSize * uBaseSize * uPixelRatio * mix(1.8, 1.0, clamp(revealOn,0.0,1.0));',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'varying float vAlpha;',
    'varying float vFlash;',
    'varying float vBright;',
    'void main(){',
    '  vec2 c = gl_PointCoord - vec2(0.5);',
    '  float d = length(c);',
    '  if (d > 0.5) discard;',
    '  float a = (1.0 - smoothstep(0.1, 0.5, d)) * vAlpha;',
    '  if (a <= 0.003) discard;',
    '  vec3 base = vec3(0.184, 0.561, 0.408);',
    '  vec3 bright = vec3(0.365, 0.722, 0.549);',
    '  vec3 flashC = vec3(0.745, 0.941, 0.831);',
    '  vec3 color = mix(base, bright, step(0.9, vBright));',
    '  color = mix(color, flashC, vFlash);',
    '  gl_FragColor = vec4(color*a, a);',
    '}'
  ].join('\n');

  function initThree(mapPoints) {
    var W = window.innerWidth, H = window.innerHeight;
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 10);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    var pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);

    var built = buildGeometry(mapPoints);

    uniforms = {
      uProgress: { value: 0 },
      uRevealWidth: { value: built.mapRevealWidth },
      uExtraRevealWidth: { value: built.extraRevealWidth },
      uSpreadStart: { value: gAbs(11.2) },
      uSpreadEnd: { value: gAbs(13.6) },
      uKillStart: { value: gAbs(15.6) },
      uKillEnd: { value: gAbs(16.6) },
      uScatterFadeStart: { value: gAbs(6.3) },
      uScatterFadeEnd: { value: gAbs(7.6) },
      uBackdropStart: { value: gAbs(19.5) },
      uBackdropEnd: { value: gAbs(21.0) },
      uTime: { value: 0 },
      uPixelRatio: { value: pr },
      uBaseSize: { value: isMobile ? 2.3 : 3.0 }
    };

    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });

    points = new THREE.Points(built.geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    clock = new THREE.Clock();
  }

  function sizeRenderer() {
    if (!renderer) return;
    var W = window.innerWidth, H = window.innerHeight;
    camera.left = -W / 2; camera.right = W / 2; camera.top = H / 2; camera.bottom = -H / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H, false);
  }
  window.addEventListener('resize', sizeRenderer);

  // 휠 입력은 한 칸(약 100px)씩 뚝뚝 들어오므로, 목표 진행도(latestProgress)를 바로 쓰지 않고
  // 매 프레임 부드럽게 따라가게 한다(관성 스무딩). 프레임레이트와 무관하게 같은 속도로 수렴.
  var smoothProgress = 0, lastTickTime = performance.now();
  function tick() {
    raf = requestAnimationFrame(tick);
    var now = performance.now(), dt = Math.min(0.05, (now - lastTickTime) / 1000); lastTickTime = now;
    if (!isVisible) return;
    var diff = latestProgress - smoothProgress;
    if (Math.abs(diff) > 0.00002) {
      smoothProgress += diff * (1 - Math.pow(1 - 0.085, dt * 60));
    } else {
      smoothProgress = latestProgress;
    }
    if (smoothProgress !== lastApplied) {
      applyProgress(smoothProgress);
      lastApplied = smoothProgress;
    }
    uniforms.uTime.value = clock.getElapsedTime();
    renderer.render(scene, camera);
  }

  var visObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { isVisible = e.isIntersecting; });
  }, { threshold: 0 });
  visObserver.observe(stage);

  // ================= 장면별 DOM 업데이트(러프의 seg()/op() 그대로, 초 -> gAbs()) =================
  function updateDots(p) {
    for (var i = 0; i < SCENES.length; i++) {
      var s = SCENES[i];
      var active = (p >= s.g0 && p < s.g1) || (i === SCENES.length - 1 && p >= s.g1);
      if (dots[i]) dots[i].classList.toggle('hp-ad-dot--active', active);
    }
  }

  function applyProgress(p) {
    uniforms.uProgress.value = p;

    // 장면 1
    var h1Op = seg(p, gAbs(3.0), gAbs(3.6)) * (1 - seg(p, gAbs(6.0), gAbs(6.8)));
    var h1Ty = (1 - seg(p, gAbs(3.0), gAbs(3.6))) * 30 - seg(p, gAbs(6.0), gAbs(6.8)) * 60;
    if (line1) { line1.style.opacity = h1Op; line1.style.transform = 'translateY(' + h1Ty + 'px)'; }
    var h2Op = seg(p, gAbs(3.4), gAbs(4.0)) * (1 - seg(p, gAbs(6.0), gAbs(6.8)));
    var h2Ty = (1 - seg(p, gAbs(3.4), gAbs(4.0))) * 30 + seg(p, gAbs(6.0), gAbs(6.8)) * 60;
    if (line2) { line2.style.opacity = h2Op; line2.style.transform = 'translateY(' + h2Ty + 'px)'; }

    // 장면 2
    var k1Op = seg(p, gAbs(8.6), gAbs(9.3)) * (1 - seg(p, gAbs(10.6), gAbs(11.0)));
    var k1Ty = (1 - seg(p, gAbs(8.6), gAbs(9.3))) * 20;
    if (s2box) { s2box.style.opacity = k1Op; s2box.style.transform = 'translateY(-50%) translateY(' + k1Ty + 'px)'; }
    var k1sOp = seg(p, gAbs(9.0), gAbs(9.6)) * (1 - seg(p, gAbs(10.6), gAbs(11.0)));
    if (s2note) s2note.style.opacity = k1sOp;
    if (s2num) s2num.textContent = fmt(3000 * ease(seg(p, gAbs(8.6), gAbs(10.4))));

    // 장면 3
    var k2aOp = seg(p, gAbs(11.6), gAbs(12.1)) * (1 - seg(p, gAbs(14.8), gAbs(15.2)));
    if (s3label) s3label.style.opacity = k2aOp;
    var k2Op = seg(p, gAbs(11.8), gAbs(12.4)) * (1 - seg(p, gAbs(14.8), gAbs(15.2)));
    var k2Ty = (1 - seg(p, gAbs(11.8), gAbs(12.4))) * 24;
    if (s3big) { s3big.style.opacity = k2Op; s3big.style.transform = 'translateY(' + k2Ty + 'px)'; }
    if (s3num) s3num.textContent = fmt(4000 * ease(seg(p, gAbs(11.8), gAbs(14.0))));

    // 장면 4
    var killP = seg(p, gAbs(15.6), gAbs(16.6));
    var k3Op = seg(p, gAbs(15.3), gAbs(15.7)) * (1 - seg(p, gAbs(19.0), gAbs(19.4)));
    if (s4label) s4label.style.opacity = k3Op;
    if (s4big) s4big.style.opacity = k3Op;
    var done = killP >= 1;
    if (s4num) s4num.textContent = fmt(4000 * (1 - killP));
    if (s4unit) s4unit.textContent = done ? '회' : '건';
    if (s4label) s4label.textContent = done ? '정산 누락' : '이번 주 정산 진행 중';
    if (s4big) s4big.classList.toggle('hp-ad-done', done);
    var k3sOp = seg(p, gAbs(16.8), gAbs(17.2)) * (1 - seg(p, gAbs(19.0), gAbs(19.4)));
    if (s4note) s4note.style.opacity = k3sOp;

    // 장면 5
    carrierEls.forEach(function (el, i) {
      var a = 19.8 + i * 0.8;
      var cp = seg(p, gAbs(a), gAbs(a + 1.6));
      var sc = 3.2 - 2.9 * cp;
      var op = (cp > 0 && cp < 1) ? Math.sin(Math.PI * cp) : 0;
      var blur = cp < 0.25 ? (0.25 - cp) * 24 : 0;
      el.style.opacity = op;
      el.style.transform = 'translate(-50%,-50%) scale(' + sc + ')';
      el.style.filter = 'none'; // 120px 글자에 매 프레임 blur는 무거워서 끊김 유발 -> 투명도·크기만 사용
    });
    var slogOp = seg(p, gAbs(24.6), gAbs(25.1)) * (1 - seg(p, gAbs(25.9), gAbs(26.2)));
    if (s5slogan) s5slogan.style.opacity = slogOp;

    // 장면 6
    if (s6line1) s6line1.style.opacity = seg(p, gAbs(26.4), gAbs(27.0));
    if (s6line2) {
      s6line2.style.opacity = seg(p, gAbs(27.0), gAbs(27.5));
      var f = seg(p, gAbs(27.5), gAbs(28.6));
      s6line2.style.color = 'rgb(' + Math.round(58 + 197 * f) + ',' + Math.round(63 + 192 * f) + ',' + Math.round(72 + 178 * f) + ')';
    }
    if (s6btns) {
      var btnsOp = seg(p, gAbs(28.6), gAbs(29.1));
      s6btns.style.opacity = btnsOp;
      s6btns.style.transform = 'translateY(' + ((1 - btnsOp) * 16) + 'px)';
      s6btns.style.pointerEvents = p >= 0.95 ? 'auto' : 'none';
    }

    if (progressFill) progressFill.style.transform = 'scaleX(' + p + ')';
    updateDots(p);
  }

  // ================= 입력: 스크롤(wheel/touch/키보드)을 가상 진행도로 =================
  var touchY = 0;
  function onWheel(e) {
    e.preventDefault();
    if (!introDone || transitioning) return;
    latestProgress = clamp01(latestProgress + e.deltaY / virtualLength);
  }
  function onTouchStart(e) { touchY = e.touches[0].clientY; }
  function onTouchMove(e) {
    e.preventDefault();
    if (!introDone || transitioning) return;
    var y = e.touches[0].clientY;
    var dy = touchY - y;
    touchY = y;
    latestProgress = clamp01(latestProgress + dy / virtualLength);
  }
  function onKey(e) {
    if (!introDone || transitioning) return;
    var step = 0.06;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      latestProgress = clamp01(latestProgress + step); e.preventDefault();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      latestProgress = clamp01(latestProgress - step); e.preventDefault();
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
    attachInput(); // 잠겨 있지만(introDone=false) 리스너는 먼저 달아둔다
    requestAnimationFrame(function () {
      introEl.classList.add('hp-ad-intro--in');
    });
    setTimeout(function () {
      introEl.classList.remove('hp-ad-intro--in');
      introEl.classList.add('hp-ad-intro--out');
    }, 700 + 1100);
    setTimeout(function () {
      introEl.classList.add('hp-ad-intro--done');
      stage.classList.add('hp-ad-stage--sky');
    }, 700 + 1100 + 700);
    setTimeout(function () {
      introDone = true;
    }, 700 + 1100 + 700 + 1000);
  }

  // ================= 전환: 막이 걷힘(초록 띠 와이프) -> 하얀 홈 =================
  function revealWhiteHome() {
    var lines = document.querySelectorAll('.hp-hero .hp-display-xl .hp-headline-line');
    lines.forEach(function (el) {
      el.style.transition = 'none';
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
    });
    html.classList.remove('ad-pending');
    window.scrollTo(0, 0);
    requestAnimationFrame(function () {
      lines.forEach(function (el, i) {
        el.style.transition = 'opacity .6s ease ' + (i * 0.1) + 's, transform .6s ease ' + (i * 0.1) + 's';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
      setTimeout(function () {
        lines.forEach(function (el) {
          el.style.transition = ''; el.style.opacity = ''; el.style.transform = '';
        });
      }, 600 + lines.length * 100 + 50);
    });
    if (window.ScrollTrigger) { try { ScrollTrigger.refresh(); } catch (e) {} }
  }

  function stopThree() {
    if (raf) cancelAnimationFrame(raf);
    visObserver.disconnect();
    if (renderer) {
      renderer.dispose();
      if (points) { points.geometry.dispose(); points.material.dispose(); }
    }
  }

  function beginTransition() {
    if (transitioning) return;
    transitioning = true;
    detachInput();
    markSeen();

    stage.classList.add('hp-ad-stage--leaving');
    requestAnimationFrame(function () {
      stage.style.transform = 'translateX(100%)';
    });
    wipeLayers.forEach(function (layer, i) {
      setTimeout(function () {
        layer.style.transition = 'transform .72s cubic-bezier(.7,0,.3,1)';
        layer.style.transform = 'translateX(100%)';
      }, i * 80);
    });

    setTimeout(function () {
      stopThree();
      stage.style.display = 'none';
      revealWhiteHome();
    }, 900);
  }

  if (skipBtn) skipBtn.addEventListener('click', beginTransition);
  if (enterHomeBtn) enterHomeBtn.addEventListener('click', beginTransition);
  if (kakaoBtn) {
    kakaoBtn.addEventListener('click', function (e) {
      if (kakaoBtn.getAttribute('href') === '#') e.preventDefault();
      try {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'ad_cta_kakao_click' });
      } catch (err) {}
    });
  }

  // ================= 시작: 지도 데이터 로드 후 Three.js 초기화 =================
  cancelHardTimeout();

  fetch('static/data/korea-points.json')
    .then(function (r) { if (!r.ok) throw new Error('korea-points fetch failed'); return r.json(); })
    .then(function (data) {
      initThree(data.points);
      tick();
      playIntro();
    })
    .catch(function () {
      bailOut();
    });
})();
