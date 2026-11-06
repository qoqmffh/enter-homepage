/* 왜 ENTER(why.html) — 히어로 아래 4장 막대 그래프. 화면에 들어오면 IntersectionObserver로
   딱 한 번만 --bar-h를 채운다(지시서 2026-11-11). 카드는 4장이 0.08s씩 차례로 시작해서
   각자 0.9s 동안 0 -> 최종 높이로 차오른다(실제 애니메이션은 static/home-poetic.css의
   --bar-h transition이 맡는다 — 여기서는 "언제 채울지"만 정한다). 주황 막대 위 흰 글자는
   막대가 다 찬 뒤(바의 0.9s가 끝난 뒤)에 is-text-in을 붙여 0.2s 페이드인한다 — 차오르는
   중간에 밝은 카드 바탕 위로 흰 글자가 떠 보이지 않게 하려는 것. prefers-reduced-motion이면
   보간 없이 바로 최종 상태로(텍스트도 지연 없이 바로 보임).

   숫자 카운트업(지시서 2026-11-12) — 이 카드의 값(4,000건 등)은 static/reveal.js의 자동
   관찰 대상이 아니라 data-count-manual로 빠져 있다(0회 카드는 애초에 data-count가 없다).
   막대가 차오르기 시작하는 바로 그 순간(delay) window.ENTER_REVEAL.startCount를 직접 불러
   "막대 차오름과 같은 타이밍"으로 맞춘다 — 숫자가 다 세어지는 시점(1.2s)이 바의 끝(0.9s)과
   정확히 같을 필요는 없고, 같이 시작하기만 하면 된다. */
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
      var delaySec = parseFloat(card.getAttribute('data-delay')) || 0;
      var delay = reduceMotion ? 0 : delaySec * 1000;
      setTimeout(function () {
        card.style.setProperty('--bar-h', finalH);
        card.classList.add('is-in');
        var valueEl = card.querySelector('[data-count]');
        // 바깥 setTimeout(delay)이 이미 "막대가 차오르기 시작할 시점"까지 기다렸으므로
        // 여기서는 추가 지연 없이(0) 바로 센다 — delaySec을 또 넘기면 두 배로 밀린다.
        if (valueEl && window.ENTER_REVEAL) window.ENTER_REVEAL.startCount(valueEl, 0);
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
