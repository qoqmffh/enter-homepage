/* 커스텀 커서 — 평소엔 초록 십자, 누를 수 있는 곳에서는 상황별 아이콘으로 바뀐다
   (지시서 2026-11-08). static/cursor.css와 짝. (hover:hover) and (pointer:fine) and
   >=1024px에서만 켠다. 십자·아이콘 모두 보간 없이 매 mousemove마다 커서 좌표에 바로
   translate3d로 붙는다.

   종류 판단은 mouseover 위임 한 곳(updateHoverState)에서만 closest()로 하고, 결과를
   data-cursor-icon 속성 하나에 저장해 둔다. mousemove(매 프레임)는 좌표만 쓰고 DOM
   탐색을 하지 않는다 — 성능 요구사항. */
(function () {
  'use strict';
  var html = document.documentElement;

  var mqCapable = window.matchMedia('(hover:hover) and (pointer:fine)');
  var mqDesktop = window.matchMedia('(min-width:1024px)');

  /* ---------- 아이콘 SVG — 전부 선 두께 3px, 초록(#1E6F50) + 바깥 흰(#FFFFFA) 테두리.
     흰 테두리는 십자와 같은 원리: 같은 path를 5px 흰 선으로 먼저 깔고, 3px 초록 선을
     그 위에 얹는다(획 2겹). viewBox 24x24. ---------- */
  function svg(paths, linejoin) {
    return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none">' +
      '<g stroke="#FFFFFA" stroke-width="5" stroke-linecap="round" stroke-linejoin="' + linejoin + '">' + paths + '</g>' +
      '<g stroke="#1E6F50" stroke-width="3" stroke-linecap="round" stroke-linejoin="' + linejoin + '">' + paths + '</g>' +
      '</svg>';
  }
  var ICON_SVGS = {
    /* 꼬리 달린 타원형 말풍선(둥근 사각형 아님), 꼬리는 왼쪽 아래 */
    kakao: svg('<ellipse cx="12" cy="10" rx="8" ry="6"/><path d="M7.5 15 4.5 21 11.5 16.3"/>', 'round'),
    /* 옛 전화 수화기 실루엣 */
    phone: svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>', 'round'),
    /* → 이동, 화살촉 각지게 */
    go: svg('<path d="M4 12h16M13 5l7 7-7 7"/>', 'miter'),
    /* ← 넘기기, 화살촉 각지게 */
    swipe: svg('<path d="M20 12H4M11 5l-7 7 7 7"/>', 'miter'),
  };

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

  var icon = document.createElement('div');
  icon.className = 'cursor-icon';
  icon.setAttribute('aria-hidden', 'true');
  var iconShape = document.createElement('div');
  iconShape.className = 'cursor-icon-shape';
  var iconAnim = document.createElement('div');
  iconAnim.className = 'cursor-icon-anim';
  iconShape.appendChild(iconAnim);
  icon.appendChild(iconShape);

  var active = false;
  var started = false;
  var currentType = null; /* null | 'kakao' | 'phone' | 'go' | 'swipe' */

  function onMouseMove(e) {
    var t = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';
    cross.style.transform = t;
    icon.style.transform = t;
  }

  /* ---------- 종류 판단: closest()를 위에서부터 순서대로, 처음 맞는 걸 쓴다 ----------
     (지시서 §2) 헤더의 01/02/03 그룹 버튼은 호버만으로 메가 패널이 열리므로 십자를
     그대로 유지한다(예외, 최우선 검사). */
  function determineType(target) {
    if (!target || !target.closest) return null;
    if (target.closest('.hp-nav-group')) return null;
    if (target.closest('[data-cursor="kakao"]')) return 'kakao';
    if (target.closest('a[href^="tel:"]')) return 'phone';
    if (target.closest('[data-cursor="swipe"]')) return 'swipe';
    if (target.closest('a[href], button, [role="button"], label[for], summary')) return 'go';
    return null;
  }

  function restartEntrance() {
    iconShape.classList.remove('is-entering');
    iconAnim.classList.remove('is-looping');
    void iconShape.offsetWidth; /* 강제 리플로 — 키프레임을 처음부터 다시 돌리기 위함 */
    iconShape.classList.add('is-entering');
  }
  function restartCrossReturn() {
    crossShape.classList.remove('is-returning');
    void crossShape.offsetWidth;
    crossShape.classList.add('is-returning');
  }
  /* 등장(cursorIconIn)이 끝난 뒤에만 반복을 시작한다(지시서: "등장이 끝난 뒤 시작"). */
  iconShape.addEventListener('animationend', function (e) {
    if (e.animationName === 'cursorIconIn' && iconShape.classList.contains('is-entering')) {
      iconAnim.classList.add('is-looping');
    }
  });

  function setType(type) {
    if (type === currentType) return; /* 같은 종류 안에서 옮겨가면 아무것도 다시 안 함 */
    var hadIcon = currentType !== null;
    currentType = type;
    if (type === null) {
      html.removeAttribute('data-cursor-icon');
      iconShape.classList.remove('is-entering');
      iconAnim.classList.remove('is-looping');
      if (hadIcon) restartCrossReturn();
      return;
    }
    crossShape.classList.remove('is-returning');
    iconAnim.innerHTML = ICON_SVGS[type];
    html.setAttribute('data-cursor-icon', type);
    restartEntrance();
  }

  function updateHoverState(target) {
    var fieldEl = target && target.closest && target.closest('input, textarea, select, [contenteditable]');
    html.classList.toggle('cursor-on-field', !!fieldEl);
    if (fieldEl) {
      setType(null);
      return;
    }
    setType(determineType(target));
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
    document.body.appendChild(icon);
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
    currentType = null;
    html.removeAttribute('data-cursor-icon');
    html.classList.remove('cursor-on-field', 'cursor-outside', 'cursor-clicking');
    iconShape.classList.remove('is-entering');
    iconAnim.classList.remove('is-looping');
    crossShape.classList.remove('is-returning');
    if (cross.parentNode) cross.parentNode.removeChild(cross);
    if (icon.parentNode) icon.parentNode.removeChild(icon);
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
