/* 커스텀 커서 — 두꺼운 초록 십자 + 라벨 원 (지시서 2026-11-07: 라벨 원이 십자 자리를
   그대로 대신하게). static/cursor.css와 짝. (hover:hover) and (pointer:fine) and
   >=1024px에서만 켠다. 십자·라벨 원 모두 보간 없이 매 mousemove마다 커서 좌표에 바로
   translate3d로 붙는다 — 라벨 원이 뜨면 십자는 숨고(opacity, CSS) 원 중심이 곧 클릭 지점.

   라벨 판단은 mouseover 위임 한 곳(updateHoverState)에서만 closest()로 하고, 결과를
   html 클래스 + labelText.textContent에 저장해 둔다. mousemove(매 프레임)는 그 값을
   그대로 쓰기만 할 뿐 DOM 탐색을 하지 않는다 — 성능 요구사항. */
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

  /* 라벨 원이 이제 커서 자리를 그대로 대신하므로(지시서 2026-11-07) 십자와 똑같은
     translate3d를 그대로 쓴다 — 뷰포트 가장자리 반전 계산은 더 이상 필요 없다. */
  function onMouseMove(e) {
    var t = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';
    cross.style.transform = t;
    label.style.transform = t;
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
    } else {
      labelText.textContent = '';
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
