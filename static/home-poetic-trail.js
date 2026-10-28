/* ENTER 홈 POETIC — 픽셀 잔상(hover trail). poetic.com 레퍼런스.
   검은 영역(.hp-trail-host[data-trail="green"])과 흰 영역
   (.hp-trail-host[data-trail="gray"])에 전부 적용된다. 흰 섹션 안에
   검은 카드(초록 호스트)가 중첩돼 있을 수 있어서(예: 히어로 안 숫자 카드),
   전역 pointermove 하나로 event.target.closest('.hp-trail-host')를 써서
   "가장 안쪽 호스트" 하나만 찾아 그 호스트의 색으로만 칸을 생성한다 —
   같은 지점에서 두 호스트가 동시에 반응하는 일이 없다.
   헤더·버튼·링크 위에서는 생성하지 않는다.
   호버 가능 + 포인터 정밀(마우스) + reduced-motion 아님일 때만 동작 — 조건이
   안 맞으면 리스너 자체를 안 걸어서 .hp-trail은 항상 빈 채로 남는다. */
(function () {
  'use strict';

  if (!window.matchMedia) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var PITCH = 26;
  var CELL_PER_MOVE = 1; // 1차 수정: mousemove당 2개 -> 1개
  var MAX_CELLS = 4;     // 2차 수정: 마우스가 지나갈 때 동시에 3~4개 정도만 보이게
  var NEIGHBORHOOD = 1; // 커서 중심 반경 절반으로(±2칸 -> ±1칸)
  var COLOR_GREEN = '#1E6F50';
  var COLOR_GRAY = '#E5E5DF';

  var hostStates = new WeakMap();

  function getState(host) {
    var state = hostStates.get(host);
    if (!state) {
      state = { active: new Map(), layer: host.querySelector('.hp-trail') };
      hostStates.set(host, state);
    }
    return state;
  }

  function spawnCell(host, state, color, ix, iy, maxIx, maxIy) {
    if (!state.layer) return;
    if (ix < 0 || iy < 0 || ix > maxIx || iy > maxIy) return;
    var key = ix + ',' + iy;
    if (state.active.has(key)) return;
    if (state.active.size >= MAX_CELLS) return;

    var el = document.createElement('span');
    el.className = 'hp-trail-cell';
    el.style.left = (ix * PITCH) + 'px';
    el.style.top = (iy * PITCH) + 'px';
    el.style.background = color;
    state.layer.appendChild(el);
    state.active.set(key, el);

    var life = 300 + Math.random() * 300;
    setTimeout(function () {
      state.active.delete(key);
      if (el.parentNode) el.parentNode.removeChild(el);
    }, life);
  }

  var pending = null;
  var rafId = null;

  function onMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    pending = e;
    if (rafId == null) rafId = requestAnimationFrame(process);
  }

  function process() {
    rafId = null;
    var e = pending;
    if (!e) return;

    // 헤더·버튼·링크 위에서는 잔상 생성 안 함
    if (e.target.closest && e.target.closest('a, button, .hp-header, input, label')) return;

    var host = e.target.closest ? e.target.closest('.hp-trail-host') : null;
    if (!host) return;

    var color = host.getAttribute('data-trail') === 'gray' ? COLOR_GRAY : COLOR_GREEN;
    var state = getState(host);
    var rect = host.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var maxIx = Math.floor(rect.width / PITCH);
    var maxIy = Math.floor(rect.height / PITCH);
    var cx = Math.floor(x / PITCH);
    var cy = Math.floor(y / PITCH);

    // ±2칸(5x5=25칸) 후보 중 CELL_PER_MOVE개를 무작위로 뽑는다
    var candidates = [];
    for (var dx = -NEIGHBORHOOD; dx <= NEIGHBORHOOD; dx++) {
      for (var dy = -NEIGHBORHOOD; dy <= NEIGHBORHOOD; dy++) {
        candidates.push([cx + dx, cy + dy]);
      }
    }
    for (var i = candidates.length - 1; i > 0 && i > candidates.length - 1 - CELL_PER_MOVE; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = candidates[i]; candidates[i] = candidates[j]; candidates[j] = t;
    }
    var picks = candidates.slice(candidates.length - CELL_PER_MOVE);
    picks.forEach(function (p) { spawnCell(host, state, color, p[0], p[1], maxIx, maxIy); });
  }

  document.addEventListener('pointermove', onMove);
})();
