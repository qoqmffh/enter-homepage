/* 커스텀 커서 — 십자 + 추적 링 + 라벨 원 (지시서 2026-11-04). static/cursor.css와 짝.
   (hover:hover) and (pointer:fine) and >=1024px에서만 켠다. prefers-reduced-motion이면
   커서 자체는 그대로 켜지지만 링의 rAF 보간만 꺼서 좌표에 바로 붙는다. */
(function () {
  'use strict';
  var html = document.documentElement;

  var mqCapable = window.matchMedia('(hover:hover) and (pointer:fine)');
  var mqDesktop = window.matchMedia('(min-width:1024px)');
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  var cross = document.createElement('div');
  cross.className = 'cursor-cross';
  cross.setAttribute('aria-hidden', 'true');
  var ring = document.createElement('div');
  ring.className = 'cursor-ring';
  ring.setAttribute('aria-hidden', 'true');
  var ringLabel = document.createElement('span');
  ringLabel.className = 'cursor-ring-label';
  ring.appendChild(ringLabel);

  var active = false;
  var reduceMotion = false;
  var mx = 0, my = 0;       /* 실제 마우스 좌표 */
  var rx = 0, ry = 0;       /* 링의 보간된 좌표 */
  var scale = 1;            /* 클릭 피드백 — ring 자신의 translate3d와 한 문자열로 합친다 */
  var clickAnimStart = null;
  var CLICK_ANIM_MS = 150;
  var rafId = null;
  var started = false;

  function setCrossTransform(x, y) {
    cross.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
  }
  function composeRingTransform(x, y) {
    return 'translate3d(' + x + 'px,' + y + 'px,0)' + (scale !== 1 ? ' scale(' + scale + ')' : '');
  }
  function updateClickScale(now) {
    if (clickAnimStart === null) { scale = 1; return false; }
    var t = now - clickAnimStart;
    if (t >= CLICK_ANIM_MS) { clickAnimStart = null; scale = 1; return false; }
    scale = 1 - 0.1 * Math.sin(Math.PI * (t / CLICK_ANIM_MS));
    return true;
  }

  function ensureRaf() {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  function tick(now) {
    var posActive = false;
    if (!reduceMotion) {
      rx += (mx - rx) * 0.25;
      ry += (my - ry) * 0.25;
      posActive = Math.abs(mx - rx) > 0.1 || Math.abs(my - ry) > 0.1;
    }
    var clickActive = updateClickScale(now || performance.now());
    ring.style.transform = composeRingTransform(rx, ry);
    if (posActive || clickActive) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null; /* 멈춰 있으면 rAF 루프도 멈춘다 */
    }
  }

  function onMouseMove(e) {
    mx = e.clientX;
    my = e.clientY;
    setCrossTransform(mx, my);
    if (reduceMotion) {
      rx = mx; ry = my;
      ring.style.transform = composeRingTransform(rx, ry);
      if (clickAnimStart !== null) ensureRaf(); /* 클릭 펄스만은 reduced-motion에서도 돈다 */
    } else {
      ensureRaf();
    }
  }

  function updateHoverState(target) {
    html.classList.remove('cursor-on-label', 'cursor-on-link', 'cursor-on-field', 'cursor-tone-light', 'cursor-tone-green');
    var fieldEl = target && target.closest && target.closest('input, textarea, select, [contenteditable]');
    var labelEl = target && target.closest && target.closest('[data-cursor-label]');
    var linkEl = target && target.closest && target.closest('a, button, [role="button"]');
    if (fieldEl) {
      html.classList.add('cursor-on-field');
      ringLabel.textContent = '';
    } else if (labelEl) {
      html.classList.add('cursor-on-label');
      var tone = labelEl.getAttribute('data-cursor-tone');
      if (tone === 'light') html.classList.add('cursor-tone-light');
      else if (tone === 'green') html.classList.add('cursor-tone-green');
      ringLabel.textContent = labelEl.getAttribute('data-cursor-label') || '';
    } else {
      ringLabel.textContent = '';
      if (linkEl) html.classList.add('cursor-on-link');
    }
  }

  function onMouseOver(e) { updateHoverState(e.target); }
  function onWindowEnter() { html.classList.remove('cursor-outside'); }
  function onWindowLeave() { html.classList.add('cursor-outside'); }
  function onMouseDown() {
    html.classList.add('cursor-clicking');
    clickAnimStart = performance.now();
    ensureRaf();
  }
  function onMouseUp() { html.classList.remove('cursor-clicking'); }

  function start() {
    if (started) return;
    started = true;
    document.body.appendChild(cross);
    document.body.appendChild(ring);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    html.addEventListener('mouseenter', onWindowEnter);
    html.addEventListener('mouseleave', onWindowLeave);
  }
  function stop() {
    if (!started) return;
    started = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseover', onMouseOver);
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mouseup', onMouseUp);
    html.removeEventListener('mouseenter', onWindowEnter);
    html.removeEventListener('mouseleave', onWindowLeave);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    scale = 1; clickAnimStart = null;
    html.classList.remove('cursor-on-label', 'cursor-on-link', 'cursor-on-field', 'cursor-tone-light', 'cursor-tone-green', 'cursor-outside', 'cursor-clicking');
    if (cross.parentNode) cross.parentNode.removeChild(cross);
    if (ring.parentNode) ring.parentNode.removeChild(ring);
  }

  function evaluate() {
    reduceMotion = mqReduce.matches;
    var shouldBeActive = mqCapable.matches && mqDesktop.matches;
    if (shouldBeActive === active) return;
    active = shouldBeActive;
    if (active) {
      html.classList.add('has-cursor');
      start();
    } else {
      html.classList.remove('has-cursor');
      stop();
    }
  }

  function addMqListener(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn); /* 구형 브라우저 폴백 */
  }
  addMqListener(mqCapable, evaluate);
  addMqListener(mqDesktop, evaluate);
  addMqListener(mqReduce, evaluate);

  evaluate();
})();
