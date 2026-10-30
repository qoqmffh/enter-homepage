/* ENTER 홈 POETIC — 픽셀 잔상(hover trail). poetic.com 레퍼런스.
   검은 영역(.hp-trail-host[data-trail="green"])과 흰 영역
   (.hp-trail-host[data-trail="gray"])에 전부 적용된다. 흰 섹션 안에
   검은 카드(초록 호스트)가 중첩돼 있을 수 있어서(예: 히어로 안 숫자 카드),
   전역 pointermove 하나로 event.target.closest('.hp-trail-host')를 써서
   "가장 안쪽 호스트" 하나만 찾아 그 호스트의 색으로만 칸을 생성한다.
   헤더·버튼·링크 위에서는 생성하지 않는다.

   동작 방식: 시간 간격이나 무작위 선택이 아니라, 커서가 지나간 "격자 칸"을
   그대로 따라간다 — 새 칸에 들어갈 때만 켜고, 빠르게 움직여 칸을 건너뛰면
   Bresenham 직선 보간으로 그 사이 칸도 전부 켜서 끊김이 없다. 한 호스트당
   동시에 최대 5칸만 떠 있고, 6번째가 켜지면 가장 오래된 칸을 즉시 사라지게
   해서(막지 않고) 자연스러운 꼬리를 유지한다.

   호버 가능 + 포인터 정밀(마우스) + reduced-motion 아님일 때만 동작 — 조건이
   안 맞으면 리스너 자체를 안 걸어서 .hp-trail은 항상 빈 채로 남는다. */
(function () {
  'use strict';

  if (!window.matchMedia) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var PITCH = 26;
  var MAX_CELLS = 5;     // 호스트당 동시 최대 — 넘으면 막지 않고 가장 오래된 칸을 바로 없앤다
  var LIFETIME = 260;    // 고정 수명(ms), 랜덤 없음
  var EXIT_DUR = 120;    // 사라질 때 scale 1->0 (ms)
  var COLOR_GREEN = '#1E6F50';
  var COLOR_GRAY = '#E5E5DF';

  var hostStates = new WeakMap();
  var currentHost = null; // 직전 이벤트가 어느 호스트였는지(호스트가 바뀌면 보간을 리셋)

  function getState(host) {
    var state = hostStates.get(host);
    if (!state) {
      state = { layer: host.querySelector('.hp-trail'), cells: new Map(), order: [], lastCell: null };
      hostStates.set(host, state);
    }
    return state;
  }

  function killCell(state, key) {
    var entry = state.cells.get(key);
    if (!entry || entry.killed) return;
    entry.killed = true;
    clearTimeout(entry.timeoutId);
    state.cells.delete(key);
    var idx = state.order.indexOf(key);
    if (idx !== -1) state.order.splice(idx, 1);

    var el = entry.el;
    el.style.animation = 'none';
    el.style.transform = 'scale(1)';
    void el.offsetWidth; // 강제 리플로우 — 위 상태를 브라우저가 확정한 뒤에 트랜지션을 건다
    el.style.transition = 'transform ' + (EXIT_DUR / 1000) + 's ease-in';
    el.style.transform = 'scale(0)';
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, EXIT_DUR + 30);
  }

  function lightCell(host, state, color, ix, iy, maxIx, maxIy) {
    if (!state.layer) return;
    if (ix < 0 || iy < 0 || ix > maxIx || iy > maxIy) return;
    var key = ix + ',' + iy;
    if (state.cells.has(key)) return; // 이미 켜진 칸은 재생성·수명 연장 안 함

    if (state.order.length >= MAX_CELLS) {
      killCell(state, state.order[0]); // 가장 오래된 칸을 즉시 퇴장 — 새 칸은 막지 않는다
    }

    var el = document.createElement('span');
    el.className = 'hp-trail-cell';
    el.style.left = (ix * PITCH) + 'px';
    el.style.top = (iy * PITCH) + 'px';
    el.style.background = color;
    state.layer.appendChild(el);

    var timeoutId = setTimeout(function () { killCell(state, key); }, LIFETIME);
    state.cells.set(key, { el: el, timeoutId: timeoutId, killed: false });
    state.order.push(key);
  }

  // 정수 격자 좌표 사이를 잇는 Bresenham 직선 — (x0,y0)부터 (x1,y1)까지 포함해서
  // 지나가는 모든 칸을 순서대로 돌려준다(빠르게 움직여 칸을 건너뛰어도 빈틈 없이 채움).
  function bresenham(x0, y0, x1, y1) {
    var pts = [];
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    var err = dx + dy;
    var x = x0, y = y0;
    var guard = 0;
    while (true) {
      pts.push([x, y]);
      if (x === x1 && y === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
      if (++guard > 500) break; // 안전장치(비정상적으로 먼 점프 방지)
    }
    return pts;
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
    if (e.target.closest && e.target.closest('a, button, .hp-header, input, label')) {
      currentHost = null;
      return;
    }

    var host = e.target.closest ? e.target.closest('.hp-trail-host') : null;
    if (!host) { currentHost = null; return; }

    var color = host.getAttribute('data-trail') === 'gray' ? COLOR_GRAY : COLOR_GREEN;
    var state = getState(host);
    var rect = host.getBoundingClientRect();
    var maxIx = Math.floor(rect.width / PITCH);
    var maxIy = Math.floor(rect.height / PITCH);
    var cx = Math.floor((e.clientX - rect.left) / PITCH);
    var cy = Math.floor((e.clientY - rect.top) / PITCH);

    if (host !== currentHost) {
      // 다른 호스트(또는 호스트 바깥)에서 막 들어옴 — 직전 위치와 보간하지 않고 이 칸만 켠다
      state.lastCell = null;
      currentHost = host;
    }

    if (state.lastCell && state.lastCell[0] === cx && state.lastCell[1] === cy) {
      return; // 같은 칸 안에서는 아무것도 안 함
    }

    var path = state.lastCell ? bresenham(state.lastCell[0], state.lastCell[1], cx, cy) : [[cx, cy]];
    if (state.lastCell) path.shift(); // 시작 칸은 이전 프레임에서 이미 켰으므로 제외
    state.lastCell = [cx, cy];

    for (var i = 0; i < path.length; i++) {
      lightCell(host, state, color, path[i][0], path[i][1], maxIx, maxIy);
    }
  }

  document.addEventListener('pointermove', onMove);
})();
