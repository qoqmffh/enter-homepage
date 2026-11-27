/* 메뉴구조 개편 지시서(2026-11-27) §3 — 읽을거리 페이지 왼쪽 목차의 "현재 보고
 * 있는 소제목 강조"를 IntersectionObserver로만 한다(스크롤 핸들러 금지, 지시서 명시).
 * [data-toc-scrollspy] 안의 a[href^="#"]만 대상 — 장 목록(링크가 다른 페이지로
 * 가는 <a>)이나 "관련 글" 목록은 건드리지 않는다. */
(function () {
  'use strict';
  var navs = document.querySelectorAll('[data-toc-scrollspy]');
  if (!navs.length || !('IntersectionObserver' in window)) return;

  navs.forEach(function (nav) {
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    if (!links.length) return;
    var targets = links.map(function (a) {
      return document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    });

    function setActive(id) {
      links.forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('href') === '#' + id);
      });
    }

    var visible = new Set();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });
      // 화면에 걸린 것 중 문서에서 가장 먼저 나오는 소제목을 "현재" 항목으로 삼는다.
      var firstVisible = targets.find(function (t) { return t && visible.has(t.id); });
      if (firstVisible) setActive(firstVisible.id);
    }, { rootMargin: '-96px 0px -70% 0px', threshold: 0 });

    targets.forEach(function (t) { if (t) observer.observe(t); });
  });
})();
