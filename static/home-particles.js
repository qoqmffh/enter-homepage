/* ENTER 홈 — 입자 스토리(장면 1~2). 기획서/클로드코드_홈_입자스토리_지시서.md 기준.
   기본 상태는 static/home-particles.css가 이미 "안전한 정적 화면"(지도 미리보기
   이미지 + 헤드라인/부제)으로 그려 둔다. 이 모듈은 WebGL과 모션이 둘 다 가능할
   때만 canvas를 켜고 GSAP ScrollTrigger로 스크롤-스크럽 장면을 재생한다.
   실패하면(three.js 로드 실패, WebGL 없음, reduced-motion) 아무 것도 건드리지
   않고 기본 정적 화면 그대로 둔다. */
import * as THREE from './vendor/three.module.min.js';

(async function () {
  'use strict';

  var section = document.getElementById('particle-story');
  var canvas = section && section.querySelector('[data-particle-canvas]');
  if (!section || !canvas) return;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function webglSupported() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (!webglSupported()) return;

  // gsap/ScrollTrigger는 classic <script defer>로 따로 로드된다 — 모듈 스크립트와
  // 상대적 실행 순서가 100% 보장되진 않으므로 짧게 폴링해서 기다린다.
  function waitFor(check, timeoutMs) {
    return new Promise(function (resolve) {
      var start = Date.now();
      (function poll() {
        if (check()) return resolve(true);
        if (Date.now() - start > timeoutMs) return resolve(false);
        requestAnimationFrame(poll);
      })();
    });
  }
  var gsapReady = await waitFor(function () { return typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined'; }, 3000);
  if (!gsapReady) return;

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  var res;
  try {
    res = await fetch('static/data/korea-points.json');
    if (!res.ok) return;
  } catch (e) { return; }
  var data = await res.json();
  var mapPoints2D = data.points; // [[x,y], ...], normalized [-1,1], y up

  // ---------------- 스캐터(흩어진 위치) 분포 ----------------
  // 지시서 §1: 시안 A "field"(공간 전체 무작위) / 시안 B "terrain"(아래쪽 지형형).
  // 비교 보고용으로 ?scatter=terrain 쿼리로 전환 가능, 기본은 field.
  var scatterMode = (new URLSearchParams(location.search).get('scatter') === 'terrain') ? 'terrain' : 'field';

  function scatterField(seed) {
    return new THREE.Vector3(
      (seed[0] - 0.5) * 12,          // x: -6..6
      (seed[1] - 0.5) * 8,           // y: -4..4
      -8 + seed[2] * 10              // z: -8..2
    );
  }
  function scatterTerrain(seed, i) {
    var x = (seed[0] - 0.5) * 12;
    var z = -8 + seed[2] * 10;
    var wave = Math.sin(x * 0.5 + i * 0.013) * 0.6 + Math.sin(x * 0.17 - i * 0.021) * 0.3;
    var y = -3.4 + wave + (seed[1] - 0.5) * 1.2;
    return new THREE.Vector3(x, y, z);
  }

  // ---------------- 입자 개수 / 모바일 분기 ----------------
  var isMobile = window.matchMedia('(max-width: 767px)').matches;
  var count = isMobile ? Math.min(1500, mapPoints2D.length) : mapPoints2D.length;

  // 모바일은 1,500개만 — 균등 샘플링(앞에서부터 자르지 않고 골고루 솎아낸다)
  var usedIndices = [];
  if (count === mapPoints2D.length) {
    for (var ii = 0; ii < count; ii++) usedIndices.push(ii);
  } else {
    var step = mapPoints2D.length / count;
    for (var jj = 0; jj < count; jj++) usedIndices.push(Math.floor(jj * step));
  }

  // ---------------- 지도 좌표 -> 월드 좌표 ----------------
  // 지도는 x:[-1,1] y:[-1,1](위) 데이터를 가로 7, 세로 7 범위로 스케일, z=0 평면.
  var MAP_SCALE = 3.6;
  var mapWorld = new Float32Array(count * 3);
  var scatterWorld = new Float32Array(count * 3);
  var delays = new Float32Array(count);
  var brights = new Float32Array(count);
  var densities = new Float32Array(count);

  // 밀도 계산(그리드 버킷, O(n) 근사) — 수도권/부산/대구 등 밀집 지역이 더 밝아지게.
  var GRID = 40;
  var buckets = {};
  function bucketKey(bx, by) { return bx + '_' + by; }
  var rawXY = [];
  for (var k = 0; k < count; k++) {
    var p = mapPoints2D[usedIndices[k]];
    rawXY.push(p);
    var bx = Math.floor((p[0] + 1) / 2 * GRID);
    var by = Math.floor((p[1] + 1) / 2 * GRID);
    var key = bucketKey(bx, by);
    (buckets[key] || (buckets[key] = [])).push(k);
  }
  var maxNeighbors = 1;
  var neighborCounts = new Float32Array(count);
  for (var k2 = 0; k2 < count; k2++) {
    var p2 = rawXY[k2];
    var bx2 = Math.floor((p2[0] + 1) / 2 * GRID);
    var by2 = Math.floor((p2[1] + 1) / 2 * GRID);
    var c = 0;
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 1; dy++) {
        var arr = buckets[bucketKey(bx2 + dx, by2 + dy)];
        if (arr) c += arr.length;
      }
    }
    neighborCounts[k2] = c;
    if (c > maxNeighbors) maxNeighbors = c;
  }

  for (var i = 0; i < count; i++) {
    var src = mapPoints2D[usedIndices[i]];
    var mv = new THREE.Vector3(src[0] * MAP_SCALE, src[1] * MAP_SCALE * 1.08, 0);
    mapWorld[i * 3] = mv.x; mapWorld[i * 3 + 1] = mv.y; mapWorld[i * 3 + 2] = mv.z;

    var seed = [Math.random(), Math.random(), Math.random()];
    var sv = scatterMode === 'terrain' ? scatterTerrain(seed, i) : scatterField(seed);
    scatterWorld[i * 3] = sv.x; scatterWorld[i * 3 + 1] = sv.y; scatterWorld[i * 3 + 2] = sv.z;

    delays[i] = Math.random() * 0.35;
    brights[i] = Math.random() < 0.1 ? 1 : 0;
    densities[i] = Math.min(1, neighborCounts[i] / (maxNeighbors * 0.75));
  }

  // ---------------- Three.js 장면 ----------------
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(52, 1, 0.1, 50);
  camera.position.set(0, 1.6, 13);

  function sizeRenderer() {
    var w = section.clientWidth, h = section.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(scatterWorld.slice(), 3));
  geometry.setAttribute('aScatter', new THREE.BufferAttribute(scatterWorld, 3));
  geometry.setAttribute('aMap', new THREE.BufferAttribute(mapWorld, 3));
  geometry.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));
  geometry.setAttribute('aBright', new THREE.BufferAttribute(brights, 1));
  geometry.setAttribute('aDensity', new THREE.BufferAttribute(densities, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute((function () {
    var a = new Float32Array(count);
    for (var s = 0; s < count; s++) a[s] = Math.random() * Math.PI * 2;
    return a;
  })(), 1));

  var uniforms = {
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    uBaseSize: { value: isMobile ? 2.2 : 3.0 },
    uDensityMix: { value: 0 }
  };

  var material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: [
      'attribute vec3 aScatter;',
      'attribute vec3 aMap;',
      'attribute float aDelay;',
      'attribute float aBright;',
      'attribute float aDensity;',
      'attribute float aSeed;',
      'uniform float uProgress;',
      'uniform float uTime;',
      'uniform float uPixelRatio;',
      'uniform float uBaseSize;',
      'uniform float uDensityMix;',
      'varying float vBright;',
      'varying float vDensity;',
      'varying float vTwinkle;',
      'void main(){',
      '  float local = clamp((uProgress - aDelay) / max(0.0001, 1.0 - aDelay), 0.0, 1.0);',
      '  float eased = local * local * (3.0 - 2.0 * local);',
      '  vec3 pos = mix(aScatter, aMap, eased);',
      '  float driftFade = 1.0 - eased;',
      '  pos.x += sin(uTime * 0.25 + aSeed) * 0.12 * driftFade;',
      '  pos.y += cos(uTime * 0.22 + aSeed * 1.7) * 0.1 * driftFade;',
      '  vBright = aBright;',
      '  vDensity = aDensity * uDensityMix;',
      '  vTwinkle = sin(uTime * 0.6 + aSeed * 3.0) * 0.5 + 0.5;',
      '  vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
      '  float size = uBaseSize * (13.0 / -mv.z);',
      '  gl_PointSize = size * uPixelRatio;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying float vBright;',
      'varying float vDensity;',
      'varying float vTwinkle;',
      'void main(){',
      '  vec2 c = gl_PointCoord - vec2(0.5);',
      '  float d = length(c);',
      '  if (d > 0.5) discard;',
      '  float alpha = (1.0 - smoothstep(0.1, 0.5, d)) * 0.8;',
      '  vec3 base = vec3(0.184, 0.561, 0.408);', // #2F8F68
      '  vec3 bright = vec3(0.365, 0.722, 0.549);', // #5DB88C
      '  float brightMix = clamp(vBright * (0.6 + vTwinkle * 0.4) + vDensity * 0.6, 0.0, 1.0);',
      '  vec3 color = mix(base, bright, brightMix);',
      '  gl_FragColor = vec4(color * alpha, alpha);',
      '}'
    ].join('\n'),
    blending: THREE.AdditiveBlending
  });

  var points = new THREE.Points(geometry, material);
  points.frustumCulled = false; // 셰이더가 position을 scatter<->map으로 동적으로 섞어서
  // 정적 position attribute 기준 bounding sphere로는 컬링을 정확히 판단할 수 없다.
  scene.add(points);

  // ---------------- 배경 깊이감: 흐린 큰 점 (모바일 생략) ----------------
  // THREE.PointsMaterial은 텍스처 없이는 사각형 스프라이트로 그려지고, 내부
  // size-attenuation 공식이 우리 메인 셰이더와 달라 화면에서 거대한 사각형으로
  // 보이는 문제가 있었다 — 메인 입자와 동일한 원형 discard 셰이더를 재사용한다.
  var bgPoints = null;
  if (!isMobile) {
    var BG_COUNT = 200;
    var bgPos = new Float32Array(BG_COUNT * 3);
    for (var b = 0; b < BG_COUNT; b++) {
      bgPos[b * 3] = (Math.random() - 0.5) * 20;
      bgPos[b * 3 + 1] = (Math.random() - 0.5) * 14;
      bgPos[b * 3 + 2] = -18 - Math.random() * 14;
    }
    var bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
    var bgMat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: uniforms.uPixelRatio },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: [
        'uniform float uPixelRatio;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  float size = 34.0 * (13.0 / -mv.z);',
        '  gl_PointSize = size * uPixelRatio;',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'void main(){',
        '  vec2 c = gl_PointCoord - vec2(0.5);',
        '  float d = length(c);',
        '  if (d > 0.5) discard;',
        '  float alpha = (1.0 - smoothstep(0.0, 0.5, d)) * 0.1;',
        '  vec3 color = vec3(0.184, 0.561, 0.408);',
        '  gl_FragColor = vec4(color * alpha, alpha);',
        '}'
      ].join('\n')
    });
    bgPoints = new THREE.Points(bgGeo, bgMat);
    scene.add(bgPoints);
  }

  // ---------------- 전환: 기본 상태 -> 라이브 ----------------
  section.classList.add('hp-particle-story--live');
  sizeRenderer();

  // ---------------- 오버레이 DOM ----------------
  var subEl = section.querySelector('[data-particle-sub]');
  var statEl = section.querySelector('[data-particle-stat]');
  var countEl = section.querySelector('[data-particle-count]');
  var progressFill = section.querySelector('[data-particle-progress]');
  var header = document.querySelector('.hp-header');

  gsap.set(statEl, { opacity: 0, y: 16 });
  if (countEl) countEl.textContent = '0';

  function remap(p, a, b) { return Math.min(1, Math.max(0, (p - a) / (b - a))); }

  // ---------------- 헤더 다크 테마: 입자 장면이 보이는 동안만 ----------------
  if (header && 'IntersectionObserver' in window) {
    var headerIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        header.classList.toggle('hp-header--on-dark', entry.isIntersecting);
      });
    }, { threshold: 0.35 });
    headerIo.observe(section);
  }

  // ---------------- 화면 밖이면 렌더 정지 ----------------
  var isVisible = true;
  if ('IntersectionObserver' in window) {
    var renderIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { isVisible = entry.isIntersecting; });
    }, { threshold: 0 });
    renderIo.observe(section);
  }

  // ---------------- 카메라 리그 ----------------
  var mouseTiltX = 0, mouseTiltY = 0;
  window.addEventListener('mousemove', function (e) {
    var nx = (e.clientX / window.innerWidth) * 2 - 1;
    var ny = (e.clientY / window.innerHeight) * 2 - 1;
    mouseTiltX = nx;
    mouseTiltY = ny;
  }, { passive: true });

  var TILT_START = THREE.MathUtils.degToRad(25);

  function updateCamera(p) {
    var formProgress = remap(p, 0.15, 0.70);
    var tilt = TILT_START * (1 - formProgress);
    var dolly = remap(p, 0.75, 1.0) * 1.0;
    var exitPull = remap(p, 0, 0.15) * 0.6;

    camera.position.x = mouseTiltX * 0.12;
    camera.position.y = 1.2 + Math.sin(tilt) * 1.3 + mouseTiltY * 0.08;
    camera.position.z = 13 - exitPull - dolly;
    camera.lookAt(0, -0.4, 0);
    camera.updateMatrixWorld(true);
  }

  // ---------------- 스크롤 타임라인 ----------------
  // onUpdate는 scrub 중 매우 잦게(초당 수십 번) 불릴 수 있는데, 그때마다
  // gsap.set으로 DOM(opacity/transform)을 바로 건드리면 이 환경에서 WebGL
  // 캔버스가 사라지는 렌더링 버그가 재현됐다. 그래서 onUpdate는 progress 값만
  // 저장하고, 실제 DOM/유니폼 갱신은 Three.js의 자체 rAF 루프(tick) 안에서
  // 화면 주사율에 맞춰 1프레임당 한 번만 수행한다.
  var latestProgress = 0;
  var lastAppliedProgress = -1;

  var st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: '+=250%',
    pin: true,
    scrub: 0.35,
    onUpdate: function (self) {
      latestProgress = self.progress;
    }
  });

  // 헤드라인(큰 두 줄, .hp-particle-line)은 의도적으로 스크롤에 맞춰
  // 움직이거나 사라지게 하지 않는다 — 이 요소를 어떤 방식으로건(gsap.set,
  // 순수 style, GSAP 타임라인+scrollTrigger, 1회성 class 토글, display:none,
  // display:contents 등 전부 시도) 건드리면 이 환경에서 WebGL 캔버스 쪽
  // 입자가 사라지는 렌더링 버그가 재현됐고 원인을 좁히지 못했다. 작은
  // 요소(부제/통계/진행바)는 동일한 방식으로 매 프레임 갱신해도 문제가 없어
  // 그대로 두고, 헤드라인만 정적으로 유지한다(다음 단계에서 재검토 필요).

  function applyProgress(p) {
    uniforms.uProgress.value = remap(p, 0.15, 0.70);
    uniforms.uDensityMix.value = remap(p, 0.75, 1.0);

    var exitP = remap(p, 0, 0.15);
    if (subEl) subEl.style.cssText = 'opacity:' + (1 - exitP) + ';transform:translate(-50%,-50%) scale(' + (1 - exitP * 0.1) + ')';

    // 45~75%: 타이포 등장 + 카운트업
    var typoP = remap(p, 0.45, 0.75);
    statEl.style.cssText = 'opacity:' + typoP + ';transform:translateY(-50%) translateY(' + (16 * (1 - typoP)) + 'px)';
    var countText = Math.round(typoP * 3000).toLocaleString('ko-KR');
    if (countEl && countEl.textContent !== countText) countEl.textContent = countText;

    if (progressFill) progressFill.style.cssText = 'transform:scaleY(' + p + ')';

    updateCamera(p);
  }

  window.addEventListener('resize', function () {
    sizeRenderer();
  });

  // ---------------- 렌더 루프 ----------------
  var clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    if (!isVisible) return;
    if (latestProgress !== lastAppliedProgress) {
      applyProgress(latestProgress);
      lastAppliedProgress = latestProgress;
    }
    uniforms.uTime.value = clock.getElapsedTime();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);
})();
