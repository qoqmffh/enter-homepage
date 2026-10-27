/* ENTER 홈 POETIC — 검은 영역(숫자 카드/기능 카드/약속 섹션/통신사 섹션) 커서 추적
   초록빛 번짐. poetic.com 레퍼런스. transform만 사용해 60fps 유지, lerp로 살짝
   늦게 따라오게 한다. 호버 가능 + 포인터 정밀(마우스) + reduced-motion 아님일
   때만 리스너를 건다 — 조건이 안 맞으면 아예 실행 안 되고 .hp-glow는
   opacity:0인 채로 남아(home-poetic.css 기본값) 화면에 아무 영향 없다. */
(function () {
  'use strict';

  if (!window.matchMedia) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var LERP = 0.12;
  var SIZE = 420;
  var HALF = SIZE / 2;

  var hosts = document.querySelectorAll('.hp-glow-host');
  hosts.forEach(function (host) {
    var glow = host.querySelector('.hp-glow');
    if (!glow) return;

    var state = {
      targetX: 0, targetY: 0,
      curX: 0, curY: 0,
      rafId: null,
      fadeTimer: null,
    };

    function tick() {
      state.curX += (state.targetX - state.curX) * LERP;
      state.curY += (state.targetY - state.curY) * LERP;
      glow.style.transform = 'translate3d(' + (state.curX - HALF) + 'px,' + (state.curY - HALF) + 'px,0)';
      state.rafId = requestAnimationFrame(tick);
    }

    function startLoop() {
      if (state.rafId == null) state.rafId = requestAnimationFrame(tick);
    }
    function stopLoop() {
      if (state.rafId != null) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    }

    host.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var rect = host.getBoundingClientRect();
      state.targetX = e.clientX - rect.left;
      state.targetY = e.clientY - rect.top;
    });

    host.addEventListener('pointerenter', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var rect = host.getBoundingClientRect();
      state.targetX = state.curX = e.clientX - rect.left;
      state.targetY = state.curY = e.clientY - rect.top;
      glow.style.transform = 'translate3d(' + (state.curX - HALF) + 'px,' + (state.curY - HALF) + 'px,0)';
      glow.style.opacity = '1';
      if (state.fadeTimer) { clearTimeout(state.fadeTimer); state.fadeTimer = null; }
      startLoop();
    });

    host.addEventListener('pointerleave', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      glow.style.opacity = '0';
      state.fadeTimer = setTimeout(stopLoop, 450);
    });
  });
})();
