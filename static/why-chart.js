/* 왜 ENTER(why.html) — 히어로 아래 4장 막대 그래프. 화면에 들어오면 IntersectionObserver로
   딱 한 번만 --bar-h를 채운다(지시서 2026-11-11). 카드는 4장이 0.08s씩 차례로 시작해서
   각자 0.9s 동안 0 -> 최종 높이로 차오른다(실제 애니메이션은 static/home-poetic.css의
   --bar-h transition이 맡는다 — 여기서는 "언제 채울지"만 정한다). 주황 막대 위 흰 글자는
   막대가 다 찬 뒤(바의 0.9s가 끝난 뒤)에 is-text-in을 붙여 0.2s 페이드인한다 — 차오르는
   중간에 밝은 카드 바탕 위로 흰 글자가 떠 보이지 않게 하려는 것. prefers-reduced-motion이면
   보간 없이 바로 최종 상태로(텍스트도 지연 없이 바로 보임). */
(function () {
  'use strict';
  var container = document.querySelector('[data-chart-container]');
  if (!container) return;
  var cards = Array.prototype.slice.call(container.querySelectorAll('[data-chart-card]'));
  if (!cards.length) return;

  var BAR_DURATION_MS = 900;

  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function revealAll() {
    cards.forEach(function (card) {
      var finalH = (card.getAttribute('data-bar-h') || '0') + '%';
      var isZero = card.classList.contains('sp-chart-card--zero');
      var delay = reduceMotion ? 0 : (parseFloat(card.getAttribute('data-delay')) || 0) * 1000;
      setTimeout(function () {
        card.style.setProperty('--bar-h', finalH);
        card.classList.add('is-in');
      }, delay);
      if (!isZero) {
        var textDelay = reduceMotion ? 0 : delay + BAR_DURATION_MS;
        setTimeout(function () {
          card.classList.add('is-text-in');
        }, textDelay);
      }
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
