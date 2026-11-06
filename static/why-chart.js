/* 왜 ENTER(why.html) — 히어로 아래 4장 막대 그래프. 화면에 들어오면 IntersectionObserver로
   딱 한 번만 --bar-h를 채운다(지시서 2026-11-10). 카드는 4장이 0.08s씩 차례로 시작해서
   각자 0.9s 동안 0 -> 최종 높이로 차오른다(실제 애니메이션은 static/home-poetic.css의
   --bar-h transition이 맡는다 — 여기서는 "언제 채울지"만 정한다). prefers-reduced-motion이면
   보간 없이 바로 최종 상태로. */
(function () {
  'use strict';
  var container = document.querySelector('[data-chart-container]');
  if (!container) return;
  var cards = Array.prototype.slice.call(container.querySelectorAll('[data-chart-card]'));
  if (!cards.length) return;

  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function revealAll() {
    cards.forEach(function (card) {
      var finalH = (card.getAttribute('data-bar-h') || '0') + '%';
      var delay = reduceMotion ? 0 : (parseFloat(card.getAttribute('data-delay')) || 0) * 1000;
      setTimeout(function () {
        card.style.setProperty('--bar-h', finalH);
        card.classList.add('is-in');
      }, delay);
    });
  }

  if (!('IntersectionObserver' in window)) { revealAll(); return; }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        revealAll();
        observer.disconnect();
      }
    });
  }, { threshold: 0.3 });
  observer.observe(container);
})();
