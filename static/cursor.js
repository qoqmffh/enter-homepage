/* 커스텀 커서 — 두꺼운 초록 십자 + 라벨 원 (지시서 2026-11-05: 추적 링 제거).
   static/cursor.css와 짝. (hover:hover) and (pointer:fine) and >=1024px에서만 켠다.
   십자·라벨 원 모두 보간 없이 매 mousemove마다 커서 좌표에 바로 translate3d로 붙는다 —
   더 이상 rAF 루프가 필요 없다(이전의 추적 링 보간 로직은 전부 제거). */
(function () {
  'use strict';
  var html = document.documentElement;

  var mqCapable = window.matchMedia('(hover:hover) and (pointer:fine)');
  var mqDesktop = window.matchMedia('(min-width:1024px)');

  var cross = document.createElement('div');
  cross.className = 'cursor-cross';
  cross.setAttribute('aria-hidden', 'true');
  var crossShape = document.createElement('div');
  crossShape.className = 'cursor-cross-shape';
  var crossOutline = document.createElement('div');
  crossOutline.className = 'cursor-cross-outline';
  var crossFill = document.createElement('div');
  crossFill.className = 'cursor-cross-fill';
  crossShape.appendChild(crossOutline);
  crossShape.appendChild(crossFill);
  cross.appendChild(crossShape);

  var label = document.createElement('div');
  label.className = 'cursor-label';
  label.setAttribute('aria-hidden', 'true');
  var labelShape = document.createElement('div');
  labelShape.className = 'cursor-label-shape';
  var labelText = document.createElement('span');
  labelText.className = 'cursor-label-text';
  labelShape.appendChild(labelText);
  label.appendChild(labelShape);

  var active = false;
  var started = false;

  function setPositions(x, y) {
    var t = 'translate3d(' + x + 'px,' + y + 'px,0)';
    cross.style.transform = t;
    label.style.transform = t;
  }

  function onMouseMove(e) { setPositions(e.clientX, e.clientY); }

  function updateHoverState(target) {
    html.classList.remove('cursor-on-label', 'cursor-on-link', 'cursor-on-field', 'cursor-tone-light', 'cursor-tone-green');
    var fieldEl = target && target.closest && target.closest('input, textarea, select, [contenteditable]');
    var labelEl = target && target.closest && target.closest('[data-cursor-label]');
    var linkEl = target && target.closest && target.closest('a, button, [role="button"]');
    if (fieldEl) {
      html.classList.add('cursor-on-field');
      labelText.textContent = '';
    } else if (labelEl) {
      html.classList.add('cursor-on-label');
      var tone = labelEl.getAttribute('data-cursor-tone');
      if (tone === 'light') html.classList.add('cursor-tone-light');
      else if (tone === 'green') html.classList.add('cursor-tone-green');
      labelText.textContent = labelEl.getAttribute('data-cursor-label') || '';
    } else {
      labelText.textContent = '';
      if (linkEl) html.classList.add('cursor-on-link');
    }
  }

  function onMouseOver(e) { updateHoverState(e.target); }
  function onWindowEnter() { html.classList.remove('cursor-outside'); }
  function onWindowLeave() { html.classList.add('cursor-outside'); }
  function onMouseDown() { html.classList.add('cursor-clicking'); }
  function onMouseUp() { html.classList.remove('cursor-clicking'); }

  function start() {
    if (started) return;
    started = true;
    document.body.appendChild(cross);
    document.body.appendChild(label);
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
    html.classList.remove('cursor-on-label', 'cursor-on-link', 'cursor-on-field', 'cursor-tone-light', 'cursor-tone-green', 'cursor-outside', 'cursor-clicking');
    if (cross.parentNode) cross.parentNode.removeChild(cross);
    if (label.parentNode) label.parentNode.removeChild(label);
  }

  function evaluate() {
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
  /* prefers-reduced-motion은 더 이상 JS 분기가 필요 없다 — 회전 트랜지션을 끄는 일은
     cursor.css의 @media (prefers-reduced-motion:reduce)가 전담한다. */

  evaluate();
})();
