/* ENTER 홈 POETIC — 검은 영역(숫자 카드/기능 카드/약속 섹션/통신사 섹션/
   statement 사진 블록) 픽셀 잔상(hover trail). poetic.com 실제 구현 분석값을
   그대로 따른다: 26px 격자(20x20 네모 + 6px 틈), 커서 칸 기준 ±2칸에서 매
   mousemove(rAF로 묶음)마다 무작위 2칸 점등, 등장만 0.16s 스프링, 수명
   300~600ms 후 페이드 없이 바로 제거, 동시 최대 40개, 같은 칸 중복 생성 금지.
   호버 가능 + 포인터 정밀(마우스) + reduced-motion 아님일 때만 동작 — 조건이
   안 맞으면 아예 리스너를 안 걸어서 평소엔 빈 레이어로 아무 영향 없다. */
(function () {
  'use strict';

  if (!window.matchMedia) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var PITCH = 26;
  var CELL = 20;
  var MAX_CELLS = 40;
  var NEIGHBORHOOD = 2; // ±2칸

  var hosts = document.querySelectorAll('.hp-trail-host');
  hosts.forEach(function (host) {
    var layer = host.querySelector('.hp-trail');
    if (!layer) return;

    var active = new Map(); // key "ix,iy" -> element
    var pendingX = 0, pendingY = 0, pending = false, rafId = null;

    function cellKey(ix, iy) { return ix + ',' + iy; }

    function spawnCell(ix, iy, maxIx, maxIy) {
      if (ix < 0 || iy < 0 || ix > maxIx || iy > maxIy) return;
      var key = cellKey(ix, iy);
      if (active.has(key)) return;
      if (active.size >= MAX_CELLS) return;

      var el = document.createElement('span');
      el.className = 'hp-trail-cell';
      el.style.left = (ix * PITCH) + 'px';
      el.style.top = (iy * PITCH) + 'px';
      layer.appendChild(el);
      active.set(key, el);

      var life = 300 + Math.random() * 300;
      setTimeout(function () {
        active.delete(key);
        if (el.parentNode) el.parentNode.removeChild(el);
      }, life);
    }

    function processMove() {
      pending = false;
      rafId = null;

      var rect = host.getBoundingClientRect();
      var maxIx = Math.floor(rect.width / PITCH);
      var maxIy = Math.floor(rect.height / PITCH);
      var cx = Math.floor(pendingX / PITCH);
      var cy = Math.floor(pendingY / PITCH);

      // ±2칸 범위(5x5=25칸) 후보를 만들고 그중 서로 다른 2칸을 무작위로 고른다
      var candidates = [];
      for (var dx = -NEIGHBORHOOD; dx <= NEIGHBORHOOD; dx++) {
        for (var dy = -NEIGHBORHOOD; dy <= NEIGHBORHOOD; dy++) {
          candidates.push([cx + dx, cy + dy]);
        }
      }
      // Fisher-Yates 일부만 섞어 앞 2개만 쓴다
      for (var i = candidates.length - 1; i > 0 && i > candidates.length - 3; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = candidates[i]; candidates[i] = candidates[j]; candidates[j] = t;
      }
      var picks = candidates.slice(candidates.length - 2);
      picks.forEach(function (p) { spawnCell(p[0], p[1], maxIx, maxIy); });
    }

    host.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var rect = host.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      pendingY = e.clientY - rect.top;
      if (!pending) {
        pending = true;
        rafId = requestAnimationFrame(processMove);
      }
    });

    host.addEventListener('pointerleave', function () {
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; pending = false; }
    });
  });
})();
