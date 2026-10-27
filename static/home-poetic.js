/* ENTER 홈 POETIC — 정산 장부 티커의 "화면 밖이면 정지" 보조 스크립트.
   호버 정지/reduced-motion 정지는 CSS만으로 처리됨(home-poetic.css). 이 파일이
   없거나 실패해도 CSS 애니메이션 자체는 계속 정상 작동한다 — 점진적 향상. */
(function () {
  'use strict';
  if (!('IntersectionObserver' in window)) return;
  var viewports = document.querySelectorAll('.hp-ledger-viewport');
  if (!viewports.length) return;

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      entry.target.classList.toggle('hp-ledger-offscreen', !entry.isIntersecting);
    });
  }, { threshold: 0 });

  viewports.forEach(function (el) { io.observe(el); });
})();
