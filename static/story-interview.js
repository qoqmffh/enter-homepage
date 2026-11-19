/* 거래처이야기4건_홈추가 지시서(2026-11-19) — 질문 목록 클릭 시 답변 카드 강조.
   stories.html·why.html(#voices)의 .story-interview 컨테이너마다 독립적으로 동작한다.
   카드를 숨기지 않는다(display:none 금지) — 매치는 테두리 주황(.is-match), 나머지는
   opacity .45(.is-dim)만 토글한다. 로컬(이 블록)에 매치가 없으면 "모두 보기" 링크
   (data-story-more)를 대신 강조한다. 같은 질문을 다시 누르면 전부 해제한다. */
(function () {
  'use strict';

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var containers = Array.prototype.slice.call(document.querySelectorAll('.story-interview'));
  containers.forEach(function (container) {
    var items = Array.prototype.slice.call(container.querySelectorAll('[data-q-trigger]'));
    var cards = Array.prototype.slice.call(container.querySelectorAll('.story-answer-card'));
    var moreLink = container.querySelector('[data-story-more]');
    if (!items.length || !cards.length) return;

    function reset() {
      items.forEach(function (it) { it.classList.remove('is-active'); });
      cards.forEach(function (c) { c.classList.remove('is-match', 'is-dim'); });
      if (moreLink) moreLink.classList.remove('is-match');
    }

    function activate(item) {
      var n = item.getAttribute('data-q-trigger');
      items.forEach(function (it) { it.classList.toggle('is-active', it === item); });
      var matched = cards.filter(function (c) {
        return (c.getAttribute('data-questions') || '').split(',').indexOf(n) !== -1;
      });
      cards.forEach(function (c) {
        var isMatch = matched.indexOf(c) !== -1;
        c.classList.toggle('is-match', isMatch);
        c.classList.toggle('is-dim', !isMatch);
      });
      if (moreLink) moreLink.classList.toggle('is-match', matched.length === 0);
      if (matched.length) {
        matched[0].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      }
    }

    items.forEach(function (item) {
      item.addEventListener('click', function () {
        if (item.classList.contains('is-active')) { reset(); return; }
        activate(item);
      });
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
    });
  });
})();
