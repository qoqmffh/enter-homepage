/* 커스텀 커서 — 두꺼운 초록 십자 + 라벨 원 (지시서 2026-11-06: 누를 수 있는 모든 곳에
   라벨 원을 일관되게 적용). static/cursor.css와 짝. (hover:hover) and (pointer:fine) and
   >=1024px에서만 켠다. 십자·라벨 원 모두 보간 없이 매 mousemove마다 커서 좌표에 바로
   translate3d로 붙는다.

   라벨 판단은 mouseover 위임 한 곳(updateHoverState)에서만 closest()로 하고, 결과를
   html 클래스 + labelText.textContent에 저장해 둔다. mousemove(매 프레임)는 그 저장된
   값을 그대로 쓰기만 할 뿐 DOM 탐색을 하지 않는다 — 성능 요구사항(지시서 5). */
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
  var hasLabel = false; /* mousemove가 매 프레임 다시 판단하지 않도록 캐싱 */

  var LABEL_SIZE = 64;
  var LABEL_GAP = 14;

  function onMouseMove(e) {
    var x = e.clientX, y = e.clientY;
    cross.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    if (!hasLabel) return;
    var lx = x + LABEL_GAP, ly = y + LABEL_GAP;
    if (lx + LABEL_SIZE > window.innerWidth) lx = x - LABEL_GAP - LABEL_SIZE;
    if (ly + LABEL_SIZE > window.innerHeight) ly = y - LABEL_GAP - LABEL_SIZE;
    label.style.transform = 'translate3d(' + lx + 'px,' + ly + 'px,0)';
  }

  /* ---------- 라벨 결정: closest()를 위에서부터 순서대로, 처음 맞는 규칙을 쓴다 ----------
     (지시서 2026-11-06 §2) 헤더의 01/02/03 그룹 버튼은 호버만으로 메가 패널이 열리므로
     라벨 없이 십자만 보여준다(예외, 최우선 검사). */
  function determineLabel(target) {
    if (!target || !target.closest) return null;
    if (target.closest('.hp-nav-group')) return null;
    var el;
    if ((el = target.closest('[data-cursor-label]'))) return el.getAttribute('data-cursor-label');
    if (target.closest('a.hp-brand')) return '홈';
    if (target.closest('a[href^="tel:"]')) return '전화 →';
    if (target.closest('[data-cursor-kind="kakao"]')) return '정책 받기';
    if (target.closest('a[href]')) return '이동 →';
    if (target.closest('button, [role="button"], label[for], summary')) return '클릭';
    return null;
  }

  /* 색 톤은 라벨을 준 요소가 아니라 "가장 가까운 data-cursor-tone 조상"에서 따로 상속한다
     — 섹션에 한 번만 붙이면 그 안의 모든 클릭 가능 요소가 같이 상속받는다(지시서 §3). */
  function determineTone(target) {
    if (html.classList.contains('ad-pending')) return 'light'; /* 광고 무대: 헤더까지 포함해 전부 어두운 배경 위 */
    var el = target && target.closest && target.closest('[data-cursor-tone]');
    return el ? el.getAttribute('data-cursor-tone') : null;
  }

  function updateHoverState(target) {
    html.classList.remove('cursor-on-label', 'cursor-on-field', 'cursor-tone-light', 'cursor-tone-green');
    var fieldEl = target && target.closest && target.closest('input, textarea, select, [contenteditable]');
    if (fieldEl) {
      html.classList.add('cursor-on-field');
      hasLabel = false;
      labelText.textContent = '';
      return;
    }
    var text = determineLabel(target);
    if (text) {
      html.classList.add('cursor-on-label');
      var tone = determineTone(target);
      if (tone === 'light') html.classList.add('cursor-tone-light');
      else if (tone === 'green') html.classList.add('cursor-tone-green');
      labelText.textContent = text;
      hasLabel = true;
    } else {
      labelText.textContent = '';
      hasLabel = false;
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
    hasLabel = false;
    html.classList.remove('cursor-on-label', 'cursor-on-field', 'cursor-tone-light', 'cursor-tone-green', 'cursor-outside', 'cursor-clicking');
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

  evaluate();
})();
